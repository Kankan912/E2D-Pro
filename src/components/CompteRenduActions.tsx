import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, FileText, CheckCircle, Users, UserPlus, UserMinus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

import { logger } from "@/lib/logger";
interface Reunion {
  id: string;
  sujet?: string;
  date_reunion: string;
  statut: string;
}

interface CompteRenduActionsProps {
  reunion: Reunion;
  onSuccess?: () => void;
}

interface Membre {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
}

export default function CompteRenduActions({ reunion, onSuccess }: CompteRenduActionsProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Récupérer tous les membres
  const { data: allMembers } = useQuery({
    queryKey: ['all-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom, email')
        .eq('statut', 'actif')
        .order('nom');

      if (error) throw error;
      return data as Membre[];
    },
    enabled: open
  });

  // Récupérer les membres présents à la réunion
  const { data: presences } = useQuery({
    queryKey: ['reunion-presences', reunion.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions_presences')
        .select('membre_id')
        .eq('reunion_id', reunion.id)
        .eq('statut_presence', 'present');

      if (error) throw error;
      return data?.map(p => p.membre_id) || [];
    },
    enabled: open
  });

  // Récupérer les points du compte-rendu
  const { data: comptesRendus } = useQuery({
    queryKey: ['comptes-rendus', reunion.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rapports_seances')
        .select('*')
        .eq('reunion_id', reunion.id)
        .order('numero_ordre', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Pré-sélectionner les membres présents
  useEffect(() => {
    if (presences && allMembers) {
      const presentMembersWithEmail = presences.filter(id => {
        const member = allMembers.find(m => m.id === id);
        return member?.email;
      });
      setSelectedMembers(new Set(presentMembersWithEmail));
    }
  }, [presences, allMembers]);

  const toggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const selectAllWithEmail = () => {
    const membersWithEmail = allMembers?.filter(m => m.email).map(m => m.id) || [];
    setSelectedMembers(new Set(membersWithEmail));
  };

  const deselectAll = () => {
    setSelectedMembers(new Set());
  };

  const handleConfirmerEtNotifier = async () => {
    setSending(true);
    try {
      // Récupérer les destinataires avec leurs infos complètes pour l'edge function
      const destinataires = allMembers
        ?.filter(m => selectedMembers.has(m.id) && m.email)
        .map(m => ({
          email: m.email!,
          nom: m.nom,
          prenom: m.prenom
        })) || [];

      if (destinataires.length === 0) {
        toast({
          title: "Erreur",
          description: "Aucun membre sélectionné avec email valide",
          variant: "destructive",
        });
        return;
      }

      // Préparer la liste des présents
      const presentsNames = allMembers
        ?.filter(m => presences?.includes(m.id))
        .map(m => `${m.prenom} ${m.nom}`)
        .join(', ') || 'Aucun';

      // Préparer le contenu du CR
      const contenuCR = comptesRendus
        ?.map((cr: any, index: number) =>
          `${index + 1}. ${cr.sujet}\n   Résolution: ${cr.resolution || 'Aucune résolution'}`
        )
        .join('\n\n') || 'Aucun point à l\'ordre du jour';

      const fullContent = `PRÉSENTS (${presences?.length || 0}):\n${presentsNames}\n\n---\n\nORDRE DU JOUR:\n\n${contenuCR}`;

      // Appeler l'edge function pour envoyer les emails
      const { data, error } = await supabase.functions.invoke('send-reunion-cr', {
        body: {
          reunionId: reunion.id,
          destinataires,
          sujet: reunion.sujet || 'Réunion',
          contenu: fullContent,
          dateReunion: reunion.date_reunion
        }
      });

      if (error) {
        const errorMessage = data?.error || error.message;
        throw new Error(errorMessage);
      }
      if (data?.error) throw new Error(data.error);

      // Mettre à jour le statut de la réunion
      await supabase
        .from('reunions')
        .update({ statut: 'terminee' })
        .eq('id', reunion.id);

      toast({
        title: "Succès",
        description: `Compte-rendu envoyé à ${destinataires.length} membre(s)`,
      });

      setOpen(false);
      onSuccess?.();
    } catch (error: unknown) {
      logger.error('Erreur envoi CR:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le compte-rendu: " + (error instanceof Error ? error.message : "Erreur"),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const totalMembers = allMembers?.length || 0;
  const membersWithEmail = allMembers?.filter(m => m.email).length || 0;
  const selectedCount = selectedMembers.size;
  const pointsCRCount = comptesRendus?.length || 0;
  const presentsCount = presences?.length || 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-primary to-secondary">
          <Send className="w-4 h-4 mr-2" />
          Confirmer et Notifier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Envoi du Compte-Rendu
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les destinataires et confirmez l'envoi
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Résumé */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Résumé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Réunion</span>
                <Badge>{reunion.sujet || 'Sans titre'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Date</span>
                <span className="text-sm font-medium">
                  {new Date(reunion.date_reunion).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Points à l'ordre du jour</span>
                <Badge variant="outline">{pointsCRCount}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Présents enregistrés</span>
                <Badge variant="secondary">{presentsCount}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Sélection des destinataires */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Destinataires ({selectedCount}/{membersWithEmail} avec email)
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={selectAllWithEmail}>
                    <UserPlus className="h-3 w-3 mr-1" />
                    Tous
                  </Button>
                  <Button size="sm" variant="outline" onClick={deselectAll}>
                    <UserMinus className="h-3 w-3 mr-1" />
                    Aucun
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Cochez les membres qui recevront le compte-rendu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {allMembers?.map((member) => {
                    const isPresent = presences?.includes(member.id);
                    const hasEmail = !!member.email;
                    
                    return (
                      <div
                        key={member.id}
                        className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                          selectedMembers.has(member.id) 
                            ? 'bg-primary/10 border border-primary/20' 
                            : 'bg-muted'
                        } ${!hasEmail ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedMembers.has(member.id)}
                            onCheckedChange={() => hasEmail && toggleMember(member.id)}
                            disabled={!hasEmail}
                          />
                          <div>
                            <span className="text-sm font-medium">
                              {member.prenom} {member.nom}
                            </span>
                            {isPresent && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Présent
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {member.email || 'Pas d\'email'}
                        </span>
                      </div>
                    );
                  })}
                  {totalMembers === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucun membre trouvé
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Aperçu du contenu */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Aperçu du Contenu</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-32">
                <div className="text-sm space-y-2 whitespace-pre-wrap">
                  {comptesRendus?.map((cr: any, index: number) => (
                    <div key={cr.id} className="border-l-2 border-primary pl-3">
                      <p className="font-medium">
                        Point {index + 1}: {cr.sujet}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {cr.resolution || 'Aucune résolution'}
                      </p>
                    </div>
                  ))}
                  {pointsCRCount === 0 && (
                    <p className="text-muted-foreground text-center py-4">
                      Aucun point à l'ordre du jour
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleConfirmerEtNotifier}
              disabled={sending || selectedCount === 0 || pointsCRCount === 0}
              className="bg-gradient-to-r from-primary to-secondary"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {sending ? "Envoi en cours..." : `Envoyer à ${selectedCount} membre(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
