import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HistoriqueTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des Membres</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          Cliquez sur un membre dans n'importe quelle vue pour afficher son historique complet.
        </p>
        <p className="text-sm text-muted-foreground">
          Astuce : Les fiches individuelles sont accessibles depuis l'État des Absences ou les Récapitulatifs en cliquant sur le nom d'un membre.
        </p>
      </CardContent>
    </Card>
  );
}
