import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Trophy, Target } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CalendrierSportifUnifie() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { data: matchsE2D } = useQuery({
    queryKey: ['calendrier-e2d'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_e2d_matchs')
        .select('*')
        .order('date_match', { ascending: false });
      
      if (error) throw error;
      return data?.map(m => ({ ...m, type: 'E2D' }));
    }
  });

  // Table phoenix_matchs à créer
  const matchsPhoenix: any[] = [];

  const { data: entrainements } = useQuery({
    queryKey: ['calendrier-entrainements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoenix_entrainements')
        .select('*')
        .order('date_entrainement', { ascending: false });
      
      if (error) throw error;
      return data?.map(e => ({ ...e, type: 'Entraînement' }));
    }
  });

  const allEvents = [
    ...(matchsE2D || []).map(m => ({ ...m, date: m.date_match })),
    ...(matchsPhoenix || []).map(m => ({ ...m, date: m.date_match })),
    ...(entrainements || []).map(e => ({ ...e, date: e.date_entrainement })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const eventDates = allEvents.map(e => new Date(e.date));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendrier Sportif Unifié
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={fr}
                modifiers={{
                  event: eventDates
                }}
                modifiersStyles={{
                  event: { backgroundColor: 'hsl(var(--primary))', color: 'white', fontWeight: 'bold' }
                }}
                className="rounded-md border"
              />
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Événements à venir</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {allEvents.slice(0, 10).map((event, index) => (
                  <Card key={`${event.type}-${event.id || index}`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={
                              event.type === 'E2D' ? 'default' :
                              event.type === 'Phoenix' ? 'secondary' :
                              'outline'
                            }>
                              {event.type}
                            </Badge>
                            {event.type !== 'Entraînement' && (
                              <Trophy className="h-3 w-3 text-muted-foreground" />
                            )}
                            {event.type === 'Entraînement' && (
                              <Target className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          
                          <p className="font-medium">
                            {event.type === 'Entraînement' 
                              ? event.objectif || 'Entraînement' 
                              : `vs ${event.adversaire}`
                            }
                          </p>
                          
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(event.date), 'dd MMMM yyyy', { locale: fr })}
                          </p>
                          
                          {event.lieu && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {event.lieu}
                            </p>
                          )}
                        </div>
                        
                        {event.type !== 'Entraînement' && event.buts_marques !== undefined && (
                          <div className="text-right">
                            <p className="text-lg font-bold">
                              {event.buts_marques} - {event.buts_encaisses}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
