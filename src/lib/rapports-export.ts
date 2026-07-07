import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { addE2DHeader, addE2DFooter } from "@/lib/pdf-utils";
import type { CotisationWithJoins, PretWithJoins, SanctionWithJoins, EpargneWithJoins } from "@/types/supabase-joins";

const formatMembre = (membres: { prenom: string; nom: string } | null): string =>
  membres ? `${membres.prenom} ${membres.nom}` : "-";

interface ExportContext {
  cotisations?: CotisationWithJoins[];
  prets?: PretWithJoins[];
  sanctions?: SanctionWithJoins[];
  epargnes?: EpargneWithJoins[];
  periode?: string;
}

export async function exportRapportPDF(type: string, ctx: ExportContext) {
  const doc = new jsPDF();
  const title = `Rapport ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  const startY = await addE2DHeader(doc, title, `Période : ${ctx.periode ?? "Toutes périodes"}`);

  let tableData: (string | number)[][] = [];
  let columns: string[] = [];

  if (type === "cotisations" && ctx.cotisations) {
    columns = ["Membre", "Type", "Montant", "Statut", "Date"];
    tableData = ctx.cotisations.map(c => [
      formatMembre(c.membres),
      c.cotisations_types?.nom || "-",
      `${(c.montant || 0).toLocaleString("fr-FR")} FCFA`,
      c.statut || "-",
      c.date_paiement ? format(parseISO(c.date_paiement), "dd/MM/yyyy") : "-"
    ]);
  } else if (type === "prets" && ctx.prets) {
    columns = ["Membre", "Montant", "Payé", "Reste", "Statut", "Échéance"];
    tableData = ctx.prets.map(p => [
      formatMembre(p.membres),
      `${(p.montant || 0).toLocaleString("fr-FR")} FCFA`,
      `${(p.montant_paye || 0).toLocaleString("fr-FR")} FCFA`,
      `${(Math.max(0, (p.montant_total_du || p.montant) - (p.montant_paye || 0))).toLocaleString("fr-FR")} FCFA`,
      p.statut,
      format(parseISO(p.echeance), "dd/MM/yyyy")
    ]);
  } else if (type === "sanctions" && ctx.sanctions) {
    columns = ["Membre", "Motif", "Montant", "Statut"];
    tableData = ctx.sanctions.map(s => [
      formatMembre(s.membres),
      s.motif || "-",
      `${(s.montant_amende || 0).toLocaleString("fr-FR")} FCFA`,
      s.statut
    ]);
  } else if (type === "epargnes" && ctx.epargnes) {
    columns = ["Membre", "Montant", "Date", "Statut"];
    tableData = ctx.epargnes.map(e => [
      formatMembre(e.membres),
      `${(e.montant || 0).toLocaleString("fr-FR")} FCFA`,
      format(parseISO(e.date_depot), "dd/MM/yyyy"),
      e.statut
    ]);
  }

  autoTable(doc, {
    head: [columns],
    body: tableData,
    startY,
    headStyles: { fillColor: [30, 64, 175] },
  });

  addE2DFooter(doc);
  doc.save(`rapport-${type}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

export function exportRapportExcel(type: string, ctx: ExportContext) {
  let data: Record<string, string | number>[] = [];

  if (type === "cotisations" && ctx.cotisations) {
    data = ctx.cotisations.map(c => ({
      Membre: formatMembre(c.membres),
      Type: c.cotisations_types?.nom || "-",
      Montant: c.montant || 0,
      Statut: c.statut || "-",
      Date: c.date_paiement || ""
    }));
  } else if (type === "prets" && ctx.prets) {
    data = ctx.prets.map(p => ({
      Membre: formatMembre(p.membres),
      Montant: p.montant || 0,
      "Montant Total Dû": p.montant_total_du || p.montant,
      "Montant Payé": p.montant_paye || 0,
      Reste: (p.montant_total_du || p.montant) - (p.montant_paye || 0),
      Statut: p.statut,
      "Date Prêt": p.date_pret,
      Échéance: p.echeance
    }));
  } else if (type === "sanctions" && ctx.sanctions) {
    data = ctx.sanctions.map(s => ({
      Membre: formatMembre(s.membres),
      Motif: s.motif || "-",
      Montant: s.montant_amende || 0,
      Statut: s.statut,
      Date: s.created_at
    }));
  } else if (type === "epargnes" && ctx.epargnes) {
    data = ctx.epargnes.map(e => ({
      Membre: formatMembre(e.membres),
      Montant: e.montant || 0,
      "Date Dépôt": e.date_depot,
      Statut: e.statut
    }));
  }

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type);
  XLSX.writeFile(wb, `rapport-${type}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}
