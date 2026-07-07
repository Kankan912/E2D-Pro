import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Save } from 'lucide-react';

import { logger } from "@/lib/logger";
const pointSchema = z.object({
  numero_ordre: z.number().min(1),
  sujet: z.string().min(3, 'Sujet requis (min 3 caractères)'),
  description: z.string().optional(),
  resolution: z.string().optional(),
  decisions: z.string().optional(),
});

type PointFormData = z.infer<typeof pointSchema>;

interface CompteRenduFormProps {
  reunionId: string;
  ordreJour?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CompteRenduForm({
  reunionId,
  ordreJour,
  onSuccess,
  onCancel,
}: CompteRenduFormProps) {
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPoint, setEditingPoint] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<PointFormData>({
    resolver: zodResolver(pointSchema),
    defaultValues: {
      numero_ordre: 1,
      sujet: '',
      description: '',
      resolution: '',
      decisions: '',
    },
  });

  // Charger les points existants
  useEffect(() => {
    loadPoints();
  }, [reunionId]);

  const loadPoints = async () => {
    try {
      const { data, error } = await supabase
        .from('rapports_seances')
        .select('*')
        .eq('reunion_id', reunionId)
        .order('numero_ordre', { ascending: true });

      if (error) throw error;
      setPoints(data || []);
    } catch (error: unknown) {
      logger.error('Erreur chargement points:', error);
    }
  };

  const onSubmit = async (data: PointFormData) => {
    setLoading(true);
    try {
      if (editingPoint) {
        const { error } = await supabase
          .from('rapports_seances')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPoint.id);

        if (error) throw error;
        toast({ title: 'Succès', description: 'Point mis à jour' });
      } else {
        const { error } = await supabase.from('rapports_seances').insert([{ 
          reunion_id: reunionId, 
          numero_ordre: data.numero_ordre,
          sujet: data.sujet,
          description: data.description || null,
          resolution: data.resolution || null,
          decisions: data.decisions || null
        }]);
        if (error) throw error;
        toast({ title: 'Succès', description: 'Point ajouté au compte-rendu' });
      }

      form.reset({ numero_ordre: points.length + 1, sujet: '', description: '', resolution: '', decisions: '' });
      setEditingPoint(null);
      loadPoints();
    } catch (error: unknown) {
      logger.error('Erreur ajout point:', error);
      toast({ title: 'Erreur', description: error instanceof Error ? error.message : "Erreur", variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditPoint = (point: any) => {
    setEditingPoint(point);
    form.reset({ numero_ordre: point.numero_ordre, sujet: point.sujet, description: point.description || '', resolution: point.resolution || '', decisions: point.decisions || '' });
  };

  const handleDeletePoint = (pointId: string) => {
    setPendingDeleteId(pointId);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePoint = async () => {
    if (!pendingDeleteId) return;
    try {
      const { error } = await supabase.from('rapports_seances').delete().eq('id', pendingDeleteId);
      if (error) throw error;
      toast({ title: 'Succès', description: 'Point supprimé' });
      loadPoints();
    } catch (error: unknown) {
      toast({ title: 'Erreur', description: error instanceof Error ? error.message : "Erreur", variant: 'destructive' });
    }
    setShowDeleteConfirm(false);
    setPendingDeleteId(null);
  };

  return (
    <div className="space-y-6">
      {ordreJour && (
        <Card>
          <CardHeader><CardTitle className="text-base">Ordre du Jour Initial</CardTitle><CardDescription>Utilisez ceci comme référence pour créer les points</CardDescription></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap text-muted-foreground">{ordreJour}</p></CardContent>
        </Card>
      )}
      {points.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Points Ajoutés ({points.length})</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {points.map((point) => (
                  <div key={point.id} className="flex items-start justify-between p-3 rounded-lg border bg-muted/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1"><Badge variant="outline">{point.numero_ordre}</Badge><p className="font-medium">{point.sujet}</p></div>
                      {point.resolution && <p className="text-sm text-muted-foreground line-clamp-2">{point.resolution}</p>}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEditPoint(point)}>Éditer</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeletePoint(point.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">{editingPoint ? 'Modifier le Point' : 'Ajouter un Point'}</CardTitle><CardDescription>Remplissez les informations pour chaque point à l'ordre du jour</CardDescription></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="numero_ordre" render={({ field }) => (<FormItem><FormLabel>Numéro d'Ordre</FormLabel><FormControl><Input type="number" min={1} {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="sujet" render={({ field }) => (<FormItem><FormLabel>Sujet</FormLabel><FormControl><Input placeholder="Ex: Validation des comptes" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Contexte et détails du point..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="resolution" render={({ field }) => (<FormItem><FormLabel>Résolution</FormLabel><FormControl><Textarea placeholder="Décision prise sur ce point..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="decisions" render={({ field }) => (<FormItem><FormLabel>Décisions / Actions</FormLabel><FormControl><Textarea placeholder="Actions à entreprendre suite à ce point..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Enregistrement...' : editingPoint ? <><Save className="w-4 h-4 mr-2" />Mettre à jour</> : <><Plus className="w-4 h-4 mr-2" />Ajouter le Point</>}</Button>
                {editingPoint && <Button type="button" variant="outline" onClick={() => { setEditingPoint(null); form.reset({ numero_ordre: points.length + 1, sujet: '', description: '', resolution: '', decisions: '' }); }}>Annuler</Button>}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Fermer</Button>
        <Button onClick={onSuccess} disabled={points.length === 0}>Terminer le Compte-Rendu</Button>
      </div>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Voulez-vous vraiment supprimer ce point ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePoint}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
