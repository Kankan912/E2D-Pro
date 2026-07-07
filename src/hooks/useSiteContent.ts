import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

import { logger } from "@/lib/logger";
// Helper functions for toast
const showSuccess = (message: string) => toast({ title: "Succès", description: message });
const showError = (message: string) => toast({ title: "Erreur", description: message, variant: "destructive" });

// Hook pour Hero
export const useSiteHero = () => {
  return useQuery({
    queryKey: ["site-hero"],
    queryFn: async () => {
      // Timeout 10s pour éviter un état "loading" infini si le réseau bloque
      // (extension, proxy, panne réseau intermittente).
      const queryPromise = supabase
        .from("site_hero")
        .select("actif, badge_text, bouton_1_lien, bouton_1_texte, bouton_2_lien, bouton_2_texte, carousel_auto_play, carousel_interval, created_at, id, image_url, media_source, sous_titre, stat_1_label, stat_1_nombre, stat_2_label, stat_2_nombre, stat_3_label, stat_3_nombre, titre, updated_at")
        .eq("actif", true)
        .maybeSingle();

      const timeoutPromise = new Promise<Awaited<typeof queryPromise>>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: new Error("Hero query timeout (10s)") } as Awaited<typeof queryPromise>),
          10000
        )
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        // Ne bloque pas le rendu : on renvoie null pour basculer sur les valeurs par défaut.
        logger.warn("[useSiteHero]", error.message ?? error);
        return null;
      }
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - contenu CMS stable
    gcTime: 30 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

export const useUpdateHero = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_hero")
        .update(data as never)
        .eq("id", data.id as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-hero"] });
      showSuccess("Section Hero mise à jour");
    },
    onError: () => {
      showError("Erreur lors de la mise à jour");
    },
  });
};

// Hook pour About
export const useSiteAbout = () => {
  return useQuery({
    queryKey: ["site-about"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_about")
        .select("actif, created_at, histoire_contenu, histoire_titre, id, sous_titre, titre, updated_at, valeurs")
        .eq("actif", true)
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useUpdateAbout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_about")
        .update(data as never)
        .eq("id", data.id as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-about"] });
      showSuccess("Section À Propos mise à jour");
    },
    onError: () => {
      showError("Erreur lors de la mise à jour");
    },
  });
};

// Hook pour Activities
export const useSiteActivities = () => {
  return useQuery({
    queryKey: ["site-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_activities")
        .select("actif, created_at, description, features, icon, id, ordre, titre, updated_at")
        .eq("actif", true)
        .order("ordre", { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useCreateActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase.from("site_activities").insert(data as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-activities"] });
      showSuccess("Activité créée");
    },
    onError: () => {
      showError("Erreur lors de la création");
    },
  });
};

export const useUpdateActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_activities")
        .update(data as never)
        .eq("id", data.id as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-activities"] });
      showSuccess("Activité mise à jour");
    },
    onError: () => {
      showError("Erreur lors de la mise à jour");
    },
  });
};

export const useDeleteActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("site_activities")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-activities"] });
      showSuccess("Activité supprimée");
    },
    onError: () => {
      showError("Erreur lors de la suppression");
    },
  });
};

// Hook pour Events
export const useSiteEvents = () => {
  return useQuery({
    queryKey: ["site-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_events")
        .select("actif, album_id, auto_sync, created_at, date, description, heure, id, image_url, lieu, match_id, match_type, media_source, ordre, titre, type, updated_at")
        .eq("actif", true)
        .order("date", { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - événements changent plus souvent
    gcTime: 15 * 60 * 1000,
  });
};

export const useCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase.from("site_events").insert(data as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-events"] });
      showSuccess("Événement créé");
    },
    onError: () => {
      showError("Erreur lors de la création");
    },
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_events")
        .update(data as never)
        .eq("id", data.id as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-events"] });
      showSuccess("Événement mis à jour");
    },
    onError: () => {
      showError("Erreur lors de la mise à jour");
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("site_events")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-events"] });
      showSuccess("Événement supprimé");
    },
    onError: () => {
      showError("Erreur lors de la suppression");
    },
  });
};

// Hook pour Gallery
export const useSiteGallery = () => {
  return useQuery({
    queryKey: ["site-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_gallery")
        .select("actif, album_id, categorie, created_at, id, image_url, media_source, ordre, titre, updated_at, video_url")
        .eq("actif", true)
        .order("ordre", { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useCreateGalleryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase.from("site_gallery").insert(data as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-gallery"] });
      showSuccess("Élément de galerie créé");
    },
    onError: () => {
      showError("Erreur lors de la création");
    },
  });
};

export const useUpdateGalleryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_gallery")
        .update(data as never)
        .eq("id", data.id as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-gallery"] });
      showSuccess("Élément mis à jour");
    },
    onError: () => {
      showError("Erreur lors de la mise à jour");
    },
  });
};

export const useDeleteGalleryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("site_gallery")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-gallery"] });
      showSuccess("Élément supprimé");
    },
    onError: () => {
      showError("Erreur lors de la suppression");
    },
  });
};

