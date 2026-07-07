import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Download, Mail, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Donation {
  id: string;
  created_at: string;
  donor_name: string;
  donor_email: string;
  donor_phone?: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  is_recurring: boolean;
  recurring_frequency?: string;
  bank_transfer_reference?: string;
}

interface DonationsTableProps {
  donations: Donation[];
  onView?: (donation: Donation) => void;
  onValidate?: (donationId: string) => void;
  onReject?: (donationId: string) => void;
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
    completed: { variant: "default", label: "Complété" },
    pending: { variant: "secondary", label: "En attente" },
    failed: { variant: "destructive", label: "Échoué" },
    refunded: { variant: "outline", label: "Remboursé" },
  };

  const config = variants[status] || { variant: "outline" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const METHOD_LABELS: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  bank_transfer: "Virement",
  helloasso: "HelloAsso",
  orange_money: "Orange Money",
  mtn_money: "MTN MoMo",
};

const getPaymentMethodBadge = (method: string) => {
  const colors: Record<string, string> = {
    stripe: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    paypal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    bank_transfer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    helloasso: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    orange_money: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    mtn_money: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  };

  const label = METHOD_LABELS[method] || method;
  const icon = method === "orange_money" ? "🟠" : method === "mtn_money" ? "🟡" : undefined;

  return (
    <Badge variant="outline" className={cn("capitalize", colors[method])}>
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </Badge>
  );
};

const isMobileMoney = (method: string) => method === "orange_money" || method === "mtn_money";

export const DonationsTable = ({ donations, onView, onValidate, onReject }: DonationsTableProps) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Donateur</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Méthode</TableHead>
            <TableHead>Référence</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {donations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                Aucun don trouvé
              </TableCell>
            </TableRow>
          ) : (
            donations.map((donation) => {
              const isPendingMoMo =
                isMobileMoney(donation.payment_method) && donation.payment_status === "pending";

              return (
                <TableRow key={donation.id} className={isPendingMoMo ? "bg-amber-50/40 dark:bg-amber-950/20" : ""}>
                  <TableCell className="font-medium">
                    {format(new Date(donation.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                  </TableCell>
                  <TableCell>{donation.donor_name}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{donation.donor_email}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {donation.amount.toFixed(2)} {donation.currency}
                  </TableCell>
                  <TableCell>{getPaymentMethodBadge(donation.payment_method)}</TableCell>
                  <TableCell>
                    {donation.bank_transfer_reference ? (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono max-w-[120px] truncate block">
                        {donation.bank_transfer_reference}
                      </code>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {donation.is_recurring ? (
                      <Badge variant="secondary">
                        Récurrent ({donation.recurring_frequency})
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unique</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(donation.payment_status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isPendingMoMo && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Valider le paiement"
                            onClick={() => onValidate?.(donation.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Rejeter le paiement"
                            onClick={() => onReject?.(donation.id)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView?.(donation)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Voir détails
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="mr-2 h-4 w-4" />
                            Télécharger reçu
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            Renvoyer email
                          </DropdownMenuItem>
                          {donation.payment_status === "completed" && (
                            <DropdownMenuItem className="text-destructive">
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Rembourser
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
