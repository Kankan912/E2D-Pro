import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Banknote, CheckCircle, CreditCard, Download, Edit, Eye, FileText, RefreshCw, Trash2 } from "lucide-react";
import { formatFCFA } from "@/lib/utils";
import type { PretAdminWithJoins } from "@/types/supabase-joins";

interface CalculsPret {
  totalDu: number;
  resteAPayer: number;
  totalPaye: number;
}

interface Props {
  pret: PretAdminWithJoins;
  calculs: CalculsPret;
  rowClass: string;
  statutBadge: React.ReactNode;
  effectiveStatus: string;
  verifReconduction: { peut: boolean; raison: string };
  maxReconductions: number;
  payerTotalPending: boolean;
  reconduirePending: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onPayerTotal: (p: PretAdminWithJoins) => void;
  onOpenPaiements: (id: string) => void;
  onOpenReconduire: (p: PretAdminWithJoins) => void;
  onOpenDetails: (id: string) => void;
  onExportPDF: (p: PretAdminWithJoins) => void;
  onEdit: (p: PretAdminWithJoins) => void;
  onDelete: (id: string) => void;
}

export default function PretRow({
  pret, calculs, rowClass, statutBadge, effectiveStatus, verifReconduction,
  maxReconductions, payerTotalPending, reconduirePending,
  canUpdate, canDelete,
  onPayerTotal, onOpenPaiements, onOpenReconduire, onOpenDetails, onExportPDF, onEdit, onDelete,
}: Props) {
  const resteAPayer = calculs.resteAPayer;
  return (
    <TableRow className={rowClass}>
      <TableCell>{new Date(pret.date_pret).toLocaleDateString('fr-FR')}</TableCell>
      <TableCell className="font-medium">{pret.emprunteur?.nom} {pret.emprunteur?.prenom}</TableCell>
      <TableCell>{formatFCFA(pret.montant)}</TableCell>
      <TableCell>{pret.taux_interet}%</TableCell>
      <TableCell className="font-medium">{formatFCFA(calculs.totalDu)}</TableCell>
      <TableCell>{new Date(pret.echeance).toLocaleDateString('fr-FR')}</TableCell>
      <TableCell>
        {pret.reconductions > 0 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className={`flex items-center gap-1 ${!verifReconduction.peut ? 'bg-red-100 text-red-800' : ''}`}>
                  <RefreshCw className="h-3 w-3" />{pret.reconductions}/{maxReconductions}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{pret.reconductions}/{maxReconductions} reconductions</p>
                {!verifReconduction.peut && <p className="text-red-500">{verifReconduction.raison}</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-muted-foreground text-xs">0/{maxReconductions}</span>
        )}
      </TableCell>
      <TableCell>{statutBadge}</TableCell>
      <TableCell className={resteAPayer > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>{formatFCFA(resteAPayer)}</TableCell>
      <TableCell className="text-right">
        <div className="flex gap-0.5 justify-end flex-nowrap">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onOpenDetails(pret.id)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voir détails</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {effectiveStatus !== 'rembourse' && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="default" className="h-7 w-7 bg-green-600 hover:bg-green-700"
                      onClick={() => onPayerTotal(pret)} disabled={payerTotalPending}>
                      <CheckCircle className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Payer Total ({formatFCFA(resteAPayer)})</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onOpenPaiements(pret.id)}>
                      <Banknote className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Paiement Partiel</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {canUpdate && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline"
                        className={`h-7 w-7 ${verifReconduction.peut ? 'border-blue-500 text-blue-600 hover:bg-blue-50' : 'opacity-50'}`}
                        onClick={() => onOpenReconduire(pret)} disabled={!verifReconduction.peut || reconduirePending}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{verifReconduction.peut ? `Reconduire (+1 mois)` : verifReconduction.raison}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onOpenPaiements(pret.id)}>
                  <CreditCard className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gérer les paiements</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {pret.justificatif_url && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline" className="h-7 w-7"
                    onClick={() => window.open(pret.justificatif_url as string, '_blank')}>
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Voir justificatif</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onExportPDF(pret)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exporter PDF</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {canUpdate && (
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onEdit(pret)}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
          )}
          {canDelete && (
            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => onDelete(pret.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
