import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock } from "lucide-react";
import { formatFCFA } from "@/lib/utils";

export interface ReconductionAttente {
  id: string;
  created_at: string;
  notes?: string | null;
  interet_mois?: number | null;
  prets?: { membres?: { nom?: string; prenom?: string } | null } | null;
}

interface Props {
  reconductions: ReconductionAttente[];
  isPending: boolean;
  onDecision: (reconId: string, decision: "validee" | "refusee") => void;
}

/**
 * Liste des demandes de reconduction de prêt en attente de validation
 * par un administrateur ou trésorier. Extrait de PretsAdmin.tsx (G2).
 */
export function ReconductionsAttenteList({ reconductions, isPending, onDecision }: Props) {
  if (reconductions.length === 0) return null;

  return (
    <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <Clock className="h-4 w-4" />
          {reconductions.length} reconduction(s) en attente de validation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {reconductions.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 p-2 rounded border bg-background"
          >
            <div className="text-sm">
              <div className="font-medium">
                {r.prets?.membres?.prenom} {r.prets?.membres?.nom} — Intérêt:{" "}
                {formatFCFA(Number(r.interet_mois || 0))}
              </div>
              <div className="text-xs text-muted-foreground">
                Demande du {new Date(r.created_at).toLocaleDateString("fr-FR")} — {r.notes}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDecision(r.id, "refusee")}
                disabled={isPending}
                aria-label="Refuser la reconduction"
              >
                Refuser
              </Button>
              <Button
                size="sm"
                onClick={() => onDecision(r.id, "validee")}
                disabled={isPending}
                aria-label="Valider la reconduction"
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Valider
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
