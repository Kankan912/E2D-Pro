import { useLoanRequestValidations, type LoanRequestValidation } from "@/hooks/useLoanRequests";
import { CheckCircle2, XCircle, Clock, CircleDot, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  requestId: string;
  currentStep: number;
  globalStatus: string;
}

type AvalisteInfo = {
  avaliste_self: boolean;
  avaliste_statut: "pending" | "approved" | "rejected";
  avaliste_motif_refus: string | null;
  avaliste_validated_at: string | null;
  avaliste: { nom: string; prenom: string; fonction: string | null } | null;
};

function StepIcon({ statut, isCurrent }: { statut: LoanRequestValidation["statut"] | "pending" | "approved" | "rejected"; isCurrent: boolean }) {
  if (statut === "approved") return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (statut === "rejected") return <XCircle className="h-5 w-5 text-destructive" />;
  if (isCurrent) return <CircleDot className="h-5 w-5 text-blue-600 animate-pulse" />;
  return <Clock className="h-5 w-5 text-muted-foreground" />;
}

function colorFor(statut: string, isCurrent: boolean) {
  if (statut === "approved") return "border-emerald-500/50 bg-emerald-500/5";
  if (statut === "rejected") return "border-destructive/50 bg-destructive/5";
  if (isCurrent) return "border-blue-500/50 bg-blue-500/5";
  return "border-muted bg-muted/20";
}

export function LoanValidationTimeline({ requestId, currentStep, globalStatus }: Props) {
  const { data: steps, isLoading } = useLoanRequestValidations(requestId);

  const { data: info } = useQuery({
    queryKey: ["loan-request-avaliste", requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_requests" as never)
        .select("avaliste_self, avaliste_statut, avaliste_motif_refus, avaliste_validated_at, avaliste:membres!avaliste_id(nom, prenom, fonction)")
        .eq("id", requestId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AvalisteInfo | null;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const avalisteCurrent = globalStatus === "awaiting_avaliste";
  const avalisteLabel = info?.avaliste_self ? "Auto-avalisation" : "Avaliste";
  const avalisteName = info?.avaliste
    ? `${info.avaliste.prenom} ${info.avaliste.nom}${info.avaliste.fonction ? ` — ${info.avaliste.fonction}` : ""}`
    : info?.avaliste_self
    ? "Demandeur (lui-même)"
    : "—";

  return (
    <ol className="space-y-3">
      {/* Étape 0 — Avaliste */}
      <li className={cn("flex items-start gap-3 rounded-md border p-3", colorFor(info?.avaliste_statut ?? "pending", avalisteCurrent))}>
        <div className="mt-0.5">
          <StepIcon statut={info?.avaliste_statut ?? "pending"} isCurrent={avalisteCurrent} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-medium flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Étape 0 — {avalisteLabel}
            </span>
            <span className="text-xs text-muted-foreground">
              {info?.avaliste_statut === "approved" && "Validé"}
              {info?.avaliste_statut === "rejected" && "Refusé"}
              {info?.avaliste_statut === "pending" && (avalisteCurrent ? "En attente" : "Non démarré")}
            </span>
          </div>
          <p className="text-xs text-foreground/80 mt-1">{avalisteName}</p>
          {info?.avaliste_motif_refus && (
            <p className="text-sm text-muted-foreground mt-1 italic">« {info.avaliste_motif_refus} »</p>
          )}
          {info?.avaliste_validated_at && (
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(info.avaliste_validated_at), "dd/MM/yyyy HH:mm", { locale: fr })}
            </p>
          )}
        </div>
      </li>

      {(!steps || steps.length === 0) && globalStatus !== "awaiting_avaliste" && (
        <li className="text-sm text-muted-foreground italic px-3">Aucune étape de validation configurée.</li>
      )}

      {(steps ?? []).map((s) => {
        const isCurrent = globalStatus === "in_progress" && s.ordre === currentStep && s.statut === "pending";
        return (
          <li
            key={s.id}
            className={cn("flex items-start gap-3 rounded-md border p-3", colorFor(s.statut, isCurrent))}
          >
            <div className="mt-0.5">
              <StepIcon statut={s.statut} isCurrent={isCurrent} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium">
                  Étape {s.ordre} — {s.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.statut === "approved" && "Validé"}
                  {s.statut === "rejected" && "Rejeté"}
                  {s.statut === "cancelled" && "Annulé"}
                  {s.statut === "pending" && (isCurrent ? "En cours" : "En attente")}
                </span>
              </div>
              {s.validator && (s.validator.prenom || s.validator.nom) && (
                <p className="text-xs text-foreground/80 mt-1">
                  Par <span className="font-medium">{`${s.validator.prenom ?? ""} ${s.validator.nom ?? ""}`.trim()}</span>
                </p>
              )}
              {s.commentaire && (
                <p className="text-sm text-muted-foreground mt-1 italic">« {s.commentaire} »</p>
              )}
              {s.validated_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(s.validated_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
