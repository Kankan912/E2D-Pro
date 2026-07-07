import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, AlertCircle, Users, FileText, Send, Lock, AlertTriangle, Wallet, Receipt, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { logger } from "@/lib/logger";
interface ClotureReunionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reunionId: string;
  reunionData: {
    sujet?: string;
    date_reunion: string;
  };
  onSuccess?: () => void;
}

export default function ClotureReunionModal({
  open,
  onOpenChange,
  reunionId,
  reunionData,
  onSuccess
}: ClotureReunionModalProps) {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Récupérer tous les membres E2D actifs
  const { data: membresE2D } = useQuery({
    queryKey: ['membres-e2d-cloture'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom, email')
        .eq('statut', 'actif')
        .eq('est_membre_e2d', true);
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Récupérer les présences depuis reunions_presences
  const { data: presences } = useQuery({
    queryKey: ['reunion-presences-cloture', reunionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions_presences')
        .select(`
          membre_id,
          statut_presence,
          membres:membre_id (
            nom,
            prenom,
            email
          )
        `)
        .eq('reunion_id', reunionId);

      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Récupérer les points du compte-rendu
  const { data: comptesRendus } = useQuery({
    queryKey: ['comptes-rendus-cloture', reunionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rapports_seances')
        .select('*')
        .eq('reunion_id', reunionId)
        .order('numero_ordre', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Récupérer la configuration des sanctions pour absence depuis les configurations
  const { data: sanctionConfig } = useQuery({
    queryKey: ['sanction-absence-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configurations')
        .select('valeur')
        .eq('cle', 'sanction_absence_montant')
        .maybeSingle();
      if (error) throw error;
      return data ? { montant: parseFloat(data.valeur) } : { montant: 500 }; // Défaut 500 FCFA
    },
    enabled: open
  });

  // Récupérer les cotisations de la réunion (avec membre_id pour check cohérence)
  const { data: cotisationsReunion } = useQuery({
    queryKey: ['cotisations-reunion', reunionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotisations')
        .select('montant, statut, membre_id')
        .eq('reunion_id', reunionId)
        .eq('statut', 'paye');
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Récupérer les bénéficiaires de la réunion
  const { data: beneficiairesReunion } = useQuery({
    queryKey: ['beneficiaires-reunion-cloture', reunionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunion_beneficiaires')
        .select('*, membres:membre_id(nom, prenom)')
        .eq('reunion_id', reunionId);
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Récupérer les validations Huile & Savon
  const { data: huileSavonData } = useQuery({
    queryKey: ['huile-savon-cloture', reunionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions_huile_savon')
        .select('membre_id, valide')
        .eq('reunion_id', reunionId);
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Récupérer la config sanction Huile & Savon
  const { data: sanctionHuileSavonConfig } = useQuery({
    queryKey: ['sanction-huile-savon-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configurations')
        .select('valeur')
        .eq('cle', 'sanction_huile_savon_montant')
        .maybeSingle();
      if (error) throw error;
      return data ? { montant: parseFloat(data.valeur) } : { montant: 2000 }; // Défaut 2000 FCFA
    },
    enabled: open
  });

  const presentsCount = presences?.filter(p => p.statut_presence === 'present').length || 0;
  const pointsCRCount = comptesRendus?.length || 0;
  const canClose = presentsCount > 0 && pointsCRCount > 0;
  
  // Calculer le total des cotisations collectées
  const totalCotisations = cotisationsReunion?.reduce((sum, c) => sum + c.montant, 0) || 0;
  const nbCotisations = cotisationsReunion?.length || 0;

  // Bénéficiaires impayés
  const beneficiairesImpayes = beneficiairesReunion?.filter((b: any) => b.statut !== 'paye') || [];
  const totalBeneficiairesImpayes = beneficiairesImpayes.reduce((sum: number, b: any) => sum + (b.montant_final || 0), 0);

  // Check cohérence : membres présents sans aucune cotisation
  const membresPresentsIds = presences?.filter(p => p.statut_presence === 'present').map(p => p.membre_id) || [];
  const membresAvecCotisation = new Set(cotisationsReunion?.map(c => c.membre_id) || []);
  const membresPresentsSansCotisation = presences
    ?.filter(p => p.statut_presence === 'present' && !membresAvecCotisation.has(p.membre_id))
    .map((p: any) => ({
      id: p.membre_id,
      nom: p.membres?.nom,
      prenom: p.membres?.prenom
    })) || [];

  // Calculer les membres non marqués (qui n'ont pas d'enregistrement de présence)
  const membresNonMarques = membresE2D?.filter(
    m => !presences?.some(p => p.membre_id === m.id)
  ) || [];

  // Calculer les membres sans Huile & Savon validé
  const membresSansHuileSavon = membresE2D?.filter(
    m => !huileSavonData?.some(hs => hs.membre_id === m.id && hs.valide)
  ) || [];

  const handleCloturer = async () => {
    if (!canClose) return;

    setProcessing(true);
    try {
      // === ÉTAPE 1: Traiter les membres non marqués comme absents non excusés ===
      if (membresNonMarques.length > 0) {
        const absencesACreer = membresNonMarques.map(m => ({
          reunion_id: reunionId,
          membre_id: m.id,
          statut_presence: 'absent_non_excuse',
          present: false,
        }));

        const { error: insertError } = await supabase
          .from('reunions_presences')
          .insert(absencesACreer);

        if (insertError) throw insertError;
      }

      // === ÉTAPE 2: Récupérer tous les absents non excusés pour sanctions ===
      const { data: tousAbsentsNonExcuses } = await supabase
        .from('reunions_presences')
        .select('membre_id')
        .eq('reunion_id', reunionId)
        .eq('statut_presence', 'absent_non_excuse');

      // === ÉTAPE 3: Créer les sanctions automatiques pour les absents non excusés ===
      if (tousAbsentsNonExcuses && tousAbsentsNonExcuses.length > 0 && sanctionConfig) {
        const sanctionsACreer = tousAbsentsNonExcuses.map(abs => ({
          reunion_id: reunionId,
          membre_id: abs.membre_id,
          type_sanction: 'absence',
          montant_amende: sanctionConfig.montant || 500,
          motif: 'Absence non excusée à la réunion',
          statut: 'impaye',
        }));

        const { error: sanctionError } = await supabase
          .from('reunions_sanctions')
          .insert(sanctionsACreer);

        if (sanctionError) {
          logger.error('Erreur création sanctions:', sanctionError);
          // On continue même si les sanctions échouent
        }
      }

      // === ÉTAPE 3bis: Créer les sanctions pour Huile & Savon non validé ===
      if (membresSansHuileSavon.length > 0 && sanctionHuileSavonConfig) {
        const sanctionsHuileSavon = membresSansHuileSavon.map(m => ({
          reunion_id: reunionId,
          membre_id: m.id,
          type_sanction: 'huile_savon',
          montant_amende: sanctionHuileSavonConfig.montant || 2000,
          motif: 'Huile & Savon non apporté',
          statut: 'impaye',
        }));

        const { error: sanctionHSError } = await supabase
          .from('reunions_sanctions')
          .insert(sanctionsHuileSavon);

        if (sanctionHSError) {
          logger.error('Erreur création sanctions Huile & Savon:', sanctionHSError);
        }
      }

      const { data: presentsData } = await supabase
        .from('reunions_presences')
        .select('membres:membre_id (nom, prenom, email)')
        .eq('reunion_id', reunionId)
        .eq('statut_presence', 'present');

      // Formater les destinataires comme attendu par l'edge function
      const destinataires = presentsData
        ?.filter((p: any) => p.membres?.email)
        .map((p: any) => ({
          email: p.membres.email,
          nom: p.membres.nom,
          prenom: p.membres.prenom
        })) || [];

      // B1 — Ne pas bloquer la clôture si aucun email valide.
      const hasDestinataires = destinataires.length > 0;
      if (!hasDestinataires) {
        toast({
          title: "Compte-rendu non envoyé",
          description: "Aucun email valide pour les membres présents. La clôture se poursuit sans envoi.",
        });
      }

      // === ÉTAPE 5: Préparer et envoyer le compte-rendu par email ===
      const contenuCR = comptesRendus
        ?.map((cr: any, index: number) =>
          `${index + 1}. ${cr.sujet}\n   ${cr.resolution || 'Aucune résolution'}`
        )
        .join('\n\n') || 'Aucun point à l\'ordre du jour';

      // Préparer les données de présences pour l'email
      const presentsNoms = presentsData?.map((p: any) => `${p.membres?.prenom} ${p.membres?.nom}`).filter(Boolean) || [];
      
      const { data: excusesData } = await supabase
        .from('reunions_presences')
        .select('membres:membre_id (nom, prenom)')
        .eq('reunion_id', reunionId)
        .eq('statut_presence', 'absent_excuse');
      const excusesNoms = excusesData?.map((p: any) => `${p.membres?.prenom} ${p.membres?.nom}`).filter(Boolean) || [];
      
      const absentsNonExcusesNoms = tousAbsentsNonExcuses?.length 
        ? membresE2D?.filter(m => tousAbsentsNonExcuses.some(a => a.membre_id === m.id))
            .map(m => `${m.prenom} ${m.nom}`) || []
        : [];
      
      const { data: retardsData } = await supabase
        .from('reunions_presences')
        .select('membres:membre_id (nom, prenom)')
        .eq('reunion_id', reunionId)
        .eq('statut_presence', 'present')
        .not('heure_arrivee', 'is', null);
      const retardsNoms = retardsData?.map((p: any) => `${p.membres?.prenom} ${p.membres?.nom}`).filter(Boolean) || [];

      const totalMembresCalcul = presentsNoms.length + excusesNoms.length + absentsNonExcusesNoms.length;
      const tauxPresenceEmail = totalMembresCalcul > 0 ? Math.round((presentsNoms.length / totalMembresCalcul) * 100) : 0;

      // Récupérer les données financières pour l'email
      const { data: epargnesReunion } = await supabase
        .from('epargnes')
        .select('montant')
        .eq('reunion_id', reunionId);
      
      const { data: sanctionsReunion } = await supabase
        .from('reunions_sanctions')
        .select('montant_amende')
        .eq('reunion_id', reunionId);

      const { data: beneficiairesData } = await supabase
        .from('reunion_beneficiaires')
        .select('*, membres:membre_id(nom, prenom)')
        .eq('reunion_id', reunionId);

      // Construire le résumé financier
      const financials = {
        cotisations: { 
          count: nbCotisations, 
          total: totalCotisations 
        },
        epargnes: { 
          count: epargnesReunion?.length || 0, 
          total: epargnesReunion?.reduce((sum, e) => sum + (e.montant || 0), 0) || 0 
        },
        sanctions: { 
          count: sanctionsReunion?.length || 0, 
          total: sanctionsReunion?.reduce((sum, s) => sum + (s.montant_amende || 0), 0) || 0 
        },
        beneficiaires: beneficiairesData && beneficiairesData.length > 0 ? {
          count: beneficiairesData.length,
          total: beneficiairesData.reduce((sum: number, b: any) => sum + (b.montant_final || 0), 0),
          details: beneficiairesData.map((b: any) => ({
            nom: `${b.membres?.prenom} ${b.membres?.nom}`,
            montant: b.montant_final || 0,
            statut: b.statut
          }))
        } : undefined
      };

      let emailSent = false;
      if (hasDestinataires) {
        const { error: emailError } = await supabase.functions.invoke('send-reunion-cr', {
          body: {
            reunionId,
            destinataires,
            sujet: reunionData.sujet || 'Réunion',
            contenu: contenuCR,
            dateReunion: reunionData.date_reunion,
            presences: {
              presents: presentsNoms,
              excuses: excusesNoms,
              absentsNonExcuses: absentsNonExcusesNoms,
              retards: retardsNoms,
              tauxPresence: tauxPresenceEmail
            },
            financials
          }
        });

        if (emailError) {
          logger.error("Email error details:", emailError);
          // B1 — Ne pas bloquer la clôture si l'email échoue
        } else {
          emailSent = true;
        }
      }

      // === ÉTAPE 6: Calculer le taux de présence et mettre à jour le statut ===
      const totalMembresE2D = membresE2D?.length || 0;
      const tauxPresenceCalcule = totalMembresE2D > 0 
        ? Math.round((presentsCount / totalMembresE2D) * 100 * 10) / 10  // Arrondi 1 décimale
        : 0;

      const { error: updateError } = await supabase
        .from('reunions')
        .update({ 
          statut: 'terminee',
          taux_presence: tauxPresenceCalcule 
        })
        .eq('id', reunionId);

      if (updateError) throw updateError;

      // Invalider les caches pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ['reunion-presences'] });
      queryClient.invalidateQueries({ queryKey: ['reunion-presences-cloture'] });
      queryClient.invalidateQueries({ queryKey: ['presences-all'] });
      queryClient.invalidateQueries({ queryKey: ['reunions'] });
      queryClient.invalidateQueries({ queryKey: ['reunions-cloturees'] });
      queryClient.invalidateQueries({ queryKey: ['reunions-sanctions'] });
      const nbSanctionsAbsence = tousAbsentsNonExcuses?.length || 0;
      const nbSanctionsHuileSavon = membresSansHuileSavon.length;
      const totalSanctions = nbSanctionsAbsence + nbSanctionsHuileSavon;
      
      const emailMsg = emailSent
        ? `CR envoyé à ${destinataires.length} membre(s).`
        : (hasDestinataires ? `Envoi du CR échoué — clôture maintenue.` : `CR non envoyé (aucun email).`);
      toast({
        title: "Réunion clôturée avec succès",
        description: `${emailMsg} ${totalSanctions > 0 ? `${totalSanctions} sanction(s) créée(s) (${nbSanctionsAbsence} absence${nbSanctionsAbsence > 1 ? 's' : ''}, ${nbSanctionsHuileSavon} Huile & Savon).` : ''}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      logger.error('Erreur clôture réunion:', error);
      toast({
        title: "Erreur",
        description: "Impossible de clôturer la réunion: " + (error instanceof Error ? error.message : "Erreur"),
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Clôturer la Réunion
          </DialogTitle>
          <DialogDescription>
            La clôture est définitive : elle bloque les modifications, applique les sanctions et envoie le compte-rendu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Résumé */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Résumé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Réunion</span>
                <Badge>{reunionData.sujet || 'Sans titre'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Date</span>
                <span className="text-sm font-medium">
                  {new Date(reunionData.date_reunion).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Vérifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vérifications</CardTitle>
              <CardDescription>
                Assurez-vous que toutes les conditions sont remplies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {presentsCount > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Membres présents enregistrés</span>
                </div>
                <Badge variant={presentsCount > 0 ? 'default' : 'destructive'}>
                  {presentsCount}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {pointsCRCount > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Points à l'ordre du jour</span>
                </div>
                <Badge variant={pointsCRCount > 0 ? 'default' : 'destructive'}>
                  {pointsCRCount}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Résumé Financier */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Résumé Financier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Cotisations collectées</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-green-600">{totalCotisations.toLocaleString()} FCFA</span>
                  <span className="text-xs text-muted-foreground ml-1">({nbCotisations} paiement{nbCotisations > 1 ? 's' : ''})</span>
                </div>
              </div>
              {membresNonMarques.length > 0 && sanctionConfig && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm">Sanctions absence</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-orange-600">
                      {(membresNonMarques.length * sanctionConfig.montant).toLocaleString()} FCFA
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">({membresNonMarques.length} × {sanctionConfig.montant.toLocaleString()})</span>
                  </div>
                </div>
              )}
              {membresSansHuileSavon.length > 0 && sanctionHuileSavonConfig && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm">Sanctions Huile & Savon</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-600">
                      {(membresSansHuileSavon.length * sanctionHuileSavonConfig.montant).toLocaleString()} FCFA
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">({membresSansHuileSavon.length} × {sanctionHuileSavonConfig.montant.toLocaleString()})</span>
                  </div>
                </div>
              )}
              {beneficiairesReunion && beneficiairesReunion.length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    <span className="text-sm">Bénéficiaires du mois</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-primary">
                      {beneficiairesReunion.reduce((sum: number, b: any) => sum + (b.montant_final || 0), 0).toLocaleString()} FCFA
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({beneficiairesReunion.filter((b: any) => b.statut === 'paye').length}/{beneficiairesReunion.length} payé)
                    </span>
                  </div>
                </div>
              )}
              <div className="pt-2 border-t text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Ces montants seront synchronisés automatiquement avec la caisse
              </div>
            </CardContent>
          </Card>

          {/* Avertissement membres non marqués */}
          {membresNonMarques.length > 0 && (
            <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                  <div className="text-sm text-orange-800 dark:text-orange-200">
                    <p className="font-medium mb-1">{membresNonMarques.length} membre(s) non marqué(s)</p>
                    <p>
                      Ces membres seront automatiquement marqués comme <strong>absents non excusés</strong> et 
                      recevront une sanction.
                    </p>
                    <div className="mt-2 text-xs">
                      {membresNonMarques.slice(0, 5).map(m => m.prenom + ' ' + m.nom).join(', ')}
                      {membresNonMarques.length > 5 && ` et ${membresNonMarques.length - 5} autre(s)...`}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Avertissement bénéficiaires impayés */}
          {beneficiairesImpayes.length > 0 && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <Gift className="h-5 w-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">{beneficiairesImpayes.length} bénéficiaire(s) non payé(s)</p>
                    <p className="text-muted-foreground">
                      Montant total impayé: <strong>{totalBeneficiairesImpayes.toLocaleString()} FCFA</strong>
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {beneficiairesImpayes.map((b: any) => 
                        `${b.membres?.prenom} ${b.membres?.nom}`
                      ).join(', ')}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Avertissement membres présents sans cotisation */}
          {membresPresentsSansCotisation.length > 0 && (
            <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">{membresPresentsSansCotisation.length} membre(s) présent(s) sans cotisation</p>
                    <p className="text-muted-foreground text-xs mb-2">
                      Ces membres sont marqués présents mais n'ont aucune cotisation enregistrée pour cette réunion.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {membresPresentsSansCotisation.map((m, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700">
                          {m.prenom} {m.nom}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {presentsCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Destinataires du CR ({presentsCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-24">
                  <div className="space-y-2">
                    {presences?.filter(p => p.statut_presence === 'present').map((presence: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted text-sm"
                      >
                        <span>
                          {presence.membres?.prenom} {presence.membres?.nom}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {presence.membres?.email || 'Pas d\'email'}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Avertissement conditions non remplies */}
          {!canClose && (
            <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-medium mb-1">Conditions non remplies</p>
                    <p>
                      Veuillez enregistrer au moins un membre présent et un point à l'ordre du jour
                      avant de clôturer la réunion.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCloturer}
              disabled={!canClose || processing}
              className="bg-gradient-to-r from-primary to-secondary"
            >
              {processing ? (
                <>Traitement en cours...</>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Clôturer et Envoyer
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
