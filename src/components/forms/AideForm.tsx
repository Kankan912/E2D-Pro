import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import FileUploadField from "@/components/forms/FileUploadField";
import {
  AIDE_STATUTS,
  AIDE_STATUT_LABELS,
  CONTEXTE_AIDE,
  ALL_STATUTS,
  type AideStatut,
} from "@/lib/aide-constants";

// ---------------------------------------------------------------------------
// Schema & Types
// ---------------------------------------------------------------------------

const aideSchema = z.object({
  type_aide_id: z.string().min(1, "Sélectionnez un type d'aide"),
  beneficiaire_id: z.string().min(1, "Sélectionnez un bénéficiaire"),
  reunion_id: z.string().optional(),
  exercice_id: z.string().min(1, "Sélectionnez un exercice"),
  montant: z.number().positive("Le montant doit être positif"),
  date_allocation: z.string().min(1, "Date d'allocation requise"),
  contexte_aide: z.string().min(1, "Contexte requis"),
  statut: z.string().min(1, "Statut requis"),
  notes: z.string().optional(),
  justificatif_url: z.string().optional(),
});

type AideFormData = z.infer<typeof aideSchema>;

/** Payload sent back to the parent on submit */
export interface AideSubmitData {
  type_aide_id: string;
  beneficiaire_id: string;
  reunion_id: string | null;
  exercice_id: string | null;
  montant: number;
  date_allocation: string;
  contexte_aide: string;
  statut: string;
  notes?: string;
  justificatif_url: string | null;
}

/** Shape of the `initialData` prop (a persisted aide record) */
export interface AideInitialData {
  id: string;
  type_aide_id: string;
  beneficiaire_id: string;
  reunion_id?: string | null;
  exercice_id?: string | null;
  montant: number;
  date_allocation: string;
  contexte_aide: string;
  statut: string;
  notes?: string | null;
  justificatif_url?: string | null;
  [key: string]: unknown; // allow extra fields from Supabase joins
}

