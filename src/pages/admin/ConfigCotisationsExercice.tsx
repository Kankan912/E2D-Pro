/**
 * ConfigCotisationsExercice (Feature #1)
 *
 * Permet à l'administrateur de configurer les montants de toutes les cotisations
 * pour chaque exercice. Historisé par exercice — aucun impact sur exercices passés.
 */

import { useState, useEffect } from 'react';
import { Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useExerciceCotisationConfig, useSaveExerciceCotisationConfig } from '@/hooks/useEvolutionV5';
import { useExercices } from '@/hooks/useCotisations';
import { formatFCFA } from '@/lib/financial-calculations';
import { toast } from 'sonner';
import BackButton from '@/components/BackButton';

export default function ConfigCotisationsExercice() {
  const [selectedExercice, setSelectedExercice] = useState<string>('');
  const [form, setForm] = useState({
    cotisation_mensuelle_montant: 0,
    fond_sport_montant: 0,
    fond_investissement_montant: 0,
    fond_caisse_montant: 0,
    nb_mois_exercice: 12,
  });

  const { data: exercices } = useExercices();
  const { data: configs, isLoading } = useExerciceCotisationConfig(selectedExercice || undefined);
  const saveMutation = useSaveExerciceCotisationConfig();

  // Auto-sélectionner le premier exercice
  useEffect(() => {
    if (!selectedExercice && exercices && exercices.length > 0) {
      const actif = exercices.find((e: { statut: string }) => e.statut === 'actif') ?? exercices[0];
      setSelectedExercice(actif.id);
    }
  }, [exercices, selectedExercice]);

  // Charger la config quand l'exercice change
  useEffect(() => {
    if (!selectedExercice || !configs) return;
    const config = configs.find((c) => c.exercice_id === selectedExercice);
    if (config) {
      setForm({
        cotisation_mensuelle_montant: config.cotisation_mensuelle_montant ?? 0,
        fond_sport_montant: config.fond_sport_montant ?? 0,
        fond_investissement_montant: config.fond_investissement_montant ?? 0,
        fond_caisse_montant: config.fond_caisse_montant ?? 0,
        nb_mois_exercice: config.nb_mois_exercice ?? 12,
      });
    } else {
      setForm({
        cotisation_mensuelle_montant: 0,
        fond_sport_montant: 0,
        fond_investissement_montant: 0,
        fond_caisse_montant: 0,
        nb_mois_exercice: 12,
      });
    }
  }, [selectedExercice, configs]);

  const handleSave = () => {
    if (!selectedExercice) {
      toast.error('Veuillez sélectionner un exercice');
      return;
    }
    saveMutation.mutate({
      exercice_id: selectedExercice,
      ...form,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Configuration des Cotisations
            </h1>
            <p className="text-sm text-muted-foreground">
              Les montants sont historisés par exercice · Aucun impact sur les exercices passés
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Choisir l'exercice</CardTitle>
            <CardDescription>
              Sélectionnez l'exercice à configurer. Chaque exercice a ses propres montants.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedExercice} onValueChange={setSelectedExercice}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un exercice" /></SelectTrigger>
              <SelectContent>
                {(exercices ?? []).map((ex: { id: string; nom: string; statut: string; date_debut: string; date_fin: string }) => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.nom} ({ex.date_debut} → {ex.date_fin}) {ex.statut === 'actif' && '· Actif'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Montants des cotisations</CardTitle>
            <CardDescription>
              Ces montants s'appliquent uniquement à l'exercice sélectionné.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ConfigField
                label="Cotisation mensuelle"
                value={form.cotisation_mensuelle_montant}
                onChange={(v) => setForm({ ...form, cotisation_mensuelle_montant: v })}
              />
              <ConfigField
                label="Fond sport"
                value={form.fond_sport_montant}
                onChange={(v) => setForm({ ...form, fond_sport_montant: v })}
              />
              <ConfigField
                label="Fond d'investissement"
                value={form.fond_investissement_montant}
                onChange={(v) => setForm({ ...form, fond_investissement_montant: v })}
              />
              <ConfigField
                label="Fond de caisse"
                value={form.fond_caisse_montant}
                onChange={(v) => setForm({ ...form, fond_caisse_montant: v })}
              />
              <div>
                <Label>Nombre de mois de l'exercice</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={form.nb_mois_exercice}
                  onChange={(e) => setForm({ ...form, nb_mois_exercice: parseInt(e.target.value) || 12 })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Utilisé pour calculer le bénéfice prévisionnel des membres
                </p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer la configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {selectedExercice && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Historisation :</strong> Ces montants seront figés pour cet exercice.
                Si vous créez un nouvel exercice, vous pourrez définir de nouveaux montants sans
                affecter les données passées.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ConfigField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        placeholder="Montant en FCFA"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Aperçu : {formatFCFA(value)}
      </p>
    </div>
  );
}
