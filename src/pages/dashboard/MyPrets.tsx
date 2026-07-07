import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useUserPrets, useUserMemberId } from "@/hooks/usePersonalData";
import { Wallet, CircleDollarSign, Clock, CheckCircle, CalendarClock, FileText } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { formatFCFA } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { buildMembrePDFHeader, buildMembreFileName, membrePDFFooter } from "@/lib/membre-pdf";

type StatutFiltre = "tous" | "en_cours" | "rembourse" | "en_attente" | "refuse" | "approuve";

const MyPrets = () => {
  const { data: prets, isLoading, error } = useUserPrets();
  const { data: membre } = useUserMemberId();
  const [filtreStatut, setFiltreStatut] = useState<StatutFiltre>("tous");

  const filtered = useMemo(() => {
    if (!prets) return [];
    if (filtreStatut === "tous") return prets;
    return prets.filter((p) => p.statut === filtreStatut);
  }, [prets, filtreStatut]);

  const getPretsEnCours = () => {
    if (!prets) return { count: 0, total: 0 };
    const enCours = prets.filter((p) => p.statut === "en_cours" || p.statut === "approuve");
    return {
      count: enCours.length,
      total: enCours.reduce((sum, p) => sum + ((p.montant || 0) - (p.montant_paye || 0)), 0),
    };
  };

  // Prochaine échéance
  const prochainePret = useMemo(() => {
    if (!prets) return null;
    const actifs = prets
      .filter((p) => (p.statut === "en_cours" || p.statut === "approuve") && p.echeance)
      .sort((a, b) => new Date(a.echeance).getTime() - new Date(b.echeance).getTime());
    return actifs[0] ?? null;
  }, [prets]);

  const echeanceColor = (date: string) => {
    const d = differenceInDays(new Date(date), new Date());
    if (d < 0) return "destructive";
    if (d < 7) return "destructive";
    if (d < 30) return "secondary";
    return "default";
  };

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case "rembourse":
        return (
          <Badge className="bg-green-500 flex items-center gap-1 w-fit">
            <CheckCircle className="h-3 w-3" />
            Remboursé
          </Badge>
        );
      case "en_cours":
        return (
          <Badge className="bg-blue-500 flex items-center gap-1 w-fit">
            <Clock className="h-3 w-3" />
            En cours
          </Badge>
        );
      case "approuve":
        return <Badge className="bg-cyan-500 w-fit">Approuvé</Badge>;
      case "en_attente":
        return <Badge variant="secondary" className="w-fit">En attente</Badge>;
      case "refuse":
        return <Badge variant="destructive" className="w-fit">Refusé</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  const pretsEnCours = getPretsEnCours();
  const totalRembourse = filtered.reduce((s, p) => s + (p.montant_paye || 0), 0);
  const totalRestant = filtered.reduce((s, p) => s + Math.max(0, (p.montant || 0) - (p.montant_paye || 0)), 0);

  const membreLabel = membre ? `${membre.prenom ?? ""} ${membre.nom ?? ""}`.trim() : "—";

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const startY = buildMembrePDFHeader(doc, { titre: "Mes prêts", membreLabel });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(9);
    doc.text(
      `Total remboursé : ${Math.round(totalRembourse).toLocaleString("fr-FR")} FCFA  |  Total restant : ${Math.round(totalRestant).toLocaleString("fr-FR")} FCFA  |  Prêts : ${filtered.length}`,
      14,
      startY
    );

    autoTable(doc, {
      startY: startY + 4,
      head: [["Date", "Montant initial", "Remboursé", "Reste", "Échéance", "Statut"]],
      body: filtered.map((p) => {
        const reste = Math.max(0, (p.montant || 0) - (p.montant_paye || 0));
        return [
          format(new Date(p.date_pret), "dd/MM/yyyy", { locale: fr }),
          `${Math.round(p.montant || 0).toLocaleString("fr-FR")} FCFA`,
          `${Math.round(p.montant_paye || 0).toLocaleString("fr-FR")} FCFA`,
          `${reste.toLocaleString("fr-FR")} FCFA`,
          p.echeance ? format(new Date(p.echeance), "dd/MM/yyyy", { locale: fr }) : "—",
          p.statut,
        ];
      }),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didDrawPage: () => membrePDFFooter(doc),
    });

    // marge en bas
    void pageWidth;
    doc.save(`${buildMembreFileName("mes_prets")}.pdf`);
  };

  const noData = filtered.length === 0;

  return (
    <div className="space-y-6 p-3 sm:p-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Mes Prêts</h1>
        <p className="text-muted-foreground mt-2">Historique de vos prêts et remboursements</p>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-blue-500" />
              Prêts en cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">{pretsEnCours.count}</div>
            {pretsEnCours.count > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Reste à rembourser: {formatFCFA(pretsEnCours.total)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-gray-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4" />
              Total des prêts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{prets?.length || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-orange-500" />
              Prochaine échéance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {prochainePret ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">
                    {format(new Date(prochainePret.echeance), "dd MMM yyyy", { locale: fr })}
                  </span>
                  <Badge variant={echeanceColor(prochainePret.echeance) as "default" | "secondary" | "destructive"}>
                    {differenceInDays(new Date(prochainePret.echeance), new Date())} j
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Reste : {formatFCFA(Math.max(0, (prochainePret.montant || 0) - (prochainePret.montant_paye || 0)))}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune échéance à venir</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtre + export */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <Select value={filtreStatut} onValueChange={(v) => setFiltreStatut(v as StatutFiltre)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous statuts</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
                <SelectItem value="approuve">Approuvé</SelectItem>
                <SelectItem value="en_cours">En cours</SelectItem>
                <SelectItem value="rembourse">Remboursé</SelectItem>
                <SelectItem value="refuse">Refusé</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportPDF} disabled={noData}>
              <FileText className="h-4 w-4 mr-2" /> Export PDF
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {filtered.length} prêt{filtered.length > 1 ? "s" : ""} affiché
            {filtered.length > 1 ? "s" : ""} / {prets?.length ?? 0} au total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Historique des Prêts
          </CardTitle>
          <CardDescription>Vos demandes de prêts et leur état de remboursement</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-destructive">Erreur lors du chargement des prêts</p>
            </div>
          ) : noData ? (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun prêt pour ce filtre</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Remboursement</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((pret) => {
                  const montant = pret.montant || 0;
                  const rembourse = pret.montant_paye || 0;
                  const pourcentage = montant > 0 ? Math.round((rembourse / montant) * 100) : 0;

                  return (
                    <TableRow key={pret.id}>
                      <TableCell>
                        {format(new Date(pret.date_pret), "dd/MM/yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatFCFA(montant)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{formatFCFA(rembourse)}</span>
                            <span>{pourcentage}%</span>
                          </div>
                          <Progress value={pourcentage} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {pret.echeance
                          ? format(new Date(pret.echeance), "dd/MM/yyyy", { locale: fr })
                          : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(pret.statut)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyPrets;
