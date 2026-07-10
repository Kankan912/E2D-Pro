'use client';

/**
 * @module AideWorkflowConfig
 * Workflow configuration component for managing aide approval steps.
 * Displays ordered workflow steps with drag-to-reorder, add/edit, and active toggle.
 *
 * Multi-tenant: scoped by associationId.
 */
import { useState, useCallback } from 'react';
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Save,
  Clock,
  Shield,
  Users,
  Zap,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAideWorkflowConfig, useUpdateAideWorkflowConfig } from '@/hooks/useAidePhase2';
import type { WorkflowStep } from '@/hooks/useAidePhase2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AideWorkflowConfigProps {
  associationId: string;
}

interface StepFormData {
  nom: string;
  description: string;
  validateur_role: string;
  est_obligatoire: boolean;
  delai_max_heures: number | null;
}

const STEP_TYPE_OPTIONS = [
  { value: 'admin', label: 'Administrateur', icon: Shield },
  { value: 'committee', label: 'Comité', icon: Users },
  { value: 'auto', label: 'Automatique', icon: Zap },
] as const;

const VALIDATEUR_ROLES = [
  { value: 'administrateur', label: 'Administrateur' },
  { value: 'tresorier', label: 'Trésorier' },
  { value: 'secretaire_general', label: 'Secrétaire Général' },
  { value: 'president', label: 'Président' },
  { value: 'comite_validation', label: 'Comité de validation' },
] as const;

const DEFAULT_STEP_FORM: StepFormData = {
  nom: '',
  description: '',
  validateur_role: 'administrateur',
  est_obligatoire: true,
  delai_max_heures: 48,
};

// ---------------------------------------------------------------------------
// Helper: infer step type from validateur_role
// ---------------------------------------------------------------------------

