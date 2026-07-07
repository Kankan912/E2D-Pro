import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PhoenixEquipesManager() {
  const { data: adherents } = useQuery({
    queryKey: ['phoenix-adherents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('*')
        .eq('est_adherent_phoenix', true)
        .eq('statut', 'actif')
        .order('nom');
      
      if (error) throw error;
      return data;
    }
  });

  const equipeJaune = adherents?.filter(a => a.equipe_jaune_rouge === 'jaune') || [];
  const equipeRouge = adherents?.filter(a => a.equipe_jaune_rouge === 'rouge') || [];

  const EquipeCard = ({ equipe, couleur }: { equipe: any[], couleur: 'jaune' | 'rouge' }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className={`h-5 w-5 ${couleur === 'jaune' ? 'text-yellow-500' : 'text-red-500'}`} />
          Équipe {couleur.charAt(0).toUpperCase() + couleur.slice(1)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              {equipe.length} joueur{equipe.length > 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="grid gap-3">
            {equipe.map((joueur) => (
              <div key={joueur.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{joueur.nom} {joueur.prenom}</p>
                    {joueur.poste && (
                      <p className="text-sm text-muted-foreground">{joueur.poste}</p>
                    )}
                  </div>
                </div>
                {joueur.numero_maillot && (
                  <Badge variant="outline">#{joueur.numero_maillot}</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Gestion des Équipes Phoenix</h2>

      <Tabs defaultValue="jaune" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="jaune">
            Équipe Jaune ({equipeJaune.length})
          </TabsTrigger>
          <TabsTrigger value="rouge">
            Équipe Rouge ({equipeRouge.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jaune">
          <EquipeCard equipe={equipeJaune} couleur="jaune" />
        </TabsContent>

        <TabsContent value="rouge">
          <EquipeCard equipe={equipeRouge} couleur="rouge" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
