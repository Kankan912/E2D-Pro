import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Plus, Edit, Trash2, Loader2, Coins } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatFCFA } from "@/lib/utils";

interface SanctionType {
  id: string;
  nom: string;
  description: string | null;
  categorie: string;
  montant: number;
  created_at: string;
}

interface SanctionTarif {
  id: string;
  type_sanction_id: string;
  categorie_membre: string;
  montant: number;
  created_at: string;
  sanction_type?: SanctionType;
}

interface FormData {
  nom: string;
  description: string;
  categorie: string;
  montant: number;
}

const CATEGORIES = [
  { value: "reunion", label: "Réunion" },
  { value: "sport", label: "Sport" },
  { value: "discipline", label: "Discipline" },
  { value: "financiere", label: "Financière" },
];

const CATEGORIES_MEMBRES = [
  { value: "standard", label: "Membre Standard" },
  { value: "bureau", label: "Membre du Bureau" },
  { value: "president", label: "Président" },
];

export function SanctionsTarifsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tarifDialogOpen, setTarifDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<SanctionType | null>(null);
  const [selectedType, setSelectedType] = useState<SanctionType | null>(null);
  const [formData, setFormData] = useState<FormData>({
    nom: "",
    description: "",
    categorie: "reunion",
    montant: 0,
  });
  const [tarifFormData, setTarifFormData] = useState({
    categorie_membre: "standard",
    montant: 0,
  });

  const { data: types, isLoading } = useQuery({
    queryKey: ["sanctions_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sanctions_types")
        .select("*")
        .order("categorie", { ascending: true });
      
      if (error) throw error;
      return data as SanctionType[];
    },
  });

  const { data: tarifs } = useQuery({
    queryKey: ["sanctions_tarifs", selectedType?.id],
    queryFn: async () => {
      if (!selectedType) return [];
      const { data, error } = await supabase
        .from("sanctions_tarifs")
        .select("*")
        .eq("type_sanction_id", selectedType.id)
        .order("categorie_membre");
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedType,
  });

  const createTypeMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase
        .from("sanctions_types")
        .insert([data]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sanctions_types"] });
      toast({ title: "Type de sanction créé avec succès" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData> }) => {
      const { error } = await supabase
        .from("sanctions_types")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sanctions_types"] });
      toast({ title: "Type de sanction modifié avec succès" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sanctions_types")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sanctions_types"] });
      toast({ title: "Type de sanction supprimé" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const createTarifMutation = useMutation({
    mutationFn: async (data: { type_sanction_id: string; categorie_membre: string; montant: number }) => {
      const { error } = await supabase
        .from("sanctions_tarifs")
        .insert([data]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sanctions_tarifs"] });
      toast({ title: "Tarif ajouté avec succès" });
      setTarifDialogOpen(false);
      setTarifFormData({ categorie_membre: "standard", montant: 0 });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteTarifMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sanctions_tarifs")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sanctions_tarifs"] });
      toast({ title: "Tarif supprimé" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      nom: "",
      description: "",
      categorie: "reunion",
      montant: 0,
    });
    setEditingType(null);
    setDialogOpen(false);
  };

  const handleEdit = (type: SanctionType) => {
    setEditingType(type);
    setFormData({
      nom: type.nom,
      description: type.description || "",
      categorie: type.categorie,
      montant: type.montant,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingType) {
      updateTypeMutation.mutate({ id: editingType.id, data: formData });
    } else {
      createTypeMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const getCategorieLabel = (value: string) => 
    CATEGORIES.find(c => c.value === value)?.label || value;

  const getCategorieMembreLabel = (value: string) =>
    CATEGORIES_MEMBRES.find(c => c.value === value)?.label || value;

  return (
    <Tabs defaultValue="types" className="space-y-4">
      <TabsList>
        <TabsTrigger value="types">Types de Sanctions</TabsTrigger>
        <TabsTrigger value="tarifs">Tarifs par Catégorie</TabsTrigger>
      </TabsList>

      <TabsContent value="types">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Types de Sanctions
                </CardTitle>
                <CardDescription>
                  Configurez les différents types de sanctions applicables
                </CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau Type
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingType ? "Modifier le type" : "Nouveau type de sanction"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="nom">Nom</Label>
                      <Input
                        id="nom"
                        value={formData.nom}
                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                        placeholder="Ex: Absence réunion"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="categorie">Catégorie</Label>
                      <Select
                        value={formData.categorie}
                        onValueChange={(value) => setFormData({ ...formData, categorie: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="montant">Montant par défaut (FCFA)</Label>
                      <Input
                        id="montant"
                        type="number"
                        value={formData.montant}
                        onChange={(e) => setFormData({ ...formData, montant: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={resetForm}>Annuler</Button>
                    <Button onClick={handleSubmit} disabled={!formData.nom}>
                      {editingType ? "Modifier" : "Créer"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Montant défaut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types?.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.nom}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategorieLabel(type.categorie)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{type.description || "-"}</TableCell>
                    <TableCell>{formatFCFA(type.montant)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleEdit(type)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce type ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action supprimera le type "{type.nom}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteTypeMutation.mutate(type.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {!types?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucun type de sanction configuré
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tarifs">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Tarifs par Catégorie de Membre
            </CardTitle>
            <CardDescription>
              Définissez des tarifs différenciés selon la catégorie de membre
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label>Type de sanction :</Label>
              <Select
                value={selectedType?.id || ""}
                onValueChange={(value) => setSelectedType(types?.find(t => t.id === value) || null)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  {types?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <Dialog open={tarifDialogOpen} onOpenChange={setTarifDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter un tarif
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ajouter un tarif</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Catégorie de membre</Label>
                        <Select
                          value={tarifFormData.categorie_membre}
                          onValueChange={(value) => setTarifFormData({ ...tarifFormData, categorie_membre: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES_MEMBRES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Montant (FCFA)</Label>
                        <Input
                          type="number"
                          value={tarifFormData.montant}
                          onChange={(e) => setTarifFormData({ ...tarifFormData, montant: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTarifDialogOpen(false)}>Annuler</Button>
                      <Button onClick={() => createTarifMutation.mutate({
                        type_sanction_id: selectedType.id,
                        ...tarifFormData
                      })}>
                        Ajouter
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {selectedType && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie de Membre</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tarifs?.map((tarif) => (
                    <TableRow key={tarif.id}>
                      <TableCell>{getCategorieMembreLabel(tarif.categorie_membre)}</TableCell>
                      <TableCell>{formatFCFA(tarif.montant)}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => deleteTarifMutation.mutate(tarif.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!tarifs?.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        Aucun tarif spécifique. Le montant par défaut sera appliqué.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {!selectedType && (
              <p className="text-center text-muted-foreground py-8">
                Sélectionnez un type de sanction pour gérer ses tarifs
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