interface AideFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AideSubmitData) => void;
  initialData?: AideInitialData | null;
  associationId?: string;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AideForm({
  open,
  onClose,
  onSubmit,
  initialData,
  associationId,
  isSubmitting = false,
}: AideFormProps) {
  const [justificatifUrl, setJustificatifUrl] = useState<string | null>(null);

  // ---- Queries scoped to association_id (SEC-06) ----

  const { data: typesAide } = useQuery({
    queryKey: ["aides-types", associationId],
    queryFn: async () => {
      const query = supabase
        .from("aides_types")
        .select("id, nom, montant_defaut, mode_repartition")
        .order("nom");
      if (associationId) {
        query.eq("association_id", associationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!associationId,
  });

  const { data: membres } = useQuery({
    queryKey: ["membres-actifs", associationId],
    queryFn: async () => {
      const query = supabase
        .from("membres")
        .select("id, nom, prenom")
        .eq("statut", "actif");
      if (associationId) {
        query.eq("association_id", associationId);
      }
      const { data, error } = await query.order("nom");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!associationId,
  });

  const { data: exercices } = useQuery({
    queryKey: ["exercices-aide", associationId],
    queryFn: async () => {
      const query = supabase
        .from("exercices")
        .select("id, nom, statut");
      if (associationId) {
        query.eq("association_id", associationId);
      }
      const { data, error } = await query.order("date_debut", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!associationId,
  });

  const { data: reunions } = useQuery({
    queryKey: ["reunions-recentes", associationId],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const query = supabase
        .from("reunions")
        .select("id, date_reunion, ordre_du_jour")
        .gte("date_reunion", sixMonthsAgo.toISOString().split("T")[0]);
      if (associationId) {
        query.eq("association_id", associationId);
      }
      const { data, error } = await query.order("date_reunion", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!associationId,
  });

  // ---- Form ----

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<AideFormData>({
    resolver: zodResolver(aideSchema),
    defaultValues: {
      contexte_aide: CONTEXTE_AIDE.reunion,
      statut: AIDE_STATUTS.BROUILLON,       // CALC-04: default is brouillon
      date_allocation: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const typeAideId = watch("type_aide_id");
  const beneficiaireId = watch("beneficiaire_id");
  const reunionId = watch("reunion_id");
  const exerciceId = watch("exercice_id");
  const statut = watch("statut");
  const contexte = watch("contexte_aide");

  // Auto-sélectionner l'exercice actif
  useEffect(() => {
    if (exercices && !initialData && !exerciceId) {
      const exerciceActif = exercices.find((e) => e.statut === "actif");
      if (exerciceActif) {
        setValue("exercice_id", exerciceActif.id);
      }
    }
  }, [exercices, initialData, exerciceId, setValue]);

  // Auto-remplir la date d'allocation avec la date de réunion
  useEffect(() => {
    if (reunionId && reunions) {
      const selectedReunion = reunions.find((r) => r.id === reunionId);
      if (selectedReunion && !initialData) {
        setValue("date_allocation", selectedReunion.date_reunion);
      }
    }
  }, [reunionId, reunions, setValue, initialData]);

  // Auto-remplir le montant selon le type d'aide sélectionné
  useEffect(() => {
    if (typeAideId && typesAide) {
      const selectedType = typesAide.find((t) => t.id === typeAideId);
      if (selectedType?.montant_defaut && !initialData) {
        setValue("montant", selectedType.montant_defaut);
      }
    }
  }, [typeAideId, typesAide, setValue, initialData]);

  // Réinitialiser reunion_id si le contexte change et n'est plus "reunion"
  useEffect(() => {
    if (contexte !== CONTEXTE_AIDE.reunion) {
      setValue("reunion_id", undefined);
    }
  }, [contexte, setValue]);

  // Reset form when dialog opens with initialData
  useEffect(() => {
    if (open) {
      if (initialData) {
        reset({
          type_aide_id: initialData.type_aide_id,
          beneficiaire_id: initialData.beneficiaire_id,
          reunion_id: initialData.reunion_id || undefined,
          exercice_id: initialData.exercice_id || "",
          montant: initialData.montant,
          date_allocation: initialData.date_allocation,
          contexte_aide: initialData.contexte_aide,
          statut: initialData.statut,
          notes: initialData.notes || "",
        });
        setJustificatifUrl(initialData.justificatif_url || null);
      } else {
        reset({
          contexte_aide: CONTEXTE_AIDE.reunion,
          statut: AIDE_STATUTS.BROUILLON,
          date_allocation: new Date().toISOString().split("T")[0],
          notes: "",
          exercice_id: "",
        });
        setJustificatifUrl(null);
      }
    }
  }, [open, initialData, reset]);

  const handleFormSubmit = (data: AideFormData) => {
    onSubmit({
      ...data,
      reunion_id: data.reunion_id || null,
      exercice_id: data.exercice_id || null,
      justificatif_url: justificatifUrl,
    });
  };

  // ---- Render ----

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? "Modifier l'aide" : "Nouvelle aide"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type d'aide *</Label>
              <Select value={typeAideId} onValueChange={(val) => setValue("type_aide_id", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  {typesAide?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type_aide_id && (
                <p className="text-sm text-destructive mt-1">{errors.type_aide_id.message}</p>
              )}
            </div>

            <div>
              <Label>Bénéficiaire *</Label>
              <Select value={beneficiaireId} onValueChange={(val) => setValue("beneficiaire_id", val)}>
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
              {errors.beneficiaire_id && (
                <p className="text-sm text-destructive mt-1">{errors.beneficiaire_id.message}</p>
              )}
            </div>
          </div>

          {/* Exercice obligatoire */}
          <div>
            <Label>Exercice *</Label>
            <Select value={exerciceId} onValueChange={(val) => setValue("exercice_id", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un exercice" />
              </SelectTrigger>
              <SelectContent>
                {exercices?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom} {e.statut === "actif" ? "(actif)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.exercice_id && (
              <p className="text-sm text-destructive mt-1">{errors.exercice_id.message}</p>
            )}
          </div>

          {/* Afficher le champ Réunion uniquement si contexte = "reunion" */}
          {contexte === CONTEXTE_AIDE.reunion && (
            <div>
              <Label>Réunion associée</Label>
              <Select value={reunionId} onValueChange={(val) => setValue("reunion_id", val === "none" ? undefined : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une réunion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune réunion</SelectItem>
                  {reunions?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {new Date(r.date_reunion).toLocaleDateString("fr-FR")} - {r.ordre_du_jour || "Réunion"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                La date d'allocation sera automatiquement remplie avec la date de la réunion.
              </p>
            </div>
          )}

          {/* Message informatif si contexte urgent/exceptionnel */}
          {(contexte === CONTEXTE_AIDE.urgent || contexte === CONTEXTE_AIDE.exceptionnel) && (
            <div className="p-3 bg-muted/50 rounded-md text-sm">
              <p className="text-muted-foreground">
                ℹ️ Cette aide ne sera pas liée à une réunion spécifique ({contexte === CONTEXTE_AIDE.urgent ? "Aide urgente" : "Aide exceptionnelle"}).
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
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
              <Label>Date d'allocation *</Label>
              <Input type="date" {...register("date_allocation")} />
              {errors.date_allocation && (
                <p className="text-sm text-destructive mt-1">{errors.date_allocation.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Contexte *</Label>
              <Select value={contexte} onValueChange={(val) => setValue("contexte_aide", val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTEXTE_AIDE).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contexte_aide && (
                <p className="text-sm text-destructive mt-1">{errors.contexte_aide.message}</p>
              )}
            </div>

            <div>
              <Label>Statut *</Label>
              <Select value={statut} onValueChange={(val) => setValue("statut", val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {AIDE_STATUT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.statut && (
                <p className="text-sm text-destructive mt-1">{errors.statut.message}</p>
              )}
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
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {initialData ? "Modifier" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
