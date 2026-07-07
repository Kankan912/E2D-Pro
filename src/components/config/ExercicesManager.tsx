import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Edit, Lock, Trash2, Loader2, Percent, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";

const safeFormat = (dateStr: string | null | undefined, fmt: string, options?: any) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return format(d, fmt, options);
};
import { fr } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CotisationsClotureExerciceCheck } from "@/components/CotisationsClotureExerciceCheck";
import { formatFCFA } from "@/lib/utils";

interface Exercice {
  id: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  croissance_fond_caisse: number | null;
  plafond_fond_caisse: number | null;
  taux_interet_prets: number | null;
  created_at: string;
}

interface ExerciceFormData {
  nom: string;
  date_debut: string;
  date_fin: string;
  croissance_fond_caisse: number;
  plafond_fond_caisse: number;
  taux_interet_prets: number;
}

export function ExercicesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clotureCheckDialogOpen, setClotureCheckDialogOpen] = useState(false);
  const [selectedExerciceForCloture, setSelectedExerciceForCloture] = useState<Exercice | null>(null);
  const [editingExercice, setEditingExercice] = useState<Exercice | null>(null);
  const [formData, setFormData] = useState<ExerciceFormData>({
    nom: "",
    date_debut: "",
    date_fin: "",
    croissance_fond_caisse: 5000,
    plafond_fond_caisse: 50000,
    taux_interet_prets: 5,
  });

  const { data: exercices, isLoading } = useQuery({
    queryKey: ["exercices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices")
        .select("*")
        .order("date_debut", { ascending: false });
      
      if (error) throw error;
      return data as Exercice[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExerciceFormData) => {
      const { error } = await supabase
        .from("exercices")
        .insert([data]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercices"] });
      toast({ title: "Exercice créé avec succès" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ExerciceFormData> }) => {
      const { error } = await supabase
        .from("exercices")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercices"] });
      toast({ title: "Exercice modifié avec succès" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("exercices")
        .update({ statut: "cloture" })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercices"] });
      toast({ title: "Exercice clôturé avec succès" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("exercices")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercices"] });
      toast({ title: "Exercice supprimé avec succès" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      nom: "",
      date_debut: "",
      date_fin: "",
      croissance_fond_caisse: 5000,
      plafond_fond_caisse: 50000,
      taux_interet_prets: 5,
    });
    setEditingExercice(null);
    setDialogOpen(false);
  };

  const handleEdit = (exercice: Exercice) => {
    setEditingExercice(exercice);
    setFormData({
      nom: exercice.nom,
      date_debut: exercice.date_debut,
      date_fin: exercice.date_fin,
      croissance_fond_caisse: exercice.croissance_fond_caisse || 5000,
      plafond_fond_caisse: exercice.plafond_fond_caisse || 50000,
      taux_interet_prets: exercice.taux_interet_prets || 5,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingExercice) {
      updateMutation.mutate({ id: editingExercice.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const activeExercice = exercices?.find(e => e.statut === "actif");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Gestion des Exercices
            </CardTitle>
            <CardDescription>
              Créez et gérez les exercices comptables de l'association
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvel Exercice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingExercice ? "Modifier l'exercice" : "Nouvel exercice"}
                </DialogTitle>
                <DialogDescription>
                  {editingExercice 
                    ? "Modifiez les informations de l'exercice"
                    : "Créez un nouvel exercice comptable"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom de l'exercice</Label>
                  <Input
                    id="nom"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    placeholder="Ex: Exercice 2025"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_debut">Date de début</Label>
                    <Input
                      id="date_debut"
                      type="date"
                      value={formData.date_debut}
                      onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_fin">Date de fin</Label>
                    <Input
                      id="date_fin"
                      type="date"
                      value={formData.date_fin}
                      onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                    />
                  </div>
                </div>
                
                {/* Taux d'intérêt prêts */}
                <div className="space-y-2">
                  <Label htmlFor="taux_interet" className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-amber-600" />
                    Taux d'intérêt prêts (%)
                  </Label>
                  <Input
                    id="taux_interet"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.taux_interet_prets}
                    onChange={(e) => setFormData({ ...formData, taux_interet_prets: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ce taux sera appliqué par défaut aux nouveaux prêts de cet exercice
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="croissance">Croissance fond de caisse (FCFA)</Label>
                    <Input
                      id="croissance"
                      type="number"
                      value={formData.croissance_fond_caisse}
                      onChange={(e) => setFormData({ ...formData, croissance_fond_caisse: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plafond">Plafond fond de caisse (FCFA)</Label>
                    <Input
                      id="plafond"
                      type="number"
                      value={formData.plafond_fond_caisse}
                      onChange={(e) => setFormData({ ...formData, plafond_fond_caisse: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Annuler
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!formData.nom || !formData.date_debut || !formData.date_fin}
                >
                  {editingExercice ? "Modifier" : "Créer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {activeExercice && (
          <div className="mb-4 p-4 bg-primary/10 rounded-lg">
            <p className="text-sm font-medium">Exercice actif :</p>
            <p className="text-lg font-bold">{activeExercice.nom}</p>
            <p className="text-sm text-muted-foreground">
              Du {safeFormat(activeExercice.date_debut, "d MMMM yyyy", { locale: fr })} au{" "}
              {safeFormat(activeExercice.date_fin, "d MMMM yyyy", { locale: fr })}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <Percent className="h-3 w-3 mr-1" />
                Taux prêts: {activeExercice.taux_interet_prets || 5}%
              </Badge>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Taux Prêts</TableHead>
              <TableHead>Croissance Fond</TableHead>
              <TableHead>Plafond</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exercices?.map((exercice) => (
              <TableRow key={exercice.id}>
                <TableCell className="font-medium">{exercice.nom}</TableCell>
                <TableCell>
                  {safeFormat(exercice.date_debut, "dd/MM/yyyy")} -{" "}
                  {safeFormat(exercice.date_fin, "dd/MM/yyyy")}
                </TableCell>
                <TableCell>
                  <Badge variant={exercice.statut === "actif" ? "default" : "secondary"}>
                    {exercice.statut === "actif" ? "Actif" : "Clôturé"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                    {exercice.taux_interet_prets || 5}%
                  </Badge>
                </TableCell>
                <TableCell>{formatFCFA(exercice.croissance_fond_caisse || 0)}</TableCell>
                <TableCell>{formatFCFA(exercice.plafond_fond_caisse || 0)}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleEdit(exercice)}
                    disabled={exercice.statut === "cloture"}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {exercice.statut === "actif" && (
                    <>
                      {/* Bouton vérification cotisations */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSelectedExerciceForCloture(exercice);
                          setClotureCheckDialogOpen(true);
                        }}
                        title="Vérifier les cotisations avant clôture"
                      >
                        <ClipboardCheck className="h-4 w-4" />
                      </Button>
                      
                      {/* Bouton clôture */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon">
                            <Lock className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Clôturer l'exercice ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. L'exercice "{exercice.nom}" sera 
                              définitivement clôturé et ne pourra plus être modifié.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => closeMutation.mutate(exercice.id)}>
                              Clôturer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                  {exercice.statut === "cloture" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer l'exercice ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action supprimera définitivement l'exercice "{exercice.nom}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteMutation.mutate(exercice.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!exercices?.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Aucun exercice configuré
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      
      {/* Dialog de vérification des cotisations avant clôture */}
      <Dialog open={clotureCheckDialogOpen} onOpenChange={setClotureCheckDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Vérification avant clôture - {selectedExerciceForCloture?.nom}
            </DialogTitle>
            <DialogDescription>
              Vérifiez que toutes les cotisations obligatoires sont soldées avant de clôturer l'exercice.
            </DialogDescription>
          </DialogHeader>
          {selectedExerciceForCloture && (
            <CotisationsClotureExerciceCheck exerciceId={selectedExerciceForCloture.id} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClotureCheckDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
