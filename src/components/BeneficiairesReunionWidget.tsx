import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Gift, Check, AlertCircle, Calculator, Plus, Loader2, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBeneficiairesReunion, useCalendrierBeneficiaires } from "@/hooks/useCalendrierBeneficiaires";
import { useAuth } from "@/contexts/AuthContext";
import { formatFCFA } from "@/lib/utils";

import { logger } from "@/lib/logger";
interface BeneficiairesReunionWidgetProps {
  reunionId: string;
  reunionDate: string;
  exerciceId?: string;
  isReadOnly?: boolean;
}

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export default function BeneficiairesReunionWidget({ 
  reunionId, 
  reunionDate,
  exerciceId,
  isReadOnly = false 
}: BeneficiairesReunionWidgetProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedCalendrierId, setSelectedCalendrierId] = useState<string>("");
  const [selectedBeneficiaireId, setSelectedBeneficiaireId] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [calculatedData, setCalculatedData] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  const { user } = useAuth();
  const { beneficiaires, isLoading, assignerBeneficiaire, marquerPaye } = useBeneficiairesReunion(reunionId);

  // Récupérer l'exercice de la réunion si non fourni
  const { data: exercice } = useQuery({
    queryKey: ['exercice-reunion', reunionDate],
    queryFn: async () => {
      if (exerciceId) return { id: exerciceId };
      
      const { data, error } = await supabase
        .from('exercices')
        .select('id')
        .lte('date_debut', reunionDate)
        .gte('date_fin', reunionDate)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !exerciceId
  });

  const currentExerciceId = exerciceId || exercice?.id;

  // Récupérer le calendrier des bénéficiaires
  const { calendrier, calculerMontant } = useCalendrierBeneficiaires(currentExerciceId);

  // Mois de la réunion
  const reunionMois = new Date(reunionDate).getMonth() + 1;

  // Bénéficiaires du mois selon le calendrier
  const beneficiairesDuMois = calendrier.filter(c => c.mois_benefice === reunionMois);

  // Bénéficiaires déjà assignés
  const dejaAssignes = beneficiaires.map(b => b.membre_id);

  // Bénéficiaires disponibles pour assignation
  const disponibles = beneficiairesDuMois.filter(c => !dejaAssignes.includes(c.membre_id));

  // Calculer le montant net
  const handleCalculate = async (calendrierId: string) => {
    const calendrierItem = calendrier.find(c => c.id === calendrierId);
    if (!calendrierItem || !currentExerciceId) return;

    setIsCalculating(true);
    try {
      const result = await calculerMontant(calendrierItem.membre_id, currentExerciceId);
      setCalculatedData({
        ...result,
        calendrierId,
        membreId: calendrierItem.membre_id,
        membreNom: `${calendrierItem.membres?.prenom} ${calendrierItem.membres?.nom}`
      });
    } catch (error: unknown) {
      logger.error('Erreur calcul:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  // Assigner le bénéficiaire
  const handleAssign = async () => {
    if (!calculatedData || !currentExerciceId) return;

    await assignerBeneficiaire.mutateAsync({
      reunionId,
      membreId: calculatedData.membreId,
      calendrierId: calculatedData.calendrierId,
      exerciceId: currentExerciceId,
      montantBrut: calculatedData.montant_brut,
      deductions: {
        sanctions_impayees: calculatedData.sanctions_impayees
      },
      montantFinal: calculatedData.montant_net
    });

    setShowAssignDialog(false);
    setSelectedCalendrierId("");
    setCalculatedData(null);
  };

  // Marquer comme payé
  const handlePay = async () => {
    if (!selectedBeneficiaireId) return;
    
    await marquerPaye.mutateAsync({
      id: selectedBeneficiaireId,
      payePar: user?.id,
      notes: paymentNotes
    });

    setShowPayDialog(false);
    setSelectedBeneficiaireId("");
    setPaymentNotes("");
  };

  const openPayDialog = (id: string) => {
    setSelectedBeneficiaireId(id);
    setShowPayDialog(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gift className="h-5 w-5 text-primary" />
            Bénéficiaires du mois
            <Badge variant="outline">{MOIS[reunionMois - 1]}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bénéficiaires prévus selon le calendrier */}
          {beneficiairesDuMois.length > 0 && disponibles.length > 0 && !isReadOnly && (
            <Alert>
              <User className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {disponibles.length} bénéficiaire(s) prévu(s) ce mois: {' '}
                  {disponibles.map(d => `${d.membres?.prenom} ${d.membres?.nom}`).join(', ')}
                </span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowAssignDialog(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Assigner
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Liste des bénéficiaires assignés */}
          {beneficiaires.length > 0 ? (
            <div className="space-y-3">
              {beneficiaires.map((benef: any) => {
                // Calculer le délai depuis l'assignation
                const joursDepuisAssignation = benef.created_at 
                  ? Math.floor((Date.now() - new Date(benef.created_at).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                const isOverdue = benef.statut !== 'paye' && joursDepuisAssignation > 7;
                
                return (
                  <div
                    key={benef.id}
                    className={`p-4 rounded-lg border ${
                      benef.statut === 'paye' 
                        ? 'bg-success/10 border-success/30' 
                        : isOverdue
                          ? 'bg-destructive/10 border-destructive/30'
                          : 'bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-semibold">
                          {benef.membres?.nom} {benef.membres?.prenom}
                        </p>
                        <div className="text-sm space-y-1">
                          <p>
                            <span className="text-muted-foreground">Montant brut:</span>{' '}
                            {formatFCFA(benef.montant_brut || benef.montant_benefice)}
                          </p>
                          {benef.deductions && Object.keys(benef.deductions).length > 0 && (
                            <p className="text-destructive">
                              <span className="text-muted-foreground">Déductions:</span>{' '}
                              -{formatFCFA(Object.values(benef.deductions as Record<string, number>).reduce((a, b) => a + b, 0))}
                            </p>
                          )}
                          <p className="font-semibold text-primary">
                            <span className="text-muted-foreground">Montant net:</span>{' '}
                            {formatFCFA(benef.montant_final || benef.montant_benefice)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge 
                          variant={benef.statut === 'paye' ? 'default' : isOverdue ? 'destructive' : 'secondary'}
                          className={benef.statut === 'paye' ? 'bg-success' : ''}
                        >
                          {benef.statut === 'paye' ? (
                            <><Check className="w-3 h-3 mr-1" />Payé</>
                          ) : benef.statut === 'partiel' ? (
                            'Partiel'
                          ) : isOverdue ? (
                            <><AlertCircle className="w-3 h-3 mr-1" />En retard</>
                          ) : (
                            'Impayé'
                          )}
                        </Badge>
                        {benef.statut !== 'paye' && !isReadOnly && (
                          <Button
                            size="sm"
                            onClick={() => openPayDialog(benef.id)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Marquer payé
                          </Button>
                        )}
                      </div>
                    </div>
                    {benef.date_paiement && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Payé le {new Date(benef.date_paiement).toLocaleDateString('fr-FR')}
                        {benef.notes && ` - ${benef.notes}`}
                      </p>
                    )}
                    {isOverdue && !benef.date_paiement && (
                      <p className="text-xs text-destructive mt-2">
                        ⚠️ En attente depuis {joursDepuisAssignation} jours
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Gift className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Aucun bénéficiaire assigné pour cette réunion</p>
            </div>
          )}

          {/* Statistiques */}
          {beneficiaires.length > 0 && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {formatFCFA(beneficiaires.reduce((sum: number, b: any) => sum + (b.montant_final || b.montant_benefice), 0))}
                </p>
                <p className="text-xs text-muted-foreground">Total à verser</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">
                  {formatFCFA(
                    beneficiaires
                      .filter((b: any) => b.statut === 'paye')
                      .reduce((sum: number, b: any) => sum + (b.montant_final || b.montant_benefice), 0)
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Déjà payé</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog d'assignation */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner un bénéficiaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bénéficiaire prévu</Label>
              <Select 
                value={selectedCalendrierId} 
                onValueChange={(v) => {
                  setSelectedCalendrierId(v);
                  handleCalculate(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le bénéficiaire" />
                </SelectTrigger>
                <SelectContent>
                  {disponibles.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.membres?.prenom} {c.membres?.nom} - {formatFCFA(c.montant_total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isCalculating && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Calcul du montant en cours...
              </div>
            )}

            {calculatedData && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="font-semibold">{calculatedData.membreNom}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Montant mensuel:</span>
                  <span>{formatFCFA(calculatedData.montant_mensuel)}</span>
                  
                  <span className="text-muted-foreground">Montant brut (×12):</span>
                  <span>{formatFCFA(calculatedData.montant_brut)}</span>
                  
                  <span className="text-muted-foreground">Sanctions impayées:</span>
                  <span className="text-destructive">-{formatFCFA(calculatedData.sanctions_impayees)}</span>
                  
                  <span className="font-semibold">Montant net à payer:</span>
                  <span className="font-bold text-primary">{formatFCFA(calculatedData.montant_net)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleAssign} 
              disabled={!calculatedData || assignerBeneficiaire.isPending}
            >
              {assignerBeneficiaire.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de paiement */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Mode de paiement, référence, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handlePay} disabled={marquerPaye.isPending}>
              {marquerPaye.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