function getStepType(validateurRole: string | null): string {
  if (!validateurRole) return 'auto';
  if (validateurRole === 'comite_validation') return 'committee';
  return 'admin';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AideWorkflowConfig({ associationId }: AideWorkflowConfigProps) {
  const { data: config, isLoading, isError, error } = useAideWorkflowConfig(associationId);
  const updateMutation = useUpdateAideWorkflowConfig(associationId);

  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [stepForm, setStepForm] = useState<StepFormData>(DEFAULT_STEP_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Sync fetched config to local state
  const syncedSteps = config?.etapes ?? [];
  const workingSteps = syncedSteps.length > 0 || steps.length > 0 ? steps.length > 0 ? steps : syncedSteps : [];

  const hasChanges = JSON.stringify(workingSteps) !== JSON.stringify(syncedSteps);

  // ---- Handlers ----

  const handleOpenAdd = useCallback(() => {
    setStepForm(DEFAULT_STEP_FORM);
    setEditingStep(null);
    setIsAddingStep(true);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((step: WorkflowStep) => {
    setStepForm({
      nom: step.nom,
      description: step.description ?? '',
      validateur_role: step.validateur_role ?? 'administrateur',
      est_obligatoire: step.est_obligatoire,
      delai_max_heures: step.delai_max_heures,
    });
    setEditingStep(step);
    setIsAddingStep(false);
    setDialogOpen(true);
  }, []);

  const handleSaveStep = useCallback(() => {
    if (!stepForm.nom.trim()) return;

    if (isAddingStep) {
      const newStep: WorkflowStep = {
        id: `temp-${Date.now()}`,
        association_id: associationId,
        rang: workingSteps.length + 1,
        nom: stepForm.nom.trim(),
        description: stepForm.description.trim() || null,
        validateur_role: stepForm.validateur_role,
        est_obligatoire: stepForm.est_obligatoire,
        delai_max_heures: stepForm.delai_max_heures,
        created_at: new Date().toISOString(),
      };
      setSteps((prev) => (prev.length > 0 ? prev : syncedSteps).concat(newStep));
    } else if (editingStep) {
      setSteps((prev) => {
        const base = prev.length > 0 ? prev : syncedSteps;
        return base.map((s) =>
          s.id === editingStep.id
            ? {
                ...s,
                nom: stepForm.nom.trim(),
                description: stepForm.description.trim() || null,
                validateur_role: stepForm.validateur_role,
                est_obligatoire: stepForm.est_obligatoire,
                delai_max_heures: stepForm.delai_max_heures,
              }
            : s
        );
      });
    }

    setDialogOpen(false);
  }, [stepForm, isAddingStep, editingStep, workingSteps, syncedSteps, associationId]);

  const handleRemoveStep = useCallback(
    (stepId: string) => {
      setSteps((prev) => {
        const base = prev.length > 0 ? prev : syncedSteps;
        return base
          .filter((s) => s.id !== stepId)
          .map((s, i) => ({ ...s, rang: i + 1 }));
      });
    },
    [syncedSteps]
  );

  const handleToggleActive = useCallback(
    (stepId: string) => {
      setSteps((prev) => {
        const base = prev.length > 0 ? prev : syncedSteps;
        return base.map((s) =>
          s.id === stepId ? { ...s, est_obligatoire: !s.est_obligatoire } : s
        );
      });
    },
    [syncedSteps]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      setSteps((prev) => {
        const base = prev.length > 0 ? prev : syncedSteps;
        const newSteps = [...base];
        const temp = newSteps[index];
        newSteps[index] = newSteps[index - 1];
        newSteps[index - 1] = temp;
        return newSteps.map((s, i) => ({ ...s, rang: i + 1 }));
      });
    },
    [syncedSteps]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      setSteps((prev) => {
        const base = prev.length > 0 ? prev : syncedSteps;
        if (index >= base.length - 1) return base;
        const newSteps = [...base];
        const temp = newSteps[index];
        newSteps[index] = newSteps[index + 1];
        newSteps[index + 1] = temp;
        return newSteps.map((s, i) => ({ ...s, rang: i + 1 }));
      });
    },
    [syncedSteps]
  );

  const handleSave = useCallback(() => {
    if (!config?.id) return;
    const stepsToSave = (steps.length > 0 ? steps : syncedSteps).map((s) => ({
      nom: s.nom,
      description: s.description,
      validateur_role: s.validateur_role,
      est_obligatoire: s.est_obligatoire,
      delai_max_heures: s.delai_max_heures,
    }));
    updateMutation.mutate({ configId: config.id, etapes: stepsToSave });
    setSteps([]);
  }, [config, steps, syncedSteps, updateMutation]);

  // ---- Render ----

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{(error as Error & { message?: string })?.message ?? 'Erreur de chargement'}</span>
        </CardContent>
      </Card>
    );
  }

  const displaySteps = steps.length > 0 ? steps : syncedSteps;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Configuration du workflow de validation</CardTitle>
        <Button size="sm" onClick={handleOpenAdd}>
          <Plus className="mr-1 h-4 w-4" />
          Étape
        </Button>
      </CardHeader>

      <CardContent>
        {displaySteps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="mb-3 h-10 w-10" />
            <p className="text-sm">Aucune étape configurée.</p>
            <p className="text-xs">Ajoutez des étapes pour définir le processus de validation.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displaySteps.map((step, index) => {
              const stepType = getStepType(step.validateur_role);
              const typeInfo = STEP_TYPE_OPTIONS.find((t) => t.value === stepType) ?? STEP_TYPE_OPTIONS[0];
              const TypeIcon = typeInfo.icon;

              return (
                <div
                  key={step.id}
                  className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  {/* Grip handle */}
                  <div className="flex flex-col gap-0.5 text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      className="cursor-pointer rounded p-0.5 hover:bg-muted disabled:opacity-30"
                      disabled={index === 0}
                    >
                      <GripVertical className="h-4 w-4 rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      className="cursor-pointer rounded p-0.5 hover:bg-muted disabled:opacity-30"
                      disabled={index === displaySteps.length - 1}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Step number */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                    {step.rang}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{step.nom}</span>
                      <Badge variant="outline" className="shrink-0 gap-1">
                        <TypeIcon className="h-3 w-3" />
                        {typeInfo.label}
                      </Badge>
                      {step.est_obligatoire && (
                        <Badge variant="secondary" className="shrink-0">Obligatoire</Badge>
                      )}
                    </div>
                    {step.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">{step.description}</p>
                    )}
                    {step.delai_max_heures && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {step.delai_max_heures}h max
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={step.est_obligatoire}
                      onCheckedChange={() => handleToggleActive(step.id)}
                      aria-label="Activer/Désactiver l'étape"
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(step)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveStep(step.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Save button */}
        {hasChanges && (
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Enregistrer la configuration
            </Button>
          </div>
        )}
      </CardContent>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isAddingStep ? 'Ajouter une étape' : 'Modifier l\'étape'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="step-nom">Nom de l&apos;étape</Label>
              <Input
                id="step-nom"
                placeholder="Ex: Validation président"
                value={stepForm.nom}
                onChange={(e) => setStepForm((f) => ({ ...f, nom: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="step-desc">Description</Label>
              <Input
                id="step-desc"
                placeholder="Description facultative"
                value={stepForm.description}
                onChange={(e) => setStepForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="step-role">Validateur / Rôle</Label>
              <Select
                value={stepForm.validateur_role}
                onValueChange={(v) => setStepForm((f) => ({ ...f, validateur_role: v }))}
              >
                <SelectTrigger id="step-role">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {VALIDATEUR_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="step-delai">Délai maximum (heures)</Label>
              <Input
                id="step-delai"
                type="number"
                min={0}
                placeholder="48"
                value={stepForm.delai_max_heures ?? ''}
                onChange={(e) =>
                  setStepForm((f) => ({
                    ...f,
                    delai_max_heures: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="step-obligatoire"
                checked={stepForm.est_obligatoire}
                onCheckedChange={(checked) =>
                  setStepForm((f) => ({ ...f, est_obligatoire: checked }))
                }
              />
              <Label htmlFor="step-obligatoire">Étape obligatoire</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveStep} disabled={!stepForm.nom.trim()}>
              {isAddingStep ? 'Ajouter' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
