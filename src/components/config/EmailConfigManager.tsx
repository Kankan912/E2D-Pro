import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Mail, Server, Key, Globe, Send, Eye, EyeOff, Loader2, CheckCircle, XCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { logger } from "@/lib/logger";
export function EmailConfigManager() {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [testingResend, setTestingResend] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [savingResendKey, setSavingResendKey] = useState(false);
  
  // Local state for form
  const [emailService, setEmailService] = useState<"resend" | "smtp" | null>(null);
  const [appUrl, setAppUrl] = useState("");
  const [emailExpediteur, setEmailExpediteur] = useState("");
  const [emailExpediteurNom, setEmailExpediteurNom] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  
  // SMTP config state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpEncryption, setSmtpEncryption] = useState<"tls" | "ssl" | "none">("tls");
  const [smtpConfigId, setSmtpConfigId] = useState<string | null>(null);

  // Fetch configurations
  const { data: configs, isLoading: configsLoading } = useQuery({
    queryKey: ["email-configurations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configurations').select('cle, valeur, description, created_at, updated_at')
        .in("cle", ["email_service", "app_url", "email_expediteur", "email_expediteur_nom"]);
      if (error) throw error;
      return data;
    },
  });

  // Fetch SMTP config
  const { data: smtpConfig, isLoading: smtpLoading } = useQuery({
    queryKey: ["smtp-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smtp_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Initialize form values from fetched data
  useEffect(() => {
    if (configs) {
      const emailServiceConfig = configs.find(c => c.cle === "email_service");
      const appUrlConfig = configs.find(c => c.cle === "app_url");
      const emailExpConfig = configs.find(c => c.cle === "email_expediteur");
      const emailExpNomConfig = configs.find(c => c.cle === "email_expediteur_nom");
      
      setEmailService((emailServiceConfig?.valeur as "resend" | "smtp") || "resend");
      setAppUrl(appUrlConfig?.valeur || "");
      setEmailExpediteur(emailExpConfig?.valeur || "");
      setEmailExpediteurNom(emailExpNomConfig?.valeur || "");
    }
  }, [configs]);

  useEffect(() => {
    if (smtpConfig) {
      setSmtpConfigId(smtpConfig.id);
      setSmtpHost(smtpConfig.serveur_smtp || "");
      setSmtpPort(String(smtpConfig.port_smtp || 587));
      setSmtpUser(smtpConfig.utilisateur_smtp || "");
      // Sécurité : ne JAMAIS pré-remplir le mot de passe SMTP côté client.
      // Champ laissé vide ; on ne réécrit la valeur en base que si l'admin saisit quelque chose.
      setSmtpPassword("");
      setSmtpEncryption((smtpConfig.encryption_type as "tls" | "ssl" | "none") || "tls");
    }
  }, [smtpConfig]);

  // Save configurations mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      // Update configurations table
      const updates = [
        { cle: "email_service", valeur: emailService },
        { cle: "app_url", valeur: appUrl },
        { cle: "email_expediteur", valeur: emailExpediteur },
        { cle: "email_expediteur_nom", valeur: emailExpediteurNom },
      ];

      for (const config of updates) {
        // C4 — Chaîner .select() pour détecter un échec RLS silencieux
        // (les policies de `configurations` exigent administrateur ; sans .select()
        // un non-admin verrait un "succès" sans aucune ligne mise à jour).
        const { data: updated, error } = await supabase
          .from("configurations")
          .update({ valeur: config.valeur, updated_at: new Date().toISOString() })
          .eq("cle", config.cle)
          .select();
        if (error) throw error;
        if (!updated || updated.length === 0) {
          throw new Error(
            `Échec de la mise à jour de "${config.cle}" : permissions insuffisantes ou clé introuvable`
          );
        }
      }

      // Update or insert SMTP config
      if (emailService === "smtp") {
        const baseSmtpData: Record<string, unknown> = {
          serveur_smtp: smtpHost,
          port_smtp: parseInt(smtpPort),
          utilisateur_smtp: smtpUser,
          encryption_type: smtpEncryption,
          actif: true,
        };
        // N'écrire le mot de passe QUE si l'admin en a saisi un nouveau
        if (smtpPassword && smtpPassword.length > 0) {
          baseSmtpData.mot_de_passe_smtp = smtpPassword;
        }

        if (smtpConfigId) {
          const { data: updatedSmtp, error } = await supabase
            .from("smtp_config")
            .update(baseSmtpData)
            .eq("id", smtpConfigId)
            .select();
          if (error) throw error;
          if (!updatedSmtp || updatedSmtp.length === 0) {
            throw new Error("Échec de la mise à jour SMTP : permissions insuffisantes ou session expirée");
          }
        } else {
          if (!smtpPassword) {
            throw new Error("Mot de passe SMTP requis pour la première configuration");
          }
          const { error } = await supabase
            .from("smtp_config")
            .insert(baseSmtpData as unknown);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-configurations"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["smtp-config"], refetchType: "all" });
      toast.success("Configuration email sauvegardée");
    },
    onError: (error) => {
      logger.error("Error saving config:", error);
      toast.error("Erreur lors de la sauvegarde");
    },
  });

  // ============================================================
  // Test unifié de configuration email — appelle l'Edge Function
  // ============================================================
  const [lastTestResult, setLastTestResult] = useState<{
    success: boolean;
    message: string;
    provider?: string;
    fallback?: boolean;
    duration_ms?: number;
  } | null>(null);

  const runConfigurationTest = async (provider: "auto" | "resend" | "smtp", enableFallback = false) => {
    if (provider === "resend" || provider === "auto") setTestingResend(true);
    if (provider === "smtp") setTestingSmtp(true);

    try {
      // Si on teste SMTP et que l'admin a saisi un nouveau mot de passe, sauvegarder d'abord
      if (provider === "smtp" || (provider === "auto" && emailService === "smtp")) {
        if (!smtpHost || !smtpUser) {
          throw new Error("Configuration SMTP incomplète — Renseignez serveur et utilisateur");
        }
        if (smtpPassword) {
          const smtpData: Record<string, unknown> = {
            serveur_smtp: smtpHost.trim(),
            port_smtp: parseInt(smtpPort),
            utilisateur_smtp: smtpUser.trim(),
            mot_de_passe_smtp: smtpPassword,
            encryption_type: smtpEncryption,
            actif: true,
          };
          if (smtpConfigId) {
            await supabase.from("smtp_config").update(smtpData).eq("id", smtpConfigId);
          } else {
            await supabase.from("smtp_config").insert(smtpData as unknown);
          }
          queryClient.invalidateQueries({ queryKey: ["smtp-config"] });
        }
      }

      // Destinataire de test : email expéditeur configuré, sinon utilisateur SMTP
      const to = emailExpediteur || smtpUser;
      if (!to) throw new Error("Aucun destinataire de test : configurez l'email expéditeur");

      const { data, error } = await supabase.functions.invoke("test-email-configuration", {
        body: { to, provider, enableFallback },
      });

      let payload = (data ?? {}) as {
        success?: boolean;
        message?: string;
        provider?: string;
        fallback?: boolean;
        duration_ms?: number;
      };

      // Si erreur non-2xx, tenter de lire le vrai message dans le corps de la réponse
      if (error && (!payload || !payload.message)) {
        try {
          const resp = (error as unknown)?.context?.response;
          if (resp && typeof resp.json === "function") {
            const body = await resp.clone().json();
            payload = { ...payload, ...body };
          }
        } catch { /* ignore */ }
      }

      if (error || !payload.success) {
        const msg = payload.message || (error as unknown)?.message || "Échec du test";
        setLastTestResult({ success: false, message: msg, provider: payload.provider });
        toast.error(msg, { icon: <XCircle className="h-4 w-4 text-red-500" /> });
        return;
      }


      setLastTestResult({
        success: true,
        message: payload.message || "Test réussi",
        provider: payload.provider,
        fallback: payload.fallback,
        duration_ms: payload.duration_ms,
      });
      const label = payload.fallback
        ? `Fallback ${payload.provider} utilisé — email envoyé à ${to}`
        : `Test ${payload.provider} réussi — email envoyé à ${to}${payload.duration_ms ? ` (${payload.duration_ms} ms)` : ""}`;
      toast.success(label, { icon: <CheckCircle className="h-4 w-4 text-green-500" /> });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setLastTestResult({ success: false, message: msg });
      toast.error("Test échoué : " + msg, { icon: <XCircle className="h-4 w-4 text-red-500" /> });
    } finally {
      setTestingResend(false);
      setTestingSmtp(false);
    }
  };

  // Wrappers conservés pour compat avec les boutons existants
  const testResendConnection = () => runConfigurationTest("resend");
  const testSmtpConnection = () => runConfigurationTest("smtp");
  const sendTestEmail = () => runConfigurationTest("auto", true);
  const sendingTestEmail = testingResend || testingSmtp;

  // ============================================================
  // Statut de la configuration (validité)
  // ============================================================
  const configStatus = (() => {
    if (!emailService) return { valid: false, message: "Chargement..." };
    if (!emailExpediteur) return { valid: false, message: "Email expéditeur manquant" };
    if (emailService === "resend") {
      // On ne peut pas vérifier la clé en base depuis le client (sécurité), mais on peut au moins vérifier la présence locale
      // ou faire confiance au backend. Statut "à tester".
      return { valid: true, message: "Resend configuré — testez pour vérifier la clé API" };
    }
    if (emailService === "smtp") {
      if (!smtpHost || !smtpUser) return { valid: false, message: "Serveur ou utilisateur SMTP manquant" };
      if (!smtpConfigId && !smtpPassword) return { valid: false, message: "Mot de passe SMTP requis" };
      return { valid: true, message: "SMTP configuré — testez pour vérifier la connexion" };
    }
    return { valid: false, message: "Service email non sélectionné" };
  })();

  if (configsLoading || smtpLoading || emailService === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bandeau de statut de la configuration */}
      <Alert className={configStatus.valid ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"}>
        {configStatus.valid ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
        <AlertDescription className={configStatus.valid ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span>
              <strong>{configStatus.valid ? "✔ Configuration valide" : "❌ Configuration invalide"}</strong>
              {" — "}
              {configStatus.message}
              {lastTestResult?.success && lastTestResult.fallback && (
                <span className="ml-2 inline-block px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-xs">
                  Dernier envoi : fallback {lastTestResult.provider}
                </span>
              )}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runConfigurationTest("auto", true)}
              disabled={sendingTestEmail}
            >
              {sendingTestEmail ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Tester la configuration
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* Service Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Service d'envoi email
          </CardTitle>
          <CardDescription>
            Choisissez le service à utiliser pour l'envoi des emails
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={emailService || "resend"}
            onValueChange={(value) => setEmailService(value as "resend" | "smtp")}
            className="grid gap-4 md:grid-cols-2"
          >
            <div className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${emailService === "resend" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
              <RadioGroupItem value="resend" id="resend" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="resend" className="cursor-pointer font-medium">
                  Resend API
                </Label>
                <p className="text-sm text-muted-foreground">
                  Service recommandé. Simple, fiable et facile à configurer.
                </p>
              </div>
            </div>
            <div className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${emailService === "smtp" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
              <RadioGroupItem value="smtp" id="smtp" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="smtp" className="cursor-pointer font-medium">
                  SMTP Personnalisé
                </Label>
                <p className="text-sm text-muted-foreground">
                  Utilisez votre propre serveur SMTP (Outlook, Gmail, etc.)
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Resend Configuration */}
      {emailService === "resend" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Configuration Resend API
            </CardTitle>
            <CardDescription>
              Saisissez votre clé API Resend pour activer l'envoi d'emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>Mode Test Resend :</strong> sans domaine vérifié, les emails ne peuvent être envoyés
              qu'à l'adresse du propriétaire du compte Resend.
              Pour envoyer à tous les membres, <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline font-medium">vérifiez un domaine</a>.
            </AlertDescription>
          </Alert>
            <div className="space-y-2">
              <Label htmlFor="resend-api-key">Clé API Resend</Label>
              <div className="relative">
                <Input
                  id="resend-api-key"
                  type={showResendKey ? "text" : "password"}
                  placeholder="re_xxxxxxxx..."
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowResendKey(!showResendKey)}
                >
                  {showResendKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Obtenez votre clé sur <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com/api-keys</a>
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="secondary"
                onClick={async () => {
                  if (!resendApiKey || !resendApiKey.startsWith('re_')) {
                    toast.error("Clé API invalide. Elle doit commencer par 're_'");
                    return;
                  }
                  setSavingResendKey(true);
                  try {
                    const { error } = await supabase.functions.invoke("update-email-config", {
                      body: { resend_api_key: resendApiKey, email_mode: "resend", email_service: "resend" }
                    });
                    if (error) {
                      const errorMessage = (error as unknown)?.message || "Impossible d'enregistrer la clé";
                      throw new Error(errorMessage);
                    }
                    toast.success("Clé API Resend enregistrée");
                  } catch (err: unknown) {
                    toast.error("Erreur: " + (err.message || "Impossible d'enregistrer la clé"));
                  } finally {
                    setSavingResendKey(false);
                  }
                }}
                disabled={savingResendKey || !resendApiKey}
              >
                {savingResendKey ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                Enregistrer la clé API
              </Button>
              
              <Button 
                variant="outline" 
                onClick={testResendConnection}
                disabled={testingResend}
              >
                {testingResend ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Tester la connexion
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SMTP Configuration */}
      {emailService === "smtp" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Configuration SMTP
            </CardTitle>
            <CardDescription>
              Paramètres de votre serveur SMTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">Serveur SMTP</Label>
                <Input
                  id="smtp-host"
                  placeholder="smtp.outlook.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">Port</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  placeholder="587"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp-user">Utilisateur</Label>
                <Input
                  id="smtp-user"
                  placeholder="votre@email.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="smtp-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-encryption">Chiffrement</Label>
              <Select value={smtpEncryption} onValueChange={(v) => setSmtpEncryption(v as typeof smtpEncryption)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tls">TLS (recommandé)</SelectItem>
                  <SelectItem value="ssl">SSL</SelectItem>
                  <SelectItem value="none">Aucun</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              variant="outline" 
              onClick={testSmtpConnection}
              disabled={testingSmtp}
            >
              {testingSmtp ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Tester la connexion SMTP
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* General Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Configuration Générale
          </CardTitle>
          <CardDescription>
            Paramètres utilisés dans tous les emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app-url">URL de l'application</Label>
            <Input
              id="app-url"
              placeholder="https://votre-domaine.com"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Utilisée dans les emails pour les liens de connexion (variable {"{{app_url}}"})
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="from-name">Nom de l'expéditeur</Label>
              <Input
                id="from-name"
                placeholder="E2D"
                value={emailExpediteurNom}
                onChange={(e) => setEmailExpediteurNom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from-email">Email expéditeur</Label>
              <Input
                id="from-email"
                placeholder="contact@e2d.org"
                value={emailExpediteur}
                onChange={(e) => setEmailExpediteur(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Email Button + Save Button */}
      <div className="flex justify-between items-center">
        <Button 
          variant="outline"
          onClick={sendTestEmail}
          disabled={sendingTestEmail || !emailExpediteur}
        >
          {sendingTestEmail ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Mail className="h-4 w-4 mr-2" />
          )}
          Envoyer un email de test
        </Button>
        
        <Button 
          onClick={() => saveConfigMutation.mutate()}
          disabled={saveConfigMutation.isPending}
          size="lg"
        >
          {saveConfigMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Sauvegarder les modifications
        </Button>
      </div>
    </div>
  );
}
