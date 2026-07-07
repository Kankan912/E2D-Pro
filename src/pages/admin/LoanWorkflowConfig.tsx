import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowDown, ArrowUp, Plus, Settings2, Trash2, Loader2, Info } from "lucide-react";
import { useLoanValidationConfig, type LoanValidationConfigItem } from "@/hooks/useLoanRequests";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: "tresorier", label: "Trésorier" },
  { value: "commissaire", label: "Commissaire aux comptes" },
  { value: "president", label: "Président / Censeur" },
  { value: "secretaire", label: "Secrétaire général" },
];

interface StepFormProps {
  initial?: LoanValidationConfigItem;
  onClose: () => void;
}

function StepForm({ initial, onClose }: StepFormProps) {
  const qc = useQueryClient();
  const [role, setRole] = useState(initial?.role ?? "tresorier");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [actif, setActif] = useState(initial?.actif ?? true);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!label.trim()) {
      toast.error("Libellé obligatoire");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("upsert_loan_validation_step" as never, {
        _id: initial?.id ?? null,
        _role: role,
        _label: label.trim(),
        _ordre: initial?.ordre ?? 999,
        _actif: actif,
      } as never);
      if (error) throw error;
      toast.success(initial ? "Étape mise à jour" : "Étape ajoutée");
      qc.invalidateQueries({ queryKey: ["loan-validation-config"] });
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Rôle</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="label">Libellé affiché</Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Validation du Trésorier"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="actif">Étape active</Label>
        <Switch id="actif" checked={actif} onCheckedChange={setActif} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function LoanWorkflowConfig() {
  const { data: items, isLoading } = useLoanValidationConfig();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LoanValidationConfigItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [reordering, setReordering] = useState(false);

  const move = async (id: string, direction: "up" | "down") => {
    if (!items) return;
    const sorted = [...items].sort((a, b) => a.ordre - b.ordre);
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]];
    setReordering(true);
    try {
      const { error } = await supabase.rpc("reorder_loan_validation_steps" as never, {
        _ids: sorted.map((s) => s.id),
      } as never);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["loan-validation-config"] });
      toast.success("Ordre mis à jour");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setReordering(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase.rpc("delete_loan_validation_step" as never, { _id: id } as never);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["loan-validation-config"] });
      toast.success("Étape supprimée");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const sorted = (items ?? []).slice().sort((a, b) => a.ordre - b.ordre);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            Workflow de validation des prêts
          </h1>
          <p className="text-sm text-muted-foreground">
            Définissez l'ordre des validateurs pour les nouvelles demandes.
          </p>
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Ajouter une étape</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle étape</DialogTitle></DialogHeader>
            <StepForm onClose={() => setCreating(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-3 flex items-start gap-2 text-sm">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p>
            <b>Étape 0 — Avaliste</b> (obligatoire, non configurable). Toute demande commence par
            l'approbation de l'avaliste désigné. Les étapes ci-dessous ne démarrent qu'après cette
            validation.
          </p>
        </CardContent>
      </Card>

      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="p-3 flex items-start gap-2 text-sm">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p>
            Les modifications n'affectent que les <b>nouvelles demandes</b>. Les demandes en cours
            conservent les étapes générées au moment de leur création.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Étapes du workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune étape configurée — toute demande sera approuvée immédiatement.
            </p>
          ) : (
            sorted.map((s, idx) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-md border p-3 bg-card"
              >
                <Badge variant="outline" className="font-mono">{idx + 1}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Rôle : <code className="bg-muted px-1 rounded">{s.role}</code>
                    {!s.actif && <span className="ml-2 text-destructive">(inactive)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={idx === 0 || reordering} onClick={() => move(s.id, "up")}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={idx === sorted.length - 1 || reordering} onClick={() => move(s.id, "down")}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>Modifier</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette étape ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. Les demandes en cours ne seront pas affectées.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(s.id)}>Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'étape</DialogTitle></DialogHeader>
          {editing && <StepForm initial={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
