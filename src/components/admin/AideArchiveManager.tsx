'use client';

/**
 * @module AideArchiveManager
 * Archive manager for the Aides module with dual-tab interface.
 * Active tab: list of non-archived aides with bulk select + archive button.
 * Archived tab: list of archived aides with restore button per item.
 *
 * Multi-tenant: all data scoped by associationId.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  Archive,
  RotateCcw,
  CheckSquare,
  Square,
  Search,
  Loader2,
  AlertCircle,
  Trash2,
  Filter,
  Calendar,
  Users,
  DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import AideStatusBadge from '@/components/ui/AideStatusBadge';
import {
  useAides,
  type Aide,
} from '@/hooks/useAides';
import {
  useAideArchive,
  useArchiveAide,
  useRestoreAide,
  useBulkArchiveAides,
  type ArchivedAide,
} from '@/hooks/useAidePhase3';
import { formatFCFA } from '@/lib/aide-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AideArchiveManagerProps {
  associationId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AideArchiveManager({ associationId }: AideArchiveManagerProps) {
  const {
    data: allAides,
    isLoading: loadingAides,
    isError: aidesError,
    error: aidesErrorObj,
  } = useAides(associationId);

  const {
    data: archivedAides,
    isLoading: loadingArchived,
    isError: archivedError,
    error: archivedErrorObj,
  } = useAideArchive(associationId);

  const archiveMutation = useBulkArchiveAides(associationId);
  const restoreMutation = useRestoreAide(associationId);

  const [activeTab, setActiveTab] = useState('actives');
  const [searchActive, setSearchActive] = useState('');
  const [searchArchived, setSearchArchived] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirmation dialogs
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);

  // ---- Computed lists ----

  const activeAides = useMemo(() => {
    const list = (allAides ?? []).filter((a) => a.statut !== 'archivee');
    if (!searchActive.trim()) return list;
    const term = searchActive.toLowerCase();
    return list.filter(
      (a) =>
        (a.beneficiaire?.nom ?? '').toLowerCase().includes(term) ||
        (a.beneficiaire?.prenom ?? '').toLowerCase().includes(term) ||
        (a.type_aide?.nom ?? '').toLowerCase().includes(term) ||
        a.contexte_aide.toLowerCase().includes(term)
    );
  }, [allAides, searchActive]);

  const filteredArchived = useMemo(() => {
    const list = archivedAides ?? [];
    if (!searchArchived.trim()) return list;
    const term = searchArchived.toLowerCase();
    return list.filter(
      (a) =>
        (a.beneficiaire?.nom ?? '').toLowerCase().includes(term) ||
        (a.beneficiaire?.prenom ?? '').toLowerCase().includes(term) ||
        (a.type_aide?.nom ?? '').toLowerCase().includes(term)
    );
  }, [archivedAides, searchArchived]);

  // ---- Selection handlers ----

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === activeAides.length && activeAides.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeAides.map((a) => a.id)));
    }
  }, [selectedIds.size, activeAides]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ---- Archive handlers ----

  const handleOpenArchiveDialog = useCallback(() => {
    if (selectedIds.size === 0) return;
    setArchiveDialogOpen(true);
  }, [selectedIds]);

  const handleConfirmArchive = useCallback(() => {
    archiveMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setArchiveDialogOpen(false);
        clearSelection();
      },
    });
  }, [archiveMutation, selectedIds, clearSelection]);

  // ---- Restore handlers ----

  const handleOpenRestoreDialog = useCallback((id: string) => {
    setRestoreTargetId(id);
    setRestoreDialogOpen(true);
  }, []);

  const handleConfirmRestore = useCallback(() => {
    if (!restoreTargetId) return;
    restoreMutation.mutate(restoreTargetId, {
      onSuccess: () => {
        setRestoreDialogOpen(false);
        setRestoreTargetId(null);
      },
    });
  }, [restoreMutation, restoreTargetId]);

  // ---- Render helpers ----

  const isLoading = loadingAides || loadingArchived;
  const allSelected = activeAides.length > 0 && selectedIds.size === activeAides.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Gestion des archives
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Archivez et restaurez les aides selon les besoins
          </p>
        </div>
      </div>

      {/* Error banner */}
      {(aidesError || archivedError) && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {(aidesErrorObj as Error & { message?: string })?.message ??
              (archivedErrorObj as Error & { message?: string })?.message ??
              'Erreur de chargement des données'}
          </span>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="actives" className="gap-1.5">
              <CheckSquare className="h-4 w-4" />
              Actives
              <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                {activeAides.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="archivees" className="gap-1.5">
              <Archive className="h-4 w-4" />
              Archivées
              <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                {filteredArchived.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ---- Active tab ---- */}
        <TabsContent value="actives" className="mt-4 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans les aides actives..."
                value={searchActive}
                onChange={(e) => setSearchActive(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              {someSelected && (
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <Square className="mr-1 h-4 w-4" />
                  Déselectionner ({selectedIds.size})
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleOpenArchiveDialog}
                disabled={selectedIds.size === 0 || archiveMutation.isPending}
              >
                {archiveMutation.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="mr-1 h-4 w-4" />
                )}
                Archiver ({selectedIds.size})
              </Button>
            </div>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : activeAides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckSquare className="mb-2 h-8 w-8" />
                  <p className="text-sm">
                    {searchActive ? 'Aucune aide correspondante.' : 'Aucune aide active.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-gray-300"
                            aria-label="Tout sélectionner"
                          />
                        </TableHead>
                        <TableHead>Bénéficiaire</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeAides.map((aide: Aide) => (
                        <TableRow
                          key={aide.id}
                          className={`cursor-pointer transition-colors ${
                            selectedIds.has(aide.id) ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => toggleSelect(aide.id)}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(aide.id)}
                              onChange={() => toggleSelect(aide.id)}
                              className="h-4 w-4 rounded border-gray-300"
                              aria-label={`Sélectionner aide ${aide.beneficiaire?.nom ?? ''}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              {aide.beneficiaire
                                ? `${aide.beneficiaire.nom} ${aide.beneficiaire.prenom}`.trim()
                                : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {aide.type_aide?.nom ?? '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <span className="flex items-center justify-end gap-1">
                              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatFCFA(aide.montant)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(aide.date_allocation).toLocaleDateString('fr-FR')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <AideStatusBadge statut={aide.statut} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Archived tab ---- */}
        <TabsContent value="archivees" className="mt-4 space-y-4">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher dans les archives..."
              value={searchArchived}
              onChange={(e) => setSearchArchived(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loadingArchived ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredArchived.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Archive className="mb-2 h-8 w-8" />
                  <p className="text-sm">
                    {searchArchived ? 'Aucune archive correspondante.' : 'Aucune aide archivée.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bénéficiaire</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Date allocation</TableHead>
                        <TableHead>Date archivage</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredArchived.map((arch: ArchivedAide) => (
                        <TableRow key={arch.id}>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              {arch.beneficiaire
                                ? `${arch.beneficiaire.nom} ${arch.beneficiaire.prenom}`.trim()
                                : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {arch.type_aide?.nom ?? '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatFCFA(arch.montant)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(arch.date_allocation).toLocaleDateString('fr-FR')}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Archive className="h-3 w-3" />
                              {new Date(arch.date_archivage).toLocaleDateString('fr-FR')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenRestoreDialog(arch.id)}
                              disabled={restoreMutation.isPending}
                            >
                              {restoreMutation.isPending && restoreTargetId === arch.id ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                              )}
                              Restaurer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Archive confirmation dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l&apos;archivage</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point d&apos;archiver {selectedIds.size} aide(s). Les aides archivées ne seront plus visibles dans la liste active. Vous pourrez les restaurer ultérieurement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setArchiveDialogOpen(false)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmArchive}
              disabled={archiveMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {archiveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Archiver {selectedIds.size} aide(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore confirmation dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer cette aide ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;aide sera restaurée avec le statut &quot;Brouillon&quot;. Vous devrez la soumettre à nouveau si nécessaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRestoreDialogOpen(false)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Restaurer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
