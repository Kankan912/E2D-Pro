import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search, X } from "lucide-react";

export interface EpargnesFiltres {
  dateDebut: string;
  dateFin: string;
  membreId: string;
  exerciceId: string;
  montantMin: string;
  montantMax: string;
}

interface Membre { id: string; nom: string; prenom: string; }
interface Exercice { id: string; nom: string; date_debut: string; date_fin: string; statut: string; }

interface Props {
  filtresTemporaires: EpargnesFiltres;
  setFiltresTemporaires: React.Dispatch<React.SetStateAction<EpargnesFiltres>>;
  filtresAppliques: EpargnesFiltres;
  setFiltresAppliques: React.Dispatch<React.SetStateAction<EpargnesFiltres>>;
  membres: Membre[];
  exercices: Exercice[];
  loadingFiltre: boolean;
  setLoadingFiltre: (v: boolean) => void;
  epargneFiltreesCount: number;
  epargnantsUniques: number;
  totalFiltre: number;
}

export default function EpargnesFilters({
  filtresTemporaires, setFiltresTemporaires,
  filtresAppliques, setFiltresAppliques,
  membres, exercices, loadingFiltre, setLoadingFiltre,
  epargneFiltreesCount, epargnantsUniques, totalFiltre,
}: Props) {
  return (
    <Card className="bg-muted/50">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtres Avancés
            </CardTitle>
            {filtresAppliques.exerciceId && filtresAppliques.exerciceId !== "all" && (
              <Badge variant="secondary" className="text-xs">📊 Niveau 1: Exercice</Badge>
            )}
            {(filtresAppliques.dateDebut || filtresAppliques.dateFin) && (
              <Badge variant="outline" className="text-xs">📅 Niveau 2: Dates</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateDebut">Date début</Label>
            <Input id="dateDebut" type="date" value={filtresTemporaires.dateDebut}
              onChange={(e) => setFiltresTemporaires(prev => ({ ...prev, dateDebut: e.target.value }))}
              min={filtresTemporaires.exerciceId !== "all" ? exercices.find(ex => ex.id === filtresTemporaires.exerciceId)?.date_debut : undefined}
              max={filtresTemporaires.exerciceId !== "all" ? exercices.find(ex => ex.id === filtresTemporaires.exerciceId)?.date_fin : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateFin">Date fin</Label>
            <Input id="dateFin" type="date" value={filtresTemporaires.dateFin}
              onChange={(e) => setFiltresTemporaires(prev => ({ ...prev, dateFin: e.target.value }))}
              min={filtresTemporaires.exerciceId !== "all" ? exercices.find(ex => ex.id === filtresTemporaires.exerciceId)?.date_debut : undefined}
              max={filtresTemporaires.exerciceId !== "all" ? exercices.find(ex => ex.id === filtresTemporaires.exerciceId)?.date_fin : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="membreFiltre">Membre</Label>
            <Select value={filtresTemporaires.membreId} onValueChange={(value) => setFiltresTemporaires(prev => ({ ...prev, membreId: value }))}>
              <SelectTrigger id="membreFiltre"><SelectValue placeholder="Tous les membres" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les membres</SelectItem>
                {membres.map((m) => (<SelectItem key={m.id} value={m.id}>{m.prenom} {m.nom}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exerciceFiltre">Exercice</Label>
            <Select value={filtresTemporaires.exerciceId} disabled={loadingFiltre}
              onValueChange={async (value) => {
                setLoadingFiltre(true);
                setFiltresTemporaires(prev => ({ ...prev, exerciceId: value }));
                await new Promise(resolve => setTimeout(resolve, 300));
                setLoadingFiltre(false);
              }}
            >
              <SelectTrigger id="exerciceFiltre" className={loadingFiltre ? 'opacity-50' : ''}>
                {loadingFiltre ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span>Chargement...</span>
                  </div>
                ) : (<SelectValue placeholder="Tous les exercices" />)}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les exercices</SelectItem>
                {exercices.map((ex) => (<SelectItem key={ex.id} value={ex.id}>{ex.nom}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="montantMin">Montant minimum</Label>
            <Input id="montantMin" type="number" placeholder="0" value={filtresTemporaires.montantMin}
              onChange={(e) => setFiltresTemporaires(prev => ({ ...prev, montantMin: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="montantMax">Montant maximum</Label>
            <Input id="montantMax" type="number" placeholder="Illimité" value={filtresTemporaires.montantMax}
              onChange={(e) => setFiltresTemporaires(prev => ({ ...prev, montantMax: e.target.value }))} />
          </div>
        </div>

        <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-md text-sm">
          <p className="font-semibold mb-1 text-primary">🔍 Filtrage hiérarchique :</p>
          <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
            <li><strong>Niveau 1 (Exercice) :</strong> Sélectionnez un exercice pour limiter aux épargnes de sa période</li>
            <li><strong>Niveau 2 (Dates) :</strong> Affinez avec des dates personnalisées à l'intérieur de l'exercice</li>
          </ul>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={() => setFiltresAppliques(filtresTemporaires)} className="flex-1">
            <Search className="h-4 w-4 mr-2" />Rechercher
          </Button>
          <Button variant="outline" onClick={() => {
            const reset = { dateDebut: "", dateFin: "", membreId: "all", exerciceId: "all", montantMin: "", montantMax: "" };
            setFiltresTemporaires(reset);
            setFiltresAppliques(reset);
          }}>
            <X className="h-4 w-4 mr-2" />Réinitialiser
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {epargneFiltreesCount} épargne(s) trouvée(s) • {epargnantsUniques} épargnant(s) • Total: {totalFiltre.toLocaleString()} FCFA
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
