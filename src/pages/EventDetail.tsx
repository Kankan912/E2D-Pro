import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Clock, MapPin, ArrowLeft, Trophy, Users, Image, Film, FileText, Target, Star, Award, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SEOHead from "@/components/SEOHead";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { LazyImage } from "@/components/ui/lazy-image";
import { ImageLightbox, LightboxImage } from "@/components/ui/image-lightbox";
import { useSiteGalleryAlbums, useSiteGalleryByAlbum } from "@/hooks/useSiteContent";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const { data: event, isLoading } = useQuery({
    queryKey: ["site-event-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_events")
        .select("actif, album_id, auto_sync, created_at, date, description, heure, id, image_url, lieu, match_id, match_type, media_source, ordre, titre, type, updated_at")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Si c'est un match synchronisé, récupérer les détails du match
  const { data: matchDetails } = useQuery({
    queryKey: ["match-details-for-event", event?.match_id],
    queryFn: async () => {
      if (!event?.match_id) return null;
      const { data, error } = await supabase
        .from("sport_e2d_matchs")
        .select("created_at, date_match, equipe_adverse, heure_match, id, image_url, lieu, logo_equipe_adverse, nom_complet_equipe_adverse, notes, score_adverse, score_e2d, statut, statut_publication, type_match")
        .eq("id", event.match_id)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!event?.match_id,
  });

  // Charger les médias du match (photos/vidéos)
  const { data: matchMedias = [] } = useQuery({
    queryKey: ["match-medias-event", event?.match_id],
    queryFn: async () => {
      if (!event?.match_id) return [];
      const { data, error } = await supabase
        .from("match_medias")
        .select("created_at, created_by, id, legende, match_id, ordre, type, url")
        .eq("match_id", event.match_id)
        .order("ordre", { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: !!event?.match_id,
  });

  // Charger le compte rendu du match
  const { data: compteRendu } = useQuery({
    queryKey: ["match-compte-rendu-public", event?.match_id],
    queryFn: async () => {
      if (!event?.match_id) return null;
      const { data, error } = await supabase
        .from("match_compte_rendus")
        .select("ambiance, arbitrage_commentaire, conditions_jeu, created_at, created_by, faits_marquants, id, match_id, resume, score_mi_temps, updated_at")
        .eq("match_id", event.match_id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!event?.match_id,
  });

  // Charger les statistiques individuelles
  const { data: matchStats = [] } = useQuery({
    queryKey: ["match-stats-public", event?.match_id],
    queryFn: async () => {
      if (!event?.match_id) return [];
      const { data, error } = await supabase
        .from("match_statistics")
        .select("assists, created_at, goals, id, man_of_match, match_id, match_type, membre_id, player_name, red_cards, updated_at, yellow_cards")
        .eq("match_id", event.match_id)
        .eq("match_type", "e2d");
      if (error) return [];
      return data || [];
    },
    enabled: !!event?.match_id,
  });

  // Préparer les images pour le lightbox
  const lightboxImages: LightboxImage[] = matchMedias.map((media) => ({
    url: media.url,
    title: media.legende || undefined,
    isVideo: media.type === "video",
  }));

  // Album galerie lié à l'événement
  const { data: linkedAlbumItems = [] } = useSiteGalleryByAlbum(event?.album_id || undefined);
  const { data: allAlbums } = useSiteGalleryAlbums();
  const linkedAlbum = allAlbums?.find((a: any) => a.id === event?.album_id);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-background pt-24">
          <div className="container mx-auto px-4 py-8">
            <Skeleton className="h-8 w-32 mb-6" />
            <Skeleton className="h-64 w-full mb-6" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!event) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold mb-4">Événement non trouvé</h1>
              <p className="text-muted-foreground mb-6">
                L'événement que vous recherchez n'existe pas ou a été supprimé.
              </p>
              <Link to="/#evenements">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour aux événements
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </>
    );
  }

  const eventDate = new Date(event.date);
  const isPast = eventDate < new Date();
  const isMatch = event.match_type === 'e2d' && matchDetails;

  return (
    <>
      <SEOHead
        title={`${event.titre} | E2D`}
        description={event.description || `Détails de l'événement ${event.titre}`}
      />
      <Navbar />
      <main className="min-h-screen bg-background pt-24">
        <div className="container mx-auto px-4 py-8">
          {/* Bouton retour */}
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/#evenements');
              }
            }}
            className="inline-flex items-center text-muted-foreground hover:text-primary mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux événements
          </button>

          {/* En-tête de l'événement */}
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Image de l'événement */}
            <div className="relative rounded-2xl overflow-hidden bg-muted aspect-video">
              {event.image_url ? (
                <img
                  src={event.image_url}
                  alt={event.titre}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                  <Calendar className="h-24 w-24 text-primary/40" />
                </div>
              )}
              <div className="absolute top-4 left-4">
                <Badge className={isPast ? "bg-muted-foreground" : "bg-primary"}>
                  {event.type}
                </Badge>
              </div>
              {isPast && (
                <div className="absolute top-4 right-4">
                  <Badge variant="secondary">Passé</Badge>
                </div>
              )}
            </div>

            {/* Informations */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                  {event.titre}
                </h1>
                {event.description && (
                  <p className="text-lg text-muted-foreground">
                    {event.description}
                  </p>
                )}
              </div>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-semibold">
                        {format(eventDate, "EEEE dd MMMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  </div>

                  {event.heure && (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Heure</p>
                        <p className="font-semibold">{event.heure}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Lieu</p>
                      <p className="font-semibold">{event.lieu}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Score si match terminé */}
              {isMatch && matchDetails.statut === 'termine' && (
                <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center gap-8">
                      <div className="text-center flex flex-col items-center gap-2">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                          <span className="text-lg font-bold text-primary">E2D</span>
                        </div>
                        <p className="text-sm text-muted-foreground">E2D</p>
                        <p className="text-4xl font-bold text-primary">
                          {matchDetails.score_e2d}
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-muted-foreground">-</div>
                      <div className="text-center flex flex-col items-center gap-2">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          {matchDetails.logo_equipe_adverse ? (
                            <img src={matchDetails.logo_equipe_adverse} alt={matchDetails.equipe_adverse} className="w-full h-full object-contain p-1" />
                          ) : (
                            <Users className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {matchDetails.equipe_adverse}
                        </p>
                        <p className="text-4xl font-bold">
                          {matchDetails.score_adverse}
                        </p>
                      </div>
                    </div>
                    <div className="text-center mt-4">
                      <Badge variant="secondary">
                        <Trophy className="h-3 w-3 mr-1" />
                        Match Terminé
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Détails supplémentaires du match */}
          {isMatch && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Informations du match
                </h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Type de match</p>
                    <p className="font-medium capitalize">{matchDetails.type_match}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Statut</p>
                    <p className="font-medium capitalize">{matchDetails.statut}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Adversaire</p>
                    <p className="font-medium">{matchDetails.equipe_adverse}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compte Rendu du match */}
          {isMatch && compteRendu && !!(
            compteRendu.resume || 
            compteRendu.faits_marquants || 
            compteRendu.conditions_jeu || 
            compteRendu.ambiance || 
            compteRendu.score_mi_temps || 
            compteRendu.arbitrage_commentaire
          ) && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Compte Rendu du Match
                </h2>
                
                {compteRendu.resume && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-muted-foreground mb-2">Résumé</h3>
                    <p className="text-foreground whitespace-pre-wrap">{compteRendu.resume}</p>
                  </div>
                )}
                
                {compteRendu.faits_marquants && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-muted-foreground mb-2">Faits Marquants</h3>
                    <p className="text-foreground whitespace-pre-wrap">{compteRendu.faits_marquants}</p>
                  </div>
                )}
                
                {compteRendu.score_mi_temps && (
                  <div className="mb-4">
                    <Badge variant="outline">Mi-temps : {compteRendu.score_mi_temps}</Badge>
                  </div>
                )}
                
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  {compteRendu.conditions_jeu && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Conditions de jeu</p>
                      <p className="text-sm">{compteRendu.conditions_jeu}</p>
                    </div>
                  )}
                  {compteRendu.ambiance && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Ambiance</p>
                      <p className="text-sm">{compteRendu.ambiance}</p>
                    </div>
                  )}
                  {compteRendu.arbitrage_commentaire && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Arbitrage</p>
                      <p className="text-sm">{compteRendu.arbitrage_commentaire}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistiques individuelles */}
          {isMatch && matchStats.length > 0 && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Statistiques du Match
                </h2>
                
                {/* Résumé global */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-primary/10 rounded-lg">
                    <p className="text-2xl font-bold text-primary">
                      {matchStats.reduce((sum, s) => sum + (s.goals || 0), 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Buts</p>
                  </div>
                  <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {matchStats.reduce((sum, s) => sum + (s.assists || 0), 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Passes D.</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">
                      {matchStats.reduce((sum, s) => sum + (s.yellow_cards || 0), 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Cartons J.</p>
                  </div>
                  <div className="text-center p-3 bg-red-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">
                      {matchStats.reduce((sum, s) => sum + (s.red_cards || 0), 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Cartons R.</p>
                  </div>
                </div>
                
                {/* Homme du match */}
                {matchStats.find(s => s.man_of_match) && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-3 mb-4">
                    <Star className="h-6 w-6 text-yellow-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Homme du match</p>
                      <p className="font-bold">{matchStats.find(s => s.man_of_match)?.player_name}</p>
                    </div>
                  </div>
                )}
                
                {/* Buteurs et Passeurs */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Buteurs */}
                  {matchStats.filter(s => s.goals > 0).length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Award className="h-4 w-4" /> Buteurs
                      </h3>
                      <div className="space-y-1">
                        {matchStats.filter(s => s.goals > 0).map((stat, idx) => (
                          <div key={idx} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                            <span>{stat.player_name}</span>
                            <Badge>{stat.goals} but{stat.goals > 1 ? 's' : ''}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Passeurs */}
                  {matchStats.filter(s => s.assists > 0).length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Passeurs Décisifs</h3>
                      <div className="space-y-1">
                        {matchStats.filter(s => s.assists > 0).map((stat, idx) => (
                          <div key={idx} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                            <span>{stat.player_name}</span>
                            <Badge variant="secondary">{stat.assists} passe{stat.assists > 1 ? 's' : ''}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Album galerie lié à l'événement */}
          {linkedAlbum && linkedAlbumItems.length > 0 && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  Album Photos : {linkedAlbum.titre}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {linkedAlbumItems.slice(0, 8).map((item: any) => (
                    <Link key={item.id} to={`/albums/${linkedAlbum.id}`}>
                      <img
                        src={item.image_url || item.video_url}
                        alt={item.titre || "Photo"}
                        className="w-full aspect-square object-cover rounded-lg hover:opacity-80 transition-opacity"
                        loading="lazy"
                      />
                    </Link>
                  ))}
                </div>
                <Link
                  to={`/albums/${linkedAlbum.id}`}
                  className="inline-flex items-center text-primary hover:underline text-sm font-medium"
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Voir l'album complet ({linkedAlbumItems.length} médias)
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Galerie médias du match */}
          {matchMedias.length > 0 && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Photos & Vidéos du match
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {matchMedias.map((media, index) => (
                    <div key={media.id} className="relative group">
                      {media.type === "video" ? (
                        <div 
                          onClick={() => openLightbox(index)}
                          className="aspect-video bg-muted rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                        >
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Film className="h-10 w-10" />
                            <span className="text-sm">Voir la vidéo</span>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => openLightbox(index)}
                          className="cursor-pointer"
                        >
                          <LazyImage
                            src={media.url}
                            alt={media.legende || "Photo du match"}
                            className="rounded-lg aspect-square object-cover hover:opacity-90 transition-opacity"
                            aspectRatio="square"
                          />
                        </div>
                      )}
                      {media.legende && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {media.legende}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
      
      {/* Lightbox pour les médias */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}
