import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, Clock } from "lucide-react";
import { formatFCFA } from "@/lib/utils";
import { differenceInDays } from "date-fns";

interface PretsAlertesProps {
  onViewDetails?: (pretId: string) => void;
}

export default function PretsAlertes({ onViewDetails }: PretsAlertesProps) {
  const { data: pretsEnRetard, isLoading } = useQuery({
    queryKey: ["prets-en-retard"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("prets")
        .select(`
          id,
          montant,
          montant_paye,
          montant_total_du,
          echeance,
          taux_interet,
          emprunteur:membres!membre_id(nom, prenom)
        `)
        .lt("echeance", today)
        .neq("statut", "rembourse")
        .order("echeance", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return null;
  if (!pretsEnRetard || pretsEnRetard.length === 0) return null;

  const getSeverityBadge = (joursRetard: number) => {
    if (joursRetard >= 30) {
      return <Badge variant="destructive">Critique ({joursRetard}j)</Badge>;
    }
    return <Badge className="bg-orange-500">{joursRetard} jours</Badge>;
  };

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Prêts en retard ({pretsEnRetard.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pretsEnRetard.slice(0, 5).map((pret: any) => {
          const joursRetard = differenceInDays(new Date(), new Date(pret.echeance));
          const totalDu = pret.montant_total_du || (pret.montant * (1 + (pret.taux_interet || 5) / 100));
          const resteAPayer = totalDu - (pret.montant_paye || 0);

          return (
            <div
              key={pret.id}
              className="flex items-center justify-between p-3 rounded-lg bg-background border"
            >
              <div className="flex-1">
                <p className="font-medium">
                  {pret.emprunteur?.nom} {pret.emprunteur?.prenom}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Échéance: {new Date(pret.echeance).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-bold text-destructive">{formatFCFA(resteAPayer)}</p>
                  {getSeverityBadge(joursRetard)}
                </div>
                {onViewDetails && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => onViewDetails(pret.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {pretsEnRetard.length > 5 && (
          <p className="text-sm text-muted-foreground text-center">
            Et {pretsEnRetard.length - 5} autre(s)...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
