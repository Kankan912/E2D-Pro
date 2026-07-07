import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { formatFCFA } from "@/lib/utils";

interface Props {
  showDashboard: boolean;
  pretsActifs: number;
  pretsPartiels: number;
  pretsEnRetard: number;
  pretsRembourses: number;
  montantPrete: number;
  montantRestant: number;
  totalInterets: number;
  totalReconductions: number;
}

export default function PretsStatsCards({
  showDashboard, pretsActifs, pretsPartiels, pretsEnRetard, pretsRembourses,
  montantPrete, montantRestant, totalInterets, totalReconductions,
}: Props) {
  return (
    <>
      {showDashboard && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" />Prêts En Cours</CardTitle></CardHeader>
            <CardContent><p className="text-2xl sm:text-3xl font-bold text-blue-600">{pretsActifs}</p></CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Partiellement Payés</CardTitle></CardHeader>
            <CardContent><p className="text-2xl sm:text-3xl font-bold text-orange-600">{pretsPartiels}</p></CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" />En Retard</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-red-600">{pretsEnRetard}</p></CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle className="h-4 w-4" />Remboursés</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-green-600">{pretsRembourses}</p></CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Montant Total Prêté</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatFCFA(montantPrete)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Reste à Rembourser</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-orange-600">{formatFCFA(montantRestant)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Intérêts Générés</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">{formatFCFA(totalInterets)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Reconductions</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-600">{totalReconductions}</p></CardContent>
        </Card>
      </div>
    </>
  );
}
