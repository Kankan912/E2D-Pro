import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Activity, BarChart3, ShieldAlert, Eye, Users, Download, Loader2 } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { logger } from "@/lib/logger";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SecurityStatusWidget } from "@/components/admin/SecurityStatusWidget";
import { CITestAccountsCard } from "@/components/admin/CITestAccountsCard";

// ----------- Helpers -----------
function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// =================== TAB 1: STATISTIQUES CONSULTATION ===================
const ConsultationStatsTab = () => {
  const { data: pageviews = [], isLoading } = useQuery({
    queryKey: ["site-pageviews-30d"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from("site_pageviews")
        .select("id, path, user_id, session_id, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        logger.error("[Monitoring] pageviews fetch:", error);
        throw error;
      }
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const stats = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const last7 = subDays(new Date(), 7).getTime();
    const last30 = subDays(new Date(), 30).getTime();

    let viewsToday = 0, views7 = 0, views30 = 0;
    const sessionsSet = new Set<string>();
    const usersSet = new Set<string>();
    const pathCount = new Map<string, number>();
    const dailyMap = new Map<string, number>();
    let anonymous = 0, authed = 0;

    for (const p of pageviews) {
      const t = new Date(p.created_at).getTime();
      if (t >= today) viewsToday++;
      if (t >= last7) views7++;
      if (t >= last30) views30++;
      if (p.session_id) sessionsSet.add(p.session_id);
      if (p.user_id) { usersSet.add(p.user_id); authed++; } else anonymous++;
      pathCount.set(p.path, (pathCount.get(p.path) ?? 0) + 1);
      const day = format(new Date(p.created_at), "yyyy-MM-dd");
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }

    const dailyChart = Array.from({ length: 30 }, (_, i) => {
      const d = format(subDays(new Date(), 29 - i), "yyyy-MM-dd");
      return { date: format(subDays(new Date(), 29 - i), "dd/MM"), visites: dailyMap.get(d) ?? 0 };
    });

    const topPages = Array.from(pathCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path: path.length > 35 ? path.slice(0, 35) + "…" : path, count }));

    return {
      viewsToday, views7, views30,
      uniqueSessions: sessionsSet.size,
      uniqueUsers: usersSet.size,
      anonymous, authed,
      dailyChart, topPages,
    };
  }, [pageviews]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Visites aujourd'hui</p>
          <p className="text-2xl font-bold">{stats.viewsToday}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">7 derniers jours</p>
          <p className="text-2xl font-bold">{stats.views7}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">30 derniers jours</p>
          <p className="text-2xl font-bold">{stats.views30}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Sessions uniques (30j)</p>
          <p className="text-2xl font-bold">{stats.uniqueSessions}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <Users className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-xs text-muted-foreground">Membres connectés</p>
          <p className="text-xl font-bold">{stats.authed}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Eye className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Visiteurs anonymes</p>
          <p className="text-xl font-bold">{stats.anonymous}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Users className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-xs text-muted-foreground">Membres uniques (30j)</p>
          <p className="text-xl font-bold">{stats.uniqueUsers}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Visites quotidiennes (30 jours)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.dailyChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="visites" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 pages les plus visitées</CardTitle>
          <CardDescription>Sur les 30 derniers jours</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.topPages} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="path" type="category" tick={{ fontSize: 11 }} width={200} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

