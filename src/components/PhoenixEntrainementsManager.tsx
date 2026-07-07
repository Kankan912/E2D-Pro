import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import EntrainementInterneForm from "./forms/EntrainementInterneForm";

export default function PhoenixEntrainementsManager() {
  const [showForm, setShowForm] = useState(false);

  const { data: entrainements, refetch } = useQuery({
    queryKey: ['phoenix-entrainements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoenix_entrainements')
        .select('*')
        .order('date_entrainement', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des Entraînements</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvel Entraînement
        </Button>
      </div>

      <div className="grid gap-4">
        {entrainements?.map((entrainement) => (
          <Card key={entrainement.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">
                      {format(new Date(entrainement.date_entrainement), 'dd MMMM yyyy', { locale: fr })}
                    </span>
                    {entrainement.heure_debut && (
                      <>
                        <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                        <span>{entrainement.heure_debut}</span>
                      </>
                    )}
                  </div>
                  
                  {entrainement.lieu && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{entrainement.lieu}</span>
                    </div>
                  )}
                  
                  {entrainement.notes && (
                    <p className="text-sm text-muted-foreground mt-2">{entrainement.notes}</p>
                  )}
                </div>
                
                <Badge variant={entrainement.type_entrainement === 'interne' ? 'default' : 'secondary'}>
                  {entrainement.type_entrainement}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EntrainementInterneForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={() => {
          setShowForm(false);
          refetch();
        }}
      />
    </div>
  );
}
