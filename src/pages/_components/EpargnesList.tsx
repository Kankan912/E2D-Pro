import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, PiggyBank, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Epargne {
  id: string;
  membre_id: string;
  montant: number;
  date_depot: string;
  statut: string;
  notes?: string;
  membre?: { nom: string; prenom: string } | null;
  membres?: { nom: string; prenom: string } | null;
}

interface Props {
  epargnes: Epargne[];
  epargneFiltrees: Epargne[];
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (e: Epargne) => void;
  onDelete: (id: string) => void;
}

export default function EpargnesList({ epargnes, epargneFiltrees, canUpdate, canDelete, onEdit, onDelete }: Props) {
  if (epargneFiltrees.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <PiggyBank className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            {epargnes.length === 0 ? "Aucune épargne enregistrée" : "Aucune épargne ne correspond aux filtres"}
          </p>
          <p className="text-sm text-muted-foreground">
            {epargnes.length === 0 ? "Ajoutez la première épargne pour commencer" : "Essayez de modifier les critères de filtrage"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {epargneFiltrees.map((epargne) => {
        const membre = epargne.membre ?? epargne.membres ?? null;
        return (
          <Card key={epargne.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{membre?.prenom} {membre?.nom}</CardTitle>
                  <CardDescription>Dépôt du {format(new Date(epargne.date_depot), "dd MMMM yyyy", { locale: fr })}</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">{epargne.montant.toLocaleString()} FCFA</p>
                  <p className="text-sm text-muted-foreground capitalize">{epargne.statut}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {epargne.notes && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{epargne.notes}</p>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                {canUpdate && (
                  <Button variant="outline" size="sm" onClick={() => onEdit(epargne)}>
                    <Edit className="w-4 h-4 mr-1" />Modifier
                  </Button>
                )}
                {canDelete && (
                  <Button variant="outline" size="sm" onClick={() => onDelete(epargne.id)} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4 mr-1" />Supprimer
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
