import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import { useMembers } from "@/hooks/useMembers";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Copy, Mail, CheckCircle2 } from "lucide-react";

import { logger } from "@/lib/logger";
interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ApiResponse<T = Record<string, unknown>> {
  success: boolean;
  code?: string;
  message?: string;
  data?: T;
  userId?: string;
  email?: string;
  tempPassword?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: "Cet email est déjà utilisé",
  INVALID_DATA: "Données invalides",
  SERVER_ERROR: "Erreur serveur, veuillez réessayer",
  EMAIL_SEND_FAILED: "L'email n'a pas pu être envoyé",
  FORBIDDEN: "Accès réservé aux administrateurs",
  UNAUTHENTICATED: "Session expirée, veuillez vous reconnecter",
  USER_NOT_FOUND: "Utilisateur introuvable",
};

function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let p = "";
  for (let i = 0; i < length; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p + "A1!";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const queryClient = useQueryClient();
  const { roles } = useRoles();
  const { members } = useMembers();

  const [step, setStep] = useState<"form" | "created">("form");
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [created, setCreated] = useState<{ userId: string; email: string; password: string } | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    nom: "",
    prenom: "",
    telephone: "",
    password: generatePassword(),
    selectedRoles: [] as string[],
    membreId: "none",
  });

  const availableMembers = members?.filter((m) => !m.user_id) || [];

  // Pré-check email existant (debounce 400ms) — audit Utilisateurs
  useEffect(() => {
    const email = formData.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setEmailExists(null);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      setEmailExists(!!data);
    }, 400);
    return () => clearTimeout(t);
  }, [formData.email]);

  const handleRoleToggle = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedRoles: prev.selectedRoles.includes(roleId)
        ? prev.selectedRoles.filter((r) => r !== roleId)
        : [...prev.selectedRoles, roleId],
    }));
  };

  const resetAll = () => {
    setStep("form");
    setCreated(null);
    setFormData({
      email: "",
      nom: "",
      prenom: "",
      telephone: "",
      password: generatePassword(),
      selectedRoles: [],
      membreId: "none",
    });
  };

  const showError = (resp: ApiResponse | null, fallback: string) => {
    const code = resp?.code;
    const msg = (code && ERROR_MESSAGES[code]) || resp?.message || fallback;
    toast.error(msg);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;

    // Client-side mirror validation
    if (!EMAIL_RE.test(formData.email.trim())) {
      toast.error("Email invalide");
      return;
    }
    if (emailExists === true) {
      toast.error("Cet email est déjà utilisé");
      return;
    }
    if (!formData.nom.trim() || !formData.prenom.trim()) {
      toast.error("Nom et prénom obligatoires");
      return;
    }
    if (formData.password.length < 8) {
      toast.error("Mot de passe trop court (min 8 caractères)");
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke<ApiResponse>("create-user-account", {
        body: {
          email: formData.email.trim().toLowerCase(),
          nom: formData.nom.trim(),
          prenom: formData.prenom.trim(),
          telephone: formData.telephone.trim() || null,
          password: formData.password,
          roleIds: formData.selectedRoles,
          membreId: formData.membreId === "none" ? null : formData.membreId,
        },
      });

      // Edge function non-2xx → error is set, but data still has body
      const resp = (data as ApiResponse) || null;
      if (error && !resp) {
        toast.error("Erreur réseau, veuillez réessayer");
        return;
      }
      if (!resp?.success) {
        showError(resp, "Erreur lors de la création du compte");
        return;
      }

      toast.success("Compte créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
      queryClient.invalidateQueries({ queryKey: ["membres"] });

      setCreated({
        userId: resp.userId!,
        email: resp.email || formData.email,
        password: resp.tempPassword || formData.password,
      });
      setStep("created");
    } catch (err: unknown) {
      logger.error("[CreateUserDialog] create error:", err);
      toast.error("Erreur réseau, veuillez réessayer");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendCredentials = async () => {
    if (!created || isSending) return;
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke<ApiResponse>("send-user-credentials", {
        body: { userId: created.userId, password: created.password, resetPassword: false },
      });
      const resp = (data as ApiResponse) || null;
      if (error && !resp) {
        toast.error("Erreur réseau lors de l'envoi");
        return;
      }
      if (!resp?.success) {
        showError(resp, "Échec de l'envoi de l'email");
        return;
      }
      toast.success(`Identifiants envoyés à ${created.email}`);
    } catch (err: unknown) {
      logger.error("[CreateUserDialog] send error:", err);
      toast.error("Erreur réseau lors de l'envoi");
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copié`);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const handleClose = () => {
    if (isCreating || isSending) return;
    onOpenChange(false);
    setTimeout(resetAll, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>Créer un compte utilisateur</DialogTitle>
              <DialogDescription>
                Le compte est créé d'abord. Vous pourrez ensuite envoyer les identifiants par email.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom *</Label>
                  <Input id="prenom" value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    placeholder="Jean" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom *</Label>
                  <Input id="nom" value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    placeholder="Dupont" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="jean.dupont@example.com" required
                  aria-invalid={emailExists === true} />
                {emailExists === true && (
                  <p className="text-xs text-destructive">Cet email est déjà utilisé</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input id="telephone" value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  placeholder="+237 6 12 34 56 78" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe temporaire *</Label>
                <div className="flex gap-2">
                  <Input id="password" value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                  <Button type="button" variant="outline"
                    onClick={() => setFormData({ ...formData, password: generatePassword() })}>
                    Régénérer
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rôles</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[60px]">
                  {formData.selectedRoles.length === 0 ? (
                    <span className="text-muted-foreground text-sm">Aucun rôle (sera "membre" par défaut)</span>
                  ) : (
                    formData.selectedRoles.map((roleId) => {
                      const role = roles?.find((r) => r.id === roleId);
                      return (
                        <Badge key={roleId} variant="secondary" className="flex items-center gap-1">
                          {role?.name}
                          <button type="button" onClick={() => handleRoleToggle(roleId)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })
                  )}
                </div>
                <Select onValueChange={handleRoleToggle}>
                  <SelectTrigger><SelectValue placeholder="Ajouter un rôle..." /></SelectTrigger>
                  <SelectContent>
                    {roles?.filter((r) => !formData.selectedRoles.includes(r.id))
                      .map((role) => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Lier à un membre (optionnel)</Label>
                <Select value={formData.membreId}
                  onValueChange={(value) => setFormData({ ...formData, membreId: value })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un membre..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {availableMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.prenom} {m.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose} disabled={isCreating}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isCreating} aria-busy={isCreating}>
                  {isCreating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Création...</>
                  ) : "Créer le compte"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === "created" && created && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Compte créé avec succès
              </DialogTitle>
              <DialogDescription>
                Transmettez ces identifiants à l'utilisateur. Vous pouvez les envoyer par email ou les copier.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-md border p-3 space-y-2 bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Email : </span>
                    <span className="font-mono">{created.email}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(created.email, "Email")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Mot de passe : </span>
                    <span className="font-mono">{created.password}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(created.password, "Mot de passe")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                L'utilisateur devra changer ce mot de passe lors de sa première connexion.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isSending}>
                Fermer
              </Button>
              <Button onClick={handleSendCredentials} disabled={isSending} aria-busy={isSending}>
                {isSending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Envoi...</>
                ) : (
                  <><Mail className="h-4 w-4 mr-2" />Envoyer les identifiants</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
