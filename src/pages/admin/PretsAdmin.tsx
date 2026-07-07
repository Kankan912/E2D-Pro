import { DollarSign, Plus, FileText, RefreshCw, Search, LayoutDashboard, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import BackButton from "@/components/BackButton";
import PretForm from "@/components/forms/PretForm";
import PretsPaiementsManager from "@/components/PretsPaiementsManager";
import ReconduireModal from "@/components/ReconduireModal";
import PretDetailsModal from "@/components/PretDetailsModal";
import { formatFCFA } from "@/lib/utils";
import { calculerResumePret } from "@/lib/pretCalculsService";
import { exportPretPDF } from "@/lib/pret-pdf-export";
import type { PretAdminWithJoins } from "@/types/supabase-joins";
import { ReconductionsAttenteList, type ReconductionAttente } from "./_components/ReconductionsAttenteList";
import PretsStatsCards from "./_components/PretsStatsCards";
import PretRow from "./_components/PretRow";


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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { addMonths, format } from "date-fns";

type StatutFilter = 'tous' | 'en_cours' | 'rembourse' | 'partiel' | 'en_retard' | 'reconduit';

export default function PretsAdmin() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPret, setSelectedPret] = useState<PretAdminWithJoins | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pretToDelete, setPretToDelete] = useState<string | null>(null);
  const [paiementsDialogOpen, setPaiementsDialogOpen] = useState(false);
  const [pretForPaiements, setPretForPaiements] = useState<string | null>(null);
  const [reconduireDialogOpen, setReconduireDialogOpen] = useState(false);
  const [pretForReconduction, setPretForReconduction] = useState<PretAdminWithJoins | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [pretForDetails, setPretForDetails] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('tous');
  const [showDashboard, setShowDashboard] = useState(false);
  const queryClient = useQueryClient();
  const { hasPermission, enforcePermission } = usePermissions();

  const { data: prets, isLoading } = useQuery({
    queryKey: ["prets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prets")
        .select(`
          *,
          emprunteur:membres!membre_id(id, nom, prenom),
          avaliste:membres!avaliste_id(id, nom, prenom),
          reunion:reunions!reunion_id(id, date_reunion, ordre_du_jour),
          exercice:exercices!exercice_id(id, nom),
          prets_paiements(*),
          prets_reconductions(*)
        `)
        .order("date_pret", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PretAdminWithJoins[];
    },
  });

  // Configuration des prêts (max reconductions, etc.)
  const { data: pretsConfig } = useQuery({
    queryKey: ["prets-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prets_config")
        .select("id, max_reconductions, duree_reconduction")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const maxReconductions = pretsConfig?.max_reconductions || 3;
  const dureeReconduction = pretsConfig?.duree_reconduction || 2;

  // Calculer via le service centralisé avec données jointes
  const getCalculsPret = (pret: PretAdminWithJoins) => {
    return calculerResumePret(
      { montant: pret.montant, taux_interet: pret.taux_interet, interet_initial: pret.interet_initial, reconductions: pret.reconductions, montant_paye: pret.montant_paye },
      (pret.prets_paiements as unknown as never[]) || [],
      (pret.prets_reconductions as unknown as never[]) || []
    );
  };

  const calculerTotalDu = (pret: PretAdminWithJoins): number => getCalculsPret(pret).totalDu;
  const calculerSoldeRestant = (pret: PretAdminWithJoins): number => getCalculsPret(pret).resteAPayer;

  const createPret = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { error } = await supabase.from('prets').insert(data as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Prêt créé avec succès" });
      queryClient.invalidateQueries({ queryKey: ['prets'] });
      setFormOpen(false);
    },
    onError: (error: unknown) => {
      toast({ title: "Erreur lors de la création", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  });

  const updatePret = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase.from('prets').update(data as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Prêt modifié avec succès" });
      queryClient.invalidateQueries({ queryKey: ['prets'] });
      setFormOpen(false);
      setSelectedPret(null);
    }
  });

  const deletePret = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('prets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Prêt supprimé" });
      queryClient.invalidateQueries({ queryKey: ['prets'] });
      setDeleteDialogOpen(false);
      setPretToDelete(null);
    }
  });

  // Payer Total
  const payerTotal = useMutation({
    mutationFn: async (pret: PretAdminWithJoins) => {
      const soldeRestant = calculerSoldeRestant(pret);
      const totalDu = calculerTotalDu(pret);
      const interetTotal = pret.interet_initial || (pret.montant * (pret.taux_interet || 5) / 100);
      
      const { error: paiementError } = await supabase.from('prets_paiements').insert([{
        pret_id: pret.id,
        montant_paye: soldeRestant,
        date_paiement: new Date().toISOString().split('T')[0],
        notes: 'Paiement total du solde restant',
        type_paiement: 'mixte',
        mode_paiement: 'especes'
      }]);
      if (paiementError) throw paiementError;

      const { error: pretError } = await supabase.from('prets').update({
        montant_paye: totalDu,
        capital_paye: pret.montant,
        interet_paye: interetTotal,
        montant_total_du: 0,
        dernier_interet: 0,
        statut: 'rembourse'
      }).eq('id', pret.id);
      if (pretError) throw pretError;
    },
    onSuccess: () => {
      toast({ title: "Prêt remboursé intégralement" });
      queryClient.invalidateQueries({ queryKey: ['prets'] });
    },
    onError: (error: unknown) => {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  });

  // Vérifier si on peut reconduire (intérêt actuel doit être payé)
  const peutReconduirePret = (pret: PretAdminWithJoins): { peut: boolean; raison: string } => {
    if ((pret.reconductions || 0) >= maxReconductions) {
      return { peut: false, raison: `Limite de reconductions atteinte (${maxReconductions} max)` };
    }
    
    // L'intérêt actuel doit être payé avant reconduction
    const interetActuel = pret.dernier_interet || pret.interet_initial || (pret.montant * (pret.taux_interet || 5) / 100);
    const interetPaye = pret.interet_paye || 0;
    
    if (interetPaye < interetActuel) {
      const reste = interetActuel - interetPaye;
      return { peut: false, raison: `Payez d'abord l'intérêt (${formatFCFA(reste)} restant)` };
    }
    
    return { peut: true, raison: '' };
  };

  // Reconduire : crée la demande. Le trigger DB force 'en_attente' pour les non-admins.
  // L'incrément de prets.reconductions n'a lieu QUE si la reconduction est immédiatement validée.
  const reconduire = useMutation({
    mutationFn: async (pret: PretAdminWithJoins) => {
      const verification = peutReconduirePret(pret);
      if (!verification.peut) {
        throw new Error(verification.raison);
      }

      const taux = pret.taux_interet || 5;
      const capitalRestant = pret.montant - (pret.capital_paye || 0);
      const nouvelInteret = capitalRestant * (taux / 100);
      const nouveauTotalDu = capitalRestant + nouvelInteret;
      const nouvelleEcheance = addMonths(new Date(pret.echeance), dureeReconduction);

      // 1) Insérer la demande de reconduction (le trigger fixe le statut effectif)
      const { data: recon, error: reconError } = await supabase
        .from('prets_reconductions')
        .insert({
          pret_id: pret.id,
          date_reconduction: new Date().toISOString().split('T')[0],
          interet_mois: nouvelInteret,
          statut: 'validee', // demandé ; le trigger downgradera si non-admin
          notes: `Reconduction #${(pret.reconductions || 0) + 1} - Intérêt ${taux}% sur capital restant ${formatFCFA(capitalRestant)}`
        })
        .select('statut')
        .single();
      if (reconError) throw reconError;

      // 2) Si validation immédiate, on applique aussi sur le prêt
      if (recon?.statut === 'validee') {
        const { error } = await supabase.from('prets').update({
          echeance: format(nouvelleEcheance, 'yyyy-MM-dd'),
          montant_total_du: nouveauTotalDu,
          dernier_interet: nouvelInteret,
          interet_paye: 0,
          reconductions: (pret.reconductions || 0) + 1
        }).eq('id', pret.id);
        if (error) throw error;
      }

      return recon?.statut as 'validee' | 'en_attente' | 'refusee';
    },
    onSuccess: (statut) => {
      if (statut === 'en_attente') {
        toast({
          title: "Demande envoyée",
          description: "La reconduction est en attente de validation par un administrateur ou trésorier."
        });
      } else {
        toast({ title: "Prêt reconduit avec intérêt sur le capital restant" });
      }
      queryClient.invalidateQueries({ queryKey: ['prets'] });
      queryClient.invalidateQueries({ queryKey: ['prets-reconductions'] });
      queryClient.invalidateQueries({ queryKey: ['prets-reconductions-attente'] });
      setReconduireDialogOpen(false);
      setPretForReconduction(null);
    },
    onError: (error: unknown) => {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  });

  // Validation/refus d'une reconduction en attente (admin/tresorier uniquement)
  const validerReconduction = useMutation({
    mutationFn: async ({ reconId, decision }: { reconId: string; decision: 'validee' | 'refusee' }) => {
      // Charger la reconduction + prêt
      const { data: recon, error: e1 } = await supabase
        .from('prets_reconductions')
        .select('*, prets(*)')
        .eq('id', reconId)
        .single();
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from('prets_reconductions')
        .update({ statut: decision })
        .eq('id', reconId);
      if (e2) throw e2;

      if (decision === 'validee' && recon?.prets) {
        const pret = recon.prets as unknown as PretAdminWithJoins;
        const nouvelleEcheance = addMonths(new Date(pret.echeance), dureeReconduction);
        const capitalRestant = pret.montant - (pret.capital_paye || 0);
        const nouveauTotalDu = capitalRestant + Number(recon.interet_mois || 0);
        const { error: e3 } = await supabase.from('prets').update({
          echeance: format(nouvelleEcheance, 'yyyy-MM-dd'),
          montant_total_du: nouveauTotalDu,
          dernier_interet: Number(recon.interet_mois || 0),
          interet_paye: 0,
          reconductions: (pret.reconductions || 0) + 1
        }).eq('id', pret.id);
        if (e3) throw e3;
      }
    },
    onSuccess: (_d, vars) => {
      toast({
        title: vars.decision === 'validee' ? "Reconduction validée" : "Reconduction refusée"
      });
      queryClient.invalidateQueries({ queryKey: ['prets'] });
      queryClient.invalidateQueries({ queryKey: ['prets-reconductions-attente'] });
    },
    onError: (error: unknown) => {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  });

  // Liste des reconductions en attente
  const { data: reconductionsAttente = [] } = useQuery({
    queryKey: ['prets-reconductions-attente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prets_reconductions')
        .select('*, prets(id, montant, taux_interet, reconductions, membres(nom, prenom))')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const handleSubmit = (data: Record<string, unknown>) => {
    if (selectedPret) {
      updatePret.mutate({ id: selectedPret.id, data });
    } else {
      createPret.mutate(data);
    }
  };

  // Statut effectif — priorité: remboursé > en_retard > reconduit > partiel > en_cours
  const getEffectiveStatus = (pret: PretAdminWithJoins) => {
    const calculs = getCalculsPret(pret);
    const echeance = new Date(pret.echeance);
    const now = new Date();

    if (calculs.totalPaye >= calculs.totalDu && calculs.totalDu > 0) return 'rembourse';
    if (echeance < now) return 'en_retard';
    if (pret.reconductions > 0) return 'reconduit';
    if (calculs.totalPaye > 0) return 'partiel';
    return 'en_cours';
  };

  const getRowClass = (pret: PretAdminWithJoins) => {
    const status = getEffectiveStatus(pret);
    switch (status) {
      case 'rembourse':
        return 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30';
      case 'partiel':
        return 'bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/30';
      case 'en_retard':
        return 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30';
      case 'reconduit':
        return 'bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30';
      default:
        return '';
    }
  };

  const getStatutBadge = (pret: PretAdminWithJoins) => {
    const status = getEffectiveStatus(pret);
    switch (status) {
      case 'en_cours':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />En cours</Badge>;
      case 'rembourse':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Remboursé</Badge>;
      case 'partiel':
        return <Badge className="bg-orange-500"><AlertTriangle className="h-3 w-3 mr-1" />Partiel</Badge>;
      case 'en_retard':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />En retard</Badge>;
      case 'reconduit':
        return <Badge className="bg-blue-500"><RefreshCw className="h-3 w-3 mr-1" />Reconduit</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filtrage et tri
  const filteredPrets = useMemo(() => {
    if (!prets) return [];
    
    const filtered = prets.filter(pret => {
      const searchLower = searchQuery.toLowerCase();
      const matchSearch = !searchQuery || 
        pret.emprunteur?.nom?.toLowerCase().includes(searchLower) ||
        pret.emprunteur?.prenom?.toLowerCase().includes(searchLower) ||
        pret.avaliste?.nom?.toLowerCase().includes(searchLower);

      const effectiveStatus = getEffectiveStatus(pret);
      const matchStatut = statutFilter === 'tous' || effectiveStatus === statutFilter;

      return matchSearch && matchStatut;
    });

    const priorityOrder: Record<string, number> = {
      'en_retard': 0,
      'en_cours': 1,
      'reconduit': 2,
      'partiel': 3,
      'rembourse': 4
    };

    return filtered.sort((a, b) => {
      const priorityA = priorityOrder[getEffectiveStatus(a)] ?? 5;
      const priorityB = priorityOrder[getEffectiveStatus(b)] ?? 5;
      return priorityA - priorityB;
    });
  }, [prets, searchQuery, statutFilter]);

  // Statistiques
  const pretsActifs = prets?.filter((p) => getEffectiveStatus(p) === "en_cours").length || 0;
  const pretsPartiels = prets?.filter((p) => getEffectiveStatus(p) === "partiel").length || 0;
  const pretsEnRetard = prets?.filter((p) => getEffectiveStatus(p) === "en_retard").length || 0;
  const totalReconductions = prets?.reduce((sum, p) => sum + (p.reconductions || 0), 0) || 0;
  const montantPrete = prets?.filter((p) => getEffectiveStatus(p) !== "rembourse").reduce((sum, p) => sum + p.montant, 0) || 0;
  const pretsRembourses = prets?.filter((p) => getEffectiveStatus(p) === "rembourse").length || 0;
  const montantRestant = prets?.filter((p) => getEffectiveStatus(p) !== "rembourse").reduce((sum, p) => sum + getCalculsPret(p).resteAPayer, 0) || 0;
  const totalInterets = prets?.reduce((sum, p) => {
    // Somme des intérêts initiaux (générés à la création) - toujours positif
    const interet = p.interet_initial ?? (p.montant * (p.taux_interet || 5) / 100);
    return sum + Math.max(0, interet);
  }, 0) || 0;


  const handleOpenReconduire = (pret: PretAdminWithJoins) => {
    setPretForReconduction(pret);
    setReconduireDialogOpen(true);
  };

  const handleExportPDF = async (pret: PretAdminWithJoins) => {
    // Récupérer les paiements et reconductions pour ce prêt
    const [paiementsRes, recondRes] = await Promise.all([
      supabase.from('prets_paiements').select('id, pret_id, montant_paye, date_paiement, type_paiement, mode_paiement, notes').eq('pret_id', pret.id).order('date_paiement', { ascending: false }),
      supabase.from('prets_reconductions').select('id, pret_id, date_reconduction, interet_mois, statut, notes').eq('pret_id', pret.id).order('date_reconduction', { ascending: false })
    ]);
    
    exportPretPDF(pret, paiementsRes.data || [], recondRes.data || []);
    toast({ title: "PDF exporté avec succès" });
  };

  return (
    <div className="container mx-auto space-y-6">
      <BackButton />

      {/* Reconductions en attente de validation (admin/trésorier) */}
      <ReconductionsAttenteList
        reconductions={reconductionsAttente as unknown as ReconductionAttente[]}
        isPending={validerReconduction.isPending}
        onDecision={(reconId, decision) => validerReconduction.mutate({ reconId, decision })}
      />


      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Gestion des Prêts</h1>
            <p className="text-sm text-muted-foreground">
              Reconduction: +{dureeReconduction} mois | Max: {maxReconductions} | Règle: Intérêt avant capital
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={showDashboard ? "default" : "outline"} 
            onClick={() => setShowDashboard(!showDashboard)}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Tableau de Bord
          </Button>
          {hasPermission('prets', 'create') && (
            <Button onClick={() => { setSelectedPret(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Prêt
            </Button>
          )}
          <Button variant="outline" onClick={() => window.location.href = '/dashboard/admin/finances/demandes-pret'}>
            <FileText className="h-4 w-4 mr-2" />
            Demandes de prêt
          </Button>
        </div>
      </div>

      <PretsStatsCards
        showDashboard={showDashboard}
        pretsActifs={pretsActifs}
        pretsPartiels={pretsPartiels}
        pretsEnRetard={pretsEnRetard}
        pretsRembourses={pretsRembourses}
        montantPrete={montantPrete}
        montantRestant={montantRestant}
        totalInterets={totalInterets}
        totalReconductions={totalReconductions}
      />


      {/* Filtres */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <CardTitle>Liste des Prêts ({filteredPrets.length})</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <Select value={statutFilter} onValueChange={(v) => setStatutFilter(v as StatutFilter)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="partiel">Partiel</SelectItem>
                  <SelectItem value="en_retard">En retard</SelectItem>
                  <SelectItem value="reconduit">Reconduit</SelectItem>
                  <SelectItem value="rembourse">Remboursé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Chargement...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Emprunteur</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Taux</TableHead>
                    <TableHead>Total dû</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Recon.</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Reste</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrets?.map((pret) => {
                    const calculs = getCalculsPret(pret);
                    const verifReconduction = peutReconduirePret(pret);
                    return (
                      <PretRow
                        key={pret.id}
                        pret={pret}
                        calculs={calculs}
                        rowClass={getRowClass(pret)}
                        statutBadge={getStatutBadge(pret)}
                        effectiveStatus={getEffectiveStatus(pret)}
                        verifReconduction={verifReconduction}
                        maxReconductions={maxReconductions}
                        payerTotalPending={payerTotal.isPending}
                        reconduirePending={reconduire.isPending}
                        canCreate={hasPermission('prets', 'create')}
                        canUpdate={hasPermission('prets', 'update')}
                        canDelete={hasPermission('prets', 'delete')}
                        onPayerTotal={(p) => payerTotal.mutate(p)}
                        onOpenPaiements={(id) => { setPretForPaiements(id); setPaiementsDialogOpen(true); }}
                        onOpenReconduire={handleOpenReconduire}
                        onOpenDetails={(id) => { setPretForDetails(id); setDetailsDialogOpen(true); }}
                        onExportPDF={handleExportPDF}
                        onEdit={(p) => { setSelectedPret(p); setFormOpen(true); }}
                        onDelete={(id) => { setPretToDelete(id); setDeleteDialogOpen(true); }}
                      />
                    );
                  })}
                  {filteredPrets?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        Aucun prêt trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Légende */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-900" />
              <span>Remboursé</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-200 dark:bg-orange-900" />
              <span>Partiel</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-200 dark:bg-red-900" />
              <span>En retard</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-200 dark:bg-blue-900" />
              <span>Reconduit</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <PretForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setSelectedPret(null); }}
        onSubmit={handleSubmit}
        initialData={selectedPret}
      />

      {pretForPaiements && (
        <PretsPaiementsManager
          pretId={pretForPaiements}
          open={paiementsDialogOpen}
          onClose={() => {
            setPaiementsDialogOpen(false);
            setPretForPaiements(null);
          }}
        />
      )}

      {pretForReconduction && (
        <ReconduireModal
          pret={pretForReconduction}
          maxReconductions={maxReconductions}
          dureeReconduction={dureeReconduction}
          soldeRestant={calculerSoldeRestant(pretForReconduction)}
          open={reconduireDialogOpen}
          onClose={() => {
            setReconduireDialogOpen(false);
            setPretForReconduction(null);
          }}
          onConfirm={() => reconduire.mutate(pretForReconduction)}
          isPending={reconduire.isPending}
        />
      )}

      {pretForDetails && (
        <PretDetailsModal
          pretId={pretForDetails}
          open={detailsDialogOpen}
          onClose={() => {
            setDetailsDialogOpen(false);
            setPretForDetails(null);
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce prêt ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => pretToDelete && deletePret.mutate(pretToDelete)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
