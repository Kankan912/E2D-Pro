import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Save, Loader2 } from "lucide-react";

interface Configuration {
  id: string;
  cle: string;
  valeur: string;
  description: string | null;
}

const DEFAULT_CONFIGS = [
  { cle: "nom_association", valeur: "E2D - Ensemble pour le Développement Durable", description: "Nom complet de l'association" },
  { cle: "sigle_association", valeur: "E2D", description: "Sigle de l'association" },
  { cle: "adresse_siege", valeur: "", description: "Adresse du siège social" },
  { cle: "telephone_contact", valeur: "", description: "Téléphone de contact" },
  { cle: "email_contact", valeur: "", description: "Email de contact" },
  { cle: "site_web", valeur: "", description: "Site web officiel" },
  { cle: "numero_siren", valeur: "", description: "Numéro SIREN" },
  { cle: "date_creation", valeur: "", description: "Date de création de l'association" },
  { cle: "president_nom", valeur: "", description: "Nom du président" },
  { cle: "tresorier_nom", valeur: "", description: "Nom du trésorier" },
  { cle: "secretaire_nom", valeur: "", description: "Nom du secrétaire général" },
];

export function GestionGeneraleManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: configs, isLoading } = useQuery({
    queryKey: ["configurations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configurations")
        .select("*")
        .order("cle");
      
      if (error) throw error;
      return data as Configuration[];
    },
  });

  useEffect(() => {
    if (configs) {
      const data: Record<string, string> = {};
      DEFAULT_CONFIGS.forEach(config => {
        const existing = configs.find(c => c.cle === config.cle);
        data[config.cle] = existing?.valeur || config.valeur;
      });
      setFormData(data);
    }
  }, [configs]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [cle, valeur] of Object.entries(formData)) {
        const defaultConfig = DEFAULT_CONFIGS.find(c => c.cle === cle);
        const existing = configs?.find(c => c.cle === cle);
        
        if (existing) {
          await supabase
            .from("configurations")
            .update({ valeur })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("configurations")
            .insert([{ 
              cle, 
              valeur, 
              description: defaultConfig?.description || null 
            }]);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurations"] });
      toast({ title: "Configuration sauvegardée avec succès" });
      setHasChanges(false);
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleChange = (cle: string, valeur: string) => {
    setFormData(prev => ({ ...prev, [cle]: valeur }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Paramètres Généraux
              </CardTitle>
              <CardDescription>
                Informations de base de l'association
              </CardDescription>
            </div>
            <Button 
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Sauvegarder
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Identité de l'association */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Identité</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nom_association">Nom de l'association</Label>
                <Input
                  id="nom_association"
                  value={formData.nom_association || ""}
                  onChange={(e) => handleChange("nom_association", e.target.value)}
                  placeholder="Nom complet de l'association"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sigle_association">Sigle</Label>
                <Input
                  id="sigle_association"
                  value={formData.sigle_association || ""}
                  onChange={(e) => handleChange("sigle_association", e.target.value)}
                  placeholder="Sigle (ex: E2D)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero_siren">Numéro SIREN</Label>
                <Input
                  id="numero_siren"
                  value={formData.numero_siren || ""}
                  onChange={(e) => handleChange("numero_siren", e.target.value)}
                  placeholder="Numéro SIREN"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_creation">Date de création</Label>
                <Input
                  id="date_creation"
                  type="date"
                  value={formData.date_creation || ""}
                  onChange={(e) => handleChange("date_creation", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="adresse_siege">Adresse du siège</Label>
                <Textarea
                  id="adresse_siege"
                  value={formData.adresse_siege || ""}
                  onChange={(e) => handleChange("adresse_siege", e.target.value)}
                  placeholder="Adresse complète du siège social"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephone_contact">Téléphone</Label>
                <Input
                  id="telephone_contact"
                  value={formData.telephone_contact || ""}
                  onChange={(e) => handleChange("telephone_contact", e.target.value)}
                  placeholder="+33 1 23 45 67 89"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_contact">Email</Label>
                <Input
                  id="email_contact"
                  type="email"
                  value={formData.email_contact || ""}
                  onChange={(e) => handleChange("email_contact", e.target.value)}
                  placeholder="contact@e2d.fr"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="site_web">Site web</Label>
                <Input
                  id="site_web"
                  value={formData.site_web || ""}
                  onChange={(e) => handleChange("site_web", e.target.value)}
                  placeholder="https://www.e2d.fr"
                />
              </div>
            </div>
          </div>

          {/* Bureau */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Bureau</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="president_nom">Président</Label>
                <Input
                  id="president_nom"
                  value={formData.president_nom || ""}
                  onChange={(e) => handleChange("president_nom", e.target.value)}
                  placeholder="Nom du président"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tresorier_nom">Trésorier</Label>
                <Input
                  id="tresorier_nom"
                  value={formData.tresorier_nom || ""}
                  onChange={(e) => handleChange("tresorier_nom", e.target.value)}
                  placeholder="Nom du trésorier"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretaire_nom">Secrétaire Général</Label>
                <Input
                  id="secretaire_nom"
                  value={formData.secretaire_nom || ""}
                  onChange={(e) => handleChange("secretaire_nom", e.target.value)}
                  placeholder="Nom du secrétaire"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
