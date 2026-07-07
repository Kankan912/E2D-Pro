import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Smartphone, CheckCircle, XCircle, Clock, AlertTriangle, Trash2, Plus, Download, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MOMO_METHODS = ["orange_money", "mtn_money"];

const getMethodLabel = (method: string) =>
  method === "orange_money" ? "🟠 Orange Money" : method === "mtn_money" ? "🟡 MTN MoMo" : method;

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-600 text-white">Validé</Badge>;
    case "pending":
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">En attente</Badge>;
    case "failed":
      return <Badge variant="destructive">Rejeté</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const AMOUNTS_FCFA = [5000, 10000, 25000, 50000, 100000];

const generateTxnRef = () =>
  `TXN${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;

export default function MobileMoneyAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sandboxOperator, setSandboxOperator] = useState<string>("orange_money");
  const [sandboxCount, setSandboxCount] = useState<string>("3");

  // ─── Queries ────────────────────────────────────────────────
  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["momo-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .in("payment_method", MOMO_METHODS)
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["momo-history"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .in("payment_method", MOMO_METHODS)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Stat counts
  const thisMonthStart = startOfMonth(new Date()).toISOString();
  const validatedThisMonth = history.filter(
    (d) => d.payment_status === "completed" && d.created_at >= thisMonthStart
  ).length;
  const rejectedThisMonth = history.filter(
    (d) => d.payment_status === "failed" && d.created_at >= thisMonthStart
  ).length;

  // ─── Mutations ──────────────────────────────────────────────
  const validateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("donations")
        .update({ payment_status: "completed", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["momo-pending"] });
      queryClient.invalidateQueries({ queryKey: ["momo-history"] });
      queryClient.invalidateQueries({ queryKey: ["donations"] });
      toast({ title: "✅ Don validé", description: "Le paiement Mobile Money a été validé." });
    },
    onError: () =>
      toast({ title: "Erreur", description: "Impossible de valider ce paiement.", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("donations")
        .update({ payment_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["momo-pending"] });
      queryClient.invalidateQueries({ queryKey: ["momo-history"] });
      queryClient.invalidateQueries({ queryKey: ["donations"] });
      toast({ title: "❌ Don rejeté", description: "Le paiement Mobile Money a été rejeté." });
    },
    onError: () =>
      toast({ title: "Erreur", description: "Impossible de rejeter ce paiement.", variant: "destructive" }),
  });

  // ─── Sandbox Mutations ──────────────────────────────────────
  const sandboxInsertMutation = useMutation({
    mutationFn: async () => {
      const count = parseInt(sandboxCount, 10);
      const fakeNames = ["Dupont Test", "Ngono Test", "Mballa Test", "Fotso Test", "Nkeng Test"];
      const records = Array.from({ length: count }).map((_, i) => ({
        donor_name: fakeNames[i % fakeNames.length],
        donor_email: "test@e2d.test",
        donor_phone: `+237 6${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 900 + 100)}`,
        amount: AMOUNTS_FCFA[Math.floor(Math.random() * AMOUNTS_FCFA.length)],
        currency: "FCFA",
        payment_method: sandboxOperator,
        payment_status: "pending",
        bank_transfer_reference: generateTxnRef(),
        is_recurring: false,
        fiscal_receipt_sent: false,
        donor_message: "[TEST SANDBOX - à supprimer]",
      }));
      const { error } = await supabase.from("donations").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["momo-pending"] });
      queryClient.invalidateQueries({ queryKey: ["momo-history"] });
      toast({ title: "🧪 Données de test insérées", description: `${sandboxCount} don(s) fictif(s) créé(s).` });
    },
    onError: (e: any) =>
      toast({ title: "Erreur sandbox", description: e.message, variant: "destructive" }),
  });

  const sandboxClearMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("donations")
        .delete()
        .eq("donor_email", "test@e2d.test");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["momo-pending"] });
      queryClient.invalidateQueries({ queryKey: ["momo-history"] });
      toast({ title: "🗑️ Données de test supprimées" });
    },
    onError: (e: any) =>
      toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // ─── Export CSV ─────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ["Date", "Opérateur", "Nom", "Email", "Téléphone", "Montant", "Devise", "Référence", "Statut"],
      ...history.map((d) => [
        format(new Date(d.created_at), "dd/MM/yyyy HH:mm"),
        d.payment_method,
        d.donor_name,
        d.donor_email,
        d.donor_phone || "",
        d.amount,
        d.currency,
        d.bank_transfer_reference || "",
        d.payment_status,
      ]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mobile-money-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Pending Transactions Table ──────────────────────────────
  const PendingTable = ({ data }: { data: typeof pending }) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Opérateur</TableHead>
            <TableHead>Donateur</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Référence SMS</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                ✅ Aucune transaction en attente
              </TableCell>
            </TableRow>
          ) : (
            data.map((d) => (
              <TableRow key={d.id} className="bg-amber-50/30 dark:bg-amber-950/20">
                <TableCell className="text-sm">
                  {format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                </TableCell>
                <TableCell>{getMethodLabel(d.payment_method)}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{d.donor_name}</p>
                    <p className="text-xs text-muted-foreground">{d.donor_email}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {(d as any).donor_phone || "—"}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {d.amount.toLocaleString("fr-FR")} {d.currency}
                </TableCell>
                <TableCell>
                  {d.bank_transfer_reference ? (
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                      {d.bank_transfer_reference}
                    </code>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                      onClick={() => validateMutation.mutate(d.id)}
                      disabled={validateMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/20 hover:bg-destructive/10"
                      onClick={() => rejectMutation.mutate(d.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Rejeter
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Smartphone className="h-7 w-7 text-primary" />
            Réconciliation Mobile Money
          </h1>
          <p className="text-muted-foreground mt-1">
            Vérification et validation des paiements Orange Money & MTN MoMo
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="En attente de validation"
          value={pending.length}
          icon={Clock}
          description={pending.length > 0 ? "⚠️ Transactions à vérifier" : "Aucune transaction en attente"}
        />
        <StatCard
          title="Validés ce mois"
          value={validatedThisMonth}
          icon={CheckCircle}
          description="Paiements confirmés"
        />
        <StatCard
          title="Rejetés ce mois"
          value={rejectedThisMonth}
          icon={XCircle}
          description="Transactions non confirmées"
        />
      </div>

      {/* Alert if pending */}
      {pending.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>{pending.length} transaction(s)</strong> Mobile Money en attente de vérification manuelle.
            Vérifiez les références de transaction dans vos relevés Orange/MTN avant de valider.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Transactions en attente
            {pending.length > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Historique 30 jours</TabsTrigger>
          <TabsTrigger value="sandbox">🧪 Sandbox / Tests</TabsTrigger>
        </TabsList>

        {/* ── Pending Tab ── */}
        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transactions à vérifier</CardTitle>
              <CardDescription>
                Comparez la référence SMS du donateur avec votre relevé Orange / MTN avant de valider.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement…</div>
              ) : (
                <PendingTable data={pending} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── History Tab ── */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Historique des 30 derniers jours</CardTitle>
                <CardDescription>{history.length} transaction(s) Mobile Money</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["momo-history"] })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement…</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Opérateur</TableHead>
                        <TableHead>Donateur</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Aucune transaction sur les 30 derniers jours
                          </TableCell>
                        </TableRow>
                      ) : (
                        history.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="text-sm">
                              {format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                            </TableCell>
                            <TableCell>{getMethodLabel(d.payment_method)}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{d.donor_name}</p>
                                <p className="text-xs text-muted-foreground">{d.donor_email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {d.amount.toLocaleString("fr-FR")} {d.currency}
                            </TableCell>
                            <TableCell>
                              {d.bank_transfer_reference ? (
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                  {d.bank_transfer_reference}
                                </code>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(d.payment_status)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sandbox Tab ── */}
        <TabsContent value="sandbox" className="space-y-4">
          <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950/30">
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>🧪 Environnement de test</strong> — Ce panneau génère des dons fictifs pour tester le workflow de
              validation Mobile Money. Les données de test utilisent l'email <code>test@e2d.test</code> et peuvent être
              supprimées en bloc.
            </AlertDescription>
          </Alert>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Générer des transactions de test
                </CardTitle>
                <CardDescription>
                  Insère des dons fictifs en statut "En attente" pour tester le workflow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Opérateur</label>
                  <Select value={sandboxOperator} onValueChange={setSandboxOperator}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="orange_money">🟠 Orange Money</SelectItem>
                      <SelectItem value="mtn_money">🟡 MTN MoMo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre de transactions</label>
                  <Select value={sandboxCount} onValueChange={setSandboxCount}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 3, 5, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} transaction{n > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 bg-muted rounded-lg text-sm space-y-1 text-muted-foreground">
                  <p>• Montants aléatoires parmi : 5k, 10k, 25k, 50k, 100k FCFA</p>
                  <p>• Références générées au format <code>TXN...</code></p>
                  <p>• Donateur fictif : "Dupont Test" / test@e2d.test</p>
                  <p>• Statut initial : En attente (pending)</p>
                </div>

                <Button
                  onClick={() => sandboxInsertMutation.mutate()}
                  disabled={sandboxInsertMutation.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {sandboxInsertMutation.isPending ? "Génération…" : `Générer ${sandboxCount} transaction(s)`}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Nettoyer les données de test
                </CardTitle>
                <CardDescription>
                  Supprime toutes les donations avec l'email <code>test@e2d.test</code>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive space-y-1">
                  <p>⚠️ Cette action supprime définitivement toutes les transactions de test.</p>
                  <p>Les vraies donations ne sont pas affectées.</p>
                </div>

                <Button
                  variant="destructive"
                  onClick={() => sandboxClearMutation.mutate()}
                  disabled={sandboxClearMutation.isPending}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {sandboxClearMutation.isPending ? "Suppression…" : "Supprimer les données de test"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
