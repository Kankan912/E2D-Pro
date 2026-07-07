/**
 * Générateur PDF des comptes-rendus de réunion.
 * Extrait depuis CompteRenduViewer.tsx (G2 — découpe composant).
 * Aucun changement de comportement par rapport à la version d'origine.
 */
import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { addE2DLogo, addE2DFooter } from "@/lib/pdf-utils";

export type PresenceRow = {
  id?: string;
  statut_presence?: string | null;
  heure_arrivee?: string | null;
  observations?: string | null;
  membres?: { nom?: string; prenom?: string } | null;
  [key: string]: unknown;
};

export type CotisationRow = {
  id?: string;
  montant?: number | null;
  membre?: { nom?: string; prenom?: string } | null;
  type?: { nom?: string } | null;
  [key: string]: unknown;
};

export type EpargneRow = {
  id?: string;
  montant?: number | null;
  membre?: { nom?: string; prenom?: string } | null;
  [key: string]: unknown;
};

export type SanctionRow = {
  id?: string;
  montant_amende?: number | null;
  type_sanction?: string | null;
  motif?: string | null;
  statut?: string | null;
  membre?: { nom?: string; prenom?: string } | null;
  [key: string]: unknown;
};

export type AideRow = {
  id?: string;
  montant?: number | null;
  type_aide?: string | null;
  type?: { nom?: string } | null;
  beneficiaire?: { nom?: string; prenom?: string } | null;
  membre?: { nom?: string; prenom?: string } | null;
  [key: string]: unknown;
};

export type BeneficiaireRow = {
  id?: string;
  montant_final?: number | null;
  montant_brut?: number | null;
  deductions?: unknown;
  statut?: string | null;
  membres?: { nom?: string; prenom?: string } | null;
  membre?: { nom?: string; prenom?: string } | null;
  [key: string]: unknown;
};

export type CRRow = {
  id?: string;
  sujet?: string | null;
  titre?: string | null;
  description?: string | null;
  resolution?: string | null;
  numero_ordre?: number | null;
  decisions?: string | null;
  [key: string]: unknown;
};

export interface CompteRenduPDFInput {
  reunion: {
    id: string;
    sujet?: string;
    date_reunion: string;
    statut: string;
    lieu_description?: string;
  };
  presences?: PresenceRow[] | null;
  comptesRendus?: CRRow[] | null;
  cotisationsReunion?: CotisationRow[] | null;
  epargnesReunion?: EpargneRow[] | null;
  sanctionsReunion?: SanctionRow[] | null;
  aidesReunion?: AideRow[] | null;
  beneficiairesReunion?: BeneficiaireRow[] | null;
}

/**
 * Génère et télécharge le PDF du compte-rendu. Retourne le nom du fichier.
 */
