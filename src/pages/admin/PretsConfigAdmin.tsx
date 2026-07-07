import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import BackButton from "@/components/BackButton";
import { Settings, Save, RefreshCw, Percent, Calendar, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PretsConfigAdminProps {
  embedded?: boolean;
}

export default function PretsConfigAdmin({ embedded = false }: PretsConfigAdminProps) {
  const queryClient = useQueryClient();
  
  const [dureeMois, setDureeMois] = useState(2);
  const [dureeReconduction, setDureeReconduction] = useState(2);
  const [maxReconductions, setMaxReconductions] = useState(3);
  const [tauxInteretDefaut, setTauxInteretDefaut] = useState(5);
  const [interetAvantCapital, setInteretAvantCapital] = useState(true);

  const { data: config, isLoading } = useQuery({
    queryKey: ["prets-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prets_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Charger les valeurs de la config
  useEffect(() => {
    if (config) {
      setDureeMois(config.duree_mois || 2);
      setDureeReconduction(config.duree_reconduction || 2);
      setMaxReconductions(config.max_reconductions || 3);
      setTauxInteretDefaut(config.taux_interet_defaut || 5);
      setInteretAvantCapital(config.interet_avant_capital ?? true);
    }
  }, [config]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (config?.id) {
        const { error } = await supabase
          .from("prets_config")
          .update({
            duree_mois: dureeMois,
            duree_reconduction: dureeReconduction,
            max_reconductions: maxReconductions,
            taux_interet_defaut: tauxInteretDefaut,
            interet_avant_capital: interetAvantCapital,
          })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("prets_config")
          .insert({
            duree_mois: dureeMois,
            duree_reconduction: dureeReconduction,
            max_reconductions: maxReconductions,
            taux_interet_defaut: tauxInteretDefaut,
            interet_avant_capital: interetAvantCapital,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Configuration sauvegardée avec succès" });
      queryClient.invalidateQueries({ queryKey: ["prets-config"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur lors de la sauvegarde", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  if (isLoading) {
    return (
      <div className={embedded ? "flex items-center justify-center py-8" : "container mx-auto flex items-center justify-center"}>
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const content = (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Durées */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Durées
            </CardTitle>
            <CardDescription>Paramètres de durée pour les prêts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="dureeMois">Durée initiale du prêt (mois)</Label>
              <Input
                id="dureeMois"
                type="number"
                min={1}
                max={24}
                value={dureeMois}
                onChange={(e) => setDureeMois(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Échéance calculée à partir de la date de réunion + {dureeMois} mois
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dureeReconduction">Durée de reconduction (mois)</Label>
              <Input
                id="dureeReconduction"
                type="number"
                min={1}
                max={12}
                value={dureeReconduction}
                onChange={(e) => setDureeReconduction(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Chaque reconduction ajoute {dureeReconduction} mois à l'échéance
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxReconductions">Nombre maximum de reconductions</Label>
              <Input
                id="maxReconductions"
                type="number"
                min={0}
                max={10}
                value={maxReconductions}
                onChange={(e) => setMaxReconductions(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Un prêt peut être reconduit au maximum {maxReconductions} fois
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Taux et règles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Taux & Règles
            </CardTitle>
            <CardDescription>Paramètres financiers des prêts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tauxInteret">Taux d'intérêt par défaut (%)</Label>
              <Input
                id="tauxInteret"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={tauxInteretDefaut}
                onChange={(e) => setTauxInteretDefaut(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Taux appliqué par défaut lors de la création d'un prêt
              </p>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="interetAvantCapital">Intérêt avant capital</Label>
                <p className="text-xs text-muted-foreground">
                  L'intérêt doit être payé avant de rembourser le capital
                </p>
              </div>
              <Switch
                id="interetAvantCapital"
                checked={interetAvantCapital}
                onCheckedChange={setInteretAvantCapital}
              />
            </div>

            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 dark:text-blue-400">
                <strong>Règle de reconduction :</strong> Le nouvel intérêt est calculé sur le <strong>capital restant</strong> uniquement, pas sur le solde total.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Résumé */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Résumé de la Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="text-center p-4 bg-background rounded-lg border">
              <p className="text-2xl sm:text-3xl font-bold text-primary">{dureeMois}</p>
              <p className="text-sm text-muted-foreground">mois (durée initiale)</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border">
              <p className="text-2xl sm:text-3xl font-bold text-blue-600">+{dureeReconduction}</p>
              <p className="text-sm text-muted-foreground">mois par reconduction</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border">
              <p className="text-2xl sm:text-3xl font-bold text-orange-600">{maxReconductions}</p>
              <p className="text-sm text-muted-foreground">reconductions max</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border">
              <p className="text-2xl sm:text-3xl font-bold text-green-600">{tauxInteretDefaut}%</p>
              <p className="text-sm text-muted-foreground">taux d'intérêt</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border">
              <p className="text-2xl sm:text-3xl font-bold">{interetAvantCapital ? "Oui" : "Non"}</p>
              <p className="text-sm text-muted-foreground">intérêt d'abord</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          size="lg" 
          onClick={() => saveConfig.mutate()}
          disabled={saveConfig.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {saveConfig.isPending ? "Sauvegarde..." : "Sauvegarder la Configuration"}
        </Button>
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return (
    <div className="container mx-auto space-y-6">
      <BackButton />
      
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Configuration des Prêts</h1>
          <p className="text-muted-foreground">Paramètres globaux pour la gestion des prêts</p>
        </div>
      </div>

      {content}
    </div>
  );
}
