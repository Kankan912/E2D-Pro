import { useState } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useSiteConfig, useUpdateConfig } from "@/hooks/useSiteContent";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { validateConfigValue } from "@/lib/validation/site-schemas";

type ConfigRow = { cle: string; valeur: string; categorie: string; type?: string | null; description?: string | null };

export default function ConfigAdmin() {
  const { data: configs, isLoading } = useSiteConfig();
  const updateConfig = useUpdateConfig();
  const { register, handleSubmit } = useForm();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const configsByCategory = (configs as ConfigRow[] | undefined)?.reduce(
    (acc: Record<string, ConfigRow[]>, config) => {
      if (!acc[config.categorie]) acc[config.categorie] = [];
      acc[config.categorie].push(config);
      return acc;
    },
    {},
  );

  const onSubmit = (data: Record<string, string>) => {
    const errors: Record<string, string> = {};
    const typeByKey: Record<string, string | null | undefined> = {};
    (configs as ConfigRow[] | undefined)?.forEach((c) => {
      typeByKey[c.cle] = c.type;
    });

    Object.entries(data).forEach(([cle, valeur]) => {
      const err = validateConfigValue(typeByKey[cle], valeur ?? "");
      if (err) errors[cle] = err;
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Certaines valeurs sont invalides");
      return;
    }

    setFieldErrors({});
    Object.entries(data).forEach(([cle, valeur]) => {
      updateConfig.mutate({ cle, valeur });
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Configuration du Site</h1>
        <p className="text-muted-foreground">
          Gérez les paramètres généraux du site web
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="social">Réseaux Sociaux</TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">
          {Object.entries(configsByCategory || {}).map(([categorie, configList]) => (
            <TabsContent key={categorie} value={categorie}>
              <Card>
                <CardHeader>
                  <CardTitle className="capitalize">{categorie}</CardTitle>
                  <CardDescription>Paramètres de {categorie}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {configList.map((config) => (
                    <div key={config.cle} className="space-y-2">
                      <Label htmlFor={config.cle}>
                        {config.description || config.cle}
                      </Label>
                      <Input
                        id={config.cle}
                        type={config.type === "email" ? "email" : config.type === "url" ? "url" : "text"}
                        defaultValue={config.valeur}
                        maxLength={2048}
                        {...register(config.cle)}
                      />
                      {fieldErrors[config.cle] && (
                        <p className="text-xs text-destructive mt-1">{fieldErrors[config.cle]}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          <div className="flex justify-end">
            <Button type="submit" disabled={updateConfig.isPending}>
              {updateConfig.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Enregistrer les modifications
            </Button>
          </div>
        </form>
      </Tabs>
    </div>
  );
}