// =================== TAB 2: HISTORIQUE CONNEXIONS ===================
const ConnectionsTab = () => {
  const [filter, setFilter] = useState<"all" | "succes" | "echec" | "bloque">("all");
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["historique-connexion-monitoring"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historique_connexion")
        .select("id, user_id, date_connexion, ip_address, statut, user_agent")
        .order("date_connexion", { ascending: false })
        .limit(200);
      if (error) throw error;

      // Récupère les profils pour afficher les noms
      const userIds = [...new Set((data ?? []).map(r => r.user_id).filter(Boolean))];
      const profilesMap = new Map<string, { nom: string; prenom: string; email: string | null }>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nom, prenom, email")
          .in("id", userIds);
        (profs ?? []).forEach(p => profilesMap.set(p.id, { nom: p.nom, prenom: p.prenom, email: p.email }));
      }

      return (data ?? []).map(r => ({
        ...r,
        // Normalisation défensive : "reussi" (legacy) -> "succes"
        statut: r.statut === "reussi" ? "succes" : r.statut,
        profile: r.user_id ? profilesMap.get(r.user_id) : null,
      }));
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter !== "all" && r.statut !== filter) return false;
      if (search) {
        const s = search.toLowerCase();
        const fullName = `${r.profile?.prenom ?? ""} ${r.profile?.nom ?? ""} ${r.profile?.email ?? ""}`.toLowerCase();
        if (!fullName.includes(s)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    let todayCount = 0, failures = 0;
    for (const r of rows) {
      const t = new Date(r.date_connexion).getTime();
      if (t >= today) todayCount++;
      if (r.statut === "echec" && t >= subDays(new Date(), 7).getTime()) failures++;
    }
    return { todayCount, failures, total: rows.length };
  }, [rows]);

  const exportCsv = () => {
    downloadCSV("historique_connexions.csv", filtered.map(r => ({
      date: r.date_connexion,
      utilisateur: r.profile ? `${r.profile.prenom} ${r.profile.nom}` : "Anonyme",
      email: r.profile?.email ?? "",
      ip: r.ip_address ?? "",
      statut: r.statut,
      navigateur: r.user_agent ?? "",
    })));
  };

  if (isLoading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Connexions aujourd'hui</p>
          <p className="text-2xl font-bold">{stats.todayCount}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Échecs (7 derniers jours)</p>
          <p className={`text-2xl font-bold ${stats.failures > 5 ? "text-destructive" : ""}`}>{stats.failures}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Total enregistré</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <CardTitle>Historique des connexions</CardTitle>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            <Input
              placeholder="Rechercher (nom, email)…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filter} onValueChange={v => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="succes">Succès</SelectItem>
                <SelectItem value="echec">Échec</SelectItem>
                <SelectItem value="bloque">Bloqué</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Navigateur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucune connexion</TableCell></TableRow>
                )}
                {filtered.slice(0, 200).map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{format(new Date(r.date_connexion), "dd/MM/yyyy HH:mm", { locale: fr })}</TableCell>
                    <TableCell className="text-sm">
                      {r.profile ? (
                        <>
                          <div className="font-medium">{r.profile.prenom} {r.profile.nom}</div>
                          <div className="text-xs text-muted-foreground">{r.profile.email}</div>
                        </>
                      ) : <span className="text-muted-foreground italic">Anonyme</span>}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{(r.ip_address as string | null) ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={
                        r.statut === "succes" ? "default" :
                        r.statut === "echec" ? "destructive" : "secondary"
                      }>{r.statut}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={r.user_agent ?? ""}>{r.user_agent ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 200 && (
            <p className="text-xs text-muted-foreground mt-2">Affichage limité à 200 lignes — utilisez l'export CSV pour tout voir.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// =================== TAB 3: LOGS D'ACTIONS ===================
type AuditEntry = {
  id: string;
  source: "audit_logs" | "utilisateurs_actions_log";
  date: string;
  user_id: string | null;
  action: string;
  target: string;
  details: Record<string, unknown> | null;
};

const ActionsLogTab = () => {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [detailModal, setDetailModal] = useState<AuditEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-actions-monitoring"],
    queryFn: async (): Promise<AuditEntry[]> => {
      const [auditRes, userActionsRes] = await Promise.all([
        supabase.from("audit_logs")
          .select("id, action, table_name, record_id, user_id, old_data, new_data, created_at")
          .order("created_at", { ascending: false }).limit(500),
        supabase.from("utilisateurs_actions_log")
          .select("id, action, user_id, performed_by, performed_at, old_value, new_value, details")
          .order("performed_at", { ascending: false }).limit(500),
      ]);

      if (auditRes.error) logger.error("[Monitoring] audit_logs:", auditRes.error);
      if (userActionsRes.error) logger.error("[Monitoring] utilisateurs_actions_log:", userActionsRes.error);

      const merged: AuditEntry[] = [
        ...(auditRes.data ?? []).map(r => ({
          id: `a-${r.id}`,
          source: "audit_logs" as const,
          date: r.created_at,
          user_id: r.user_id,
          action: r.action,
          target: `${r.table_name}${r.record_id ? ` #${String(r.record_id).slice(0, 8)}` : ""}`,
          details: { old: r.old_data, new: r.new_data },
        })),
        ...(userActionsRes.data ?? []).map(r => ({
          id: `u-${r.id}`,
          source: "utilisateurs_actions_log" as const,
          date: r.performed_at,
          user_id: r.performed_by ?? r.user_id,
          action: r.action,
          target: `utilisateur#${String(r.user_id ?? "").slice(0, 8)}`,
          details: { old: r.old_value, new: r.new_value, ...(typeof r.details === "object" ? r.details : {}) },
        })),
      ];

      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Profils
      const ids = [...new Set(merged.map(m => m.user_id).filter(Boolean))] as string[];
      const profMap = new Map<string, { nom: string; prenom: string; email: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nom, prenom, email").in("id", ids);
        (profs ?? []).forEach(p => profMap.set(p.id, { nom: p.nom, prenom: p.prenom, email: p.email }));
      }

      return merged.map(m => ({ ...m, details: { ...m.details, _profile: m.user_id ? profMap.get(m.user_id) ?? null : null } }));
    },
    staleTime: 30_000,
  });

  const entries = data ?? [];
  const actionTypes = useMemo(() => [...new Set(entries.map(e => e.action))].sort(), [entries]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const prof = (e.details as { _profile?: { nom?: string; prenom?: string; email?: string } })?._profile;
        const hay = `${prof?.prenom ?? ""} ${prof?.nom ?? ""} ${prof?.email ?? ""} ${e.target} ${e.action}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [entries, actionFilter, search]);

  const exportCsv = () => {
    downloadCSV("logs_actions.csv", filtered.map(r => {
      const prof = (r.details as { _profile?: { nom?: string; prenom?: string; email?: string } })?._profile;
      return {
        date: r.date,
        utilisateur: prof ? `${prof.prenom} ${prof.nom}` : (r.user_id ?? "système"),
        email: prof?.email ?? "",
        action: r.action,
        cible: r.target,
        source: r.source,
      };
    }));
  };

  if (isLoading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <CardTitle>Journal des actions et éditions</CardTitle>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
          <CardDescription>{filtered.length} action(s) — combinaison audit_logs + utilisateurs_actions_log</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            <Input
              placeholder="Rechercher (nom, action, cible)…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Toutes actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes actions</SelectItem>
                {actionTypes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucune action enregistrée</TableCell></TableRow>
                )}
                {filtered.slice(0, 200).map(e => {
                  const prof = (e.details as { _profile?: { nom?: string; prenom?: string; email?: string } })?._profile;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{format(new Date(e.date), "dd/MM HH:mm", { locale: fr })}</TableCell>
                      <TableCell className="text-sm">
                        {prof ? (
                          <>
                            <div className="font-medium">{prof.prenom} {prof.nom}</div>
                            <div className="text-xs text-muted-foreground">{prof.email}</div>
                          </>
                        ) : <span className="text-muted-foreground italic text-xs">{e.user_id?.slice(0, 8) ?? "système"}</span>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{String(e.action)}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{e.target}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{e.source.replace("_", " ")}</Badge></TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setDetailModal(e)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 200 && (
            <p className="text-xs text-muted-foreground mt-2">Affichage limité à 200 lignes — utilisez l'export CSV.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailModal} onOpenChange={() => setDetailModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détail de l'action</DialogTitle>
          </DialogHeader>
          {detailModal && (
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">Date :</span> {format(new Date(detailModal.date), "dd/MM/yyyy HH:mm:ss", { locale: fr })}</div>
              <div><span className="font-medium">Action :</span> {detailModal.action}</div>
              <div><span className="font-medium">Cible :</span> {detailModal.target}</div>
              <div><span className="font-medium">Source :</span> {detailModal.source}</div>
              <div>
                <div className="font-medium mb-1">Données :</div>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{JSON.stringify(detailModal.details, null, 2)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// =================== MAIN PAGE ===================
const MonitoringAdmin = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Monitoring & Audit</h1>
          <p className="text-sm text-muted-foreground">Suivi des connexions, actions et consultations du site</p>
        </div>
      </div>

      <SecurityStatusWidget />
      <CITestAccountsCard />

      <Tabs defaultValue="consultation" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="consultation"><BarChart3 className="h-4 w-4 mr-1" />Consultation</TabsTrigger>
          <TabsTrigger value="connexions"><Users className="h-4 w-4 mr-1" />Connexions</TabsTrigger>
          <TabsTrigger value="actions"><ShieldAlert className="h-4 w-4 mr-1" />Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="consultation" className="mt-4"><ConsultationStatsTab /></TabsContent>
        <TabsContent value="connexions" className="mt-4"><ConnectionsTab /></TabsContent>
        <TabsContent value="actions" className="mt-4"><ActionsLogTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringAdmin;
