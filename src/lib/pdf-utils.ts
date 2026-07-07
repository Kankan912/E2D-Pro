import jsPDF from 'jspdf';
import logoE2D from '@/assets/logo-e2d.png';
import { logger } from '@/lib/logger';

// Cache du logo en base64
let logoBase64Cache: string | null = null;

/**
 * Charge le logo E2D en base64 de manière asynchrone
 */
export async function loadLogoBase64(): Promise<string> {
  if (logoBase64Cache) return logoBase64Cache;
  
  try {
    const response = await fetch(logoE2D);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoBase64Cache = reader.result as string;
        resolve(logoBase64Cache);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error: unknown) {
    logger.error('Erreur chargement logo:', error);
    return '';
  }
}

/**
 * Ajoute l'en-tête E2D standard à un document PDF
 * @returns La position Y après l'en-tête pour commencer le contenu
 */
export async function addE2DHeader(doc: jsPDF, title: string, subtitle?: string): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let yPosition = 18;
  
  // Charger et ajouter le logo en haut à droite
  try {
    const logo = await loadLogoBase64();
    if (logo) {
      doc.addImage(logo, 'PNG', pageWidth - 55, 8, 40, 20);
    }
  } catch (e: unknown) {
    logger.debug('Logo non chargé, continuation sans logo');
  }
  
  // Titre principal
  doc.setFontSize(18);
  doc.setTextColor(30, 64, 175); // Bleu E2D
  doc.text(title, margin, yPosition);
  yPosition += 8;
  
  // Sous-titre optionnel
  if (subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, margin, yPosition);
    yPosition += 6;
  }
  
  // Date de génération
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, margin, yPosition);
  yPosition += 6;
  
  // Ligne de séparation
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;
  
  return yPosition;
}

/**
 * Ajoute le logo E2D à un document PDF existant (pour insertion ponctuelle)
 */
export async function addE2DLogo(doc: jsPDF, x: number = -1, y: number = 8, width: number = 40, height: number = 20): Promise<void> {
  try {
    const logo = await loadLogoBase64();
    if (logo) {
      const pageWidth = doc.internal.pageSize.getWidth();
      const posX = x === -1 ? pageWidth - width - 15 : x;
      doc.addImage(logo, 'PNG', posX, y, width, height);
    }
  } catch (e: unknown) {
    logger.debug('Logo non chargé');
  }
}

/**
 * Ajoute le pied de page E2D standard avec numérotation des pages
 */
export function addE2DFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Association E2D - Page ${i}/${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
}

/**
 * Version synchrone pour ajouter le logo (utilise le cache si disponible)
 */
export function addE2DLogoSync(doc: jsPDF, x: number = -1, y: number = 8, width: number = 40, height: number = 20): void {
  if (logoBase64Cache) {
    try {
      const pageWidth = doc.internal.pageSize.getWidth();
      const posX = x === -1 ? pageWidth - width - 15 : x;
      doc.addImage(logoBase64Cache, 'PNG', posX, y, width, height);
    } catch (e: unknown) {
      logger.debug('Logo non chargé');
    }
  }
}
