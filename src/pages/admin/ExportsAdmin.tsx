import { Download, Plus, Edit, Trash2, Play } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BackButton from "@/components/BackButton";
import ExportConfigForm from "@/components/forms/ExportConfigForm";
import { toast } from "@/hooks/use-toast";
import { ExportService } from "@/lib/exportService";
import { usePermissions } from "@/hooks/usePermissions";

interface ExportsAdminProps {
  embedded?: boolean;
}

export default function ExportsAdmin({ embedded = false }: ExportsAdminProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedExport, setSelectedExport] = useState<unknown>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { hasPermission, enforcePermission } = usePermissions();

  const canCreate = hasPermission('exports', 'create');
  const canUpdate = hasPermission('exports', 'update');
  const canDelete = hasPermission('exports', 'delete');

  const { data: exports, isLoading } = useQuery({
    queryKey: ["exports-programmes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exports_programmes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createExport = useMutation({
    mutationFn: async (data: unknown) => {
      const { error } = await supabase.from('exports_programmes').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Export créé avec succès" });
      queryClient.invalidateQueries({ queryKey: ['exports-programmes'] });
      setFormOpen(false);
    }
  });

  const updateExport = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: unknown}) => {
      const { error } = await supabase.from('exports_programmes').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Export modifié" });
      queryClient.invalidateQueries({ queryKey: ['exports-programmes'] });
      setFormOpen(false);
      setSelectedExport(null);
    }
  });

  const deleteExport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exports_programmes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Export supprimé" });
      queryClient.invalidateQueries({ queryKey: ['exports-programmes'] });
      setDeleteId(null);
    }
  });

  const executeExport = async (exp: unknown) => {
    try {
      toast({ title: "Export en cours...", description: "Génération du fichier" });
      
      await ExportService.export({
        type: exp.type,
        format: exp.format,
        nom: exp.nom,
        configuration: exp.configuration
      });

      await supabase
        .from('exports_programmes')
        .update({ dernier_export: new Date().toISOString() })
        .eq('id', exp.id);

      queryClient.invalidateQueries({ queryKey: ['exports-programmes'] });
      toast({ title: "Export réussi", description: "Le fichier a été téléchargé" });
    } catch (error: unknown) {
      toast({ 
        title: "Erreur lors de l'export", 
        description: "Impossible de générer le fichier",
        variant: "destructive" 
      });
    }
  };

  const handleSubmit = (data: unknown) => {
    if (selectedExport) {
      if (!enforcePermission('exports', 'update')) return;
      updateExport.mutate({ id: selectedExport.id, data });
    } else {
      if (!enforcePermission('exports', 'create')) return;
      createExport.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (!enforcePermission('exports', 'delete')) return;
    setDeleteId(id);
  };

  return (
    <div className={embedded ? "space-y-6" : "container mx-auto space-y-6"}>
      {!embedded && (
        <>
          <BackButton />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-8 w-8 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold">Exports Programmés</h1>
            </div>
            {canCreate && (
              <Button onClick={() => { setSelectedExport(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvel Export
              </Button>
            )}
          </div>
          <p className="text-muted-foreground">
            Configurez des exports automatiques de vos données (membres, finances, matchs, etc.)
          </p>
        </>
      )}
      {embedded && canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => { setSelectedExport(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvel Export
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Exports Configurés</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Chargement...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Fréquence</TableHead>
                  <TableHead>Dernier Export</TableHead>
                  <TableHead>Prochain Export</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports?.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell className="font-medium">{exp.nom}</TableCell>
                    <TableCell>{exp.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{exp.format.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>{exp.frequence}</TableCell>
                    <TableCell>
                      {exp.dernier_export
                        ? new Date(exp.dernier_export).toLocaleDateString()
                        : "Jamais"}
                    </TableCell>
                    <TableCell>
                      {exp.prochain_export
                        ? new Date(exp.prochain_export).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={exp.actif ? "default" : "secondary"}>
                        {exp.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => executeExport(exp)}>
                          <Play className="h-4 w-4" />
                        </Button>
                        {canUpdate && (
                          <Button size="sm" variant="outline" onClick={() => { setSelectedExport(exp); setFormOpen(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(exp.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExportConfigForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setSelectedExport(null); }}
        onSubmit={handleSubmit}
        initialData={selectedExport}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet export programmé ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteExport.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
