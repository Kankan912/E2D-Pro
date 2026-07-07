import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { formatFCFA } from "@/lib/utils";

interface ReconduireModalProps {
  pret: any;
  maxReconductions: number;
  dureeReconduction: number;
  soldeRestant: number; // Non utilisé - on calcule sur capital restant
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export default function ReconduireModal({
  pret,
  maxReconductions,
  dureeReconduction = 2,
  soldeRestant,
  open,
  onClose,
  onConfirm,
  isPending = false
}: ReconduireModalProps) {
  const [confirme, setConfirme] = useState(false);

  const reconductionsActuelles = pret?.reconductions || 0;
  const prochaineReconduction = reconductionsActuelles + 1;
  const limiteAtteinte = reconductionsActuelles >= maxReconductions;
  
  const taux = pret?.taux_interet || 5;
  
  // Vérifier si l'intérêt actuel est payé
  const interetActuel = pret?.dernier_interet || pret?.interet_initial || ((pret?.montant || 0) * (taux / 100));
  const interetPaye = pret?.interet_paye || 0;
  const interetNonPaye = Math.max(0, interetActuel - interetPaye);
  const interetSolde = interetNonPaye <= 0;
  
  // RÈGLE: Reconduction sur le CAPITAL RESTANT (pas le solde total)
  const capitalRestant = (pret?.montant || 0) - (pret?.capital_paye || 0);
  
  // Nouvel intérêt = Capital restant × Taux%
  const nouvelInteret = capitalRestant * (taux / 100);
  
  // Nouveau total dû = Capital restant + Nouvel intérêt
  const nouveauTotalDu = capitalRestant + nouvelInteret;

  const handleClose = () => {
    setConfirme(false);
    onClose();
  };

  const handleConfirm = () => {
    setConfirme(false);
    onConfirm();
  };

  if (!pret) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Reconduire le prêt
          </DialogTitle>
          <DialogDescription>
            Reconduction #{prochaineReconduction} sur {maxReconductions} maximum — +{dureeReconduction} mois
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Limite atteinte */}
          {limiteAtteinte && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Limite de reconductions atteinte ({maxReconductions} max). Ce prêt ne peut plus être reconduit.
              </AlertDescription>
            </Alert>
          )}

          {/* Intérêt non payé - bloquant */}
          {!limiteAtteinte && !interetSolde && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Reconduction impossible !</strong><br />
                L'intérêt actuel doit être payé avant reconduction.<br />
                Reste à payer: <strong>{formatFCFA(interetNonPaye)}</strong>
              </AlertDescription>
            </Alert>
          )}

          {/* Récapitulatif */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Emprunteur</span>
              <span className="font-medium">{pret.emprunteur?.nom} {pret.emprunteur?.prenom}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Capital initial</span>
              <span className="font-medium">{formatFCFA(pret.montant)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Capital payé</span>
              <span className="font-medium text-green-600">{formatFCFA(pret.capital_paye || 0)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Capital restant</span>
              <span className="font-bold text-orange-600">{formatFCFA(capitalRestant)}</span>
            </div>
          </div>

          {/* Calcul de la reconduction */}
          {!limiteAtteinte && interetSolde && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-700 dark:text-blue-400">Calcul de la reconduction :</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Capital restant</span>
                  <span>{formatFCFA(capitalRestant)}</span>
                </div>
                <div className="flex justify-between text-amber-600">
                  <span>+ Intérêt ({taux}%)</span>
                  <span>+{formatFCFA(nouvelInteret)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>Nouveau total dû</span>
                  <span className="text-primary">{formatFCFA(nouveauTotalDu)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Ce qui va se passer */}
          {!limiteAtteinte && interetSolde && (
            <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                <strong>Attention :</strong> Un intérêt de {taux}% sera appliqué sur le capital restant de {formatFCFA(capitalRestant)}. 
                L'échéance sera prolongée de <strong>{dureeReconduction} mois</strong>.
              </AlertDescription>
            </Alert>
          )}

          {/* Confirmation */}
          {!limiteAtteinte && interetSolde && (
            <div className="flex items-start space-x-3 p-3 border rounded-lg">
              <Checkbox
                id="confirm-reconduction"
                checked={confirme}
                onCheckedChange={(checked) => setConfirme(checked as boolean)}
              />
              <div className="space-y-1">
                <Label htmlFor="confirm-reconduction" className="cursor-pointer">
                  Je confirme vouloir reconduire ce prêt
                </Label>
                <p className="text-xs text-muted-foreground">
                  Le nouveau montant dû sera de {formatFCFA(nouveauTotalDu)}.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={limiteAtteinte || !interetSolde || !confirme || isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? "Reconduction..." : "Reconduire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
