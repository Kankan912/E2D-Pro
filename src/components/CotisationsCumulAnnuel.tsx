import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Users, Coins, Loader2, Search, FileDown, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface CotisationsCumulAnnuelProps {
  exerciceId?: string;
}

type StatutFiltre = "tous" | "complet" | "a_jour" | "en_cours" | "en_retard";
type EquipeFiltre = "toutes" | "jaune" | "rouge";

const getStatutLabel = (progression: number) => {
  if (progression >= 100) return "Complet";
  if (progression >= 80) return "À jour";
  if (progression >= 50) return "En cours";
  return "En retard";
};

const matchStatut = (progression: number, filtre: StatutFiltre) => {
  if (filtre === "tous") return true;
  if (filtre === "complet") return progression >= 100;
  if (filtre === "a_jour") return progression >= 80 && progression < 100;
  if (filtre === "en_cours") return progression >= 50 && progression < 80;
  if (filtre === "en_retard") return progression < 50;
  return true;
};

export default function CotisationsCumulAnnuel({ exerciceId }: CotisationsCumulAnnuelProps) {
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<StatutFiltre>("tous");
  const [filtreEquipe, setFiltreEquipe] = useState<EquipeFiltre>("toutes");

  const { data: exercice, isLoading: loadingExercice, error: errorExercice } = useQuery({
    queryKey: ['exercice-actif-cotisations', exerciceId],
    queryFn: async () => {
      if (exerciceId) {
        const { data, error } = await supabase
          .from('exercices')
          .select('id, nom, date_debut, date_fin, statut')
          .eq('id', exerciceId)
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('exercices')
        .select('id, nom, date_debut, date_fin, statut')
        .eq('statut', 'actif')
        .order('date_debut', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: membres } = useQuery({
    queryKey: ['membres-e2d-cumul'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom, equipe_jaune_rouge')
        .eq('statut', 'actif')
        .eq('est_membre_e2d', true)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: typesCotisations } = useQuery({
    queryKey: ['types-cotisations-obligatoires', exercice?.id],
    queryFn: async () => {
      if (exercice?.id) {
        const { data, error } = await supabase
          .from('exercices_cotisations_types')
          .select('cotisations_types(*)')
          .eq('exercice_id', exercice.id)
          .eq('actif', true);
        if (error) throw error;
        return (data || []).map((d: any) => d.cotisations_types).filter(Boolean);
      }
      const { data, error } = await supabase
        .from('cotisations_types')
        .select('id, nom, montant_defaut, obligatoire')
        .eq('obligatoire', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: cotisations } = useQuery({
    queryKey: ['cotisations-exercice-cumul', exercice?.id],
    queryFn: async () => {
      if (!exercice?.id) return [];
      const { data, error } = await supabase
        .from('cotisations')
        .select('id, membre_id, montant, statut')
        .eq('exercice_id', exercice.id)
        .eq('statut', 'paye');
      if (error) throw error;
      return data;
    },
    enabled: !!exercice?.id,
  });

  const { data: configsMembres } = useQuery({
    queryKey: ['configs-cotisations-membres', exercice?.id],
    queryFn: async () => {
      if (!exercice?.id) return [];
      const { data, error } = await supabase
        .from('cotisations_membres')
        .select('id, membre_id, type_cotisation_id, montant_personnalise, actif')
        .eq('exercice_id', exercice.id)
        .eq('actif', true);
      if (error) throw error;
      return data;
    },
    enabled: !!exercice?.id,
  });

  const { data: cotisationsMensuelles } = useQuery({
    queryKey: ['cotisations-mensuelles-cumul', exercice?.id],
    queryFn: async () => {
      if (!exercice?.id) return [];
      const { data, error } = await supabase
        .from('cotisations_mensuelles_exercice')
        .select('membre_id, montant')
        .eq('exercice_id', exercice.id)
        .eq('actif', true);
      if (error) throw error;
      return data;
    },
    enabled: !!exercice?.id,
  });

  const calculateMonthsInExercice = () => {
    if (!exercice) return 12;
    const debut = new Date(exercice.date_debut);
    const fin = new Date(exercice.date_fin);
    const months = (fin.getFullYear() - debut.getFullYear()) * 12 + (fin.getMonth() - debut.getMonth()) + 1;
    return Math.min(months, 12);
  };

  const getMontantAttenduMembre = (membreId: string) => {
    if (!typesCotisations) return 0;
    const nbMois = calculateMonthsInExercice();

    return typesCotisations.reduce((total, type) => {
      const isCotisationMensuelle = type.nom.toLowerCase().includes('cotisation mensuelle');

      if (isCotisationMensuelle) {
        const configMensuelle = cotisationsMensuelles?.find(cm => cm.membre_id === membreId);
        const montantMensuel = configMensuelle?.montant ?? type.montant_defaut ?? 0;
        return total + (montantMensuel * nbMois);
      } else {
        const configPerso = configsMembres?.find(
          c => c.membre_id === membreId && c.type_cotisation_id === type.id
        );
        const montantMensuel = configPerso?.montant_personnalise ?? type.montant_defaut ?? 0;
        return total + (montantMensuel * nbMois);
      }
    }, 0);
  };

  const getMontantPayeMembre = (membreId: string) => {
    if (!cotisations) return 0;
    return cotisations
      .filter(c => c.membre_id === membreId)
      .reduce((total, c) => total + (c.montant || 0), 0);
  };

  const membresStats = useMemo(() => {
    return membres?.map(membre => {
      const attendu = getMontantAttenduMembre(membre.id);
      const paye = getMontantPayeMembre(membre.id);
      const progression = attendu > 0 ? (paye / attendu) * 100 : 0;
      return {
        ...membre,
        attendu,
        paye,
        progression: Math.min(progression, 100),
      };
    }).sort((a, b) => b.progression - a.progression);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membres, cotisations, configsMembres, cotisationsMensuelles, typesCotisations, exercice]);

  const filteredStats = useMemo(() => {
    if (!membresStats) return [];
    const term = search.trim().toLowerCase();
    return membresStats.filter(m => {
      if (term) {
        const full = `${m.prenom ?? ""} ${m.nom ?? ""}`.toLowerCase();
        if (!full.includes(term)) return false;
      }
      if (filtreEquipe !== "toutes") {
        if ((m as any).equipe_jaune_rouge !== filtreEquipe) return false;
      }
      if (!matchStatut(m.progression, filtreStatut)) return false;
      return true;
    });
  }, [membresStats, search, filtreStatut, filtreEquipe]);

  const totalAttendu = filteredStats.reduce((sum, m) => sum + m.attendu, 0);
  const totalPaye = filteredStats.reduce((sum, m) => sum + m.paye, 0);
  const progressionGlobale = totalAttendu > 0 ? (totalPaye / totalAttendu) * 100 : 0;

  const getProgressColor = (progression: number) => {
    if (progression >= 80) return 'bg-green-500';
    if (progression >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getBadgeVariant = (progression: number): "default" | "secondary" | "destructive" => {
    if (progression >= 80) return 'default';
    if (progression >= 50) return 'secondary';
    return 'destructive';
  };

  const equipeLabel = (eq?: string | null) => {
    if (eq === 'jaune') return 'Jaune';
    if (eq === 'rouge') return 'Rouge';
    return '—';
  };

  const fileBase = () => {
    const today = new Date().toISOString().slice(0, 10);
    const nom = (exercice?.nom ?? 'exercice').replace(/\s+/g, '_');
    return `cotisations_cumul_${nom}_${today}`;
  };

  const exportCSV = () => {
    const header = ["Membre", "Équipe", "Attendu (FCFA)", "Payé (FCFA)", "Reste (FCFA)", "Progression (%)", "Statut"];
    const lines = filteredStats.map(m => [
      `${m.prenom ?? ""} ${m.nom ?? ""}`.trim(),
      equipeLabel((m as any).equipe_jaune_rouge),
      Math.round(m.attendu).toString(),
      Math.round(m.paye).toString(),
      Math.max(0, Math.round(m.attendu - m.paye)).toString(),
      m.progression.toFixed(1),
      getStatutLabel(m.progression),
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header, ...lines].map(row => row.map(escape).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Cotisations - Cumul annuel", 14, 16);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Exercice : ${exercice?.nom ?? "—"}`, 14, 23);
    doc.text(`Édité le : ${new Date().toLocaleDateString("fr-FR")}`, pageWidth - 14, 23, { align: "right" });

    doc.setFontSize(9);
    const statsLine = `Total attendu : ${Math.round(totalAttendu).toLocaleString("fr-FR")} FCFA  |  Total payé : ${Math.round(totalPaye).toLocaleString("fr-FR")} FCFA  |  Progression : ${progressionGlobale.toFixed(1)}%  |  Membres : ${filteredStats.length}`;
    doc.text(statsLine, 14, 30);

    autoTable(doc, {
      startY: 35,
      head: [["Membre", "Équipe", "Attendu (FCFA)", "Payé (FCFA)", "Reste (FCFA)", "Progression", "Statut"]],
      body: filteredStats.map(m => [
        `${m.prenom ?? ""} ${m.nom ?? ""}`.trim(),
        equipeLabel((m as any).equipe_jaune_rouge),
        Math.round(m.attendu).toLocaleString("fr-FR"),
        Math.round(m.paye).toLocaleString("fr-FR"),
        Math.max(0, Math.round(m.attendu - m.paye)).toLocaleString("fr-FR"),
        `${m.progression.toFixed(1)}%`,
        getStatutLabel(m.progression),
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        const current = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8);
        doc.text(`Page ${current} / ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
      },
    });

    doc.save(`${fileBase()}.pdf`);
  };

  if (loadingExercice) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Chargement de l'exercice...
        </CardContent>
      </Card>
    );
  }

  if (errorExercice) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          Erreur lors du chargement de l'exercice. Veuillez rafraîchir la page.
        </CardContent>
      </Card>
    );
  }

  if (!exercice) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucun exercice actif. Veuillez activer un exercice dans Administration &gt; Configuration E2D &gt; Exercices.
        </CardContent>
      </Card>
    );
  }

  const totalMembres = membresStats?.length ?? 0;
  const noData = filteredStats.length === 0;

  return (
    <div className="space-y-6">
      {/* En-tête avec stats globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Coins className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Attendu</p>
                <p className="text-xl font-bold">{totalAttendu.toLocaleString("fr-FR")} FCFA</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Payé</p>
                <p className="text-xl font-bold text-green-600">{totalPaye.toLocaleString("fr-FR")} FCFA</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Membres affichés</p>
                <p className="text-xl font-bold">{filteredStats.length} <span className="text-sm font-normal text-muted-foreground">/ {totalMembres}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2">Progression Globale</p>
            <div className="flex items-center gap-3">
              <Progress value={progressionGlobale} className="h-3 flex-1" />
              <span className="font-bold">{progressionGlobale.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres + export */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou prénom"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filtreStatut} onValueChange={(v) => setFiltreStatut(v as StatutFiltre)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les statuts</SelectItem>
                  <SelectItem value="complet">Complet (100%)</SelectItem>
                  <SelectItem value="a_jour">À jour (80-99%)</SelectItem>
                  <SelectItem value="en_cours">En cours (50-79%)</SelectItem>
                  <SelectItem value="en_retard">En retard (&lt; 50%)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtreEquipe} onValueChange={(v) => setFiltreEquipe(v as EquipeFiltre)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Équipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="toutes">Toutes équipes</SelectItem>
                  <SelectItem value="jaune">Jaune</SelectItem>
                  <SelectItem value="rouge">Rouge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={noData}>
                <FileDown className="h-4 w-4 mr-2" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF} disabled={noData}>
                <FileText className="h-4 w-4 mr-2" /> PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau détaillé par membre */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Suivi Cumulatif Annuel - {exercice.nom}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Équipe</TableHead>
                <TableHead className="text-right">Attendu Annuel</TableHead>
                <TableHead className="text-right">Payé Cumulé</TableHead>
                <TableHead className="text-right">Reste à Payer</TableHead>
                <TableHead>Progression</TableHead>
                <TableHead className="text-center">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStats.map((membre) => {
                const eq = (membre as any).equipe_jaune_rouge as string | null;
                return (
                  <TableRow key={membre.id}>
                    <TableCell className="font-medium">
                      {membre.prenom} {membre.nom}
                    </TableCell>
                    <TableCell>
                      {eq === 'jaune' && <Badge className="bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 border-0">Jaune</Badge>}
                      {eq === 'rouge' && <Badge className="bg-red-500/20 text-red-700 hover:bg-red-500/30 border-0">Rouge</Badge>}
                      {!eq && <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {membre.attendu.toLocaleString("fr-FR")} FCFA
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      {membre.paye.toLocaleString("fr-FR")} FCFA
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {Math.max(0, membre.attendu - membre.paye).toLocaleString("fr-FR")} FCFA
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={membre.progression}
                          className={`h-2 w-24 ${getProgressColor(membre.progression)}`}
                        />
                        <span className="text-sm font-medium w-12 text-right">
                          {membre.progression.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getBadgeVariant(membre.progression)}>
                        {getStatutLabel(membre.progression)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {noData && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun membre ne correspond aux filtres
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
