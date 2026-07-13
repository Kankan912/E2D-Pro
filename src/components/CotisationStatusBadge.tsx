/**
 * CotisationStatusBadge (Feature #2)
 *
 * Affiche le statut d'une cotisation avec code couleur obligatoire :
 * - ROUGE  : aucun paiement
 * - ORANGE : paiement partiel
 * - VERT   : entièrement payé (verrouillé automatiquement)
 *
 * Si verrouillé, seul l'admin peut déverrouiller (bouton cadenas).
 */

import { Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  calculerStatutCotisation,
  COTISATION_STATUS_COLORS,
  calculerResteAPayer,
  formatFCFA,
  roundMoney,
} from '@/lib/financial-calculations';

interface CotisationStatusBadgeProps {
  montant_attendu: number;
  montant_paye: number;
  verrouille?: boolean;
  isAdmin?: boolean;
  onDeverrouiller?: () => void;
  compact?: boolean;
}

export function CotisationStatusBadge({
  montant_attendu,
  montant_paye,
  verrouille = false,
  isAdmin = false,
  onDeverrouiller,
  compact = false,
}: CotisationStatusBadgeProps) {
  const status = calculerStatutCotisation(montant_attendu, montant_paye);
  const colors = COTISATION_STATUS_COLORS[status];
  const reste = calculerResteAPayer(montant_attendu, montant_paye);

  return (
    <div className="inline-flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
              style={{
                backgroundColor: colors.bg,
                color: colors.text,
                borderColor: colors.border,
              }}
            >
              <span>{colors.emoji}</span>
              {!compact && <span>{colors.label}</span>}
              {verrouille && <Lock className="w-3 h-3" />}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <div>Attendu : {formatFCFA(montant_attendu)}</div>
              <div>Payé : {formatFCFA(montant_paye)}</div>
              {reste > 0 && <div>Reste : {formatFCFA(reste)}</div>}
              {verrouille && (
                <div className="text-amber-600 font-semibold">
                  🔒 Verrouillé (entièrement payé)
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {verrouille && isAdmin && onDeverrouiller && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={onDeverrouiller}
              >
                <Unlock className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">Déverrouiller (admin uniquement)</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

/**
 * Variant simple : juste le cercle coloré
 */
export function CotisationStatusDot({
  montant_attendu,
  montant_paye,
}: {
  montant_attendu: number;
  montant_paye: number;
}) {
  const status = calculerStatutCotisation(montant_attendu, montant_paye);
  const colors = COTISATION_STATUS_COLORS[status];
  return (
    <div
      className="inline-block w-3 h-3 rounded-full border"
      style={{ backgroundColor: colors.border, borderColor: colors.border }}
      title={colors.label}
    />
  );
}

/**
 * Ligne complète avec montant attendu / payé / reste + badge
 */
export function CotisationStatusRow({
  montant_attendu,
  montant_paye,
  verrouille,
  isAdmin,
  onDeverrouiller,
}: CotisationStatusBadgeProps) {
  const reste = calculerResteAPayer(montant_attendu, montant_paye);

  return (
    <div className="flex items-center justify-between gap-3 p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <CotisationStatusBadge
          montant_attendu={montant_attendu}
          montant_paye={montant_paye}
          verrouille={verrouille}
          isAdmin={isAdmin}
          onDeverrouiller={onDeverrouiller}
        />
        <div className="text-sm text-slate-600">
          <span className="font-medium">{formatFCFA(roundMoney(montant_paye))}</span>
          <span className="text-slate-400"> / {formatFCFA(roundMoney(montant_attendu))}</span>
          {reste > 0 && (
            <span className="ml-2 text-orange-600 font-medium">
              (reste {formatFCFA(reste)})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
