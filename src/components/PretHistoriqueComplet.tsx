import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Banknote, 
  RefreshCw, 
  Calendar, 
  ArrowRight,
  Check,
  Clock
} from "lucide-react";
import { formatFCFA } from "@/lib/utils";
import { calculerResumePret } from "@/lib/pretCalculsService";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PretHistoriqueCompletProps {
  pret: any;
  paiements: any[];
  reconductions: any[];
}

interface HistoryEvent {
  date: Date;
  type: 'creation' | 'paiement' | 'reconduction';
  montant?: number;
  description: string;
  details?: string;
  icon: React.ReactNode;
  color: string;
}

export default function PretHistoriqueComplet({ pret, paiements, reconductions }: PretHistoriqueCompletProps) {
  // Construire une timeline chronologique
  const timeline = useMemo(() => {
    const events: HistoryEvent[] = [];

    // 1. Création du prêt
    events.push({
      date: new Date(pret.date_pret),
      type: 'creation',
      montant: pret.montant,
      description: `Prêt accordé`,
      details: `Capital: ${formatFCFA(pret.montant)} | Intérêt initial: ${formatFCFA(pret.interet_initial || pret.montant * (pret.taux_interet || 5) / 100)} (${pret.taux_interet || 5}%)`,
      icon: <Banknote className="h-4 w-4" />,
      color: 'bg-primary'
    });

    // 2. Ajouter les paiements
    paiements?.forEach(p => {
      events.push({
        date: new Date(p.date_paiement),
        type: 'paiement',
        montant: p.montant_paye,
        description: `Paiement reçu`,
        details: `${p.type_paiement || 'Mixte'} - ${p.mode_paiement || 'Espèces'}${p.notes ? ` - ${p.notes}` : ''}`,
        icon: <Check className="h-4 w-4" />,
        color: 'bg-success'
      });
    });

    // 3. Ajouter les reconductions
    reconductions?.forEach((r, index) => {
      events.push({
        date: new Date(r.date_reconduction),
        type: 'reconduction',
        montant: r.interet_mois,
        description: `Reconduction #${index + 1}`,
        details: r.notes || `Nouvel intérêt appliqué: ${formatFCFA(r.interet_mois)}`,
        icon: <RefreshCw className="h-4 w-4" />,
        color: 'bg-blue-500'
      });
    });

    // Trier par date décroissante (plus récent en premier)
    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [pret, paiements, reconductions]);

  // Calculer les totaux via le service centralisé
  const calculs = calculerResumePret(
    { montant: pret.montant, taux_interet: pret.taux_interet, interet_initial: pret.interet_initial, reconductions: pret.reconductions, montant_paye: pret.montant_paye },
    paiements?.map(p => ({ montant_paye: p.montant_paye, date_paiement: p.date_paiement })),
    reconductions?.map(r => ({ date_reconduction: r.date_reconduction, interet_mois: r.interet_mois }))
  );
  const { totalInterets: interetInitialPlusRecon, totalDu, totalPaye: totalPaiements, resteAPayer } = calculs;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Historique Complet
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Résumé */}
        <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-muted/50 rounded-lg text-sm">
          <div className="text-center">
            <p className="text-muted-foreground">Capital</p>
            <p className="font-bold">{formatFCFA(pret.montant)}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Total Intérêts</p>
            <p className="font-bold text-amber-600">{formatFCFA(interetInitialPlusRecon)}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Total Payé</p>
            <p className="font-bold text-success">{formatFCFA(totalPaiements)}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Reste</p>
            <p className={`font-bold ${resteAPayer > 0 ? 'text-destructive' : 'text-success'}`}>
              {formatFCFA(resteAPayer)}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <ScrollArea className="h-[300px] pr-4">
          <div className="relative">
            {/* Ligne verticale */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-4">
              {timeline.map((event, index) => (
                <div key={index} className="relative flex gap-4 pl-2">
                  {/* Point sur la timeline */}
                  <div className={`relative z-10 w-8 h-8 rounded-full ${event.color} flex items-center justify-center text-white shrink-0`}>
                    {event.icon}
                  </div>
                  
                  {/* Contenu */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{event.description}</span>
                      <Badge variant="outline" className="text-xs">
                        {format(event.date, "dd MMM yyyy", { locale: fr })}
                      </Badge>
                    </div>
                    
                    {event.montant && (
                      <p className={`text-lg font-bold ${
                        event.type === 'paiement' ? 'text-success' : 
                        event.type === 'reconduction' ? 'text-amber-600' : 
                        'text-primary'
                      }`}>
                        {event.type === 'paiement' ? '+' : ''}{formatFCFA(event.montant)}
                      </p>
                    )}
                    
                    {event.details && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {event.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        {timeline.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Aucun historique disponible
          </p>
        )}
      </CardContent>
    </Card>
  );
}
