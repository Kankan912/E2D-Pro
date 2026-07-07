import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { useCreateLoanRequest, useDefaultLoanRate, useCanSelfAvaliser } from "@/hooks/useLoanRequests";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import { fr } from "date-fns/locale";

const SELF_VALUE = "__self__";

const schema = z.object({
  montant: z.coerce.number().int("Sans décimales").positive("Montant > 0"),
  description: z.string().trim().min(5, "Description trop courte").max(2000),
  urgence: z.enum(["normal", "urgent"]),
  duree_mois: z.coerce.number().int().positive("Durée > 0").max(120),
  avaliste_choice: z.string().min(1, "Veuillez sélectionner un avaliste"),
  capacite_remboursement: z.string().trim().max(500).optional().or(z.literal("")),
  garantie: z.string().trim().max(500).optional().or(z.literal("")),
  conditions_acceptees: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter les conditions" }),
  }),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function LoanRequestDialog({ open, onOpenChange }: Props) {
  const create = useCreateLoanRequest();
  const { data: tauxDefaut } = useDefaultLoanRate();
  const { members } = useMembers();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Current member id (from user_id)
  const { data: currentMembreId } = useQuery({
    queryKey: ["current-membre-id", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as { id: string } | null)?.id ?? null;
    },
  });

  const { data: canSelf, isLoading: loadingSelf } = useCanSelfAvaliser(currentMembreId);

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      montant: 0,
      description: "",
      urgence: "normal",
      duree_mois: 6,
      avaliste_choice: "",
      capacite_remboursement: "",
      garantie: "",
      conditions_acceptees: false as unknown as true,
    },
  });

  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

  const avalisteChoice = form.watch("avaliste_choice");
  const isSelf = avalisteChoice === SELF_VALUE;

  const otherMembers = useMemo(() => {
    return (members ?? []).filter(
      (m) =>
        m.id !== currentMembreId &&
        !["supprime", "suspendu", "inactif"].includes((m.statut ?? "actif").toLowerCase()),
    );
  }, [members, currentMembreId]);

  const onSubmit = async (values: FormValues) => {
    if (!currentMembreId) return;
    const avaliste_self = values.avaliste_choice === SELF_VALUE;
    const avaliste_id = avaliste_self ? currentMembreId : values.avaliste_choice;

    setSubmitting(true);
    try {
      await create.mutateAsync({
        montant: values.montant,
        description: values.description,
        urgence: values.urgence,
        duree_mois: values.duree_mois,
        avaliste_id,
        avaliste_self,
        capacite_remboursement: values.capacite_remboursement?.trim() || null,
        garantie: values.garantie?.trim() || null,
        conditions_acceptees: true,
      });
      form.reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Demande de prêt</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="montant">Montant demandé (FCFA) *</Label>
            <Input id="montant" type="number" min={1} step={1} {...form.register("montant")} />
            {form.formState.errors.montant && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.montant.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="duree_mois">Durée souhaitée (mois) *</Label>
            <Input id="duree_mois" type="number" min={1} max={120} {...form.register("duree_mois")} />
            {form.formState.errors.duree_mois && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.duree_mois.message}</p>
            )}
          </div>

          <div>
            <Label>Niveau d'urgence *</Label>
            <Select
              defaultValue="normal"
              onValueChange={(v) => form.setValue("urgence", v as "normal" | "urgent")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Objet / Description *</Label>
            <Textarea id="description" rows={3} {...form.register("description")} />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div>
            <Label>Avaliste (garant) *</Label>
            <Select
              value={avalisteChoice}
              onValueChange={(v) => form.setValue("avaliste_choice", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un avaliste" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELF_VALUE} disabled={!loadingSelf && canSelf === false}>
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Moi-même (auto-avalisation)
                  </span>
                </SelectItem>
                {otherMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.prenom} {m.nom}
                    {m.fonction ? ` — ${m.fonction}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.avaliste_choice && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.avaliste_choice.message}
              </p>
            )}
            {isSelf && canSelf === false && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Vous avez déjà bénéficié de votre cotisation annuelle sur l'exercice en cours.
                  Vous ne pouvez plus vous désigner comme avaliste. Veuillez sélectionner un autre
                  membre comme garant.
                </AlertDescription>
              </Alert>
            )}
            {isSelf && canSelf === true && (
              <p className="text-xs text-muted-foreground mt-1">
                L'étape avaliste sera automatiquement validée sur la base de votre futur bénéfice de cotisation.
              </p>
            )}
            {!isSelf && avalisteChoice && (
              <p className="text-xs text-muted-foreground mt-1">
                L'avaliste recevra un email et devra approuver avant le démarrage du workflow de validation.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="capacite_remboursement">Capacité de remboursement (facultatif)</Label>
            <Input
              id="capacite_remboursement"
              placeholder="Ex: 50 000 FCFA / mois"
              {...form.register("capacite_remboursement")}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Information indicative à l'attention des validateurs. Sans incidence sur l'acceptation de la demande.
            </p>
          </div>

          <div>
            <Label htmlFor="garantie">Garantie (facultatif)</Label>
            <Input id="garantie" {...form.register("garantie")} />
          </div>

          {(() => {
            const m = Number(form.watch("montant") ?? 0);
            const d = Number(form.watch("duree_mois") ?? 0);
            const taux = Number(tauxDefaut ?? 5);
            if (!m || m <= 0 || !d || d <= 0) return null;
            const total = m + (m * taux) / 100;
            const mensualite = total / d;
            const echeance = addMonths(new Date(), d);
            return (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <p className="font-medium">Simulation indicative</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Taux par défaut</span>
                  <span className="text-right">{taux} %</span>
                  <span className="text-muted-foreground">Total à rembourser</span>
                  <span className="text-right font-medium">{fmt(total)}</span>
                  <span className="text-muted-foreground">Mensualité estimée</span>
                  <span className="text-right">{fmt(mensualite)}</span>
                  <span className="text-muted-foreground">Échéance estimée</span>
                  <span className="text-right">{format(echeance, "PPP", { locale: fr })}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  Indicatif — le taux final sera fixé au décaissement.
                </p>
              </div>
            );
          })()}

          <div className="flex items-start gap-2">
            <Checkbox
              id="conditions"
              checked={!!form.watch("conditions_acceptees")}
              onCheckedChange={(v) => form.setValue("conditions_acceptees", v === true ? true : (false as unknown as true), { shouldValidate: true })}
            />
            <Label htmlFor="conditions" className="text-sm leading-tight">
              J'accepte les conditions de prêt et m'engage à respecter le calendrier de remboursement
            </Label>
          </div>
          {form.formState.errors.conditions_acceptees && (
            <p className="text-xs text-destructive">
              {form.formState.errors.conditions_acceptees.message as string}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting || (isSelf && canSelf === false)}
            >
              {submitting ? "Envoi..." : "Soumettre la demande"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
