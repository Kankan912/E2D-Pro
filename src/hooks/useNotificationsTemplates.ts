import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface NotificationTemplate {
  id: string;
  code: string;
  nom: string;
  categorie: string;
  description: string | null;
  template_sujet: string;
  template_contenu: string;
  variables_disponibles: string[] | null;
  email_expediteur: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplateInsert {
  code: string;
  nom: string;
  categorie: string;
  description?: string;
  template_sujet: string;
  template_contenu: string;
  variables_disponibles?: string[];
  email_expediteur?: string;
  actif?: boolean;
}

export interface NotificationTemplateUpdate {
  nom?: string;
  categorie?: string;
  description?: string;
  template_sujet?: string;
  template_contenu?: string;
  variables_disponibles?: string[];
  email_expediteur?: string;
  actif?: boolean;
}

export const useNotificationsTemplates = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Récupérer tous les templates
  const { data: templates, isLoading, error } = useQuery({
    queryKey: ['notifications-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications_templates')
        .select('*')
        .order('categorie', { ascending: true });
      
      if (error) throw error;
      return data as NotificationTemplate[];
    }
  });

  // Récupérer un template par code
  const useTemplateByCode = (code: string) => {
    return useQuery({
      queryKey: ['notifications-template', code],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('notifications_templates')
          .select('*')
          .eq('code', code)
          .single();
        
        if (error) throw error;
        return data as NotificationTemplate;
      },
      enabled: !!code
    });
  };

  // Créer un nouveau template
  const createTemplate = useMutation({
    mutationFn: async (templateData: NotificationTemplateInsert) => {
      const { data, error } = await supabase
        .from('notifications_templates')
        .insert(templateData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-templates'] });
      toast({ title: "Template créé avec succès" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la création", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mettre à jour un template
  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: NotificationTemplateUpdate }) => {
      const { error } = await supabase
        .from('notifications_templates')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-templates'] });
      toast({ title: "Template mis à jour" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la mise à jour", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Activer/Désactiver un template
  const toggleTemplateStatus = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const { error } = await supabase
        .from('notifications_templates')
        .update({ actif, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notifications-templates'] });
      toast({ 
        title: variables.actif ? "Template activé" : "Template désactivé" 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Supprimer un template
  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-templates'] });
      toast({ title: "Template supprimé" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la suppression", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return {
    templates,
    isLoading,
    error,
    useTemplateByCode,
    createTemplate,
    updateTemplate,
    toggleTemplateStatus,
    deleteTemplate
  };
};