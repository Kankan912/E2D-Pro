/**
 * EventBudgetManager (Feature #10)
 *
 * Affiche pour un événement :
 *  - budget prévu
 *  - dépenses (ajout/suppression)
 *  - responsable financier
 *  - financement
 *  - budget consommé (%)
 *  - reste disponible
 */

import { useState } from 'react';
import { Plus, Trash2, Wallet, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useEventExpenses, useAddEventExpense } from '@/hooks/useEvolutionV5';
import { calculerBudgetEvent, formatFCFA, roundMoney } from '@/lib/financial-calculations';
import { toast } from 'sonner';

interface EventBudgetManagerProps {
  eventId: string;
  budgetPrevu: number;
}

export function EventBudgetManager({ eventId, budgetPrevu }: EventBudgetManagerProps) {
  const { data: expenses, isLoading } = useEventExpenses(eventId);
  const addExpense = useAddEventExpense();
  const [showAddForm, setShowAddForm] = useState(false);
  const [libelle, setLibelle] = useState('');
  const [montant, setMontant] = useState(0);

  const budget = calculerBudgetEvent(
    budgetPrevu,
    (expenses ?? []).map((e: { montant: number }) => ({ montant: e.montant }))
  );

  const handleAdd = async () => {
    if (!libelle || montant <= 0) {
      toast.error('Libellé et montant requis');
      return;
    }
    addExpense.mutate({
      event_id: eventId,
      libelle,
      montant,
    });
    setLibelle('');
    setMontant(0);
    setShowAddForm(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Budget de l'événement
        </CardTitle>
        <CardDescription>Suivi du budget et des dépenses en temps réel</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Synthèse budget */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-muted-foreground">Budget prévu</p>
            <p className="text-lg font-bold text-blue-600">{formatFCFA(budget.budget_prevu)}</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <p className="text-xs text-muted-foreground">Dépensé</p>
            <p className="text-lg font-bold text-orange-600">{formatFCFA(budget.total_depenses)}</p>
          </div>
          <div className={`text-center p-3 rounded-lg ${budget.reste_disponible >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-xs text-muted-foreground">Reste</p>
            <p className={`text-lg font-bold ${budget.reste_disponible >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatFCFA(budget.reste_disponible)}
            </p>
          </div>
        </div>

        {/* Barre de progression */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Budget consommé</span>
            <span className="font-semibold">{budget.budget_consomme_pct}%</span>
          </div>
          <Progress
            value={budget.budget_consomme_pct}
            className={budget.budget_consomme_pct > 100 ? 'bg-red-200' : ''}
          />
        </div>

        {/* Liste des dépenses */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Dépenses</h4>
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>

          {showAddForm && (
            <div className="grid grid-cols-[1fr_120px_auto] gap-2 p-3 border rounded">
              <Input
                placeholder="Libellé"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Montant"
                value={montant}
                onChange={(e) => setMontant(parseInt(e.target.value) || 0)}
              />
              <Button size="sm" onClick={handleAdd}>OK</Button>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : (expenses ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Aucune dépense enregistrée</p>
          ) : (
            (expenses ?? []).map((exp: { id: string; libelle: string; montant: number; date_depense: string }) => (
              <div key={exp.id} className="flex items-center gap-2 p-2 border rounded text-sm">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="flex-1">{exp.libelle}</span>
                <span className="font-medium">{formatFCFA(roundMoney(exp.montant))}</span>
                <span className="text-xs text-muted-foreground">{exp.date_depense}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
