import { Check, Download, Share2, X, Loader2, Clock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAmount } from "@/lib/payment-utils";
import type { DonationCurrency, PaymentMethod, PaymentStatus } from "@/types/donations";
import jsPDF from "jspdf";
import { addE2DHeader, addE2DFooter } from "@/lib/pdf-utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteContent";

import { logger } from "@/lib/logger";

/**
 * DonationSuccessModal (Phase 3-d / Task 19 — Fix 6)
 *
 * AVANT : le modal affichait SYSTÉMATIQUEMENT le bouton "Reçu fiscal" qui
 * générait un PDF avec :
 *   - le texte fiscal français "66% de réduction d'impôt" HARDCODÉ
 *   - le placeholder `"[Adresse de l'association]"` au lieu de l'adresse réelle
 *   ...et ce même pour les dons `bank_transfer`/`mobile_money` en statut
 *   `pending` (aucun argent reçu). Légalement discutable (un reçu fiscal ne
 *   peut être émis qu'après encaissement effectif). (Task 4 P1 #11)
 *
 * APRÈS :
 *   - Le bouton "Reçu fiscal" n'est affiché QUE pour `paymentStatus='completed'`.
 *   - Pour `paymentStatus='pending'` (virement / MoMo en attente de validation),
 *     on affiche un message clair : "Votre demande de don a été enregistrée.
 *     Vous recevrez une confirmation par email dès réception du virement."
 *   - L'adresse de l'association est lue depuis `site_config` (clé
 *     `adresse_siege`) via le hook `useSiteConfig`. Plus de placeholder
 *     `[Adresse de l'association]`. Fallback vers une chaîne discrète si
 *     l'admin n'a pas encore renseigné l'adresse.
 *   - Le texte fiscal 66% est conservé (correct pour une association
 *     française éligible) mais un commentaire TODO indique qu'il faudrait
 *     le rendre configurable (certaines associations ne sont pas éligibles,
 *     ou le taux peut varier selon le type de don).
 */
interface DonationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  donationId: string;
  amount: number;
  currency: DonationCurrency;
  method: PaymentMethod;
  /**
   * Statut de paiement de la donation. Le bouton "Reçu fiscal" n'est
   * affiché que pour `'completed'`. Pour `'pending'`, on affiche un message
   * d'attente. (Phase 3-d / Task 19 — Fix 6)
   */
  paymentStatus?: PaymentStatus;
  isRecurring?: boolean;
  donorName?: string;
  donorEmail?: string;
}