// Hook pour Partners
export const useSitePartners = () => {
  return useQuery({
    queryKey: ["site-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_partners")
        .select("actif, created_at, description, id, logo_url, media_source, nom, ordre, site_web, updated_at")
        .eq("actif", true)
        .order("ordre", { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useCreatePartner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase.from("site_partners").insert(data as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-partners"] });
      showSuccess("Partenaire créé");
    },
    onError: () => {
      showError("Erreur lors de la création");
    },
  });
};

export const useUpdatePartner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_partners")
        .update(data as never)
        .eq("id", data.id as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-partners"] });
      showSuccess("Partenaire mis à jour");
    },
    onError: () => {
      showError("Erreur lors de la mise à jour");
    },
  });
};

export const useDeletePartner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("site_partners")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-partners"] });
      showSuccess("Partenaire supprimé");
    },
    onError: () => {
      showError("Erreur lors de la suppression");
    },
  });
};

// Hook pour Config
export const useSiteConfig = () => {
  return useQuery({
    queryKey: ["site-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("categorie, cle, created_at, description, id, type, updated_at, valeur")
        .order("categorie", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_config")
        .update({ valeur: data.valeur as never })
        .eq("cle", data.cle as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-config"] });
      showSuccess("Configuration mise à jour");
    },
    onError: () => {
      showError("Erreur lors de la mise à jour");
    },
  });
};

// =================== HERO IMAGES ===================
export const useSiteHeroImages = (heroId?: string) => {
  return useQuery({
    queryKey: ["site-hero-images", heroId],
    queryFn: async () => {
      if (!heroId) return [];
      const { data, error } = await supabase
        .from("site_hero_images")
        .select("actif, created_at, hero_id, id, image_url, ordre, updated_at")
        .eq("hero_id", heroId)
        .eq("actif", true)
        .order("ordre", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!heroId,
  });
};

export const useCreateHeroImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_hero_images")
        .insert(data as never);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-hero-images"] });
      showSuccess("Image ajoutée");
    },
    onError: () => {
      showError("Erreur lors de l'ajout");
    },
  });
};

export const useUpdateHeroImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_hero_images")
        .update(data as never)
        .eq("id", data.id as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-hero-images"] });
      showSuccess("Image mise à jour");
    },
    onError: () => {
      showError("Erreur lors de la mise à jour");
    },
  });
};

export const useDeleteHeroImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("site_hero_images")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-hero-images"] });
      showSuccess("Image supprimée");
    },
    onError: () => {
      showError("Erreur lors de la suppression");
    },
  });
};

// =================== GALLERY ALBUMS ===================
export const useSiteGalleryAlbums = () => {
  return useQuery({
    queryKey: ["site-gallery-albums"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_gallery_albums")
        .select("actif, cover_image_url, created_at, description, id, ordre, titre, updated_at")
        .eq("actif", true)
        .order("ordre", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};

export const useCreateGalleryAlbum = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_gallery_albums")
        .insert(data as never);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-gallery-albums"] });
      showSuccess("Album créé");
    },
    onError: () => {
      showError("Erreur lors de la création");
    },
  });
};

export const useUpdateGalleryAlbum = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_gallery_albums")
        .update(data as never)
        .eq("id", data.id as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-gallery-albums"] });
      queryClient.invalidateQueries({ queryKey: ["site-gallery"] });
      showSuccess("Album mis à jour");
    },
    onError: () => {
      showError("Erreur lors de la mise à jour");
    },
  });
};

export const useDeleteGalleryAlbum = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("site_gallery_albums")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-gallery-albums"] });
      queryClient.invalidateQueries({ queryKey: ["site-gallery"] });
      showSuccess("Album supprimé");
    },
    onError: () => {
      showError("Erreur lors de la suppression");
    },
  });
};

// Hook to get gallery items by album
export const useSiteGalleryByAlbum = (albumId?: string) => {
  return useQuery({
    queryKey: ["site-gallery", "album", albumId],
    queryFn: async () => {
      if (!albumId) return [];
      const { data, error } = await supabase
        .from("site_gallery")
        .select("actif, album_id, categorie, created_at, id, image_url, media_source, ordre, titre, updated_at, video_url")
        .eq("album_id", albumId)
        .eq("actif", true)
        .order("ordre", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!albumId,
  });
};

// =================== EVENTS CAROUSEL CONFIG ===================
export const useSiteEventsCarouselConfig = () => {
  return useQuery({
    queryKey: ["site-events-carousel-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_events_carousel_config")
        .select("actif, auto_play, created_at, id, interval, show_arrows, show_indicators, updated_at")
        .eq("actif", true)
        .single();

      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateEventsCarouselConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id?: string; cle?: string }) => {
      const { error } = await supabase
        .from("site_events_carousel_config")
        .update(data as never)
        .eq("id", data.id as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-events-carousel-config"] });
      showSuccess("Configuration carousel mise à jour");
    },
    onError: () => {
      showError("Erreur lors de la mise à jour");
    },
  });
};
