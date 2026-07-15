/**
 * AssociationsAdmin — Gestion des associations (Super Admin uniquement)
 *
 * Le super_admin peut :
 *  - Créer une nouvelle association
 *  - Modifier une association (nom, code, description, contact)
 *  - Désactiver une association
 *  - Assigner des administrateurs à une association
 */

import { useState } from 'react';
import { Plus, Building2, Edit, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import BackButton from '@/components/BackButton';

interface Association {
  id: string;
  nom: string;
  code: string | null;
  slug: string | null;
  description: string | null;
  contact_email: string | null;
  created_at: string;
}

export default function AssociationsAdmin() {
  const { toast: toastHook } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssoc, setEditingAssoc] = useState<Association | null>(null);
  const [form, setForm] = useState({ nom: '', code: '', description: '', contact_email: '' });

  const { data: associations, isLoading } = useQuery({
    queryKey: ['associations-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associations')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Association[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { nom: string; code: string; description: string; contact_email: string }) => {
      const { error } = await supabase.from('associations').insert({
        nom: data.nom,
        code: data.code || null,
        slug: data.code ? data.code.toLowerCase().replace(/[^a-z0-9]/g, '-') : null,
        description: data.description || null,
        contact_email: data.contact_email || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['associations-admin'] });
      toast.success('Association créée avec succès');
      setDialogOpen(false);
      setForm({ nom: '', code: '', description: '', contact_email: '' });
    },
    onError: (e: unknown) => toast.error('Erreur: ' + (e as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Association>) => {
      const { error } = await supabase
        .from('associations')
        .update({
          nom: data.nom,
          code: data.code,
          description: data.description,
          contact_email: data.contact_email,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['associations-admin'] });
      toast.success('Association mise à jour');
      setDialogOpen(false);
      setEditingAssoc(null);
    },
    onError: (e: unknown) => toast.error('Erreur: ' + (e as Error).message),
  });

  const handleSubmit = () => {
    if (!form.nom) {
      toast.error('Le nom est obligatoire');
      return;
    }
    if (editingAssoc) {
      updateMutation.mutate({ id: editingAssoc.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (assoc: Association) => {
    setEditingAssoc(assoc);
    setForm({
      nom: assoc.nom,
      code: assoc.code || '',
      description: assoc.description || '',
      contact_email: assoc.contact_email || '',
    });
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6" />
              Gestion des Associations
            </h1>
            <p className="text-sm text-muted-foreground">
              Super Admin — Créer et gérer toutes les associations de la plateforme
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Associations ({associations?.length ?? 0})</CardTitle>
                <CardDescription>Liste de toutes les associations sur la plateforme</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  setEditingAssoc(null);
                  setForm({ nom: '', code: '', description: '', contact_email: '' });
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvelle association
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingAssoc ? 'Modifier' : 'Créer'} une association</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div>
                      <Label>Nom *</Label>
                      <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex: E2D Connect" />
                    </div>
                    <div>
                      <Label>Code</Label>
                      <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex: E2D" />
                    </div>
                    <div>
                      <Label>Email de contact</Label>
                      <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="contact@asso.com" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description de l'association" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                    <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                      {editingAssoc ? 'Mettre à jour' : 'Créer'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Chargement...</p>
            ) : (associations ?? []).length === 0 ? (
              <p className="text-muted-foreground italic">Aucune association. Cliquez sur "Nouvelle association" pour commencer.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Créée le</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(associations ?? []).map((assoc) => (
                    <TableRow key={assoc.id}>
                      <TableCell className="font-medium">{assoc.nom}</TableCell>
                      <TableCell><Badge variant="outline">{assoc.code || '-'}</Badge></TableCell>
                      <TableCell>{assoc.contact_email || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(assoc.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(assoc)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Rôle Super Admin
            </h3>
            <p className="text-sm text-blue-700">
              Le Super Admin a accès à toutes les associations et tous les modules.
              Il peut créer de nouvelles associations, assigner des administrateurs,
              et gérer tous les paramètres de la plateforme.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