export async function generateCompteRenduPDF(input: CompteRenduPDFInput): Promise<string> {
  const {
    reunion,
    presences,
    comptesRendus,
    cotisationsReunion,
    epargnesReunion,
    sanctionsReunion,
    aidesReunion,
    beneficiairesReunion,
  } = input;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;

  await addE2DLogo(doc);

  const checkNewPage = (neededSpace: number = 30) => {
    if (yPosition > 260 - neededSpace) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // Titre principal
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("COMPTE-RENDU DE RÉUNION", margin, yPosition);
  yPosition += 15;

  doc.setDrawColor(0, 100, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Infos générales
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("INFORMATIONS GÉNÉRALES", margin, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(`Sujet: ${reunion.sujet || "Sans titre"}`, margin, yPosition);
  yPosition += 6;
  doc.text(
    `Date: ${format(new Date(reunion.date_reunion), "PPP", { locale: fr })}`,
    margin,
    yPosition,
  );
  yPosition += 6;

  if (reunion.lieu_description) {
    doc.text(`Lieu: ${reunion.lieu_description}`, margin, yPosition);
    yPosition += 6;
  }

  doc.text(
    `Statut: ${reunion.statut === "terminee" ? "Terminée" : reunion.statut}`,
    margin,
    yPosition,
  );
  yPosition += 12;

  // Présences
  const presents = presences?.filter((p) => p.statut_presence === "present") || [];
  const excuses = presences?.filter((p) => p.statut_presence === "absent_excuse") || [];
  const absentsNonExcuses =
    presences?.filter((p) => p.statut_presence === "absent_non_excuse") || [];
  const retards = presences?.filter((p) => p.heure_arrivee) || [];
  const totalMembres = presents.length + excuses.length + absentsNonExcuses.length;
  const tauxPresence =
    totalMembres > 0 ? Math.round((presents.length / totalMembres) * 100) : 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`PRÉSENCES - Taux: ${tauxPresence}%`, margin, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Présents: ${presents.length} | Excusés: ${excuses.length} | Absents non excusés: ${absentsNonExcuses.length}`,
    margin,
    yPosition,
  );
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (presents.length > 0) {
    const presentsText = presents
      .map((p) => `${p.membres?.prenom} ${p.membres?.nom}`)
      .join(", ");
    const presentsLines = doc.splitTextToSize(presentsText, pageWidth - 2 * margin);
    doc.text(presentsLines, margin, yPosition);
    yPosition += presentsLines.length * 5 + 5;
  } else {
    doc.text("Aucun présent enregistré", margin, yPosition);
    yPosition += 8;
  }

  if (excuses.length > 0) {
    doc.setFont("helvetica", "italic");
    const excusesText = `Excusés: ${excuses
      .map((p) => `${p.membres?.prenom} ${p.membres?.nom}`)
      .join(", ")}`;
    const excusesLines = doc.splitTextToSize(excusesText, pageWidth - 2 * margin);
    doc.text(excusesLines, margin, yPosition);
    yPosition += excusesLines.length * 5 + 5;
  }

  if (retards.length > 0) {
    doc.setFont("helvetica", "italic");
    const retardsText = `Retards: ${retards
      .map((p) => `${p.membres?.prenom} ${p.membres?.nom}`)
      .join(", ")}`;
    const retardsLines = doc.splitTextToSize(retardsText, pageWidth - 2 * margin);
    doc.text(retardsLines, margin, yPosition);
    yPosition += retardsLines.length * 5 + 5;
  }

  if (absentsNonExcuses.length > 0) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(200, 0, 0);
    const absentsText = `Absents non excusés: ${absentsNonExcuses
      .map((p) => `${p.membres?.prenom} ${p.membres?.nom}`)
      .join(", ")}`;
    const absentsLines = doc.splitTextToSize(absentsText, pageWidth - 2 * margin);
    doc.text(absentsLines, margin, yPosition);
    yPosition += absentsLines.length * 5 + 5;
    doc.setTextColor(0, 0, 0);
  }

  yPosition += 5;

  // Ordre du jour
  checkNewPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`ORDRE DU JOUR (${comptesRendus?.length || 0} point(s))`, margin, yPosition);
  yPosition += 10;

  if (comptesRendus && comptesRendus.length > 0) {
    comptesRendus.forEach((cr, index) => {
      checkNewPage();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${index + 1}. ${cr.sujet ?? ""}`, margin, yPosition);
      yPosition += 6;

      if (cr.description) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const descLines = doc.splitTextToSize(cr.description, pageWidth - 2 * margin - 10);
        doc.text(descLines, margin + 5, yPosition);
        yPosition += descLines.length * 5 + 3;
      }

      if (cr.resolution) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(0, 100, 0);
        doc.text("Résolution:", margin + 5, yPosition);
        yPosition += 5;
        doc.setTextColor(0, 0, 0);
        const resLines = doc.splitTextToSize(cr.resolution, pageWidth - 2 * margin - 15);
        doc.text(resLines, margin + 10, yPosition);
        yPosition += resLines.length * 5 + 3;
      }

      if (cr.decisions) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 150);
        doc.text("Décisions:", margin + 5, yPosition);
        yPosition += 5;
        doc.setTextColor(0, 0, 0);
        const decLines = doc.splitTextToSize(cr.decisions, pageWidth - 2 * margin - 15);
        doc.text(decLines, margin + 10, yPosition);
        yPosition += decLines.length * 5 + 3;
      }

      yPosition += 5;
    });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("Aucun point à l'ordre du jour", margin, yPosition);
    yPosition += 10;
  }

  // Cotisations
  if (cotisationsReunion && cotisationsReunion.length > 0) {
    checkNewPage();
    const totalCotisations = cotisationsReunion.reduce(
      (sum, c) => sum + (c.montant || 0),
      0,
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(
      `COTISATIONS COLLECTÉES (${cotisationsReunion.length}) - Total: ${totalCotisations.toLocaleString()} FCFA`,
      margin,
      yPosition,
    );
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    cotisationsReunion.forEach((c) => {
      checkNewPage(10);
      doc.text(
        `• ${c.membre?.prenom} ${c.membre?.nom} - ${c.type?.nom || "Type inconnu"}: ${c.montant?.toLocaleString()} FCFA`,
        margin + 5,
        yPosition,
      );
      yPosition += 5;
    });
    yPosition += 5;
  }

  // Épargnes
  if (epargnesReunion && epargnesReunion.length > 0) {
    checkNewPage();
    const totalEpargnes = epargnesReunion.reduce((sum, e) => sum + (e.montant || 0), 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(
      `ÉPARGNES DÉPOSÉES (${epargnesReunion.length}) - Total: ${totalEpargnes.toLocaleString()} FCFA`,
      margin,
      yPosition,
    );
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    epargnesReunion.forEach((e) => {
      checkNewPage(10);
      doc.text(
        `• ${e.membre?.prenom} ${e.membre?.nom}: ${e.montant?.toLocaleString()} FCFA`,
        margin + 5,
        yPosition,
      );
      yPosition += 5;
    });
    yPosition += 5;
  }

  // Sanctions
  if (sanctionsReunion && sanctionsReunion.length > 0) {
    checkNewPage();
    const totalSanctions = sanctionsReunion.reduce(
      (sum, s) => sum + (s.montant_amende || 0),
      0,
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(
      `SANCTIONS (${sanctionsReunion.length}) - Total: ${totalSanctions.toLocaleString()} FCFA`,
      margin,
      yPosition,
    );
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    sanctionsReunion.forEach((s) => {
      checkNewPage(10);
      const statut = s.statut === "paye" ? "✓" : "○";
      doc.text(
        `${statut} ${s.membre?.prenom} ${s.membre?.nom} - ${s.motif || "Sanction"}: ${s.montant_amende?.toLocaleString()} FCFA`,
        margin + 5,
        yPosition,
      );
      yPosition += 5;
    });
    yPosition += 5;
  }

  // Aides
  if (aidesReunion && aidesReunion.length > 0) {
    checkNewPage();
    const totalAides = aidesReunion.reduce((sum, a) => sum + (a.montant || 0), 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(
      `AIDES DISTRIBUÉES (${aidesReunion.length}) - Total: ${totalAides.toLocaleString()} FCFA`,
      margin,
      yPosition,
    );
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    aidesReunion.forEach((a) => {
      checkNewPage(10);
      doc.text(
        `• ${a.beneficiaire?.prenom} ${a.beneficiaire?.nom} - ${a.type?.nom || "Aide"}: ${a.montant?.toLocaleString()} FCFA`,
        margin + 5,
        yPosition,
      );
      yPosition += 5;
    });
    yPosition += 5;
  }

  // Bénéficiaires
  if (beneficiairesReunion && beneficiairesReunion.length > 0) {
    checkNewPage();
    const totalBeneficiaires = beneficiairesReunion.reduce(
      (sum, b) => sum + (b.montant_final || 0),
      0,
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(
      `BÉNÉFICIAIRES DU MOIS (${beneficiairesReunion.length}) - Total: ${totalBeneficiaires.toLocaleString()} FCFA`,
      margin,
      yPosition,
    );
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    beneficiairesReunion.forEach((b) => {
      checkNewPage(10);
      const statut = b.statut === "paye" ? "✓" : "○";
      const deductionsObj =
        b.deductions && typeof b.deductions === "object"
          ? (b.deductions as Record<string, number>)
          : null;
      const details =
        deductionsObj && Object.keys(deductionsObj).length > 0
          ? ` (Brut: ${(b.montant_brut || 0).toLocaleString()}, Déductions: -${Object.values(
              deductionsObj,
            )
              .reduce((a, c) => a + c, 0)
              .toLocaleString()})`
          : "";
      doc.text(
        `${statut} ${b.membres?.prenom} ${b.membres?.nom}: ${(b.montant_final || 0).toLocaleString()} FCFA${details}`,
        margin + 5,
        yPosition,
      );
      yPosition += 5;
    });
    yPosition += 5;
  }

  addE2DFooter(doc);

  const fileName = `CR_${(reunion.sujet ?? "reunion").replace(/[^a-zA-Z0-9]/g, "_")}_${format(
    new Date(reunion.date_reunion),
    "yyyy-MM-dd",
  )}.pdf`;
  doc.save(fileName);
  return fileName;
}
