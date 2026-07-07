import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, Calendar, Banknote, Percent, RefreshCw, 
  CheckCircle, Clock, AlertTriangle, FileText, Building, Download, History, XCircle
} from "lucide-react";
import { formatFCFA } from "@/lib/utils";
import { calculerResumePret } from "@/lib/pretCalculsService";
import { exportPretPDF } from "@/lib/pret-pdf-export";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import PretHistoriqueComplet from "./PretHistoriqueComplet";
import { useAuth } from "@/contexts/AuthContext";

interface PretDetailsModalProps {
  pretId: string;
  open: boolean;
  onClose: () => void;
}

export default function PretDetailsModal({ pretId, open, onClose }: PretDetailsModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('is_admin');
      return Boolean(data);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  const { data: pret } = useQuery({
    queryKey: ['pret-details', pretId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prets')
        .select(`
          *,
          emprunteur:membres!membre_id(id, nom, prenom, telephone, email),
          avaliste:membres!avaliste_id(id, nom, prenom),
          reunion:reunions!reunion_id(id, date_reunion, ordre_du_jour),
          exercice:exercices!exercice_id(id, nom)
        `)
        .eq('id', pretId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!pretId && open,
  });

  const { data: paiements } = useQuery({
    queryKey: ['pret-paiements-details', pretId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prets_paiements')
        .select('*')
        .eq('pret_id', pretId)
        .order('date_paiement', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!pretId && open,
  });

  const { data: reconductions } = useQuery({
    queryKey: ['pret-reconductions-details', pretId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prets_reconductions')
        .select('*')
        .eq('pret_id', pretId)
        .order('date_reconduction', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!pretId && open,
  });

  if (!pret) return null;

  // Calculs centralisés
  const calculs = calculerResumePret(
    {
      montant: pret.montant,
      taux_interet: pret.taux_interet,
      interet_initial: pret.interet_initial,
      reconductions: pret.reconductions,
      montant_paye: pret.montant_paye,
    },
    paiements?.map(p => ({ montant_paye: p.montant_paye, date_paiement: p.date_paiement, type_paiement: p.type_paiement })),
    reconductions?.map(r => ({ date_reconduction: r.date_reconduction, interet_mois: r.interet_mois }))
  );

  const { totalInterets, totalDu, totalPaye, resteAPayer, progression: progressionGlobale } = calculs;

  const interetPaye = pret.interet_paye || 0;
  const capitalPaye = pret.capital_paye || 0;
  const interetRestant = Math.max(0, totalInterets - interetPaye);
  const capitalRestant = Math.max(0, pret.montant - capitalPaye);
  const progressionInteret = totalInterets > 0 ? (interetPaye / totalInterets) * 100 : 0;
  const progressionCapital = pret.montant > 0 ? (capitalPaye / pret.montant) * 100 : 0;

  // Statut
  const getStatut = () => {
    if (pret.statut === 'rembourse' || resteAPayer <= 0) return 'rembourse';
    if (new Date(pret.echeance) < new Date() && pret.statut !== 'rembourse') return 'en_retard';
    if (totalPaye > 0) return 'partiel';
    if ((pret.reconductions || 0) > 0) return 'reconduit';
    return 'en_cours';
  };

  const statut = getStatut();

  const getStatutBadge = () => {
    switch (statut) {
      case 'rembourse':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Remboursé</Badge>;
      case 'en_retard':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />En retard</Badge>;
      case 'partiel':
        return <Badge className="bg-orange-500"><Clock className="h-3 w-3 mr-1" />Partiellement payé</Badge>;
      case 'reconduit':
        return <Badge className="bg-blue-500"><RefreshCw className="h-3 w-3 mr-1" />Reconduit</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />En cours</Badge>;
    }
  };

  const handleExportPDF = () => {
    if (pret) {
      exportPretPDF(pret, paiements || [], reconductions || []);
      toast({ title: "PDF exporté avec succès" });
    }
  };

  // Validation reconductions (admin uniquement) — audit Prêts: workflow validation reconduction
  const validateReconduction = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: 'validee' | 'refusee' }) => {
      const { error } = await supabase
        .from('prets_reconductions')
        .update({ statut, validee_le: new Date().toISOString(), validee_par: user?.id ?? null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast({ title: vars.statut === 'validee' ? 'Reconduction validée' : 'Reconduction refusée' });
      queryClient.invalidateQueries({ queryKey: ['pret-reconductions-details', pretId] });
      queryClient.invalidateQueries({ queryKey: ['pret-details', pretId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la validation';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    },
  });

  const reconductionStatutBadge = (s: string) => {
    if (s === 'validee') return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Validée</Badge>;
    if (s === 'refusee') return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Refusée</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              Fiche Prêt Détaillée
              {getStatutBadge()}
            </div>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="mr-8">
              <Download className="h-4 w-4 mr-2" />
              Exporter PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="historique">
              <History className="h-4 w-4 mr-1" />
              Historique Complet
            </TabsTrigger>
            <TabsTrigger value="paiements">Paiements ({paiements?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            {/* Informations principales */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Emprunteur
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-bold text-lg">{pret.emprunteur?.nom} {pret.emprunteur?.prenom}</p>
                  {pret.emprunteur?.telephone && (
                    <p className="text-sm text-muted-foreground">{pret.emprunteur.telephone}</p>
                  )}
                  {pret.avaliste && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Avaliste (Garant)</p>
                      <p className="text-sm">{pret.avaliste.nom} {pret.avaliste.prenom}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Dates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date du prêt</span>
                    <span>{format(new Date(pret.date_pret), 'dd MMMM yyyy', { locale: fr })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Échéance</span>
                    <span className={statut === 'en_retard' ? 'text-destructive font-bold' : ''}>
                      {format(new Date(pret.echeance), 'dd MMMM yyyy', { locale: fr })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durée</span>
                    <span>{pret.duree_mois || 2} mois</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Détails financiers */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Détails Financiers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Capital emprunté</p>
                    <p className="text-xl font-bold">{formatFCFA(pret.montant)}</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total intérêts</p>
                    <p className="text-xl font-bold text-amber-600">{formatFCFA(totalInterets)}</p>
                    <p className="text-xs text-muted-foreground">{pret.taux_interet || 5}% + {pret.reconductions || 0} recon.</p>
                  </div>
                  <div className="text-center p-3 bg-primary/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total dû</p>
                    <p className="text-xl font-bold">{formatFCFA(totalDu)}</p>
                  </div>
                  <div className={`text-center p-3 rounded-lg ${resteAPayer > 0 ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-green-50 dark:bg-green-950/30'}`}>
                    <p className="text-xs text-muted-foreground">Reste à payer</p>
                    <p className={`text-xl font-bold ${resteAPayer > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatFCFA(resteAPayer)}
                    </p>
                  </div>
                </div>

                {/* Barres de progression */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progression globale</span>
                      <span>{progressionGlobale.toFixed(1)}%</span>
                    </div>
                    <Progress value={progressionGlobale} className="h-3" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-amber-600">Intérêts payés</span>
                        <span>{formatFCFA(interetPaye)} / {formatFCFA(totalInterets)}</span>
                      </div>
                      <Progress value={progressionInteret} className="h-2 [&>div]:bg-amber-500" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-blue-600">Capital remboursé</span>
                        <span>{formatFCFA(capitalPaye)} / {formatFCFA(pret.montant)}</span>
                      </div>
                      <Progress value={progressionCapital} className="h-2 [&>div]:bg-blue-500" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contexte */}
            <div className="grid md:grid-cols-2 gap-4">
              {pret.reunion && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Réunion d'attribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">
                      {format(new Date(pret.reunion.date_reunion), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                    {pret.reunion.ordre_du_jour && (
                      <p className="text-sm text-muted-foreground mt-1">{pret.reunion.ordre_du_jour}</p>
                    )}
                  </CardContent>
                </Card>
              )}
              {pret.exercice && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Exercice fiscal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{pret.exercice.nom}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Notes */}
            {pret.notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{pret.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="historique">
            <PretHistoriqueComplet 
              pret={pret} 
              paiements={paiements || []} 
              reconductions={reconductions || []} 
            />
          </TabsContent>

          <TabsContent value="paiements" className="space-y-4">
            {/* Historique des reconductions */}
            {reconductions && reconductions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Historique des reconductions ({reconductions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Intérêt du mois</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Notes</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconductions.map((recon: any, index: number) => (
                        <TableRow key={recon.id}>
                          <TableCell className="font-medium">{reconductions.length - index}</TableCell>
                          <TableCell>{format(new Date(recon.date_reconduction), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-amber-600">+{formatFCFA(recon.interet_mois)}</TableCell>
                          <TableCell>{reconductionStatutBadge(recon.statut || 'en_attente')}</TableCell>
                          <TableCell className="text-muted-foreground">{recon.notes || '-'}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              {(recon.statut ?? 'en_attente') === 'en_attente' ? (
                                <div className="flex gap-2 justify-end">
                                  <Button size="sm" variant="outline"
                                    disabled={validateReconduction.isPending}
                                    onClick={() => validateReconduction.mutate({ id: recon.id, statut: 'validee' })}>
                                    <CheckCircle className="h-3 w-3 mr-1" />Valider
                                  </Button>
                                  <Button size="sm" variant="ghost"
                                    disabled={validateReconduction.isPending}
                                    onClick={() => validateReconduction.mutate({ id: recon.id, statut: 'refusee' })}>
                                    <XCircle className="h-3 w-3 mr-1" />Refuser
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Historique des paiements */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Historique des paiements ({paiements?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paiements && paiements.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paiements.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell>{format(new Date(p.date_paiement), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="font-medium text-green-600">{formatFCFA(p.montant_paye)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {p.type_paiement || 'mixte'}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{p.mode_paiement}</TableCell>
                          <TableCell className="text-muted-foreground">{p.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    {pret.statut === 'rembourse' 
                      ? "Ce prêt a été remboursé avant la mise en place du suivi détaillé."
                      : "Aucun paiement enregistré"
                    }
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
