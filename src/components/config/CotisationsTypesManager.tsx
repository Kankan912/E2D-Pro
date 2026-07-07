import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatFCFA } from "@/lib/utils";

interface CotisationType {
  id: string;
  nom: string;
  description: string | null;
  montant_defaut: number | null;
  obligatoire: boolean | null;
  created_at: string;
}

interface FormData {
  nom: string;
  description: string;
  montant_defaut: number;
  obligatoire: boolean;
}

export function CotisationsTypesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<CotisationType | null>(null);
  const [formData, setFormData] = useState<FormData>({
    nom: "",
    description: "",
    montant_defaut: 0,
    obligatoire: false,
  });

  const { data: types, isLoading } = useQuery({
    queryKey: ["cotisations_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotisations_types")
        .select("*")
        .order("nom");
      
      if (error) throw error;
      return data as CotisationType[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase
        .from("cotisations_types")
        .insert([data]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotisations_types"] });
      toast({ title: "Type de cotisation créé avec succès" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData> }) => {
      const { error } = await supabase
        .from("cotisations_types")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotisations_types"] });
      toast({ title: "Type de cotisation modifié avec succès" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cotisations_types")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotisations_types"] });
      toast({ title: "Type de cotisation supprimé" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      nom: "",
      description: "",
      montant_defaut: 0,
      obligatoire: false,
    });
    setEditingType(null);
    setDialogOpen(false);
  };

  const handleEdit = (type: CotisationType) => {
    setEditingType(type);
    setFormData({
      nom: type.nom,
      description: type.description || "",
      montant_defaut: type.montant_defaut || 0,
      obligatoire: type.obligatoire || false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data: formData });
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Types de Cotisations
            </CardTitle>
            <CardDescription>
              Configurez les différents types de cotisations de l'association
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
                  {editingType ? "Modifier le type" : "Nouveau type de cotisation"}
                </DialogTitle>
                <DialogDescription>
                  {editingType 
                    ? "Modifiez les informations du type de cotisation"
                    : "Créez un nouveau type de cotisation"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom</Label>
                  <Input
                    id="nom"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    placeholder="Ex: Cotisation mensuelle"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description du type de cotisation..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="montant">Montant par défaut (FCFA)</Label>
                  <Input
                    id="montant"
                    type="number"
                    value={formData.montant_defaut}
                    onChange={(e) => setFormData({ ...formData, montant_defaut: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="obligatoire">Cotisation obligatoire</Label>
                    <p className="text-sm text-muted-foreground">
                      Les membres doivent payer cette cotisation
                    </p>
                  </div>
                  <Switch
                    id="obligatoire"
                    checked={formData.obligatoire}
                    onCheckedChange={(checked) => setFormData({ ...formData, obligatoire: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Annuler
                </Button>
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
              <TableHead>Description</TableHead>
              <TableHead>Montant défaut</TableHead>
              <TableHead>Obligatoire</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types?.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="font-medium">{type.nom}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {type.description || "-"}
                </TableCell>
                <TableCell>{formatFCFA(type.montant_defaut || 0)}</TableCell>
                <TableCell>
                  <Badge variant={type.obligatoire ? "default" : "secondary"}>
                    {type.obligatoire ? "Oui" : "Non"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleEdit(type)}
                  >
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
                          Cette action supprimera le type de cotisation "{type.nom}".
                          Les cotisations existantes ne seront pas affectées.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => deleteMutation.mutate(type.id)}
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
                  Aucun type de cotisation configuré
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
