import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useUserCotisations } from "@/hooks/useCotisations";
import { useUserMemberId } from "@/hooks/usePersonalData";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Receipt, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatFCFA } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { buildMembrePDFHeader, buildMembreFileName, membrePDFFooter } from "@/lib/membre-pdf";

type StatutFiltre = "tous" | "paye" | "en_attente" | "annule";

const MyCotisations = () => {
  const { data: cotisations, isLoading, error } = useUserCotisations();
  const { data: membre } = useUserMemberId();
  const [exerciceId, setExerciceId] = useState<string>("tous");
  const [filtreStatut, setFiltreStatut] = useState<StatutFiltre>("tous");
  const [filtreType, setFiltreType] = useState<string>("tous");

  // Charger les exercices référencés par les cotisations
  const exerciceIds = useMemo(() => {
    const ids = new Set<string>();
    cotisations?.forEach((c) => {
      const eid = (c as unknown as { exercice_id?: string }).exercice_id;
      if (eid) ids.add(eid);
    });
    return Array.from(ids);
  }, [cotisations]);

  const { data: exercices } = useQuery({
    queryKey: ["my-cotisations-exercices", exerciceIds.sort().join(",")],
    queryFn: async () => {
      if (exerciceIds.length === 0) return [];
      const { data, error } = await supabase
        .from("exercices")
        .select("id, nom, date_debut, date_fin")
        .in("id", exerciceIds);
      if (error) throw error;
      return data;
    },
    enabled: exerciceIds.length > 0,
  });

  const exerciceNom = (id?: string) =>
    exercices?.find((e) => e.id === id)?.nom ?? "—";

  // Configs montant attendu (pour la carte progression)
  const selectedExercice = exerciceId !== "tous" ? exercices?.find((e) => e.id === exerciceId) : null;

  const { data: progressionData } = useQuery({
    queryKey: ["my-cotisation-progression", membre?.id, exerciceId],
    queryFn: async () => {
      if (!membre?.id || exerciceId === "tous" || !selectedExercice) return null;

      const [{ data: types }, { data: mensuelle }, { data: configsPerso }] = await Promise.all([
        supabase
          .from("exercices_cotisations_types")
          .select("cotisations_types(id, nom, montant_defaut, obligatoire)")
          .eq("exercice_id", exerciceId)
          .eq("actif", true),
        supabase
          .from("cotisations_mensuelles_exercice")
          .select("montant")
          .eq("exercice_id", exerciceId)
          .eq("membre_id", membre.id)
          .eq("actif", true)
          .maybeSingle(),
        supabase
          .from("cotisations_membres")
          .select("type_cotisation_id, montant_personnalise")
          .eq("exercice_id", exerciceId)
          .eq("membre_id", membre.id)
          .eq("actif", true),
      ]);

      const debut = new Date(selectedExercice.date_debut);
      const fin = new Date(selectedExercice.date_fin);
      const nbMois = Math.min(
        12,
        (fin.getFullYear() - debut.getFullYear()) * 12 + (fin.getMonth() - debut.getMonth()) + 1
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typesList = (types || []).map((t: any) => t.cotisations_types).filter(Boolean);
      let attendu = 0;
      for (const t of typesList) {
        const isMensuelle = (t.nom as string).toLowerCase().includes("cotisation mensuelle");
        if (isMensuelle) {
          const montantMensuel = mensuelle?.montant ?? t.montant_defaut ?? 0;
          attendu += montantMensuel * nbMois;
        } else {
          const cfg = configsPerso?.find((c) => c.type_cotisation_id === t.id);
          const montantMensuel = cfg?.montant_personnalise ?? t.montant_defaut ?? 0;
          attendu += montantMensuel * nbMois;
        }
      }
      return { attendu, nbMois };
    },
    enabled: !!membre?.id && exerciceId !== "tous" && !!selectedExercice,
  });

  // Liste filtrée
  const typesUniques = useMemo(() => {
    const set = new Set<string>();
    cotisations?.forEach((c) => {
      if (c.type?.nom) set.add(c.type.nom);
    });
    return Array.from(set).sort();
  }, [cotisations]);

  const filtered = useMemo(() => {
    if (!cotisations) return [];
    return cotisations.filter((c) => {
      if (exerciceId !== "tous") {
        const eid = (c as unknown as { exercice_id?: string }).exercice_id;
        if (eid !== exerciceId) return false;
      }
      if (filtreStatut !== "tous" && c.statut !== filtreStatut) return false;
      if (filtreType !== "tous" && c.type?.nom !== filtreType) return false;
      return true;
    });
  }, [cotisations, exerciceId, filtreStatut, filtreType]);

  const totalPayeFiltered = filtered
    .filter((c) => c.statut === "paye")
    .reduce((sum, c) => sum + c.montant, 0);

  const progression = progressionData?.attendu
    ? Math.min(100, (totalPayeFiltered / progressionData.attendu) * 100)
    : 0;

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case "paye":
        return <Badge className="bg-green-500">Payé</Badge>;
      case "en_attente":
        return <Badge variant="secondary">En attente</Badge>;
      case "annule":
        return <Badge variant="destructive">Annulé</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  const membreLabel = membre ? `${membre.prenom ?? ""} ${membre.nom ?? ""}`.trim() : "—";

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const exoLabel = exerciceId !== "tous" ? exerciceNom(exerciceId) : "Tous";
    const startY = buildMembrePDFHeader(doc, {
      titre: "Mes cotisations",
      membreLabel,
      exerciceLabel: exoLabel,
    });

    doc.setFontSize(9);
    doc.text(
      `Total payé (filtré) : ${Math.round(totalPayeFiltered).toLocaleString("fr-FR")} FCFA`,
      14,
      startY
    );

    autoTable(doc, {
      startY: startY + 4,
      head: [["Type", "Date", "Montant", "Statut"]],
      body: filtered.map((c) => [
        c.type?.nom ?? "—",
        format(new Date(c.date_paiement), "dd/MM/yyyy", { locale: fr }),
        `${Math.round(c.montant).toLocaleString("fr-FR")} FCFA`,
        c.statut,
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didDrawPage: () => membrePDFFooter(doc),
    });

    doc.save(`${buildMembreFileName("mes_cotisations", exerciceId !== "tous" ? exerciceNom(exerciceId) : undefined)}.pdf`);
  };

  const noData = filtered.length === 0;

  return (
    <div className="space-y-6 p-3 sm:p-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Mes Cotisations</h1>
        <p className="text-muted-foreground mt-2">Historique de vos cotisations annuelles</p>
      </div>

      {/* Carte progression annuelle */}
      {progressionData && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Progression — Exercice {exerciceNom(exerciceId)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap justify-between text-sm">
              <span>
                Attendu : <strong>{formatFCFA(progressionData.attendu)}</strong>
              </span>
              <span>
                Payé : <strong className="text-green-600">{formatFCFA(totalPayeFiltered)}</strong>
              </span>
              <span>
                Reste :{" "}
                <strong className="text-orange-600">
                  {formatFCFA(Math.max(0, progressionData.attendu - totalPayeFiltered))}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={progression} className="h-3 flex-1" />
              <span className="font-bold text-sm">{progression.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtres + export */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <Select value={exerciceId} onValueChange={setExerciceId}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Exercice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les exercices</SelectItem>
                  {exercices?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtreStatut} onValueChange={(v) => setFiltreStatut(v as StatutFiltre)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous statuts</SelectItem>
                  <SelectItem value="paye">Payé</SelectItem>
                  <SelectItem value="en_attente">En attente</SelectItem>
                  <SelectItem value="annule">Annulé</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtreType} onValueChange={setFiltreType}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous types</SelectItem>
                  {typesUniques.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={exportPDF} disabled={noData}>
              <FileText className="h-4 w-4 mr-2" /> Export PDF
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {filtered.length} cotisation{filtered.length > 1 ? "s" : ""} affichée
            {filtered.length > 1 ? "s" : ""} / {cotisations?.length ?? 0} au total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cotisations</CardTitle>
          <CardDescription>Vos paiements de cotisations E2D</CardDescription>
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
              <Receipt className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-destructive">Erreur lors du chargement des cotisations</p>
            </div>
          ) : noData ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune cotisation pour ces filtres</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type Cotisation</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((cotisation) => (
                    <TableRow key={cotisation.id}>
                      <TableCell className="font-medium">
                        {cotisation.type?.nom || "Non spécifié"}
                      </TableCell>
                      <TableCell className="text-right">{formatFCFA(cotisation.montant)}</TableCell>
                      <TableCell>
                        {format(new Date(cotisation.date_paiement), "dd/MM/yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>{getStatusBadge(cotisation.statut)}</TableCell>
                      <TableCell className="text-right">
                        {cotisation.justificatif_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(cotisation.justificatif_url, "_blank")}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Voir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total des cotisations payées (filtré)</span>
                  <span className="text-xl font-bold text-foreground">{formatFCFA(totalPayeFiltered)}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyCotisations;
