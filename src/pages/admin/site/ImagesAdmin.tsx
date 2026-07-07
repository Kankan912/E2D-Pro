import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import MediaUploader from "@/components/admin/MediaUploader";
import { Image, Loader2, RefreshCw } from "lucide-react";
import heroImageFallback from "@/assets/hero-sports.jpg";
import teamImageFallback from "@/assets/team-celebration.jpg";
import logoFallback from "@/assets/logo-e2d.png";

interface SiteImage {
  cle: string;
  valeur: string;
  description: string;
}

const ImagesAdmin = () => {
  const queryClient = useQueryClient();

  const { data: images, isLoading } = useQuery({
    queryKey: ["site-images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("cle, valeur, description")
        .eq("categorie", "images");
      if (error) throw error;
      return data as SiteImage[];
    },
  });

  const updateImage = useMutation({
    mutationFn: async ({ cle, valeur }: { cle: string; valeur: string }) => {
      const { error } = await supabase
        .from("site_config")
        .update({ valeur })
        .eq("cle", cle);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-images"] });
      queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast({ title: "Succès", description: "Image mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour l'image", variant: "destructive" });
    },
  });

  const getImageValue = (cle: string) => images?.find(img => img.cle === cle)?.valeur || "";
  const getImageDescription = (cle: string) => images?.find(img => img.cle === cle)?.description || "";

  const getFallbackImage = (cle: string) => {
    switch (cle) {
      case "hero_fallback_image":
        return heroImageFallback;
      case "events_fallback_image":
        return teamImageFallback;
      case "site_logo":
        return logoFallback;
      default:
        return "";
    }
  };

  const imageConfigs = [
    { 
      cle: "hero_fallback_image", 
      title: "Image Hero par Défaut",
      description: "Image affichée dans la section Hero quand aucune image de carrousel n'est configurée"
    },
    { 
      cle: "events_fallback_image", 
      title: "Image Événements par Défaut",
      description: "Image affichée dans la section Événements quand aucun événement n'a d'image"
    },
    { 
      cle: "site_logo", 
      title: "Logo du Site",
      description: "Logo affiché dans le header et le footer du site public"
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Images du Site</h1>
          <p className="text-muted-foreground">
            Gérez les images par défaut affichées sur le site public
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {imageConfigs.map((config) => {
          const currentValue = getImageValue(config.cle);
          const fallback = getFallbackImage(config.cle);
          const displayImage = currentValue || fallback;

          return (
            <Card key={config.cle}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  {config.title}
                </CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preview */}
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                  <img
                    src={displayImage}
                    alt={config.title}
                    className="w-full h-full object-cover"
                  />
                  {!currentValue && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="text-white text-sm font-medium">
                        Image par défaut (code)
                      </span>
                    </div>
                  )}
                </div>

                {/* Uploader */}
                <MediaUploader
                  bucket="site-images"
                  currentUrl={currentValue}
                  onUrlChange={(url) => updateImage.mutate({ cle: config.cle, valeur: url })}
                  accept="image/*"
                  label="Choisir une image"
                />

                {/* Reset button */}
                {currentValue && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => updateImage.mutate({ cle: config.cle, valeur: "" })}
                    disabled={updateImage.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Réinitialiser (utiliser image par défaut)
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ImagesAdmin;
