import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { History, ArrowRight } from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciceId: string;
}

interface AuditRow {
  id: string;
  membre_id: string;
  montant_avant: number | null;
  montant_apres: number;
  modifie_par: string | null;
  raison: string | null;
  created_at: string;
}

export function CotisationsMensuellesAuditDialog({ open, onOpenChange, exerciceId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['cotisations-mensuelles-audit', exerciceId],
    queryFn: async () => {
      const { data: audits, error } = await supabase
        .from('cotisations_mensuelles_audit')
        .select('id, membre_id, montant_avant, montant_apres, modifie_par, raison, created_at')
        .eq('exercice_id', exerciceId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const membreIds = [...new Set((audits ?? []).map(a => a.membre_id))];
      const userIds = [...new Set((audits ?? []).map(a => a.modifie_par).filter(Boolean) as string[])];

      const [membresRes, profilesRes] = await Promise.all([
        membreIds.length
          ? supabase.from('membres').select('id, nom, prenom').in('id', membreIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        userIds.length
          ? supabase.from('profiles').select('id, nom, prenom').in('id', userIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const membresMap = new Map((membresRes.data ?? []).map((m: any) => [m.id, `${m.prenom} ${m.nom}`]));
      const profilesMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || 'Utilisateur']));

      return (audits as AuditRow[]).map(a => ({
        ...a,
        membre_label: membresMap.get(a.membre_id) ?? 'Membre supprimé',
        auteur_label: a.modifie_par ? (profilesMap.get(a.modifie_par) ?? 'Utilisateur') : 'Système',
      }));
    },
    enabled: open && !!exerciceId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des modifications
          </DialogTitle>
          <DialogDescription>
            100 dernières modifications de cotisations mensuelles pour cet exercice.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucune modification enregistrée.</p>
          ) : (
            <ul className="space-y-2">
              {data.map(entry => (
                <li key={entry.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-medium">{entry.membre_label}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{formatFCFA(entry.montant_avant ?? 0)}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge>{formatFCFA(entry.montant_apres)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Par <strong>{entry.auteur_label}</strong>
                    {entry.raison && <> — « {entry.raison} »</>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
