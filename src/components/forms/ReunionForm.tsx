import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateReunion, useUpdateReunion, type Reunion } from '@/hooks/useReunions';
import { useMembers } from '@/hooks/useMembers';

import { logger } from "@/lib/logger";
const reunionSchema = z.object({
  date_reunion: z.string().min(1, 'Date requise'),
  lieu_membre_id: z.string().optional(),
  lieu_description: z.string().optional(),
  beneficiaire_id: z.string().optional(),
  type_reunion: z.enum(['tontine', 'bureau', 'generale', 'extraordinaire']),
  sujet: z.string().min(3, 'Sujet requis (min 3 caractères)'),
  ordre_du_jour: z.string().optional(),
  compte_rendu_url: z.string().optional(),
});

type ReunionFormData = z.infer<typeof reunionSchema>;

interface ReunionInitialData {
  id?: string;
  date_reunion?: string;
  lieu_membre_id?: string | null;
  lieu_description?: string | null;
  beneficiaire_id?: string | null;
  type_reunion?: string;
  sujet?: string;
  ordre_du_jour?: string | null;
  compte_rendu_url?: string | null;
}

interface ReunionFormProps {
  initialData?: ReunionInitialData;
  onSuccess: () => void;
}

export default function ReunionForm({ initialData, onSuccess }: ReunionFormProps) {
  const createReunion = useCreateReunion();
  const updateReunion = useUpdateReunion();
  const { members: membres } = useMembers();

  const form = useForm<ReunionFormData>({
    resolver: zodResolver(reunionSchema),
    defaultValues: {
      date_reunion: '',
      lieu_membre_id: '',
      lieu_description: '',
      beneficiaire_id: '',
      type_reunion: 'tontine',
      sujet: '',
      ordre_du_jour: '',
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        date_reunion: initialData.date_reunion?.split('T')[0] || '',
        lieu_membre_id: initialData.lieu_membre_id || '',
        lieu_description: initialData.lieu_description || '',
        beneficiaire_id: initialData.beneficiaire_id || '',
        type_reunion: (initialData.type_reunion || 'tontine') as ReunionFormData['type_reunion'],
        sujet: initialData.sujet || '',
        ordre_du_jour: initialData.ordre_du_jour || '',
      });
    }
  }, [initialData, form]);

  const onSubmit = async (data: ReunionFormData) => {
    try {
      const reunionData: Omit<Reunion, 'id' | 'created_at' | 'statut'> = {
        date_reunion: data.date_reunion,
        lieu_membre_id: data.lieu_membre_id === 'none' ? null : data.lieu_membre_id || null,
        lieu_description: data.lieu_description || null,
        beneficiaire_id: data.beneficiaire_id === 'none' ? null : data.beneficiaire_id || null,
        type_reunion: data.type_reunion as string,
        sujet: data.sujet,
        ordre_du_jour: data.ordre_du_jour || null,
        compte_rendu_url: data.compte_rendu_url || null,
      };

      if (initialData?.id) {
        await updateReunion.mutateAsync({ id: initialData.id, ...reunionData });
      } else {
        await createReunion.mutateAsync(reunionData);
      }
      onSuccess();
    } catch (error: unknown) {
      logger.error('Erreur soumission formulaire réunion:', error);
    }
  };

  const isLoading = createReunion.isPending || updateReunion.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="type_reunion" render={({ field }) => (
          <FormItem>
            <FormLabel>Type de Réunion</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner le type" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="tontine">Tontine</SelectItem>
                <SelectItem value="bureau">Bureau</SelectItem>
                <SelectItem value="generale">Générale</SelectItem>
                <SelectItem value="extraordinaire">Extraordinaire</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="sujet" render={({ field }) => (
          <FormItem>
            <FormLabel>Sujet de la Réunion</FormLabel>
            <FormControl><Input placeholder="Ex: Réunion mensuelle janvier 2024" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="date_reunion" render={({ field }) => (
          <FormItem>
            <FormLabel>Date de la Réunion</FormLabel>
            <FormControl><Input type="date" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="lieu_membre_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Lieu (Membre Hôte)</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un membre" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {membres?.map((membre) => (
                  <SelectItem key={membre.id} value={membre.id}>{membre.prenom} {membre.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>Optionnel : Membre qui accueille la réunion</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="lieu_description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description du Lieu</FormLabel>
            <FormControl><Input placeholder="Ex: Salle des fêtes, Domicile..." {...field} /></FormControl>
            <FormDescription>Optionnel : Adresse ou description du lieu</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="beneficiaire_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Bénéficiaire de la Tontine</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un bénéficiaire" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {membres?.map((membre) => (
                  <SelectItem key={membre.id} value={membre.id}>{membre.prenom} {membre.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>Optionnel : Membre qui reçoit la tontine</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="ordre_du_jour" render={({ field }) => (
          <FormItem>
            <FormLabel>Ordre du Jour</FormLabel>
            <FormControl><Textarea placeholder="Points à aborder lors de la réunion..." className="min-h-[100px]" {...field} /></FormControl>
            <FormDescription>Optionnel : Liste des sujets à traiter</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isLoading}>{isLoading ? 'Enregistrement...' : initialData ? 'Mettre à jour' : 'Créer'}</Button>
        </div>
      </form>
    </Form>
  );
}
