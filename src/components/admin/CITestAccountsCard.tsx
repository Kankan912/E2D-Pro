import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SECRET_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_TEST_ANON_EMAIL",
  "VITE_TEST_ANON_PASSWORD",
  "VITE_TEST_MEMBER_EMAIL",
  "VITE_TEST_MEMBER_PASSWORD",
  "VITE_TEST_ADMIN_EMAIL",
  "VITE_TEST_ADMIN_PASSWORD",
] as const;

export function CITestAccountsCard() {
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const { toast } = useToast();

  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-test-users");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setValues({
        ...data.secrets,
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      });
      toast({ title: "Comptes générés", description: "Les 3 comptes de test ont été créés ou mis à jour." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copié", description: label });
  };

  const copyAll = async () => {
    if (!values) return;
    const lines = SECRET_KEYS.map((k) => `${k}=${values[k] ?? ""}`).join("\n");
    await navigator.clipboard.writeText(lines);
    toast({ title: "Tout copié", description: "Format clé=valeur (8 lignes)" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Comptes de test CI</CardTitle>
        </div>
        <CardDescription>
          Génère automatiquement les 3 comptes Supabase (anon, membre, administrateur)
          requis par le workflow GitHub Actions <code>security-rls.yml</code>, puis
          affiche les 8 valeurs à coller dans GitHub → Settings → Secrets and variables → Actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
          {values ? "Régénérer les comptes" : "Générer les comptes de test CI"}
        </Button>

        {values && (
          <>
            <Alert>
              <AlertDescription className="text-xs">
                Les mots de passe ne sont affichés qu'une seule fois. Copiez-les
                immédiatement dans GitHub Secrets. Vous pouvez régénérer à tout
                moment (les anciens mots de passe seront remplacés).
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={copyAll}>
                <Copy className="h-4 w-4 mr-2" /> Copier les 8 secrets
              </Button>
            </div>

            <div className="space-y-2">
              {SECRET_KEYS.map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs font-mono">{k}</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={values[k] ?? ""} className="font-mono text-xs" />
                    <Button size="icon" variant="outline" onClick={() => copy(values[k] ?? "", k)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
