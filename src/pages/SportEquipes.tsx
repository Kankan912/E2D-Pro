import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BackButton from "@/components/BackButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SportEquipes() {
  const { data: membresE2D } = useQuery({
    queryKey: ["membres-e2d"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("*")
        .eq("est_membre_e2d", true)
        .eq("statut", "actif")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const { data: membresPhoenix } = useQuery({
    queryKey: ["membres-phoenix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("*")
        .eq("est_adherent_phoenix", true)
        .eq("statut", "actif")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container mx-auto space-y-6">
      <BackButton />
      <div className="flex items-center gap-2">
        <Users className="h-8 w-8 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold">Gestion des Équipes</h1>
      </div>

      <Tabs defaultValue="e2d" className="space-y-6">
        <TabsList>
          <TabsTrigger value="e2d">Équipe E2D</TabsTrigger>
          <TabsTrigger value="phoenix">Équipe Phoenix</TabsTrigger>
        </TabsList>

        <TabsContent value="e2d" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Effectif E2D ({membresE2D?.length || 0} joueurs)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {membresE2D?.map((membre) => (
                  <Card key={membre.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        {membre.photo_url ? (
                          <img
                            src={membre.photo_url}
                            alt={`${membre.nom} ${membre.prenom}`}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-6 h-6 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">
                            {membre.nom} {membre.prenom}
                          </p>
                          {membre.equipe_e2d && (
                            <Badge variant="secondary">{membre.equipe_e2d}</Badge>
                          )}
                          {membre.fonction && (
                            <p className="text-sm text-muted-foreground">{membre.fonction}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phoenix" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-yellow-600">Équipe Jaune</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {membresPhoenix
                    ?.filter((m) => m.equipe_jaune_rouge === "jaune")
                    .map((membre) => (
                      <div key={membre.id} className="flex items-center gap-2 p-2 border rounded">
                        <Users className="w-4 h-4" />
                        <span>
                          {membre.nom} {membre.prenom}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Équipe Rouge</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {membresPhoenix
                    ?.filter((m) => m.equipe_jaune_rouge === "rouge")
                    .map((membre) => (
                      <div key={membre.id} className="flex items-center gap-2 p-2 border rounded">
                        <Users className="w-4 h-4" />
                        <span>
                          {membre.nom} {membre.prenom}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Effectif Complet Phoenix ({membresPhoenix?.length || 0} joueurs)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {membresPhoenix?.map((membre) => (
                  <Card key={membre.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        {membre.photo_url ? (
                          <img
                            src={membre.photo_url}
                            alt={`${membre.nom} ${membre.prenom}`}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-6 h-6 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">
                            {membre.nom} {membre.prenom}
                          </p>
                          {membre.equipe_jaune_rouge && (
                            <Badge
                              variant="secondary"
                              className={
                                membre.equipe_jaune_rouge === "jaune"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }
                            >
                              {membre.equipe_jaune_rouge}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
