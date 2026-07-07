import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Edit, Download, FileText, Calendar, Users, Clock, Loader2, AlertTriangle, Coins, PiggyBank, HandHeart, Gift } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  generateCompteRenduPDF,
  type PresenceRow,
  type CotisationRow,
  type EpargneRow,
  type SanctionRow,
  type AideRow,
  type BeneficiaireRow,
  type CRRow,
} from '@/lib/compte-rendu-pdf';

import { logger } from "@/lib/logger";
interface Reunion {
  id: string;
  sujet?: string;
  date_reunion: string;
  statut: string;
  lieu_description?: string;
}

interface CompteRenduViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reunion: Reunion | null;
  onEdit?: () => void;
}


export default function CompteRenduViewer({ open, onOpenChange, reunion, onEdit }: CompteRenduViewerProps) {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  // Récupérer les points du compte-rendu
  const { data: comptesRendus, isLoading } = useQuery({
    queryKey: ['comptes-rendus', reunion?.id],
    queryFn: async () => {
      if (!reunion?.id) return [];
      const { data, error } = await supabase
        .from('rapports_seances')
        .select('*')
        .eq('reunion_id', reunion.id)
        .order('numero_ordre', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: open && !!reunion?.id
  });

  // Récupérer les présences depuis reunions_presences
  const { data: presences } = useQuery({
    queryKey: ['reunion-presences-full', reunion?.id],
    queryFn: async () => {
      if (!reunion?.id) return [];
      const { data, error } = await supabase
        .from('reunions_presences')
        .select(`
          statut_presence,
          heure_arrivee,
          observations,
          membres:membre_id (
            nom,
            prenom
          )
        `)
        .eq('reunion_id', reunion.id);

      if (error) throw error;
      return data;
    },
    enabled: open && !!reunion?.id
  });

  // Récupérer les sanctions de la réunion
  const { data: sanctionsReunion } = useQuery({
    queryKey: ['reunion-sanctions-cr', reunion?.id],
    queryFn: async () => {
      if (!reunion?.id) return [];
      const { data, error } = await supabase
        .from('reunions_sanctions')
        .select('*, membre:membre_id(nom, prenom)')
        .eq('reunion_id', reunion.id);
      if (error) throw error;
      return data;
    },
    enabled: open && !!reunion?.id
  });

  // Récupérer les cotisations collectées
  const { data: cotisationsReunion } = useQuery({
    queryKey: ['reunion-cotisations-cr', reunion?.id],
    queryFn: async () => {
      if (!reunion?.id) return [];
      const { data, error } = await supabase
        .from('cotisations')
        .select('*, membre:membre_id(nom, prenom), type:type_cotisation_id(nom)')
        .eq('reunion_id', reunion.id);
      if (error) throw error;
      return data;
    },
    enabled: open && !!reunion?.id
  });

  // Récupérer les épargnes déposées
  const { data: epargnesReunion } = useQuery({
    queryKey: ['reunion-epargnes-cr', reunion?.id],
    queryFn: async () => {
      if (!reunion?.id) return [];
      const { data, error } = await supabase
        .from('epargnes')
        .select('*, membre:membre_id(nom, prenom)')
        .eq('reunion_id', reunion.id);
      if (error) throw error;
      return data;
    },
    enabled: open && !!reunion?.id
  });

  // Récupérer les aides distribuées (par date de la réunion)
  const { data: aidesReunion } = useQuery({
    queryKey: ['reunion-aides-cr', reunion?.id, reunion?.date_reunion],
    queryFn: async () => {
      if (!reunion?.id || !reunion?.date_reunion) return [];
      const { data, error } = await supabase
        .from('aides')
        .select('*, beneficiaire:beneficiaire_id(nom, prenom), type:type_aide_id(nom)')
        .eq('date_allocation', reunion.date_reunion);
      if (error) throw error;
      return data;
    },
    enabled: open && !!reunion?.id
  });

  // Récupérer les bénéficiaires de la réunion
  const { data: beneficiairesReunion } = useQuery({
    queryKey: ['reunion-beneficiaires-cr', reunion?.id],
    queryFn: async () => {
      if (!reunion?.id) return [];
      const { data, error } = await supabase
        .from('reunion_beneficiaires')
        .select('*, membres:membre_id(nom, prenom)')
        .eq('reunion_id', reunion.id);
      if (error) throw error;
      return data;
    },
    enabled: open && !!reunion?.id
  });

  const handleDownloadPDF = async () => {
    if (!reunion?.id) return;
    setDownloading(true);
    try {
      const fileName = await generateCompteRenduPDF({
        reunion,
        presences: presences as PresenceRow[] | undefined,
        comptesRendus: comptesRendus as CRRow[] | undefined,
        cotisationsReunion: cotisationsReunion as CotisationRow[] | undefined,
        epargnesReunion: epargnesReunion as EpargneRow[] | undefined,
        sanctionsReunion: sanctionsReunion as SanctionRow[] | undefined,
        aidesReunion: aidesReunion as AideRow[] | undefined,
        beneficiairesReunion: beneficiairesReunion as BeneficiaireRow[] | undefined,
      });
      toast({
        title: "PDF téléchargé",
        description: `Le fichier ${fileName} a été téléchargé`,
      });
    } catch (error: unknown) {
      logger.error('Erreur téléchargement PDF:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };


  const pointsCRCount = comptesRendus?.length || 0;
  const presentsCount = presences?.filter((p: PresenceRow) => p.statut_presence === 'present').length || 0;
  const excusesCount = presences?.filter((p: PresenceRow) => p.statut_presence === 'absent_excuse').length || 0;
  const absentsNonExcusesCount = presences?.filter((p: PresenceRow) => p.statut_presence === 'absent_non_excuse').length || 0;
  const sanctionsCount = sanctionsReunion?.length || 0;
  const cotisationsCount = cotisationsReunion?.length || 0;
  const epargnesCount = epargnesReunion?.length || 0;
  const aidesCount = aidesReunion?.length || 0;
  const beneficiairesCount = beneficiairesReunion?.length || 0;
  
  const totalMembresPresence = presentsCount + excusesCount + absentsNonExcusesCount;
  const tauxPresenceCalcule = totalMembresPresence > 0 ? Math.round((presentsCount / totalMembresPresence) * 100) : 0;

  const totalCotisations = cotisationsReunion?.reduce((sum: number, c: CotisationRow) => sum + (c.montant || 0), 0) || 0;
  const totalEpargnes = epargnesReunion?.reduce((sum: number, e: EpargneRow) => sum + (e.montant || 0), 0) || 0;
  const totalSanctions = sanctionsReunion?.reduce((sum: number, s: SanctionRow) => sum + (s.montant_amende || 0), 0) || 0;
  const totalAides = aidesReunion?.reduce((sum: number, a: AideRow) => sum + (a.montant || 0), 0) || 0;
  const totalBeneficiaires = (beneficiairesReunion as BeneficiaireRow[] | undefined)?.reduce((sum: number, b: BeneficiaireRow) => sum + (b.montant_final || 0), 0) || 0;

  if (!reunion) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Compte-Rendu de Réunion
          </DialogTitle>
          <DialogDescription>
            Consultation du compte-rendu complet
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 pr-4">
            {/* En-tête */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Informations Générales</span>
                  <Badge variant={reunion.statut === 'terminee' ? 'default' : 'outline'}>
                    {reunion.statut === 'terminee' ? 'Terminée' : reunion.statut}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Sujet:</span>
                  <span>{reunion.sujet || 'Sans titre'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Date:</span>
                  <span>
                    {format(new Date(reunion.date_reunion), 'PPP', { locale: fr })}
                  </span>
                </div>
                {reunion.lieu_description && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Lieu:</span>
                    <span>{reunion.lieu_description}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Taux de présence:</span>
                  <Badge variant={tauxPresenceCalcule >= 75 ? 'default' : tauxPresenceCalcule >= 50 ? 'secondary' : 'destructive'}>
                    {tauxPresenceCalcule}%
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Présents:</span>
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950">{presentsCount}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Excusés:</span>
                    <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950">{excusesCount}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Absents:</span>
                    <Badge variant="destructive">{absentsNonExcusesCount}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Liste des présents */}
            {presentsCount > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Membres Présents ({presentsCount})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {presences?.filter((p: PresenceRow) => p.statut_presence === 'present').map((presence: PresenceRow, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm"
                      >
                        <span>
                          {presence.membres?.prenom} {presence.membres?.nom}
                        </span>
                        {presence.heure_arrivee && (
                          <Badge variant="outline" className="text-xs">Arrivée: {presence.heure_arrivee}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Absents non excusés */}
            {absentsNonExcusesCount > 0 && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Absents Non Excusés ({absentsNonExcusesCount})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {presences?.filter((p: PresenceRow) => p.statut_presence === 'absent_non_excuse').map((presence: PresenceRow, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-sm"
                      >
                        <span className="text-destructive">
                          {presence.membres?.prenom} {presence.membres?.nom}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Points à l'ordre du jour */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Points à l'Ordre du Jour ({pointsCRCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Chargement...
                  </p>
                ) : pointsCRCount === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun point à l'ordre du jour
                  </p>
                ) : (
                  <div className="space-y-4">
                    {comptesRendus?.map((cr: CRRow) => (
                      <div
                        key={cr.id}
                        className="border-l-4 border-primary pl-4 py-2 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-base">
                              {cr.numero_ordre}. {cr.sujet}
                            </p>
                            {cr.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {cr.description}
                              </p>
                            )}
                          </div>
                        </div>
                        {cr.resolution && (
                          <div className="bg-muted p-3 rounded-lg">
                            <p className="text-sm font-medium mb-1">Résolution:</p>
                            <p className="text-sm whitespace-pre-wrap">{cr.resolution}</p>
                          </div>
                        )}
                        {cr.decisions && (
                          <div className="bg-muted p-3 rounded-lg">
                            <p className="text-sm font-medium mb-1">Décisions:</p>
                            <p className="text-sm whitespace-pre-wrap">{cr.decisions}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cotisations collectées */}
            {cotisationsCount > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    Cotisations Collectées ({cotisationsCount})
                    <Badge variant="secondary" className="ml-auto">{totalCotisations.toLocaleString()} FCFA</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {cotisationsReunion?.map((c: CotisationRow) => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted text-sm">
                        <span>{c.membre?.prenom} {c.membre?.nom}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{c.type?.nom || 'Type inconnu'}</Badge>
                          <span className="font-medium">{c.montant?.toLocaleString()} FCFA</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Épargnes déposées */}
            {epargnesCount > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <PiggyBank className="h-4 w-4" />
                    Épargnes Déposées ({epargnesCount})
                    <Badge variant="secondary" className="ml-auto">{totalEpargnes.toLocaleString()} FCFA</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {epargnesReunion?.map((e: EpargneRow) => (
                      <div key={e.id} className="flex items-center justify-between p-2 rounded-lg bg-muted text-sm">
                        <span>{e.membre?.prenom} {e.membre?.nom}</span>
                        <span className="font-medium">{e.montant?.toLocaleString()} FCFA</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sanctions */}
            {sanctionsCount > 0 && (
              <Card className="border-orange-200 dark:border-orange-800">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Sanctions ({sanctionsCount})
                    <Badge variant="destructive" className="ml-auto">{totalSanctions.toLocaleString()} FCFA</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sanctionsReunion?.map((s: SanctionRow) => (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-muted text-sm">
                        <div className="flex items-center gap-2">
                          <span>{s.membre?.prenom} {s.membre?.nom}</span>
                          <span className="text-muted-foreground">- {s.motif || 'Sanction'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={s.statut === 'paye' ? 'default' : 'outline'}>
                            {s.statut === 'paye' ? 'Payé' : 'Impayé'}
                          </Badge>
                          <span className="font-medium">{s.montant_amende?.toLocaleString()} FCFA</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Aides distribuées */}
            {aidesCount > 0 && (
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <HandHeart className="h-4 w-4 text-green-500" />
                    Aides Distribuées ({aidesCount})
                    <Badge className="ml-auto bg-green-600">{totalAides.toLocaleString()} FCFA</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {aidesReunion?.map((a: AideRow) => (
                      <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-muted text-sm">
                        <div className="flex items-center gap-2">
                          <span>{a.beneficiaire?.prenom} {a.beneficiaire?.nom}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{a.type?.nom || 'Aide'}</Badge>
                          <span className="font-medium">{a.montant?.toLocaleString()} FCFA</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bénéficiaires du mois */}
            {beneficiairesCount > 0 && (
              <Card className="border-primary/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    Bénéficiaires du Mois ({beneficiairesCount})
                    <Badge className="ml-auto bg-primary">{totalBeneficiaires.toLocaleString()} FCFA</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(beneficiairesReunion as BeneficiaireRow[] | undefined)?.map((b: BeneficiaireRow) => (
                      <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-muted text-sm">
                        <div className="flex items-center gap-2">
                          <span>{b.membres?.prenom} {b.membres?.nom}</span>
                          {b.deductions && Object.keys(b.deductions).length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              (Déductions: -{Object.values(b.deductions as unknown as Record<string, number>).reduce((a, c) => a + c, 0).toLocaleString()})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={b.statut === 'paye' ? 'default' : 'outline'}>
                            {b.statut === 'paye' ? 'Payé' : 'Impayé'}
                          </Badge>
                          <span className="font-medium">{(b.montant_final || 0).toLocaleString()} FCFA</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          )}
          <Button
            onClick={handleDownloadPDF}
            disabled={downloading || pointsCRCount === 0}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {downloading ? 'Génération...' : 'Télécharger PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
