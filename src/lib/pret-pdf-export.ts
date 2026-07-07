import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatFCFA } from './utils';
import { calculerResumePret } from './pretCalculsService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { addE2DLogo, addE2DFooter } from './pdf-utils';

interface Pret {
  id: string;
  montant: number;
  montant_paye?: number;
  montant_total_du?: number;
  taux_interet?: number;
  interet_initial?: number;
  date_pret: string;
  echeance: string;
  duree_mois?: number;
  reconductions?: number;
  statut: string;
  notes?: string;
  emprunteur?: {
    nom: string;
    prenom: string;
    telephone?: string;
    email?: string;
  };
  avaliste?: {
    nom: string;
    prenom: string;
  };
}

interface Paiement {
  id: string;
  montant_paye: number;
  date_paiement: string;
  type_paiement?: string;
  mode_paiement?: string;
  notes?: string;
}

interface Reconduction {
  id: string;
  date_reconduction: string;
  interet_mois: number;
  notes?: string;
}

export async function exportPretPDF(
  pret: Pret,
  paiements?: Paiement[],
  reconductions?: Reconduction[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Ajouter le logo E2D en haut à droite
  await addE2DLogo(doc);

  // En-tête
  doc.setFontSize(20);
  doc.setTextColor(11, 107, 124); // #0B6B7C
  doc.text('FICHE DE PRÊT E2D', 14, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Généré le ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}`, 14, yPosition);
  yPosition += 10;

  // Ligne de séparation
  doc.setDrawColor(11, 107, 124);
  doc.setLineWidth(0.5);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 10;

  // Informations emprunteur
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('EMPRUNTEUR', 20, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.text(`Nom complet: ${pret.emprunteur?.prenom || ''} ${pret.emprunteur?.nom || ''}`, 25, yPosition);
  yPosition += 6;
  
  if (pret.emprunteur?.telephone) {
    doc.text(`Téléphone: ${pret.emprunteur.telephone}`, 25, yPosition);
    yPosition += 6;
  }
  
  if (pret.emprunteur?.email) {
    doc.text(`Email: ${pret.emprunteur.email}`, 25, yPosition);
    yPosition += 6;
  }
  
  if (pret.avaliste) {
    doc.text(`Avaliste (Garant): ${pret.avaliste.prenom} ${pret.avaliste.nom}`, 25, yPosition);
    yPosition += 6;
  }
  yPosition += 8;

  // Détails du prêt
  doc.setFontSize(14);
  doc.text('DÉTAILS DU PRÊT', 20, yPosition);
  yPosition += 8;

  const taux = pret.taux_interet ?? 5;
  const calculs = calculerResumePret(
    { montant: pret.montant, taux_interet: pret.taux_interet, interet_initial: pret.interet_initial, reconductions: pret.reconductions, montant_paye: pret.montant_paye },
    paiements?.map(p => ({ montant_paye: p.montant_paye, date_paiement: p.date_paiement, type_paiement: p.type_paiement })),
    reconductions?.map(r => ({ date_reconduction: r.date_reconduction, interet_mois: r.interet_mois }))
  );
  const interetInitial = calculs.interetInitial;
  const totalDu = calculs.totalDu;
  const montantPaye = calculs.totalPaye;
  const resteAPayer = calculs.resteAPayer;

  const detailsData = [
    ['Capital emprunté', formatFCFA(pret.montant)],
    ['Taux d\'intérêt', `${taux}%`],
    ['Intérêt initial', formatFCFA(interetInitial)],
    ['Date du prêt', format(new Date(pret.date_pret), 'dd MMMM yyyy', { locale: fr })],
    ['Échéance', format(new Date(pret.echeance), 'dd MMMM yyyy', { locale: fr })],
    ['Durée', `${pret.duree_mois || 2} mois`],
    ['Reconductions', `${pret.reconductions || 0}`],
    ['Statut', pret.statut === 'rembourse' ? 'Remboursé' : pret.statut === 'en_cours' ? 'En cours' : pret.statut],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [],
    body: detailsData,
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 80 },
    },
    margin: { left: 25 },
  });

  yPosition = doc.lastAutoTable.finalY + 10;

  // Résumé financier
  doc.setFontSize(14);
  doc.text('RÉSUMÉ FINANCIER', 20, yPosition);
  yPosition += 8;

  const financialData = [
    ['Total dû', formatFCFA(totalDu)],
    ['Montant payé', formatFCFA(montantPaye)],
    ['Reste à payer', formatFCFA(Math.max(0, resteAPayer))],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [],
    body: financialData,
    theme: 'striped',
    headStyles: { fillColor: [11, 107, 124] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 80 },
    },
    margin: { left: 25 },
  });

  yPosition = doc.lastAutoTable.finalY + 10;

  // Historique des reconductions
  if (reconductions && reconductions.length > 0) {
    doc.setFontSize(14);
    doc.text('HISTORIQUE DES RECONDUCTIONS', 20, yPosition);
    yPosition += 8;

    const recondData = reconductions.map((r, i) => [
      `#${reconductions.length - i}`,
      format(new Date(r.date_reconduction), 'dd/MM/yyyy'),
      formatFCFA(r.interet_mois),
      r.notes || '-',
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['#', 'Date', 'Intérêt', 'Notes']],
      body: recondData,
      theme: 'striped',
      headStyles: { fillColor: [11, 107, 124] },
      margin: { left: 25, right: 25 },
    });

    yPosition = doc.lastAutoTable.finalY + 10;
  }

  // Historique des paiements
  if (paiements && paiements.length > 0) {
    doc.setFontSize(14);
    doc.text('HISTORIQUE DES PAIEMENTS', 20, yPosition);
    yPosition += 8;

    const paiementsData = paiements.map(p => [
      format(new Date(p.date_paiement), 'dd/MM/yyyy'),
      formatFCFA(p.montant_paye),
      p.type_paiement || 'mixte',
      p.mode_paiement || '-',
      p.notes || '-',
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Date', 'Montant', 'Type', 'Mode', 'Notes']],
      body: paiementsData,
      theme: 'striped',
      headStyles: { fillColor: [11, 107, 124] },
      margin: { left: 25, right: 25 },
    });
  }

  // Notes
  if (pret.notes) {
    yPosition = doc.lastAutoTable?.finalY + 10 || yPosition + 10;
    doc.setFontSize(14);
    doc.text('NOTES', 20, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.setTextColor(80);
    const splitNotes = doc.splitTextToSize(pret.notes, pageWidth - 50);
    doc.text(splitNotes, 25, yPosition);
  }

  // Pied de page avec logo E2D
  addE2DFooter(doc);

  // Télécharger
  const fileName = `Pret_${pret.emprunteur?.nom || 'Inconnu'}_${format(new Date(pret.date_pret), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
