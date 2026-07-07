import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Folder, Play, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageLightbox, LightboxImage } from "@/components/ui/image-lightbox";
import { useSiteGalleryAlbums, useSiteGalleryByAlbum } from "@/hooks/useSiteContent";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

export default function AlbumDetail() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: albums, isLoading: loadingAlbum } = useSiteGalleryAlbums();
  const { data: items = [], isLoading: loadingItems } = useSiteGalleryByAlbum(albumId);

  const album = albums?.find((a: any) => a.id === albumId);

  const lightboxImages: LightboxImage[] = items.map((item: any) => ({
    url: item.image_url || item.video_url,
    title: item.titre,
    isVideo: item.categorie?.toLowerCase() === "vidéo" || !!item.video_url,
  }));

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const isLoading = loadingAlbum || loadingItems;

  return (
    <>
      <SEOHead
        title={album ? `${album.titre} | Galerie E2D` : "Album | Galerie E2D"}
        description={album?.description || "Galerie photos et vidéos de l'association E2D"}
      />
      <Navbar />
      <main className="min-h-screen bg-background pt-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Bouton retour */}
          <button
            onClick={() => {
              if (window.history.length <= 1) {
                navigate('/#galerie');
              } else {
                navigate(-1);
              }
            }}
            className="inline-flex items-center text-muted-foreground hover:text-primary mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la galerie
          </button>

          {isLoading ? (
            <div>
              <Skeleton className="h-10 w-64 mb-4" />
              <Skeleton className="h-6 w-96 mb-10" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* En-tête album */}
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Folder className="h-5 w-5 text-primary" />
                  </div>
                  <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
                    {album?.titre || "Album"}
                  </h1>
                </div>
                {album?.description && (
                  <p className="text-lg text-muted-foreground mt-2 max-w-2xl">
                    {album.description}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  {items.length} élément{items.length > 1 ? "s" : ""}
                </p>
              </div>

              {/* Grille médias */}
              {items.length === 0 ? (
                <div className="text-center py-24 text-muted-foreground">
                  <Folder className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Cet album est vide pour le moment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {items.map((item: any, index: number) => {
                    const isVideo = item.categorie?.toLowerCase() === "vidéo" || !!item.video_url;
                    const mediaUrl = item.image_url || item.video_url;

                    return (
                      <div
                        key={item.id}
                        onClick={() => openLightbox(index)}
                        className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300"
                      >
                        {mediaUrl ? (
                          <>
                            <img
                              src={mediaUrl}
                              alt={item.titre || "Média"}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                            {isVideo && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                                  <Play className="w-6 h-6 text-white ml-1" />
                                </div>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            {item.titre && (
                              <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                <p className="text-white text-sm font-medium truncate">{item.titre}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            {isVideo ? (
                              <Play className="w-12 h-12 text-muted-foreground/30" />
                            ) : (
                              <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />

      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}
