import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Unlock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

import { logger } from "@/lib/logger";
interface ReouvrirReunionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reunionId: string;
  reunionData: { sujet?: string; date_reunion: string };
  onSuccess?: () => void;
}

export default function ReouvrirReunionModal({
  open,
  onOpenChange,
  reunionId,
  reunionData,
  onSuccess,
}: ReouvrirReunionModalProps) {
  const [supprimerSanctions, setSupprimerSanctions] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const handleReouvrir = async () => {
    setProcessing(true);
    try {
      // 1. Mettre à jour le statut de la réunion
      const { error: updateError } = await supabase
        .from("reunions")
        .update({ 
          statut: "en_cours",
          taux_presence: null // Reset du taux
        })
        .eq("id", reunionId);

      if (updateError) throw updateError;

      // 2. Déverrouiller les cotisations liées à cette réunion
      await supabase
        .from("cotisations")
        .update({ verrouille: false } as Record<string, unknown>)
        .eq("reunion_id", reunionId);

      // 3. Supprimer les opérations caisse auto-générées liées à cette réunion
      // (elles seront recréées lors de la prochaine clôture)
      const { error: caisseError } = await supabase
        .from("fond_caisse_operations")
        .delete()
        .eq("reunion_id", reunionId);

      if (caisseError) {
        logger.warn("Erreur suppression opérations caisse:", caisseError);
        // On continue quand même car ce n'est pas bloquant
      }

      // 3. Logger l'action dans audit_logs
      await supabase.from("audit_logs").insert({
        action: "REUNION_REOUVERTURE",
        table_name: "reunions",
        record_id: reunionId,
        user_id: user?.id || null,
        old_data: { statut: "terminee" },
        new_data: { 
          statut: "en_cours", 
          sanctions_supprimees: supprimerSanctions,
          date_reunion: reunionData.date_reunion,
          sujet: reunionData.sujet
        }
      });

      // 4. Supprimer les sanctions auto-générées (absence + huile_savon) si demandé
      // B2 — On filtre par type_sanction (valeurs stables) plutôt que par motif texte
      // qui pouvait diverger entre cloture ("Absence non excusée à la réunion") et
      // la suppression (anciens libellés). On préserve les sanctions déjà payées.
      if (supprimerSanctions) {
        const { error: sanctionsError } = await supabase
          .from("reunions_sanctions")
          .delete()
          .eq("reunion_id", reunionId)
          .in("type_sanction", ["absence", "huile_savon"])
          .eq("statut", "impaye");

        if (sanctionsError) {
          logger.error("Erreur suppression sanctions:", sanctionsError);
        }
      }

      // 5. Invalider TOUS les caches liés à cette réunion (FIX CRITIQUE)
      queryClient.invalidateQueries({ queryKey: ["reunions"] });
      queryClient.invalidateQueries({ queryKey: ["presences"] });
      queryClient.invalidateQueries({ queryKey: ["reunions-sanctions"] });
      queryClient.invalidateQueries({ queryKey: ["cotisations-reunion-grid", reunionId] });
      queryClient.invalidateQueries({ queryKey: ["huile-savon-reunion", reunionId] });
      queryClient.invalidateQueries({ queryKey: ["reunions-presences", reunionId] });
      queryClient.invalidateQueries({ queryKey: ["reunion-presences-cloture", reunionId] });
      queryClient.invalidateQueries({ queryKey: ["reunion-beneficiaires", reunionId] });
      queryClient.invalidateQueries({ queryKey: ["reunion-beneficiaires-details", reunionId] });
      queryClient.invalidateQueries({ queryKey: ["cotisations-reunion", reunionId] });
      queryClient.invalidateQueries({ queryKey: ["cotisations"] });
      queryClient.invalidateQueries({ queryKey: ["epargnes"] });

      toast({
        title: "Réunion rouverte",
        description: `La réunion du ${new Date(reunionData.date_reunion).toLocaleDateString('fr-FR')} est maintenant modifiable.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      logger.error("Erreur réouverture:", error);
      toast({
        title: "Erreur",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-warning" />
            Rouvrir la réunion
          </DialogTitle>
          <DialogDescription>
            Réunion du {new Date(reunionData.date_reunion).toLocaleDateString('fr-FR')}
            {reunionData.sujet && ` - ${reunionData.sujet}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Avertissement */}
          <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning">Attention</p>
              <p className="text-muted-foreground mt-1">
                Cette action rouvrira la réunion pour permettre les modifications. 
                Le taux de présence sera recalculé lors de la prochaine clôture.
              </p>
            </div>
          </div>

          {/* Option suppression sanctions */}
          <div className="flex items-start space-x-3 p-3 border rounded-lg">
            <Checkbox
              id="supprimer-sanctions"
              checked={supprimerSanctions}
              onCheckedChange={(checked) => setSupprimerSanctions(checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="supprimer-sanctions" className="font-medium cursor-pointer">
                Supprimer les sanctions automatiques
              </Label>
              <p className="text-xs text-muted-foreground">
                Supprime les sanctions créées lors de la clôture (absences, huile & savon)
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Annuler
          </Button>
          <Button 
            onClick={handleReouvrir} 
            disabled={processing}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Réouverture...
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4 mr-2" />
                Rouvrir la réunion
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
