import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, AlertTriangle, MinusCircle, BarChart2, Calendar, TrendingUp } from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CotisationType {
  id: string;
  nom: string;
  montant_defaut: number | null;
  obligatoire: boolean;
  type_saisie?: string;
}

interface Membre {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
}

interface Cotisation {
  id: string;
  membre_id: string;
  type_cotisation_id: string;
  montant: number;
  statut: string;
}

interface CotisationMembre {
  membre_id: string;
  type_cotisation_id: string;
  montant_personnalise: number;
}

interface CotisationMensuelle {
  membre_id: string;
  montant: number;
}

interface CotisationsEtatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reunionId: string;
  exerciceId?: string;
  membres: Membre[];
  types: CotisationType[];
  cotisations: Cotisation[];
  cotisationsMembres: CotisationMembre[];
}

type StatutMembre = 'solde' | 'partiel' | 'impaye';

interface EtatMembre {
  membre: Membre;
  montantTotal: number;
  montantPaye: number;
  reste: number;
  statut: StatutMembre;
}

export default function CotisationsEtatsModal({
  open,
  onOpenChange,
  exerciceId,
  membres,
  types,
  cotisations,
  cotisationsMembres
}: CotisationsEtatsModalProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'reunion' | 'annuel'>('reunion');

  // Fetch cotisations mensuelles individuelles par membre
  const { data: cotisationsMensuelles } = useQuery({
    queryKey: ['cotisations-mensuelles-etats', exerciceId],
    queryFn: async () => {
      if (!exerciceId) return [];
      const { data, error } = await supabase
        .from('cotisations_mensuelles_exercice')
        .select('membre_id, montant')
        .eq('actif', true)
        .eq('exercice_id', exerciceId);
      if (error) throw error;
      return data as CotisationMensuelle[];
    },
    enabled: open && !!exerciceId
  });

  // Fetch all cotisations for the entire exercice (for annual view)
  const { data: cotisationsAnnuelles } = useQuery({
    queryKey: ['cotisations-exercice-annuel', exerciceId],
    queryFn: async () => {
      if (!exerciceId) return [];
      const { data, error } = await supabase
        .from('cotisations')
        .select('id, membre_id, type_cotisation_id, montant, statut')
        .eq('exercice_id', exerciceId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!exerciceId && viewMode === 'annuel'
  });

  // Filter only standard types (not checkbox)
  const standardTypes = useMemo(
    () => types.filter(t => t.type_saisie !== 'checkbox'),
    [types]
  );

  // Use annual cotisations if in annual view mode
  const cotisationsToUse = viewMode === 'annuel' && cotisationsAnnuelles 
    ? cotisationsAnnuelles 
    : cotisations;

  // Calculate état for each membre
  const etats = useMemo<EtatMembre[]>(() => {
    return membres.map(membre => {
      let montantTotal = 0;
      let montantPaye = 0;

      // Filter types if a specific type is selected
      const typesToConsider = filterType === 'all' 
        ? standardTypes 
        : standardTypes.filter(t => t.id === filterType);

      // For annual view, multiply expected by 12 for monthly types
      const multiplier = viewMode === 'annuel' ? 12 : 1;

      typesToConsider.forEach(type => {
        // Get expected amount: use cotisations_mensuelles_exercice for monthly types
        const isCotisationMensuelle = type.nom.toLowerCase().includes('cotisation mensuelle');
        let expected: number;
        
        if (isCotisationMensuelle) {
          const configMensuelle = cotisationsMensuelles?.find(cm => cm.membre_id === membre.id);
          expected = (configMensuelle?.montant ?? type.montant_defaut ?? 0) * multiplier;
        } else {
          const perso = cotisationsMembres.find(
            cm => cm.membre_id === membre.id && cm.type_cotisation_id === type.id
          );
          expected = (perso?.montant_personnalise ?? type.montant_defaut ?? 0) * multiplier;
        }
        montantTotal += expected;

        // Get paid amount
        const paid = cotisationsToUse
          .filter((c: Cotisation) => c.membre_id === membre.id && c.type_cotisation_id === type.id && c.statut === 'paye')
          .reduce((sum: number, c: Cotisation) => sum + c.montant, 0);
        montantPaye += paid;
      });

      const reste = montantTotal - montantPaye;
      let statut: StatutMembre = 'impaye';
      if (reste <= 0 && montantTotal > 0) statut = 'solde';
      else if (montantPaye > 0) statut = 'partiel';

      return { membre, montantTotal, montantPaye, reste: Math.max(0, reste), statut };
    });
  }, [membres, standardTypes, cotisationsToUse, cotisationsMembres, cotisationsMensuelles, filterType, viewMode]);

  // Apply statut filter
  const filteredEtats = useMemo(() => {
    if (filterStatut === 'all') return etats;
    return etats.filter(e => e.statut === filterStatut);
  }, [etats, filterStatut]);

  // Stats
  const stats = useMemo(() => {
    const soldes = etats.filter(e => e.statut === 'solde').length;
    const partiels = etats.filter(e => e.statut === 'partiel').length;
    const impayes = etats.filter(e => e.statut === 'impaye').length;
    const totalAttendu = etats.reduce((sum, e) => sum + e.montantTotal, 0);
    const totalPaye = etats.reduce((sum, e) => sum + e.montantPaye, 0);
    const totalReste = etats.reduce((sum, e) => sum + e.reste, 0);
    return { soldes, partiels, impayes, totalAttendu, totalPaye, totalReste };
  }, [etats]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            États des Cotisations
          </DialogTitle>
          <DialogDescription>
            Récapitulatif des montants payés et restants par membre
          </DialogDescription>
        </DialogHeader>

        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'reunion' | 'annuel')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reunion" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Réunion courante
            </TabsTrigger>
            <TabsTrigger value="annuel" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Cumul annuel
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-xl font-bold">{formatFCFA(stats.totalAttendu)}</p>
            <p className="text-xs text-muted-foreground">
              {viewMode === 'annuel' ? 'Total annuel attendu' : 'Total attendu'}
            </p>
          </div>
          <div className="bg-success/10 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-success">{formatFCFA(stats.totalPaye)}</p>
            <p className="text-xs text-muted-foreground">
              {viewMode === 'annuel' ? 'Total annuel payé' : 'Total payé'}
            </p>
          </div>
          <div className="bg-warning/10 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-warning">{formatFCFA(stats.totalReste)}</p>
            <p className="text-xs text-muted-foreground">
              {viewMode === 'annuel' ? 'Reste annuel à payer' : 'Reste à payer'}
            </p>
          </div>
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-primary">{membres.length}</p>
            <p className="text-xs text-muted-foreground">Membres</p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <Badge 
            className="bg-success/20 text-success border-success/30 px-3 py-1 cursor-pointer"
            onClick={() => setFilterStatut(filterStatut === 'solde' ? 'all' : 'solde')}
            variant={filterStatut === 'solde' ? 'default' : 'outline'}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            {stats.soldes} soldé(s)
          </Badge>
          <Badge 
            className="bg-warning/20 text-warning border-warning/30 px-3 py-1 cursor-pointer"
            onClick={() => setFilterStatut(filterStatut === 'partiel' ? 'all' : 'partiel')}
            variant={filterStatut === 'partiel' ? 'default' : 'outline'}
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            {stats.partiels} partiel(s)
          </Badge>
          <Badge 
            className="bg-destructive/20 text-destructive border-destructive/30 px-3 py-1 cursor-pointer"
            onClick={() => setFilterStatut(filterStatut === 'impaye' ? 'all' : 'impaye')}
            variant={filterStatut === 'impaye' ? 'default' : 'outline'}
          >
            <MinusCircle className="w-3 h-3 mr-1" />
            {stats.impayes} impayé(s)
          </Badge>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Type :</span>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {standardTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="h-[400px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="sticky left-0 bg-muted/50">Membre</TableHead>
                <TableHead className="text-right">Attendu</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Reste</TableHead>
                <TableHead className="text-center">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEtats.map(etat => (
                <TableRow key={etat.membre.id}>
                  <TableCell className="font-medium">
                    {etat.membre.prenom} {etat.membre.nom}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatFCFA(etat.montantTotal)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    {formatFCFA(etat.montantPaye)}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${etat.reste > 0 ? 'text-warning' : 'text-success'}`}>
                    {formatFCFA(etat.reste)}
                  </TableCell>
                  <TableCell className="text-center">
                    {etat.statut === 'solde' && (
                      <Badge className="bg-success text-success-foreground">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Soldé
                      </Badge>
                    )}
                    {etat.statut === 'partiel' && (
                      <Badge className="bg-warning text-warning-foreground">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Partiel
                      </Badge>
                    )}
                    {etat.statut === 'impaye' && (
                      <Badge variant="destructive">
                        <MinusCircle className="w-3 h-3 mr-1" />
                        Impayé
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredEtats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun membre correspondant aux filtres
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
