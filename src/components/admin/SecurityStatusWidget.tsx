import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Shield, ShieldAlert, ShieldCheck, Download, Plus, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLatestSecurityScan, useCreateSecurityScan } from "@/hooks/useSecurityScans";

const REPORT_PDF = "/docs/SECURITY_REPORT_2026_05.pdf";
const REPORT_MD = "/docs/SECURITY_REPORT_2026_05.md";

export const SecurityStatusWidget = () => {
  const { data: scan, isLoading } = useLatestSecurityScan();
  const createScan = useCreateSecurityScan();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ critical_count: 0, warning_count: 0, info_count: 0, summary: "" });

  const total = scan ? scan.critical_count + scan.warning_count + scan.info_count : 0;
  const status: "safe" | "warn" | "critical" = !scan
    ? "warn"
    : scan.critical_count > 0
      ? "critical"
      : scan.warning_count > 0
        ? "warn"
        : "safe";

  const StatusIcon = status === "critical" ? ShieldAlert : status === "warn" ? Shield : ShieldCheck;
  const statusColor =
    status === "critical" ? "text-destructive" : status === "warn" ? "text-yellow-600" : "text-green-600";
  const statusLabel =
    status === "critical" ? "Critique" : status === "warn" ? "À surveiller" : "Sain";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${statusColor}`} />
            Statut de sécurité
          </CardTitle>
          <CardDescription>
            {isLoading
              ? "Chargement..."
              : scan
                ? `Dernier scan : ${format(new Date(scan.scan_date), "PPP 'à' HH:mm", { locale: fr })}`
                : "Aucun scan enregistré"}
          </CardDescription>
        </div>
        <Badge variant={status === "critical" ? "destructive" : status === "warn" ? "secondary" : "default"}>
          {statusLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-destructive">{scan?.critical_count ?? 0}</div>
            <div className="text-xs text-muted-foreground">Critiques</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{scan?.warning_count ?? 0}</div>
            <div className="text-xs text-muted-foreground">Warnings</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{scan?.info_count ?? 0}</div>
            <div className="text-xs text-muted-foreground">Info</div>
          </div>
        </div>

        {scan?.summary && (
          <p className="text-sm text-muted-foreground line-clamp-2">{scan.summary}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={REPORT_PDF} download>
              <Download className="h-4 w-4 mr-1" /> Rapport PDF
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={REPORT_MD} download>
              <FileText className="h-4 w-4 mr-1" /> Rapport MD
            </a>
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary">
                <Plus className="h-4 w-4 mr-1" /> Enregistrer un scan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau scan de sécurité</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Critiques</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.critical_count}
                    onChange={(e) => setForm({ ...form, critical_count: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Warnings</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.warning_count}
                    onChange={(e) => setForm({ ...form, warning_count: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Info</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.info_count}
                    onChange={(e) => setForm({ ...form, info_count: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Résumé (optionnel)</Label>
                  <Textarea
                    value={form.summary}
                    onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button
                  onClick={async () => {
                    await createScan.mutateAsync(form);
                    setOpen(false);
                    setForm({ critical_count: 0, warning_count: 0, info_count: 0, summary: "" });
                  }}
                  disabled={createScan.isPending}
                >
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {scan && (
          <p className="text-xs text-muted-foreground">
            Total : {total} finding{total > 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SecurityStatusWidget;
