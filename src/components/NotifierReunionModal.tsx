import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, Users, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

import { logger } from "@/lib/logger";
interface NotifierReunionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reunionId: string;
  reunionData: { sujet?: string; date_reunion: string; ordre_du_jour?: string; lieu_description?: string };
}

type RecipientType = "tous" | "presents" | "absents" | "manuel";

export default function NotifierReunionModal({
  open,
  onOpenChange,
  reunionId,
  reunionData,
}: NotifierReunionModalProps) {
  const [sending, setSending] = useState(false);
  const [recipientType, setRecipientType] = useState<RecipientType>("presents");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Récupérer les membres présents
  const { data: presences } = useQuery({
    queryKey: ["presences-notifier", reunionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reunions_presences")
        .select(`
          id,
          statut_presence,
          heure_arrivee,
          membre:membres(id, nom, prenom, email)
        `)
        .eq("reunion_id", reunionId);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Récupérer les comptes-rendus
  const { data: comptesRendus } = useQuery({
    queryKey: ["comptes-rendus-notifier", reunionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rapports_seances")
        .select("id, sujet, resolution, description")
        .eq("reunion_id", reunionId)
        .order("numero_ordre", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Calculer les statistiques
  //
  // Task 20 — Phase 3-e Fix 3 :
  // La contrainte CHECK `check_statut_presence` (migration
  // `20251201190431_6346104b`) autorise UNIQUEMENT les valeurs :
  //   'present' | 'absent_non_excuse' | 'absent_excuse'
  // L'ancien filtre `=== "excuse"` ne matchait donc JAMAIS — les membres
  // excusés n'apparaissaient ni dans les stats ni dans les destinataires
  // "Absents/Excusés". Corrigé en `"absent_excuse"` partout (cohérent avec
  // `ReunionPresencesManager` qui utilise déjà la bonne valeur).
  const presents = presences?.filter(p => p.statut_presence === "present") || [];
  const excuses = presences?.filter(p => p.statut_presence === "absent_excuse") || [];
  const absents = presences?.filter(p => p.statut_presence === "absent_non_excuse") || [];
  const retards = presences?.filter(p => p.heure_arrivee) || [];

  // Calculer les destinataires selon le type sélectionné
  const destinataires = useMemo(() => {
    if (!presences) return [];
    
    let filtered = presences;
    
    if (recipientType === "presents") {
      filtered = presences.filter(p => p.statut_presence === "present");
    } else if (recipientType === "absents") {
      // Task 20 — Phase 3-e Fix 3 : 'excuse' → 'absent_excuse' (valeur réelle
      // du CHECK constraint `check_statut_presence`).
      filtered = presences.filter(p => 
        p.statut_presence === "absent_non_excuse" || p.statut_presence === "absent_excuse"
      );
    } else if (recipientType === "manuel") {
      filtered = presences.filter(p => selectedMembers.has(p.membre?.id || ""));
    }
    // "tous" = pas de filtre
    
    return filtered
      .filter(p => p.membre?.email)
      .map(p => ({
        email: p.membre!.email!,
        nom: p.membre!.nom,
        prenom: p.membre!.prenom,
      }));
  }, [presences, recipientType, selectedMembers]);

  // Membres avec email pour sélection manuelle
  const membresAvecEmail = presences?.filter(p => p.membre?.email) || [];

  const tauxPresence = presences && presences.length > 0 
    ? Math.round((presents.length / presences.length) * 100) 
    : 0;

  const handleToggleMember = (membreId: string) => {
    const newSet = new Set(selectedMembers);
    if (newSet.has(membreId)) {
      newSet.delete(membreId);
    } else {
      newSet.add(membreId);
    }
    setSelectedMembers(newSet);
  };

  const handleSelectAll = () => {
    const allIds = membresAvecEmail.map(p => p.membre?.id || "").filter(Boolean);
    setSelectedMembers(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedMembers(new Set());
  };

  const handleSendNotification = async () => {
    if (destinataires.length === 0) {
      toast({
        title: "Aucun destinataire",
        description: "Aucun membre correspondant aux critères avec email",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      // Construire le contenu du CR
      const contenu = comptesRendus?.map(cr => {
        const content = cr.resolution || cr.description || "Pas de détails";
        return `## ${cr.sujet}\n${content}`;
      }).join("\n\n") || "Aucun compte-rendu disponible.";

      const presenceInfo = {
        presents: presents.map(p => `${p.membre?.prenom} ${p.membre?.nom}`),
        excuses: excuses.map(p => `${p.membre?.prenom} ${p.membre?.nom}`),
        absentsNonExcuses: absents.map(p => `${p.membre?.prenom} ${p.membre?.nom}`),
        retards: retards.map(p => `${p.membre?.prenom} ${p.membre?.nom}`),
        tauxPresence,
      };

      const { data, error } = await supabase.functions.invoke("send-reunion-cr", {
        body: {
          reunionId,
          destinataires,
          sujet: `[APERÇU] ${reunionData.ordre_du_jour || "Réunion E2D"}`,
          contenu,
          dateReunion: new Date(reunionData.date_reunion).toLocaleDateString("fr-FR"),
          lieu: reunionData.lieu_description,
          presences: presenceInfo,
          isPreview: true,
        },
      });

      if (error) {
        const errorMessage = data?.error || error.message;
        throw new Error(errorMessage);
      }
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Notification envoyée",
        description: `${data.sentCount} email(s) envoyé(s) (aperçu, sans clôture)`,
      });

      onOpenChange(false);
    } catch (error: unknown) {
      logger.error("Erreur envoi notification:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'envoyer la notification",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Notifier sans clôturer
          </DialogTitle>
          <DialogDescription>
            Envoyer un compte-rendu préliminaire aux membres sélectionnés
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Infos réunion */}
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm space-y-1">
                <p><strong>Date :</strong> {new Date(reunionData.date_reunion).toLocaleDateString("fr-FR")}</p>
                <p><strong>Sujet :</strong> {reunionData.ordre_du_jour || "Non défini"}</p>
                {reunionData.lieu_description && (
                  <p><strong>Lieu :</strong> {reunionData.lieu_description}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statistiques présences */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 bg-success/10 rounded-lg">
              <p className="text-lg font-bold text-success">{presents.length}</p>
              <p className="text-xs text-muted-foreground">Présents</p>
            </div>
            <div className="text-center p-2 bg-secondary/10 rounded-lg">
              <p className="text-lg font-bold text-secondary">{excuses.length}</p>
              <p className="text-xs text-muted-foreground">Excusés</p>
            </div>
            <div className="text-center p-2 bg-destructive/10 rounded-lg">
              <p className="text-lg font-bold text-destructive">{absents.length}</p>
              <p className="text-xs text-muted-foreground">Absents</p>
            </div>
            <div className="text-center p-2 bg-primary/10 rounded-lg">
              <p className="text-lg font-bold text-primary">{tauxPresence}%</p>
              <p className="text-xs text-muted-foreground">Taux</p>
            </div>
          </div>

          {/* Points de CR */}
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{comptesRendus?.length || 0} point(s) de compte-rendu</span>
          </div>

          {/* Sélection type de destinataires */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Destinataires</Label>
            <RadioGroup 
              value={recipientType} 
              onValueChange={(v) => setRecipientType(v as RecipientType)}
              className="grid grid-cols-2 gap-2"
            >
              <div className="flex items-center space-x-2 border rounded-lg p-2">
                <RadioGroupItem value="tous" id="tous" />
                <Label htmlFor="tous" className="font-normal text-sm cursor-pointer">
                  Tous ({membresAvecEmail.length})
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-2">
                <RadioGroupItem value="presents" id="presents" />
                <Label htmlFor="presents" className="font-normal text-sm cursor-pointer">
                  Présents ({presents.filter(p => p.membre?.email).length})
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-2">
                <RadioGroupItem value="absents" id="absents" />
                <Label htmlFor="absents" className="font-normal text-sm cursor-pointer">
                  Absents/Excusés ({[...excuses, ...absents].filter(p => p.membre?.email).length})
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-2">
                <RadioGroupItem value="manuel" id="manuel" />
                <Label htmlFor="manuel" className="font-normal text-sm cursor-pointer">
                  Sélection manuelle
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Sélection manuelle */}
          {recipientType === "manuel" && (
            <div className="space-y-2">
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  Tout sélectionner
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
                  Tout désélectionner
                </Button>
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                {membresAvecEmail.map((p) => (
                  <div key={p.id} className="flex items-center space-x-2 hover:bg-muted/50 rounded p-1">
                    <Checkbox 
                      id={p.id}
                      checked={selectedMembers.has(p.membre?.id || "")}
                      onCheckedChange={() => handleToggleMember(p.membre?.id || "")}
                    />
                    <Label htmlFor={p.id} className="font-normal text-sm cursor-pointer flex-1">
                      {p.membre?.prenom} {p.membre?.nom}
                      <span className="text-xs text-muted-foreground ml-2">
                        {/* Task 20 — Phase 3-e Fix 3 : label 'excuse' → 'absent_excuse' */}
                        ({p.statut_presence === "present" ? "présent" : 
                          p.statut_presence === "absent_excuse" ? "excusé" : 
                          p.statut_presence === "absent_non_excuse" ? "absent" : "—"})
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affichage des destinataires */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              <span>Destinataires sélectionnés ({destinataires.length})</span>
            </div>
            {destinataires.length > 0 ? (
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {destinataires.map((d, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {d.prenom} {d.nom}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>Aucun destinataire sélectionné avec email</span>
              </div>
            )}
          </div>

          {/* Avertissement */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Note :</strong> Cette notification est un aperçu. L'email portera la mention [APERÇU] 
            et la réunion restera modifiable. Pour finaliser, utilisez la fonction "Clôturer".
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annuler
          </Button>
          <Button 
            onClick={handleSendNotification} 
            disabled={sending || destinataires.length === 0}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Envoyer l'aperçu
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
