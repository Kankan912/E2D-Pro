import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCaisseDetails, DetailType, getDetailTitle } from "@/hooks/useCaisse";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatFCFA } from "@/lib/utils";

interface CaisseSyntheseDetailModalProps {
  type: DetailType | null;
  isOpen: boolean;
  onClose: () => void;
}


export const CaisseSyntheseDetailModal = ({
  type,
  isOpen,
  onClose,
}: CaisseSyntheseDetailModalProps) => {
  const { data: items, isLoading } = useCaisseDetails(type, isOpen);

  const total = items?.reduce((acc, item) => acc + item.montant, 0) || 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{type ? getDetailTitle(type) : "Détails"}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <ScrollArea className="h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {type !== 'reliquat' && <TableHead>Membre</TableHead>}
                    <TableHead>Libellé</TableHead>
                    {type === 'fond_total' && <TableHead>Catégorie</TableHead>}
                    {(type === 'prets_en_cours' || type === 'sanctions_impayees') && (
                      <TableHead>Statut</TableHead>
                    )}
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Aucune donnée disponible
                      </TableCell>
                    </TableRow>
                  ) : (
                    items?.map((item) => (
                      <TableRow key={item.id} className={item.type === 'total' ? 'font-bold bg-muted' : ''}>
                        <TableCell>{formatDate(item.date)}</TableCell>
                        {type !== 'reliquat' && (
                          <TableCell>{item.membre_nom || "-"}</TableCell>
                        )}
                        <TableCell className="max-w-[200px] truncate">
                          {item.libelle}
                        </TableCell>
                        {type === 'fond_total' && (
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.categorie || "-"}
                            </Badge>
                          </TableCell>
                        )}
                        {(type === 'prets_en_cours' || type === 'sanctions_impayees') && (
                          <TableCell>
                            <Badge 
                              variant={item.type === 'en_cours' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {item.type}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className={`text-right font-medium ${
                          item.montant < 0 ? 'text-destructive' : 'text-emerald-600'
                        }`}>
                          {formatFCFA(item.montant)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Total */}
            <div className="border-t pt-4 mt-2 flex justify-between items-center">
              <span className="font-medium text-muted-foreground">
                {items?.length || 0} élément(s)
              </span>
              <div className="text-right">
                <span className="text-sm text-muted-foreground mr-2">Total:</span>
                <span className={`text-lg font-bold ${
                  total < 0 ? 'text-destructive' : 'text-emerald-600'
                }`}>
                  {formatFCFA(total)}
                </span>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
