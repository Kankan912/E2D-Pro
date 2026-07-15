import { Bell, Plus, Send, Loader2, Zap, AlertTriangle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BackButton from "@/components/BackButton";
import NotificationCampagneForm from "@/components/forms/NotificationCampagneForm";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

interface NotificationsAdminProps {
  embedded?: boolean;
}

// Définition des déclencheurs automatiques disponibles
const TRIGGERS_CONFIG = [
  { id: 'reunion_created', label: 'Nouvelle réunion créée', description: 'Notifier tous les membres de la création d\'une réunion' },
  { id: 'sanction_applied', label: 'Sanction appliquée', description: 'Notifier le membre concerné d\'une sanction' },
  { id: 'pret_approved', label: 'Prêt accordé', description: 'Notifier l\'emprunteur de l\'approbation de son prêt' },
  { id: 'pret_echeance', label: 'Échéance prêt proche', description: 'Rappel automatique avant échéance' },
  { id: 'cotisation_reminder', label: 'Rappel cotisation', description: 'Rappel pour les cotisations en retard' },
  { id: 'aide_allocated', label: 'Aide allouée', description: 'Notifier le bénéficiaire d\'une aide' },
];

export default function NotificationsAdmin({ embedded = false }: NotificationsAdminProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { hasPermission, enforcePermission } = usePermissions();

  const canCreate = hasPermission('notifications', 'create');
  const canSend = hasPermission('notifications', 'update');

  const { data: currentMembre } = useQuery({
    queryKey: ['current-membre', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('membres')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: campagnes, isLoading, isError, error: campagnesError } = useQuery({
    queryKey: ["notifications-campagnes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications_campagnes")
        .select(`
          *,
          createur:membres!fk_notifications_campagnes_created_by(nom, prenom)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch envois détaillés pour traçabilité
  const { data: envoisStats } = useQuery({
    queryKey: ["notifications-envois-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications_envois")
        .select("campagne_id, statut");
      if (error) throw error;
      // Agréger par campagne
      const stats: Record<string, { envoyes: number; echecs: number; en_attente: number }> = {};
      data?.forEach((e) => {
        if (!stats[e.campagne_id]) stats[e.campagne_id] = { envoyes: 0, echecs: 0, en_attente: 0 };
        if (e.statut === "sent" || e.statut === "envoye") stats[e.campagne_id].envoyes++;
        else if (e.statut === "failed" || e.statut === "echec") stats[e.campagne_id].echecs++;
        else stats[e.campagne_id].en_attente++;
      });
      return stats;
    },
  });

  // Fetch templates pour les déclencheurs
  const { data: templates } = useQuery({
    queryKey: ["notifications-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications_templates")
        .select("id, nom")
        .eq("actif", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  // Fetch triggers config
  const { data: triggersConfig } = useQuery({
    queryKey: ["notifications-triggers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configurations').select('cle, valeur, description, created_at, updated_at')
        .like("cle", "trigger_%");
      if (error) throw error;
      // Convertir en map pour un accès facile
      const configMap: Record<string, { enabled: boolean; templateId: string | null }> = {};
      data?.forEach(c => {
        const triggerId = c.cle.replace("trigger_", "").replace("_enabled", "").replace("_template", "");
        if (!configMap[triggerId]) configMap[triggerId] = { enabled: false, templateId: null };
        if (c.cle.endsWith("_enabled")) {
          configMap[triggerId].enabled = c.valeur === "true";
        } else if (c.cle.endsWith("_template")) {
          configMap[triggerId].templateId = c.valeur || null;
        }
      });
      return configMap;
    },
  });

  const createCampagne = useMutation({
    mutationFn: async (data: unknown) => {
      const { error } = await supabase.from('notifications_campagnes').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-campagnes'] });
      setFormOpen(false);
    }
  });

  const sendCampagne = useMutation({
    mutationFn: async (campaignId: string) => {
      setSendingId(campaignId);
      const { data, error } = await supabase.functions.invoke('send-campaign-emails', {
        body: { campaignId }
      });
      if (error) {
        const errorMessage = data?.error || error.message;
        throw new Error(errorMessage);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notifications-campagnes'] });
      toast.success(`${data.sent} emails envoyés, ${data.errors} erreurs`);
      setSendingId(null);
    },
    onError: (error) => {
      toast.error("Erreur lors de l'envoi: " + error.message);
      setSendingId(null);
    }
  });

  // Mutation pour sauvegarder la config d'un trigger
  const updateTriggerConfig = useMutation({
    mutationFn: async ({ triggerId, enabled, templateId }: { triggerId: string; enabled?: boolean; templateId?: string }) => {
      const updates = [];
      
      if (enabled !== undefined) {
        updates.push(
          supabase
            .from("configurations")
            .upsert({ cle: `trigger_${triggerId}_enabled`, valeur: String(enabled) }, { onConflict: "cle" })
        );
      }
      
      if (templateId !== undefined) {
        updates.push(
          supabase
            .from("configurations")
            .upsert({ cle: `trigger_${triggerId}_template`, valeur: templateId || "" }, { onConflict: "cle" })
        );
      }
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-triggers"] });
      toast.success("Configuration mise à jour");
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    }
  });

  // Afficher une erreur propre en cas de problème de chargement
  if (isError) {
    return (
      <div className={embedded ? "space-y-6" : "container mx-auto space-y-6"}>
        {!embedded && <BackButton />}
        <div className="p-8 text-center">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Erreur de chargement</h2>
          <p className="text-muted-foreground mb-4">
            Impossible de charger les notifications. Vérifiez votre connexion.
          </p>
          {campagnesError && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded mb-4">
              {(campagnesError as Error).message}
            </p>
          )}
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-6" : "container mx-auto space-y-6"}>
      {!embedded && <BackButton />}
      <div className="flex items-center justify-between">
        {!embedded && (
          <div className="flex items-center gap-2">
            <Bell className="h-8 w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold">Notifications & Campagnes</h1>
          </div>
        )}
        {canCreate && (
          <Button onClick={() => setFormOpen(true)} className={embedded ? "ml-auto" : ""}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Campagne
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Campagnes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold">{campagnes?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>En Cours</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold">
              {campagnes?.filter((c) => c.statut === "en_cours").length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Envoyées</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold">
              {campagnes?.filter((c) => c.statut === "envoyee").length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Taux d'ouverture</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold">---%</p>
          </CardContent>
        </Card>
      </div>

      {/* Section Déclencheurs Automatiques */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            Déclencheurs Automatiques
          </CardTitle>
          <CardDescription>
            Configurez les notifications automatiques déclenchées par les événements de l'application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {TRIGGERS_CONFIG.map((trigger) => {
              const config = triggersConfig?.[trigger.id] || { enabled: false, templateId: null };
              
              return (
                <div 
                  key={trigger.id} 
                  className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{trigger.label}</span>
                      <Badge variant={config.enabled ? "default" : "secondary"}>
                        {config.enabled ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{trigger.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Select
                      value={config.templateId || "none"}
                      onValueChange={(value) => updateTriggerConfig.mutate({ 
                        triggerId: trigger.id, 
                        templateId: value === "none" ? "" : value 
                      })}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Choisir un template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun template</SelectItem>
                        {templates?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(checked) => updateTriggerConfig.mutate({ 
                        triggerId: trigger.id, 
                        enabled: checked 
                      })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campagnes Récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Chargement...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Destinataires</TableHead>
                  <TableHead>Envoyés</TableHead>
                  <TableHead>Échecs</TableHead>
                  <TableHead>En attente</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date d'envoi</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campagnes?.map((campagne) => (
                  <TableRow key={campagne.id}>
                    <TableCell className="font-medium">{campagne.nom}</TableCell>
                    <TableCell>{campagne.type_campagne}</TableCell>
                    <TableCell>{campagne.nb_destinataires || 0}</TableCell>
                    <TableCell>
                      <span className="text-green-600 font-medium">
                        {envoisStats?.[campagne.id]?.envoyes ?? campagne.nb_envoyes ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      {(envoisStats?.[campagne.id]?.echecs ?? campagne.nb_erreurs ?? 0) > 0 ? (
                        <span className="text-destructive font-medium">
                          {envoisStats?.[campagne.id]?.echecs ?? campagne.nb_erreurs ?? 0}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {envoisStats?.[campagne.id]?.en_attente ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          campagne.statut === "envoyee"
                            ? "default"
                            : campagne.statut === "en_cours"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {campagne.statut}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {campagne.date_envoi_reelle
                        ? new Date(campagne.date_envoi_reelle).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {campagne.statut !== "envoyee" && canSend && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!enforcePermission('notifications', 'update')) return;
                            sendCampagne.mutate(campagne.id);
                          }}
                          disabled={sendingId === campagne.id}
                        >
                          {sendingId === campagne.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {currentMembre && (
        <NotificationCampagneForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={(data) => createCampagne.mutate(data)}
          createdBy={currentMembre.id}
        />
      )}
    </div>
  );
}
