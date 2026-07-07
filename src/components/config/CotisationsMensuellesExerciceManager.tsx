import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Coins, Save, Lock, Unlock, AlertCircle, Users, RefreshCw, Wand2, CheckCircle, History, ShieldCheck } from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { CotisationsMensuellesAuditDialog } from './CotisationsMensuellesAuditDialog';

interface Membre {
  id: string;
  nom: string;
  prenom: string;
}

interface Exercice {
  id: string;
  nom: string;
  statut: string;
  date_debut: string;
  date_fin: string;
}

interface CotisationMensuelleExercice {
  id: string;
  membre_id: string;
  exercice_id: string;
  montant: number;
  actif: boolean;
  verrouille: boolean;
}

export function CotisationsMensuellesExerciceManager() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedExerciceId, setSelectedExerciceId] = useState<string>('');
  const [modifiedMontants, setModifiedMontants] = useState<Record<string, number>>({});
  const [massApplyAmount, setMassApplyAmount] = useState<string>('');
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [auditReason, setAuditReason] = useState('');
  const [pendingSave, setPendingSave] = useState<{ membreId: string; montant: number; oldMontant: number }[]>([]);

  // Fetch exercices
  const { data: exercices, isLoading: loadingExercices } = useQuery({
    queryKey: ['exercices-list-mensuelle'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercices')
        .select('id, nom, statut, date_debut, date_fin')
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data as Exercice[];
    }
  });

  // Fetch membres E2D actifs
  const { data: membres, isLoading: loadingMembres } = useQuery({
    queryKey: ['membres-e2d-mensuelle'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom')
        .eq('statut', 'actif')
        .eq('est_membre_e2d', true)
        .order('nom');
      if (error) throw error;
      return data as Membre[];
    }
  });

  // Fetch cotisations mensuelles pour l'exercice sélectionné
  const { data: cotisationsMensuelles, isLoading: loadingCotisations, refetch } = useQuery({
    queryKey: ['cotisations-mensuelles-exercice', selectedExerciceId],
    queryFn: async () => {
      if (!selectedExerciceId) return [];
      const { data, error } = await supabase
        .from('cotisations_mensuelles_exercice')
        .select('*')
        .eq('exercice_id', selectedExerciceId);
      if (error) throw error;
      return data as CotisationMensuelleExercice[];
    },
    enabled: !!selectedExerciceId
  });

  // Fetch montant par défaut de cotisation mensuelle
  const { data: defaultMontant } = useQuery({
    queryKey: ['cotisation-mensuelle-default'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotisations_types')
        .select('montant_defaut')
        .ilike('nom', '%cotisation mensuelle%')
        .eq('obligatoire', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.montant_defaut || 20000;
    }
  });

  // Auto-select active exercise
  useEffect(() => {
    if (exercices && exercices.length > 0 && !selectedExerciceId) {
      const activeExercice = exercices.find(e => e.statut === 'actif');
      if (activeExercice) {
        setSelectedExerciceId(activeExercice.id);
      }
    }
  }, [exercices, selectedExerciceId]);

  // Exercice sélectionné
  const selectedExercice = useMemo(() => 
    exercices?.find(e => e.id === selectedExerciceId),
    [exercices, selectedExerciceId]
  );

  // Check if any record is locked
  const hasLockedRecords = cotisationsMensuelles?.some(c => c.verrouille) || false;
  const isExerciceLocked = selectedExercice?.statut === 'actif' || selectedExercice?.statut === 'cloture';

  // Autorisation centralisée : permission cotisations.update (admin = true via has_permission)
  const canEdit = hasPermission('cotisations', 'update');
  // L'admin bypass est déjà géré par usePermissions (isAdministrateur)
  const isAdmin = canEdit;

  // Get montant for a membre
  const getMontant = (membreId: string): number => {
    if (modifiedMontants[membreId] !== undefined) {
      return modifiedMontants[membreId];
    }
    const existing = cotisationsMensuelles?.find(c => c.membre_id === membreId);
    return existing?.montant ?? defaultMontant ?? 20000;
  };

  // Check if montant is configured
  const isConfigured = (membreId: string): boolean => {
    return cotisationsMensuelles?.some(c => c.membre_id === membreId) || false;
  };

  // Check if montant is locked
  const isLocked = (membreId: string): boolean => {
    const existing = cotisationsMensuelles?.find(c => c.membre_id === membreId);
    return existing?.verrouille || false;
  };

  // Mutation pour sauvegarder
  const saveMontants = useMutation({
    mutationFn: async (items: { membreId: string; montant: number; oldMontant: number; reason?: string }[]) => {
      for (const item of items) {
        const existing = cotisationsMensuelles?.find(c => c.membre_id === item.membreId);

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('cotisations_mensuelles_exercice')
            .update({ montant: item.montant })
            .eq('id', existing.id);
          if (error) throw error;

          // Log audit systématique pour toute modification (verrouillée ou non)
          if (item.oldMontant !== item.montant) {
            await supabase.from('cotisations_mensuelles_audit').insert({
              cotisation_mensuelle_id: existing.id,
              membre_id: item.membreId,
              exercice_id: selectedExerciceId,
              montant_avant: item.oldMontant,
              montant_apres: item.montant,
              modifie_par: profile?.id,
              raison: item.reason?.trim() || (existing.verrouille ? 'Modification (exercice verrouillé)' : 'Modification du montant'),
            });
          }
        } else {
          // Insert new
          const { data: inserted, error } = await supabase
            .from('cotisations_mensuelles_exercice')
            .insert({
              membre_id: item.membreId,
              exercice_id: selectedExerciceId,
              montant: item.montant,
              actif: true,
              verrouille: isExerciceLocked,
            })
            .select('id')
            .single();
          if (error) throw error;

          // Log la création initiale
          await supabase.from('cotisations_mensuelles_audit').insert({
            cotisation_mensuelle_id: inserted.id,
            membre_id: item.membreId,
            exercice_id: selectedExerciceId,
            montant_avant: 0,
            montant_apres: item.montant,
            modifie_par: profile?.id,
            raison: item.reason?.trim() || 'Initialisation du montant',
          });
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Montants sauvegardés avec succès" });
      queryClient.invalidateQueries({ queryKey: ['cotisations-mensuelles-exercice', selectedExerciceId] });
      setModifiedMontants({});
      setShowAuditDialog(false);
      setAuditReason('');
      setPendingSave([]);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur lors de la sauvegarde", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Initialize all members with default amount
  const initializeAll = useMutation({
    mutationFn: async () => {
      const membresWithoutConfig = membres?.filter(m => !isConfigured(m.id)) || [];
      
      for (const membre of membresWithoutConfig) {
        const { error } = await supabase
          .from('cotisations_mensuelles_exercice')
          .insert({
            membre_id: membre.id,
            exercice_id: selectedExerciceId,
            montant: defaultMontant || 20000,
            actif: true,
            verrouille: isExerciceLocked
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Initialisation terminée", description: `${membres?.filter(m => !isConfigured(m.id)).length} membres initialisés` });
      queryClient.invalidateQueries({ queryKey: ['cotisations-mensuelles-exercice', selectedExerciceId] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  // Handle montant change
  const handleMontantChange = (membreId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setModifiedMontants(prev => ({ ...prev, [membreId]: numValue }));
  };

  // Handle mass apply
  const handleMassApply = () => {
    const amount = parseFloat(massApplyAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    
    const updates: Record<string, number> = {};
    membres?.forEach(m => {
      if (!isLocked(m.id) || isAdmin) {
        updates[m.id] = amount;
      }
    });
    setModifiedMontants(updates);
    toast({ title: "Montant appliqué à tous les membres" });
  };

  // Handle save
  const handleSave = () => {
    const itemsToSave = Object.entries(modifiedMontants).map(([membreId, montant]) => {
      const existing = cotisationsMensuelles?.find(c => c.membre_id === membreId);
      return {
        membreId,
        montant,
        oldMontant: existing?.montant ?? defaultMontant ?? 20000
      };
    });

    // Demander une raison pour toute modification sensible : exercice actif/clôturé OU ligne verrouillée
    const requiresReason = itemsToSave.some(item => {
      const existing = cotisationsMensuelles?.find(c => c.membre_id === item.membreId);
      return isExerciceLocked || existing?.verrouille;
    });

    if (requiresReason) {
      setPendingSave(itemsToSave);
      setShowAuditDialog(true);
    } else {
      saveMontants.mutate(itemsToSave);
    }
  };

  // Confirm save with reason
  const confirmSaveWithReason = () => {
    const itemsWithReason = pendingSave.map(item => ({
      ...item,
      reason: auditReason
    }));
    saveMontants.mutate(itemsWithReason);
  };

  const isLoading = loadingExercices || loadingMembres;
  const hasModifications = Object.keys(modifiedMontants).length > 0;
  const membresNotConfigured = membres?.filter(m => !isConfigured(m.id)).length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Cotisation Mensuelle par Membre
          </CardTitle>
          <CardDescription>
            Définissez le montant de cotisation mensuelle pour chaque membre par exercice.
            Ces montants sont utilisés pour calculer les attendus dans les réunions et bilans.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sélection exercice */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] max-w-xs">
              <Select value={selectedExerciceId} onValueChange={(value) => {
                setSelectedExerciceId(value);
                setModifiedMontants({});
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un exercice" />
                </SelectTrigger>
                <SelectContent>
                  {exercices?.map(ex => (
                    <SelectItem key={ex.id} value={ex.id}>
                      <div className="flex items-center gap-2">
                        {ex.nom}
                        <Badge variant={ex.statut === 'actif' ? 'default' : 'secondary'} className="ml-2">
                          {ex.statut}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedExerciceId && (
              <>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </Button>
                
                {membresNotConfigured > 0 && canEdit && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => initializeAll.mutate()}
                    disabled={initializeAll.isPending}
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Initialiser {membresNotConfigured} membre(s)
                  </Button>
                )}

                <Button variant="outline" size="sm" onClick={() => setShowHistoryDialog(true)}>
                  <History className="h-4 w-4 mr-2" />
                  Historique
                </Button>
              </>
            )}
          </div>

          {/* Message si pas d'exercice sélectionné */}
          {!selectedExerciceId && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Sélectionnez un exercice pour configurer les montants de cotisation mensuelle par membre.
              </AlertDescription>
            </Alert>
          )}

          {/* Message si exercice verrouillé */}
          {selectedExerciceId && isExerciceLocked && (
            <Alert variant={canEdit ? "default" : "destructive"}>
              {canEdit ? <ShieldCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <AlertDescription>
                <strong>Exercice {selectedExercice?.statut === 'actif' ? 'actif' : 'clôturé'}</strong>
                {canEdit
                  ? " - Vous êtes autorisé à modifier les montants. Une raison vous sera demandée et chaque modification sera enregistrée dans l'historique."
                  : " - Les montants sont verrouillés. Contactez un administrateur pour toute modification."
                }
              </AlertDescription>
            </Alert>
          )}

          {/* Application en masse */}
          {selectedExerciceId && canEdit && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Appliquer à tous:</span>
              <Input
                type="number"
                value={massApplyAmount}
                onChange={(e) => setMassApplyAmount(e.target.value)}
                placeholder="Montant"
                className="w-32"
              />
              <Button variant="secondary" size="sm" onClick={handleMassApply}>
                Appliquer
              </Button>
            </div>
          )}

          {/* Tableau */}
          {selectedExerciceId && (
            <>
              {loadingCotisations ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ScrollArea className="w-full border rounded-md">
                  <div className="min-w-max">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Membre
                            </div>
                          </TableHead>
                          <TableHead className="text-center min-w-[180px]">Montant Mensuel</TableHead>
                          <TableHead className="text-center min-w-[120px]">Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {membres?.map(membre => {
                          const montant = getMontant(membre.id);
                          const configured = isConfigured(membre.id);
                          const locked = isLocked(membre.id);
                          const isModified = modifiedMontants[membre.id] !== undefined;
                          const disabled = locked && !isAdmin;

                          return (
                            <TableRow key={membre.id}>
                              <TableCell className="sticky left-0 bg-background z-10 border-r font-medium">
                                {membre.prenom} {membre.nom}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="relative">
                                    <Input
                                      type="number"
                                      value={montant}
                                      onChange={(e) => handleMontantChange(membre.id, e.target.value)}
                                      disabled={disabled}
                                      className={`w-36 text-center ${isModified ? 'border-primary ring-1 ring-primary' : ''} ${disabled ? 'bg-muted' : ''}`}
                                    />
                                    {locked && !canEdit && (
                                      <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {formatFCFA(montant)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                  {configured ? (
                                    <Badge className="bg-success/20 text-success border-success/30">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Configuré
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">
                                      Non configuré
                                    </Badge>
                                  )}
                                  {locked && !canEdit && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      <Lock className="h-2 w-2 mr-1" />
                                      Verrouillé
                                    </Badge>
                                  )}
                                  {locked && canEdit && (
                                    <Badge variant="outline" className="text-[10px]">
                                      <ShieldCheck className="h-2 w-2 mr-1" />
                                      Modifiable (audité)
                                    </Badge>
                                  )}
                                  {isModified && (
                                    <Badge className="bg-primary text-primary-foreground text-[10px]">
                                      Modifié
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {(!membres || membres.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                              Aucun membre E2D actif
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}

              {/* Bouton sauvegarder */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleSave} 
                  disabled={!hasModifications || saveMontants.isPending || !canEdit}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveMontants.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                  {hasModifications && (
                    <Badge variant="secondary" className="ml-2">
                      {Object.keys(modifiedMontants).length}
                    </Badge>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Audit Dialog */}
      <Dialog open={showAuditDialog} onOpenChange={setShowAuditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Modification de montants verrouillés
            </DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de modifier des montants verrouillés. 
              Cette action sera enregistrée dans l'historique d'audit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Raison de la modification</Label>
              <Textarea
                id="reason"
                placeholder="Expliquez pourquoi vous modifiez ces montants..."
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>{pendingSave.length}</strong> montant(s) seront modifié(s)
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuditDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={confirmSaveWithReason}
              disabled={!auditReason.trim() || saveMontants.isPending}
            >
              {saveMontants.isPending ? 'Sauvegarde...' : 'Confirmer et sauvegarder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedExerciceId && (
        <CotisationsMensuellesAuditDialog
          open={showHistoryDialog}
          onOpenChange={setShowHistoryDialog}
          exerciceId={selectedExerciceId}
        />
      )}
    </>
  );
}
