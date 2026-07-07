import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

interface NotificationConfig {
  id: string;
  type_notification: string;
  actif: boolean;
  delai_jours: number;
  template_sujet: string | null;
  template_contenu: string | null;
  created_at: string;
  updated_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  'rappel_cotisation': 'Rappel de cotisation',
  'rappel_pret': 'Rappel échéance prêt',
  'convocation_reunion': 'Convocation réunion',
  'confirmation_adhesion': 'Confirmation adhésion',
  'sanction_notification': 'Notification sanction',
  'rappel_epargne': 'Rappel épargne',
  'bienvenue': 'Email de bienvenue',
};

export const NotificationsConfigManager = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editedConfigs, setEditedConfigs] = useState<Record<string, Partial<NotificationConfig>>>({});

  const { data: configs, isLoading } = useQuery({
    queryKey: ['notifications-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications_config')
        .select('*')
        .order('type_notification');
      if (error) throw error;
      return data as NotificationConfig[];
    }
  });

  const updateConfig = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<NotificationConfig> }) => {
      const { error } = await supabase
        .from('notifications_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-config'] });
      toast({ title: "Configuration mise à jour" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const toggleActive = (config: NotificationConfig) => {
    updateConfig.mutate({ id: config.id, updates: { actif: !config.actif } });
  };

  const handleDelaiChange = (id: string, value: string) => {
    const delai = parseInt(value) || 0;
    setEditedConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], delai_jours: delai }
    }));
  };

  const saveDelai = (id: string) => {
    const edited = editedConfigs[id];
    if (edited?.delai_jours !== undefined) {
      updateConfig.mutate({ id, updates: { delai_jours: edited.delai_jours } });
      setEditedConfigs(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Paramètres des Notifications Automatiques
          </CardTitle>
          <CardDescription>
            Configurez les déclencheurs et délais pour les notifications automatiques
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configs && configs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type de notification</TableHead>
                  <TableHead className="text-center">Actif</TableHead>
                  <TableHead>Délai (jours)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map(config => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {TYPE_LABELS[config.type_notification] || config.type_notification}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Code: {config.type_notification}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={config.actif}
                        onCheckedChange={() => toggleActive(config)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          className="w-20"
                          value={editedConfigs[config.id]?.delai_jours ?? config.delai_jours}
                          onChange={(e) => handleDelaiChange(config.id, e.target.value)}
                        />
                        {editedConfigs[config.id]?.delai_jours !== undefined && (
                          <Button size="sm" variant="outline" onClick={() => saveDelai(config.id)}>
                            <Save className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={config.actif ? "default" : "secondary"}>
                        {config.actif ? "Activé" : "Désactivé"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune configuration de notification trouvée.</p>
              <p className="text-sm">Les configurations seront créées automatiquement lors de la première utilisation.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• <strong>Délai (jours)</strong> : Nombre de jours avant/après l'événement pour envoyer la notification.</p>
          <p>• <strong>Rappel cotisation</strong> : Envoyé X jours après une réunion si cotisation non payée.</p>
          <p>• <strong>Rappel prêt</strong> : Envoyé X jours avant l'échéance d'un prêt.</p>
          <p>• <strong>Convocation réunion</strong> : Envoyée X jours avant la date de la réunion.</p>
        </CardContent>
      </Card>
    </div>
  );
};
