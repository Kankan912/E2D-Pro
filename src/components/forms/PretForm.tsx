import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatFCFA } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import FileUploadField from "@/components/forms/FileUploadField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Calendar } from "lucide-react";
import { addMonths, format } from "date-fns";

const pretSchema = z.object({
  membre_id: z.string().min(1, "Sélectionnez un emprunteur"),
  montant: z.number().positive("Le montant doit être positif"),
  taux_interet: z.number().min(0).max(100),
  echeance: z.string().min(1, "Date d'échéance requise"),
  avaliste_id: z.string().optional(),
  reunion_id: z.string().min(1, "La réunion d'attribution est obligatoire"),
  exercice_id: z.string().min(1, "L'exercice fiscal est obligatoire"),
  reconductions: z.number().min(0).optional(),
  notes: z.string().optional(),
  justificatif_url: z.string().optional(),
});

type PretFormData = z.infer<typeof pretSchema>;

interface PretFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: any;
}

export default function PretForm({ open, onClose, onSubmit, initialData }: PretFormProps) {
  const [justificatifUrl, setJustificatifUrl] = useState<string | null>(null);
  
  const { data: membres } = useQuery({
    queryKey: ['membres-actifs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom')
        .eq('statut', 'actif')
        .order('nom');
      if (error) throw error;
      return data;
    }
  });

  const { data: reunions } = useQuery({
    queryKey: ['reunions-recentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions')
        .select('id, date_reunion, ordre_du_jour')
        .order('date_reunion', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    }
  });

  const { data: exercices } = useQuery({
    queryKey: ['exercices-avec-taux'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercices')
        .select('id, nom, statut, taux_interet_prets')
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Configuration des prêts
  const { data: pretsConfig } = useQuery({
    queryKey: ['prets-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prets_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const dureeMoisConfig = pretsConfig?.duree_mois || 2;
  const tauxInteretDefaut = pretsConfig?.taux_interet_defaut || 5;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<PretFormData>({
    resolver: zodResolver(pretSchema),
    defaultValues: {
      taux_interet: 5,
      reconductions: 0,
      notes: ""
    }
  });

  const membreId = watch("membre_id");
  const avalisteId = watch("avaliste_id");
  const reunionId = watch("reunion_id");
  const exerciceId = watch("exercice_id");
  const montant = watch("montant");
  const tauxInteret = watch("taux_interet");
  const echeance = watch("echeance");

  // Calculer le montant total dû (intérêt initial)
  const interetInitial = montant && tauxInteret ? montant * (tauxInteret / 100) : 0;
  const montantTotalDu = montant ? montant + interetInitial : 0;

  // Calcul automatique de l'échéance quand une réunion est sélectionnée
  useEffect(() => {
    if (reunionId && reunionId !== "none" && !initialData) {
      const reunion = reunions?.find(r => r.id === reunionId);
      if (reunion) {
        const dateReunion = new Date(reunion.date_reunion);
        const nouvelleEcheance = addMonths(dateReunion, dureeMoisConfig);
        setValue("echeance", format(nouvelleEcheance, 'yyyy-MM-dd'));
      }
    }
  }, [reunionId, reunions, setValue, initialData, dureeMoisConfig]);

  // Charger le taux d'intérêt de l'exercice sélectionné
  useEffect(() => {
    if (exerciceId && exerciceId !== "none" && !initialData) {
      const exercice = exercices?.find(e => e.id === exerciceId);
      if (exercice?.taux_interet_prets) {
        setValue("taux_interet", exercice.taux_interet_prets);
      }
    }
  }, [exerciceId, exercices, setValue, initialData]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (initialData) {
        reset({
          membre_id: initialData.membre_id,
          montant: initialData.montant,
          taux_interet: initialData.taux_interet || tauxInteretDefaut,
          echeance: initialData.echeance,
          avaliste_id: initialData.avaliste_id || "none",
          reunion_id: initialData.reunion_id || "",
          exercice_id: initialData.exercice_id || "",
          reconductions: initialData.reconductions || 0,
          notes: initialData.notes || "",
        });
        setJustificatifUrl(initialData.justificatif_url || null);
      } else {
        // Pour un nouveau prêt, pré-sélectionner l'exercice actif
        const exerciceActif = exercices?.find(e => e.statut === 'actif');
        reset({
          taux_interet: exerciceActif?.taux_interet_prets || tauxInteretDefaut,
          reconductions: 0,
          notes: "",
          avaliste_id: "none",
          reunion_id: "",
          exercice_id: exerciceActif?.id || "",
        });
        setJustificatifUrl(null);
      }
    }
  }, [open, initialData, reset, exercices, tauxInteretDefaut]);

  const handleFormSubmit = (data: PretFormData) => {
    const interetInit = data.montant * ((data.taux_interet || 0) / 100);
    const montantTotal = data.montant + interetInit;
    
    onSubmit({
      ...data,
      date_pret: initialData?.date_pret || new Date().toISOString().split('T')[0],
      statut: initialData?.statut || 'en_cours',
      montant_paye: initialData?.montant_paye || 0,
      montant_total_du: montantTotal,
      interet_initial: interetInit,
      dernier_interet: initialData?.dernier_interet || interetInit,
      interet_paye: initialData?.interet_paye || 0,
      capital_paye: initialData?.capital_paye || 0,
      duree_mois: dureeMoisConfig,
      avaliste_id: data.avaliste_id === "none" ? null : data.avaliste_id,
      reunion_id: data.reunion_id,
      exercice_id: data.exercice_id,
      reconductions: data.reconductions || 0,
      justificatif_url: justificatifUrl,
    });
  };

  // Trouver la réunion sélectionnée pour afficher la date d'échéance calculée
  const reunionSelectionnee = reunions?.find(r => r.id === reunionId);
  const dateEcheanceCalculee = reunionSelectionnee 
    ? format(addMonths(new Date(reunionSelectionnee.date_reunion), dureeMoisConfig), 'dd/MM/yyyy')
    : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Modifier le prêt" : "Nouveau prêt"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Info durée configurable */}
          <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-400">
              <strong>Durée : {dureeMoisConfig} mois</strong> — L'échéance est calculée automatiquement à partir de la date de réunion.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Emprunteur *</Label>
              <Select value={membreId} onValueChange={(val) => setValue("membre_id", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un membre" />
                </SelectTrigger>
                <SelectContent>
                  {membres?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nom} {m.prenom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.membre_id && (
                <p className="text-sm text-destructive mt-1">{errors.membre_id.message}</p>
              )}
            </div>

            <div>
              <Label>Avaliste (Garant)</Label>
              <Select value={avalisteId || "none"} onValueChange={(val) => setValue("avaliste_id", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un garant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {membres?.filter(m => m.id !== membreId).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nom} {m.prenom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Réunion d'attribution *</Label>
              <Select value={reunionId || ""} onValueChange={(val) => setValue("reunion_id", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une réunion" />
                </SelectTrigger>
                <SelectContent>
                  {reunions?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {new Date(r.date_reunion).toLocaleDateString('fr-FR')} - {r.ordre_du_jour?.substring(0, 30)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.reunion_id && (
                <p className="text-sm text-destructive mt-1">{errors.reunion_id.message}</p>
              )}
              {dateEcheanceCalculee && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Échéance auto: {dateEcheanceCalculee}
                </p>
              )}
            </div>

            <div>
              <Label>Exercice fiscal *</Label>
              <Select value={exerciceId || ""} onValueChange={(val) => setValue("exercice_id", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un exercice" />
                </SelectTrigger>
                <SelectContent>
                  {exercices?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nom} {e.statut === 'actif' && '(Actif)'} - Taux: {e.taux_interet_prets || 5}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.exercice_id && (
                <p className="text-sm text-destructive mt-1">{errors.exercice_id.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Montant (FCFA) *</Label>
              <Input
                type="number"
                step="1"
                {...register("montant", { valueAsNumber: true })}
              />
              {errors.montant && (
                <p className="text-sm text-destructive mt-1">{errors.montant.message}</p>
              )}
            </div>

            <div>
              <Label>Taux d'intérêt (%) *</Label>
              <Input
                type="number"
                step="0.01"
                {...register("taux_interet", { valueAsNumber: true })}
              />
              {errors.taux_interet && (
                <p className="text-sm text-destructive mt-1">{errors.taux_interet.message}</p>
              )}
            </div>

            <div>
              <Label>Intérêt initial</Label>
              <Input
                type="text"
                value={formatFCFA(interetInitial)}
                disabled
                className="bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Date d'échéance *</Label>
              <Input type="date" {...register("echeance")} />
              {errors.echeance && (
                <p className="text-sm text-destructive mt-1">{errors.echeance.message}</p>
              )}
            </div>

            <div>
              <Label>Reconductions</Label>
              <Input
                type="number"
                min="0"
                {...register("reconductions", { valueAsNumber: true })}
                disabled={!initialData}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {initialData ? "Modifiable" : "Géré automatiquement"}
              </p>
            </div>

            <div>
              <Label>Montant total dû</Label>
              <Input
                type="text"
                value={formatFCFA(montantTotalDu)}
                disabled
                className="bg-muted font-semibold"
              />
            </div>
          </div>

          <FileUploadField
            label="Justificatif (optionnel)"
            value={justificatifUrl}
            onChange={setJustificatifUrl}
          />

          <div>
            <Label>Notes</Label>
            <Textarea {...register("notes")} rows={3} placeholder="Informations complémentaires..." />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              {initialData ? "Modifier" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
