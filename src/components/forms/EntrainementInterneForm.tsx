import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const entrainementSchema = z.object({
  date_entrainement: z.string().min(1, "Date requise"),
  lieu: z.string().min(2, "Lieu requis"),
  objectif: z.string().optional(),
  notes: z.string().optional(),
  duree_minutes: z.number().min(1, "Durée requise"),
});

type EntrainementFormData = z.infer<typeof entrainementSchema>;

interface EntrainementInterneFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EntrainementInterneForm({ open, onOpenChange, onSuccess }: EntrainementInterneFormProps) {
  const { toast } = useToast();
  const form = useForm<EntrainementFormData>({
    resolver: zodResolver(entrainementSchema),
    defaultValues: { date_entrainement: "", lieu: "", objectif: "", notes: "", duree_minutes: 90 },
  });

  const onSubmit = async (data: EntrainementFormData) => {
    try {
      const [dateStr, timeStr] = data.date_entrainement.split('T');
      const dureeEnMinutes = data.duree_minutes;
      const heureDebut = timeStr || '00:00';
      
      // Calculer heure de fin
      const [heures, minutes] = heureDebut.split(':').map(Number);
      const totalMinutes = heures * 60 + minutes + dureeEnMinutes;
      const heureFinHeures = Math.floor(totalMinutes / 60);
      const heureFinMinutes = totalMinutes % 60;
      const heureFin = `${String(heureFinHeures).padStart(2, '0')}:${String(heureFinMinutes).padStart(2, '0')}`;

      const { error } = await supabase
        .from('phoenix_entrainements_internes')
        .insert([{
          date_entrainement: dateStr,
          heure_debut: heureDebut,
          heure_fin: heureFin,
          lieu: data.lieu,
          notes: data.notes || null,
          statut: 'planifie'
        }]);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Entraînement interne enregistré avec succès",
      });
      
      form.reset();
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'enregistrer l'entraînement",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader><DialogTitle>Nouvel Entraînement Interne</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="date_entrainement" render={({ field }) => (<FormItem><FormLabel>Date de l'Entraînement</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="lieu" render={({ field }) => (<FormItem><FormLabel>Lieu</FormLabel><FormControl><Input placeholder="Ex: Terrain synthétique" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="duree_minutes" render={({ field }) => (<FormItem><FormLabel>Durée (minutes)</FormLabel><FormControl><Input type="number" min={1} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="objectif" render={({ field }) => (<FormItem><FormLabel>Objectif</FormLabel><FormControl><Input placeholder="Ex: Préparation physique" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Observations et remarques..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
