import { Folder } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteGalleryAlbums, useSiteGallery } from "@/hooks/useSiteContent";
import { useNavigate } from "react-router-dom";

const Gallery = () => {
  const navigate = useNavigate();
  const { data: albums, isLoading: loadingAlbums } = useSiteGalleryAlbums();
  // useSiteGallery est nécessaire uniquement pour compter les items par album et trouver la cover
  const { data: galleryItems, isLoading: loadingItems } = useSiteGallery();

  const isLoading = loadingAlbums;

  if (isLoading) {
    return (
      <section id="galerie" className="py-20 lg:py-32 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Skeleton className="h-8 w-48 mx-auto mb-4" />
            <Skeleton className="h-12 w-96 mx-auto" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="galerie" className="py-20 lg:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Galerie
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Revivez Nos Meilleurs Moments
          </h2>
          <p className="text-lg text-muted-foreground">
            Découvrez en images et en vidéos les moments forts qui font la richesse de notre association.
          </p>
        </div>

        {/* Albums Grid */}
        {albums && albums.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {albums.map((album: any) => {
              const albumItemsCount = galleryItems?.filter((item: any) => item.album_id === album.id).length || 0;
              const coverImage = album.cover_image_url ||
                                galleryItems?.find((item: any) => item.album_id === album.id)?.image_url;

              return (
                <div
                  key={album.id}
                  onClick={() => navigate(`/albums/${album.id}`)}
                  className="group relative rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
                >
                  {/* Album Cover */}
                  <div className="aspect-square">
                    {coverImage ? (
                      <img
                        src={coverImage}
                        alt={album.titre}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        <Folder className="w-16 h-16 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Album info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-semibold text-lg mb-1">{album.titre}</h3>
                    {album.description && (
                      <p className="text-white/80 text-sm line-clamp-2 mb-2">
                        {album.description}
                      </p>
                    )}
                    <p className="text-white/60 text-xs">
                      {albumItemsCount} élément{albumItemsCount > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-24 text-muted-foreground">
            <Folder className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Galerie en cours de préparation</p>
            <p className="text-sm mt-2">Les albums photos seront bientôt disponibles.</p>
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">Plus de photos et vidéos disponibles sur nos réseaux sociaux</p>
          <button
            onClick={() => window.open("https://www.facebook.com/phoenixkmra/", "_blank")}
            className="inline-flex items-center px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Suivez-nous sur Facebook
          </button>
        </div>
      </div>
    </section>
  );
};

export default Gallery;

