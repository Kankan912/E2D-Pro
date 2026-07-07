import { Trophy } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import BackButton from "@/components/BackButton";
import { useForm } from "react-hook-form";

export default function MatchGalaConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["match-gala-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_gala_config")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { register, handleSubmit, setValue } = useForm<any>({
    values: config || {},
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("match_gala_config")
        .update(data)
        .eq("id", config?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match-gala-config"] });
      toast({ title: "Configuration mise à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: any) => {
    updateMutation.mutate(data);
  };

  if (isLoading) return <p>Chargement...</p>;

  return (
    <div className="container mx-auto space-y-6">
      <BackButton />
      <div className="flex items-center gap-2">
        <Trophy className="h-8 w-8 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold">Configuration Match de Gala</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Critères d'Éligibilité</CardTitle>
          <CardDescription>
            Définissez les critères pour qu'un joueur soit éligible au match de gala annuel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Activer le Match de Gala</Label>
                <p className="text-sm text-muted-foreground">
                  Active ou désactive la fonctionnalité
                </p>
              </div>
              <Switch
                checked={config?.actif}
                onCheckedChange={(checked) => setValue("actif", checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre_matchs_minimum">Nombre minimum de matchs joués</Label>
              <Input
                id="nombre_matchs_minimum"
                type="number"
                min={0}
                {...register("nombre_matchs_minimum")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pourcentage_presence_minimum">
                Pourcentage minimum de présence aux entraînements (%)
              </Label>
              <Input
                id="pourcentage_presence_minimum"
                type="number"
                min={0}
                max={100}
                {...register("pourcentage_presence_minimum")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taux_cotisation_minimum">
                Taux minimum de cotisations payées (%)
              </Label>
              <Input
                id="taux_cotisation_minimum"
                type="number"
                min={0}
                max={100}
                {...register("taux_cotisation_minimum")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sanctions_max">Nombre maximum de sanctions tolérées</Label>
              <Input
                id="sanctions_max"
                type="number"
                min={0}
                {...register("sanctions_max")}
              />
            </div>

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
