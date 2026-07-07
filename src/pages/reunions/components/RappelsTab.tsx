import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar, Mail, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function RappelsTab() {
  const [joursAvant, setJoursAvant] = useState("2");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();

  const { data: prochReunions } = useQuery({
    queryKey: ["prochaines-reunions"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("reunions")
        .select("id, date_reunion, ordre_du_jour, lieu_description")
        .eq("statut", "planifie")
        .gte("date_reunion", today)
        .order("date_reunion", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: membresAvecEmail } = useQuery({
    queryKey: ["membres-avec-email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id, nom, prenom, email")
        .eq("statut", "actif")
        .not("email", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const handleSendReminders = async (testMode: boolean = false) => {
    setSending(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-presence-reminders", {
        body: { joursAvant: parseInt(joursAvant), testMode },
      });
      if (error) { const errorMessage = data?.error || error.message; throw new Error(errorMessage); }
      if (data?.error) throw new Error(data.error);
      setLastResult(data);
      if (data.emailsSent > 0) {
        toast({ title: testMode ? "Test réussi" : "Rappels envoyés", description: `${data.emailsSent} email(s) ${testMode ? "simulé(s)" : "envoyé(s)"} pour ${data.reunionsCount} réunion(s)` });
      } else {
        toast({ title: "Aucun rappel nécessaire", description: data.message || "Aucune réunion ou membre trouvé" });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erreur inconnue";
      setLastResult({ error: msg });
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Configuration des Rappels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label>Envoyer les rappels X jours avant la réunion</Label>
                <Select value={joursAvant} onValueChange={setJoursAvant}>
                  <SelectTrigger className="w-48 mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 jour avant</SelectItem>
                    <SelectItem value="2">2 jours avant</SelectItem>
                    <SelectItem value="3">3 jours avant</SelectItem>
                    <SelectItem value="7">1 semaine avant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={() => handleSendReminders(true)} disabled={sending} variant="outline">
                  {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Tester (simulation)
                </Button>
                <Button onClick={() => handleSendReminders(false)} disabled={sending} className="bg-gradient-to-r from-primary to-secondary">
                  {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Envoyer maintenant
                </Button>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Statistiques</h4>
              <div className="text-sm space-y-2">
                <p className="flex items-center justify-between"><span className="text-muted-foreground">Membres avec email :</span><Badge variant="secondary">{membresAvecEmail?.length || 0}</Badge></p>
                <p className="flex items-center justify-between"><span className="text-muted-foreground">Prochaines réunions :</span><Badge variant="secondary">{prochReunions?.length || 0}</Badge></p>
              </div>
            </div>
          </div>

          {lastResult && (
            <div className={`rounded-lg p-4 ${lastResult.error ? "bg-destructive/10 border border-destructive/30" : "bg-success/10 border border-success/30"}`}>
              <div className="flex items-start gap-3">
                {lastResult.error ? <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" /> : <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />}
                <div className="space-y-1">
                  <p className="font-medium">{lastResult.error ? "Erreur" : "Résultat de l'envoi"}</p>
                  {lastResult.error ? (
                    <p className="text-sm text-destructive">{lastResult.error}</p>
                  ) : (
                    <div className="text-sm space-y-1">
                      <p>✉️ {lastResult.emailsSent} email(s) envoyé(s)</p>
                      {lastResult.emailsErrors > 0 && <p className="text-destructive">❌ {lastResult.emailsErrors} erreur(s)</p>}
                      <p className="text-muted-foreground">Pour {lastResult.reunionsCount} réunion(s), {lastResult.membresCount} membre(s)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Prochaines réunions planifiées</CardTitle>
        </CardHeader>
        <CardContent>
          {prochReunions && prochReunions.length > 0 ? (
            <div className="space-y-3">
              {prochReunions.map((reunion) => {
                const date = new Date(reunion.date_reunion);
                const joursRestants = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={reunion.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-center bg-primary/10 rounded-lg p-2 min-w-[50px]">
                        <p className="text-lg font-bold text-primary">{date.getDate()}</p>
                        <p className="text-xs text-muted-foreground uppercase">{date.toLocaleDateString("fr-FR", { month: "short" })}</p>
                      </div>
                      <div>
                        <p className="font-medium">{reunion.ordre_du_jour || "Réunion"}</p>
                        {reunion.lieu_description && <p className="text-sm text-muted-foreground">{reunion.lieu_description}</p>}
                      </div>
                    </div>
                    <Badge variant={joursRestants <= 2 ? "default" : "secondary"}>
                      {joursRestants === 0 ? "Aujourd'hui" : joursRestants === 1 ? "Demain" : `Dans ${joursRestants} jours`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-6">Aucune réunion planifiée à venir</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
