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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, ArrowUpCircle, ArrowDownCircle, Link } from "lucide-react";
import { CaisseOperation, CAISSE_CATEGORIES, useDeleteCaisseOperation } from "@/hooks/useCaisse";
import { formatFCFA } from "@/lib/utils";

interface CaisseOperationsTableProps {
  operations: CaisseOperation[];
  isLoading?: boolean;
}

export const CaisseOperationsTable = ({ operations, isLoading }: CaisseOperationsTableProps) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteMutation = useDeleteCaisseOperation();


  const handleDelete = async () => {
    if (deleteId) {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!operations || operations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucune opération trouvée
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Membre</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.map((operation) => {
              const catInfo = CAISSE_CATEGORIES[operation.categorie as keyof typeof CAISSE_CATEGORIES] 
                || CAISSE_CATEGORIES.autre;
              const isEntree = operation.type_operation === "entree";
              const isManual = !operation.source_table;

              return (
                <TableRow key={operation.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(operation.date_operation), "dd MMM yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell>
                    {isEntree ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        <ArrowUpCircle className="h-3 w-3 mr-1" />
                        Entrée
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <ArrowDownCircle className="h-3 w-3 mr-1" />
                        Sortie
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`${catInfo.color} text-white`}>
                      {catInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={operation.libelle}>
                    {operation.libelle}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {operation.beneficiaire
                      ? `${operation.beneficiaire.prenom} ${operation.beneficiaire.nom}`
                      : operation.operateur
                      ? `${operation.operateur.prenom} ${operation.operateur.nom}`
                      : "-"}
                  </TableCell>
                  <TableCell className={`text-right font-medium whitespace-nowrap ${isEntree ? "text-emerald-600" : "text-red-600"}`}>
                    {isEntree ? "+" : "-"}{formatFCFA(operation.montant)}
                  </TableCell>
                  <TableCell>
                    {operation.source_table ? (
                      <Badge variant="outline" className="text-xs">
                        <Link className="h-3 w-3 mr-1" />
                        {operation.source_table}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Manuel
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {isManual && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(operation.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette opération ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
