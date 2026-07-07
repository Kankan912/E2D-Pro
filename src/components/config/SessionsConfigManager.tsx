import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Clock, Save, Shield, Edit, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SessionConfig {
  id: string;
  role_type: string;
  session_duration_minutes: number;
  inactivity_timeout_minutes: number;
  warning_before_logout_seconds: number;
}

interface EditableConfig {
  sessionHours: number;
  sessionMinutes: number;
  inactivityHours: number;
  inactivityMinutes: number;
  warningSeconds: number;
}

const roleLabels: Record<string, { label: string; description: string; icon: typeof Shield; color: string }> = {
  super_admin: {
    label: "Super Administrateur",
    description: "Administrateurs avec accès complet au système",
    icon: Shield,
    color: "text-red-500"
  },
  editor: {
    label: "Éditeur",
    description: "Utilisateurs avec droits de modification (trésorier, secrétaire, etc.)",
    icon: Edit,
    color: "text-orange-500"
  },
  readonly: {
    label: "Lecture seule",
    description: "Membres avec consultation uniquement",
    icon: Eye,
    color: "text-green-500"
  }
};

const convertToEditable = (config: SessionConfig): EditableConfig => ({
  sessionHours: Math.floor(config.session_duration_minutes / 60),
  sessionMinutes: config.session_duration_minutes % 60,
  inactivityHours: Math.floor(config.inactivity_timeout_minutes / 60),
  inactivityMinutes: config.inactivity_timeout_minutes % 60,
  warningSeconds: config.warning_before_logout_seconds
});

const convertFromEditable = (editable: EditableConfig) => ({
  session_duration_minutes: editable.sessionHours * 60 + editable.sessionMinutes,
  inactivity_timeout_minutes: editable.inactivityHours * 60 + editable.inactivityMinutes,
  warning_before_logout_seconds: editable.warningSeconds
});

export const SessionsConfigManager = () => {
  const queryClient = useQueryClient();
  const [editedConfigs, setEditedConfigs] = useState<Record<string, EditableConfig>>({});

  const { data: configs, isLoading } = useQuery({
    queryKey: ['session-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_config')
        .select('*')
        .order('role_type');
      
      if (error) throw error;
      return data as SessionConfig[];
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ roleType, values }: { roleType: string; values: ReturnType<typeof convertFromEditable> }) => {
      const { error } = await supabase
        .from('session_config')
        .update(values)
        .eq('role_type', roleType);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-config'] });
      toast({ title: "Succès", description: "Configuration de session mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  });

  const handleChange = (roleType: string, field: keyof EditableConfig, value: number) => {
    const config = configs?.find(c => c.role_type === roleType);
    if (!config) return;

    const current = editedConfigs[roleType] || convertToEditable(config);
    setEditedConfigs(prev => ({
      ...prev,
      [roleType]: { ...current, [field]: value }
    }));
  };

  const handleSave = (roleType: string) => {
    const editable = editedConfigs[roleType];
    if (!editable) return;

    const values = convertFromEditable(editable);
    
    // Validation
    if (values.session_duration_minutes < 30) {
      toast({ title: "Erreur", description: "La durée de session doit être d'au moins 30 minutes", variant: "destructive" });
      return;
    }
    if (values.inactivity_timeout_minutes < 5) {
      toast({ title: "Erreur", description: "Le timeout d'inactivité doit être d'au moins 5 minutes", variant: "destructive" });
      return;
    }
    if (values.warning_before_logout_seconds > values.inactivity_timeout_minutes * 60) {
      toast({ title: "Erreur", description: "L'avertissement doit être inférieur au timeout d'inactivité", variant: "destructive" });
      return;
    }

    updateMutation.mutate({ roleType, values });
  };

  const getEditableValue = (config: SessionConfig): EditableConfig => {
    return editedConfigs[config.role_type] || convertToEditable(config);
  };

  const hasChanges = (config: SessionConfig): boolean => {
    const edited = editedConfigs[config.role_type];
    if (!edited) return false;
    const original = convertToEditable(config);
    return JSON.stringify(edited) !== JSON.stringify(original);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Chargement...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Configuration des Sessions
        </CardTitle>
        <CardDescription>
          Définissez les durées de session et les timeouts d'inactivité par type d'utilisateur
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {configs?.map((config) => {
          const roleInfo = roleLabels[config.role_type];
          const Icon = roleInfo?.icon || Shield;
          const editable = getEditableValue(config);
          const changed = hasChanges(config);

          return (
            <Card key={config.id} className="border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Icon className={`h-5 w-5 ${roleInfo?.color || ''}`} />
                  {roleInfo?.label || config.role_type}
                </CardTitle>
                <CardDescription>{roleInfo?.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Durée de session */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Durée de session</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={48}
                          value={editable.sessionHours}
                          onChange={(e) => handleChange(config.role_type, 'sessionHours', parseInt(e.target.value) || 0)}
                          className="w-16"
                        />
                        <span className="text-sm text-muted-foreground">h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          value={editable.sessionMinutes}
                          onChange={(e) => handleChange(config.role_type, 'sessionMinutes', parseInt(e.target.value) || 0)}
                          className="w-16"
                        />
                        <span className="text-sm text-muted-foreground">min</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Durée maximale avant déconnexion automatique</p>
                  </div>

                  {/* Timeout d'inactivité */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Timeout d'inactivité</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          value={editable.inactivityHours}
                          onChange={(e) => handleChange(config.role_type, 'inactivityHours', parseInt(e.target.value) || 0)}
                          className="w-16"
                        />
                        <span className="text-sm text-muted-foreground">h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          value={editable.inactivityMinutes}
                          onChange={(e) => handleChange(config.role_type, 'inactivityMinutes', parseInt(e.target.value) || 0)}
                          className="w-16"
                        />
                        <span className="text-sm text-muted-foreground">min</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Déconnexion après cette période sans activité</p>
                  </div>

                  {/* Avertissement */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Avertissement</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={10}
                        max={300}
                        value={editable.warningSeconds}
                        onChange={(e) => handleChange(config.role_type, 'warningSeconds', parseInt(e.target.value) || 30)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">secondes</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Temps avant déconnexion pour prolonger</p>
                  </div>
                </div>

                {changed && (
                  <div className="mt-4 flex justify-end">
                    <Button 
                      onClick={() => handleSave(config.role_type)}
                      disabled={updateMutation.isPending}
                      size="sm"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Sauvegarder
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
};
