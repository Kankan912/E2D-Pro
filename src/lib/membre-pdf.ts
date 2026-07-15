import type jsPDF from "jspdf";

export interface MembrePDFHeaderOptions {
  titre: string;
  membreLabel: string;
  exerciceLabel?: string;
}

/**
 * En-tête standardisé pour les PDF générés côté membre.
 * Retourne la coordonnée Y où le contenu suivant peut commencer.
 */
export function buildMembrePDFHeader(doc: jsPDF, opts: MembrePDFHeaderOptions): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(opts.titre, 14, 16);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Membre : ${opts.membreLabel}`, 14, 23);

  if (opts.exerciceLabel) {
    doc.text(`Exercice : ${opts.exerciceLabel}`, 14, 29);
  }

  doc.text(
    `Édité le : ${new Date().toLocaleDateString("fr-FR")}`,
    pageWidth - 14,
    23,
    { align: "right" }
  );

  return opts.exerciceLabel ? 34 : 28;
}

export function membrePDFFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const internalAny = doc as unknown;
  const pageCount = internalAny.internal.getNumberOfPages();
  const current = internalAny.internal.getCurrentPageInfo().pageNumber;
  doc.setFontSize(8);
  doc.text(`Page ${current} / ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: "right" });
}

export function buildMembreFileName(prefix: string, exerciceNom?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const exo = (exerciceNom ?? "tous").replace(/\s+/g, "_");
  return `${prefix}_${exo}_${today}`;
}