const DonationSuccessModal = ({
  isOpen,
  onClose,
  donationId,
  amount,
  currency,
  method,
  paymentStatus = 'pending',
  isRecurring = false,
  donorName = "Donateur anonyme",
  donorEmail = "",
}: DonationSuccessModalProps) => {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();
  const { data: siteConfig } = useSiteConfig();

  const getConfigValue = (key: string): string => {
    return siteConfig?.find((c) => c.cle === key)?.valeur || '';
  };

  // Phase 3-d (Fix 6) — adresse réelle depuis `site_config.adresse_siege`.
  // Plus de placeholder `[Adresse de l'association]`. Si l'admin n'a pas
  // renseigné l'adresse, on affiche un fallback discret (évite de générer
  // un PDF avec une chaîne "[Adresse...]" qui serait visiblement cassée).
  const associationAddress =
    getConfigValue('adresse_siege') ||
    getConfigValue('site_adresse') ||
    'Adresse à confirmer auprès de l\'association';

  const associationName =
    getConfigValue('nom_association') ||
    'Association E2D - Ensemble pour le Développement et le Dynamisme';

  const isCompleted = paymentStatus === 'completed';

  const handleDownloadReceipt = async () => {
    setDownloading(true);
    try {
      const doc = new jsPDF();

      // En-tête E2D
      const yStart = await addE2DHeader(doc, 'Reçu Fiscal - Don', associationName);

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = yStart + 5;

      // Titre du reçu
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175);
      doc.text('REÇU AU TITRE DES DONS', pageWidth / 2, y, { align: 'center' });
      y += 6;

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Article 200 et 238 bis du Code Général des Impôts', pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Informations de l'association
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text('ORGANISME BÉNÉFICIAIRE', margin, y);
      y += 6;

      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      // Phase 3-d (Fix 6) — nom + adresse réels depuis site_config (plus de placeholder)
      doc.text(associationName, margin, y);
      y += 5;
      // `splitTextToSize` gère les adresses longues (retour à la ligne automatique)
      const addressLines = doc.splitTextToSize(`Siège social : ${associationAddress}`, pageWidth - margin * 2);
      doc.text(addressLines, margin, y);
      y += 5 * addressLines.length;
      doc.text('Objet : Entraide, développement communautaire et activités sportives', margin, y);
      y += 12;

      // Informations du donateur
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text('DONATEUR', margin, y);
      y += 6;

      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Nom : ${donorName}`, margin, y);
      y += 5;
      if (donorEmail) {
        doc.text(`Email : ${donorEmail}`, margin, y);
        y += 5;
      }
      y += 7;

      // Cadre du don
      doc.setDrawColor(30, 64, 175);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 35, 3, 3);
      y += 8;

      doc.setFontSize(11);
      doc.setTextColor(30, 64, 175);
      doc.text('DÉTAILS DU DON', margin + 5, y);
      y += 8;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Date du don : ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}`, margin + 5, y);
      y += 6;

      doc.text(`Montant : ${formatAmount(amount, currency)}`, margin + 5, y);
      y += 6;

      doc.text(`Mode de paiement : ${method === 'stripe' ? 'Carte bancaire (Stripe)' : method === 'bank_transfer' ? 'Virement bancaire' : method === 'paypal' ? 'PayPal' : method === 'helloasso' ? 'HelloAsso' : method}`, margin + 5, y);
      y += 6;

      doc.text(`Référence : ${donationId.slice(0, 8).toUpperCase()}`, margin + 5, y);
      y += 15;

      // Nature du don
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text('Nature du don :', margin, y);
      y += 5;
      doc.text('☑ Numéraire (espèces, chèque, virement, carte bancaire)', margin + 5, y);
      y += 5;
      doc.text('☐ Autres (préciser : _______________)', margin + 5, y);
      y += 10;

      // Réduction fiscale
      // TODO (Phase 4) : rendre le taux de réduction fiscale configurable via
      // `site_config` (clé `taux_reduction_fiscale`). Certaines associations
      // ne sont pas éligibles (taux 0%), d'autres relèvent de taux spécifiques
      // (ex: 75% pour les dons aux organismes d'aide aux personnes en difficulté
      // jusqu'à 1000€, 66% au-delà). Pour l'instant, on garde 66% qui est le
      // taux standard pour une association loi 1901 éligible.
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const reductionText = `Ce don ouvre droit à une réduction d'impôt égale à 66% de son montant dans la limite de 20% du revenu imposable. `;
      const reductionAmount = Math.round(amount * 0.66 * 100) / 100;
      doc.text(reductionText, margin, y, { maxWidth: pageWidth - (margin * 2) });
      y += 10;

      doc.setFontSize(10);
      doc.setTextColor(30, 64, 175);
      doc.text(`Réduction fiscale estimée : ${formatAmount(reductionAmount, currency)}`, margin, y);
      y += 15;

      // Signature
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text('Le Président de l\'Association', pageWidth - 60, y);
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Signature et cachet', pageWidth - 60, y);
      y += 25;

      // Mention légale
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      const legalText = 'L\'association certifie sur l\'honneur que les dons reçus sont utilisés conformément à son objet social. ' +
        'Ce reçu ne peut être utilisé qu\'une seule fois pour bénéficier de la réduction d\'impôt.';
      doc.text(legalText, margin, y, { maxWidth: pageWidth - (margin * 2) });

      // Pied de page
      addE2DFooter(doc);

      // Télécharger
      const fileName = `recu_fiscal_E2D_${donationId.slice(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);

      toast({
        title: "✅ Reçu téléchargé",
        description: `Le fichier ${fileName} a été téléchargé`
      });
    } catch (error: unknown) {
      logger.error('Error generating receipt:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le reçu fiscal",
        variant: "destructive"
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "J'ai fait un don à E2D",
        text: `Je viens de soutenir l'Association E2D avec un don de ${formatAmount(amount, currency)}`,
        url: window.location.origin,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(
        `Je viens de soutenir l'Association E2D avec un don de ${formatAmount(amount, currency)}. Rejoignez-nous sur ${window.location.origin}`
      );
      toast({
        title: "Lien copié",
        description: "Le message a été copié dans le presse-papiers"
      });
    }
  };

  const methodLabel =
    method === 'stripe' ? 'Carte bancaire' :
    method === 'bank_transfer' ? 'Virement' :
    method === 'paypal' ? 'PayPal' :
    method === 'helloasso' ? 'HelloAsso' :
    method;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>

        <DialogHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Merci pour votre générosité !
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {isCompleted
              ? "Votre don a été enregistré avec succès"
              : "Votre demande de don a été enregistrée"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Montant</span>
              <span className="font-semibold">{formatAmount(amount, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Méthode</span>
              <span className="font-medium capitalize">{methodLabel}</span>
            </div>
            {isRecurring && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">Don récurrent</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Référence</span>
              <span className="font-mono text-xs">{donationId.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Statut</span>
              <span className={`font-medium ${isCompleted ? 'text-green-600' : 'text-amber-600'}`}>
                {isCompleted ? 'Confirmé' : 'En attente de validation'}
              </span>
            </div>
            {/* Phase 3-d (Fix 6) — réduction fiscale affichée UNIQUEMENT si
                completed. Pour pending, l'estimation serait trompeuse (rien
                n'a été encaissé). */}
            {isCompleted && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Réduction fiscale</span>
                <span className="font-medium text-primary">
                  ~{formatAmount(Math.round(amount * 0.66), currency)}
                </span>
              </div>
            )}
          </div>

          {isCompleted ? (
            <div className="bg-secondary/10 rounded-lg p-4 border border-secondary/20">
              <p className="text-sm text-center">
                Téléchargez votre reçu fiscal ci-dessous pour votre déclaration d'impôts.
              </p>
            </div>
          ) : (
            // Phase 3-d (Fix 6) — message spécifique pour les dons pending
            // (virement bancaire, Mobile Money en attente de validation admin).
            // Le reçu fiscal n'est PAS disponible tant que le paiement n'est
            // pas confirmé (légalement, un reçu fiscal ne peut être émis qu'après
            // encaissement effectif).
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-900">
                  Votre demande de don a été enregistrée. Vous recevrez une
                  confirmation par email dès réception du paiement. Le reçu
                  fiscal sera disponible à ce moment-là.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Phase 3-d (Fix 6) — reçu fiscal UNIQUEMENT si paymentStatus='completed' */}
            {isCompleted && (
              <Button
                variant="outline"
                onClick={handleDownloadReceipt}
                className="w-full"
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {downloading ? 'Génération...' : 'Reçu fiscal'}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleShare}
              className={isCompleted ? "w-full" : "w-full col-span-2"}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Partager
            </Button>
          </div>

          <Button onClick={onClose} className="w-full">
            Retour à l'accueil
          </Button>
        </div>

        <div className="text-xs text-center text-muted-foreground">
          Votre soutien nous permet de continuer notre mission. Merci ! 🙏
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DonationSuccessModal;
