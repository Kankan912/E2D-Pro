'use client';

/**
 * @module AideValidationTimeline
 * Vertical timeline showing all validation steps for a specific aide.
 * Each step shows validator name, date, status, and comment.
 * Pending steps show a "pending" indicator; current step offers approve/reject buttons.
 *
 * Multi-tenant: scoped by associationId.
 */
import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  User,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import AideStatusBadge from '@/components/ui/AideStatusBadge';
import {
  useAideValidationHistory,
  useCanValidateAide,
  useApproveAide,
  useRejectAide,
  type AideValidationHistoryEntry,
} from '@/hooks/useAideValidation';
import {
  useAides,
  type Aide,
} from '@/hooks/useAides';
import {
  AIDE_STATUT_LABELS,
  type AideStatut,
} from '@/lib/aide-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AideValidationTimelineProps {
  associationId: string;
  aideId: string;
}

type TimelineStatus = 'completed' | 'pending' | 'current' | 'future';

interface TimelineEntry {
  historyEntry: AideValidationHistoryEntry | null;
  status: TimelineStatus;
  statutLabel: string;
  validatorName: string;
  date: string | null;
  comment: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatutBadgeVariant(
  statut: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (statut === 'approuvee' || statut === 'payee' || statut === 'soumise')
    return 'default';
  if (statut === 'refusee') return 'destructive';
  if (statut === 'en_validation' || statut === 'brouillon') return 'secondary';
  return 'outline';
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AideValidationTimeline({
  associationId,
  aideId,
}: AideValidationTimelineProps) {
  const {
    data: history,
    isLoading,
    isError,
    error,
  } = useAideValidationHistory(associationId, aideId);
  const { data: canValidate, isLoading: loadingPerm } = useCanValidateAide(associationId);
  const { data: aidesData } = useAides(associationId);
  const approveMutation = useApproveAide(associationId);
  const rejectMutation = useRejectAide(associationId);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  // Find current aide
  const currentAide: Aide | undefined = useMemo(
    () => aidesData?.find((a) => a.id === aideId),
    [aidesData, aideId]
  );

  // Build timeline entries from validation history
  const timelineEntries: TimelineEntry[] = useMemo(() => {
    if (!history || history.length === 0) {
      // No history yet – show initial state
      if (!currentAide) return [];
      return [
        {
          historyEntry: null,
          status: 'current',
          statutLabel: AIDE_STATUT_LABELS[currentAide.statut as AideStatut] ?? currentAide.statut,
          validatorName: '',
          date: null,
          comment: null,
        },
      ];
    }

    const entries: TimelineEntry[] = history.map((entry, idx) => {
      const isLast = idx === history.length - 1;
      const status: TimelineStatus = isLast ? 'completed' : 'completed';

      return {
        historyEntry: entry,
        status,
        statutLabel: AIDE_STATUT_LABELS[entry.statut_apres as AideStatut] ?? entry.statut_apres,
        validatorName:
          entry.profil
            ? `${entry.profil.prenom} ${entry.profil.nom}`.trim()
            : entry.effectue_par
              ? 'Utilisateur'
              : 'Système',
        date: entry.created_at,
        comment: entry.commentaire,
      };
    });

    // If current status is en_validation, add a pending entry
    if (currentAide && currentAide.statut === 'en_validation') {
      entries.push({
        historyEntry: null,
        status: 'pending',
        statutLabel: 'En attente de validation',
        validatorName: 'Prochain validateur',
        date: null,
        comment: null,
      });
    }

    return entries;
  }, [history, currentAide]);

  const canShowActions = useMemo(() => {
    return (
      canValidate === true &&
      currentAide?.statut === 'en_validation'
    );
  }, [canValidate, currentAide]);

  const isActing = approveMutation.isPending || rejectMutation.isPending;

  const handleApprove = () => {
    approveMutation.mutate({ aideId });
  };

  const handleReject = () => {
    rejectMutation.mutate({ aideId, commentaire: rejectComment || undefined });
    setRejectDialogOpen(false);
    setRejectComment('');
  };

  // ---- Render: Loading ----

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
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

  // ---- Render: Timeline ----

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historique de validation
          </CardTitle>
          {currentAide && (
            <div className="mt-1">
              <AideStatusBadge statut={currentAide.statut} />
            </div>
          )}
        </CardHeader>

        <CardContent>
          {timelineEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="mb-2 h-8 w-8" />
              <p className="text-sm">Aucune étape de validation enregistrée.</p>
            </div>
          ) : (
            <div className="relative space-y-0">
              {timelineEntries.map((entry, index) => {
                const isFirst = index === 0;
                const isLast = index === timelineEntries.length - 1;

                return (
                  <div key={index} className="flex gap-4 pb-6 last:pb-0">
                    {/* Timeline line and dot */}
                    <div className="flex flex-col items-center">
                      {/* Dot */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                          entry.status === 'completed'
                            ? 'border-emerald-500 bg-emerald-100 text-emerald-700'
                            : entry.status === 'pending'
                              ? 'border-amber-500 bg-amber-100 text-amber-700'
                              : 'border-muted-foreground/30 bg-muted text-muted-foreground'
                        }`}
                      >
                        {entry.status === 'completed' ? (
                          entry.statutLabel === 'Refusée' ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )
                        ) : entry.status === 'pending' ? (
                          <Clock className="h-4 w-4 animate-pulse" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>

                      {/* Connector line */}
                      {!isLast && (
                        <div className="w-0.5 flex-1 bg-border" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getStatutBadgeVariant(entry.historyEntry?.statut_apres ?? '')}>
                          {entry.statutLabel}
                        </Badge>
                        {entry.date && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(entry.date)}
                          </span>
                        )}
                      </div>

                      {entry.validatorName && (
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span>{entry.validatorName}</span>
                        </div>
                      )}

                      {entry.historyEntry?.statut_avant && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Transition : {AIDE_STATUT_LABELS[entry.historyEntry.statut_avant as AideStatut] ?? entry.historyEntry.statut_avant} → {entry.statutLabel}
                        </p>
                      )}

                      {entry.comment && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-muted/50 p-2 text-sm">
                          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span>{entry.comment}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Action buttons for current step */}
              {canShowActions && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed p-4 bg-muted/30">
                  <span className="text-sm font-medium text-muted-foreground mr-auto">
                    Actions de validation
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={isActing}
                  >
                    {rejectMutation.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-1 h-4 w-4" />
                    )}
                    Refuser
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleApprove}
                    disabled={isActing}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                    )}
                    Approuver
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refuser l&apos;aide</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reject-comment">Commentaire (facultatif)</Label>
              <Textarea
                id="reject-comment"
                placeholder="Indiquez la raison du refus..."
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
