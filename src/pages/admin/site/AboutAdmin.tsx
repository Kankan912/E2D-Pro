import { useState, useEffect } from "react";
import { useSiteAbout, useUpdateAbout } from "@/hooks/useSiteContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Eye, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BackButton from "@/components/BackButton";
import { aboutSchema } from "@/lib/validation/site-schemas";

interface Valeur {
  icone: string;
  titre: string;
  description: string;
}

const AboutAdmin = () => {
  const { data: about, isLoading } = useSiteAbout();
  const updateAbout = useUpdateAbout();

  const [formData, setFormData] = useState({
    titre: "",
    sous_titre: "",
    histoire_titre: "",
    histoire_contenu: "",
    valeurs: [] as Valeur[],
  });

  useEffect(() => {
    if (about) {
      setFormData({
        titre: about.titre || "",
        sous_titre: about.sous_titre || "",
        histoire_titre: about.histoire_titre || "",
        histoire_contenu: about.histoire_contenu || "",
        valeurs: Array.isArray(about.valeurs) ? (about.valeurs as unknown as Valeur[]) : [],
      });
    }
  }, [about]);

  const handleSave = async () => {
    if (!about?.id) {
      toast({ title: "Erreur", description: "Données non chargées", variant: "destructive" });
      return;
    }

    const parsed = aboutSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Données invalides";
      toast({ title: "Validation", description: firstError, variant: "destructive" });
      return;
    }

    try {
      await updateAbout.mutateAsync({
        id: about.id,
        ...parsed.data,
      });
      toast({ title: "Succès", description: "Section À Propos mise à jour" });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: "Échec de la mise à jour", variant: "destructive" });
    }
  };

  const addValeur = () => {
    setFormData({
      ...formData,
      valeurs: [...formData.valeurs, { icone: "Heart", titre: "", description: "" }],
    });
  };

  const updateValeur = (index: number, field: keyof Valeur, value: string) => {
    const newValeurs = [...formData.valeurs];
    newValeurs[index] = { ...newValeurs[index], [field]: value };
    setFormData({ ...formData, valeurs: newValeurs });
  };

  const removeValeur = (index: number) => {
    const newValeurs = formData.valeurs.filter((_, i) => i !== index);
    setFormData({ ...formData, valeurs: newValeurs });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Section À Propos</h1>
            <p className="text-muted-foreground">Gérez le contenu de la section À Propos du site</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open("/#apropos", "_blank")}>
            <Eye className="h-4 w-4 mr-2" />
            Prévisualiser
          </Button>
          <Button onClick={handleSave} disabled={updateAbout.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateAbout.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Titre Principal */}
        <Card>
          <CardHeader>
            <CardTitle>Titre Section</CardTitle>
            <CardDescription>Le titre et sous-titre de la section</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titre">Titre</Label>
              <Input
                id="titre"
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                placeholder="À Propos de Nous"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sous_titre">Sous-titre</Label>
              <Textarea
                id="sous_titre"
                value={formData.sous_titre}
                onChange={(e) => setFormData({ ...formData, sous_titre: e.target.value })}
                placeholder="Décrivez brièvement l'association..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Histoire */}
        <Card>
          <CardHeader>
            <CardTitle>Notre Histoire</CardTitle>
            <CardDescription>Le récit de l'association</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="histoire_titre">Titre</Label>
              <Input
                id="histoire_titre"
                value={formData.histoire_titre}
                onChange={(e) => setFormData({ ...formData, histoire_titre: e.target.value })}
                placeholder="Notre Histoire"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="histoire_contenu">Contenu</Label>
              <Textarea
                id="histoire_contenu"
                value={formData.histoire_contenu}
                onChange={(e) => setFormData({ ...formData, histoire_contenu: e.target.value })}
                placeholder="Racontez l'histoire de l'association..."
                rows={6}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Valeurs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Nos Valeurs</CardTitle>
              <CardDescription>Les valeurs fondamentales de l'association</CardDescription>
            </div>
            <Button onClick={addValeur} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une valeur
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {formData.valeurs.map((valeur, index) => (
              <Card key={index} className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer cette valeur"
                  className="absolute top-2 right-2 h-8 w-8 text-destructive"
                  onClick={() => removeValeur(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Icône</Label>
                    <Input
                      value={valeur.icone}
                      onChange={(e) => updateValeur(index, "icone", e.target.value)}
                      placeholder="Heart, Users, Trophy..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Titre</Label>
                    <Input
                      value={valeur.titre}
                      onChange={(e) => updateValeur(index, "titre", e.target.value)}
                      placeholder="Titre de la valeur"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={valeur.description}
                      onChange={(e) => updateValeur(index, "description", e.target.value)}
                      placeholder="Description courte..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {formData.valeurs.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Aucune valeur définie. Cliquez sur "Ajouter une valeur" pour commencer.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AboutAdmin;
