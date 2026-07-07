import { useState, useRef } from "react";
import { Calendar, Clock, MapPin, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteEvents, useSiteEventsCarouselConfig, useSiteConfig } from "@/hooks/useSiteContent";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import teamImageFallback from "@/assets/team-celebration.jpg";

const Events = () => {
  const { data: siteConfig } = useSiteConfig();
  const eventsFallbackImage = siteConfig?.find(c => c.cle === 'events_fallback_image')?.valeur || teamImageFallback;
  const { data: events, isLoading } = useSiteEvents();
  const { data: carouselConfig } = useSiteEventsCarouselConfig();
  const [displayCount, setDisplayCount] = useState(4);
  
  const plugin = useRef(
    Autoplay({ 
      delay: carouselConfig?.interval || 5000, 
      stopOnInteraction: true 
    })
  );

  if (isLoading) {
    return (
      <section id="evenements" className="py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Skeleton className="h-8 w-48 mx-auto mb-4" />
            <Skeleton className="h-12 w-96 mx-auto" />
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="evenements" className="py-20 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            <Calendar className="w-4 h-4 mr-2" />
            Événements à Venir
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Ne Manquez Aucun Événement
          </h2>
          <p className="text-lg text-muted-foreground">
            Participez à nos prochaines rencontres sportives et moments de convivialité.
          </p>
        </div>

        {/* Events Grid */}
        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          {/* Events List */}
          <div className="space-y-4">
            {events && events.length > 0 ? (
              <>
                {events.slice(0, displayCount).map((event: any) => (
                  <Link key={event.id} to={`/evenements/${event.id}`}>
                    <Card className="group hover:shadow-strong transition-all duration-300 border-border cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
                            <div className="text-2xl font-bold text-primary">
                              {format(new Date(event.date), "dd")}
                            </div>
                            <div className="text-xs text-primary uppercase">
                              {format(new Date(event.date), "MMM", { locale: fr })}
                            </div>
                          </div>
                          
                          <div className="flex-1">
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-secondary/20 text-secondary mb-2">
                              {event.type}
                            </span>
                            <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                              {event.titre}
                            </h3>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              {event.heure && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  <span>{event.heure}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span>{event.lieu}</span>
                              </div>
                            </div>
                          </div>

                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                
                {/* Bouton Voir plus */}
                {events.length > displayCount && (
                  <Button 
                    variant="outline" 
                    onClick={() => setDisplayCount(prev => prev + 4)}
                    className="w-full mt-4"
                  >
                    Voir plus d'événements ({events.length - displayCount} restants)
                  </Button>
                )}
              </>
            ) : (
              <p className="text-center text-muted-foreground py-12">
                Aucun événement prévu pour le moment.
              </p>
            )}
          </div>

          {/* Events Carousel with Images */}
          <div className="relative rounded-2xl overflow-hidden shadow-strong h-full min-h-[500px]">
            {events && events.length > 0 && events.some((e: any) => e.image_url) ? (
              <Carousel
                plugins={carouselConfig?.auto_play ? [plugin.current] : []}
                className="w-full h-full"
                opts={{
                  loop: true,
                }}
              >
                <CarouselContent className="ml-0 h-full">
                  {events
                    .filter((event: any) => event.image_url)
                    .map((event: any) => (
                      <CarouselItem key={event.id} className="pl-0 h-full min-h-[500px]">
                        <div className="relative w-full h-full">
                          <img
                            src={event.image_url}
                            alt={event.titre}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent" />
                          
                          {/* Event Info Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                            <div className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-secondary mb-3">
                              {event.type}
                            </div>
                            <h3 className="text-2xl font-bold mb-2">{event.titre}</h3>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>{format(new Date(event.date), "dd MMMM yyyy", { locale: fr })}</span>
                              </div>
                              {event.heure && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  <span>{event.heure}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                </CarouselContent>
                {carouselConfig?.show_arrows !== false && (
                  <>
                    <CarouselPrevious className="left-4 bg-white/10 text-white hover:bg-white/20 border-none" />
                    <CarouselNext className="right-4 bg-white/10 text-white hover:bg-white/20 border-none" />
                  </>
                )}
              </Carousel>
            ) : (
              <div className="w-full h-full">
                <img
                  src={eventsFallbackImage}
                  alt="Team Celebration"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent" />
                
                {/* Stats Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <div className="grid grid-cols-3 gap-6 text-white text-center">
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold">25+</div>
                      <div className="text-sm text-white/80">Matchs</div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold">12+</div>
                      <div className="text-sm text-white/80">Entraînements</div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold">8+</div>
                      <div className="text-sm text-white/80">Événements</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Events;
