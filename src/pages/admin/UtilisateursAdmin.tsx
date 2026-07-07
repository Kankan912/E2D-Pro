import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  useUtilisateurs,
  useUpdateUtilisateurStatus,
  useForcePasswordChange,
  useAssignRole,
  useRemoveRole,
  useUnlinkMembre,
  useUserConnections,
  Utilisateur,
} from "@/hooks/useUtilisateurs";
import { useRoles } from "@/hooks/useRoles";
import { useMembers } from "@/hooks/useMembers";
import { useLinkMembre } from "@/hooks/useUtilisateurs";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  Trash2,
  KeyRound,
  Shield,
  Link,
  Unlink,
  Clock,
  Loader2,
  UserCircle,
  UserPlus,
  AlertCircle,
  RefreshCw,
  Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { logger } from "@/lib/logger";
interface UtilisateursAdminProps {
  embedded?: boolean;
}

export default function UtilisateursAdmin({ embedded = false }: UtilisateursAdminProps) {
  const { data: utilisateurs, isLoading, error, refetch } = useUtilisateurs();
  const { roles } = useRoles();
  const { members: membres } = useMembers();
  const updateStatus = useUpdateUtilisateurStatus();
  const forcePasswordChange = useForcePasswordChange();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const linkMembre = useLinkMembre();
  const unlinkMembre = useUnlinkMembre();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<Utilisateur | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedMembreId, setSelectedMembreId] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResendCredentials = async (userId: string) => {
    if (resendingId) return;
    setResendingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke<{
        success: boolean; code?: string; message?: string; email?: string;
      }>("send-user-credentials", {
        body: { userId, resetPassword: true },
      });
      const resp = data || null;
      if (error && !resp) {
        toast.error("Erreur réseau lors de l'envoi");
        return;
      }
      if (!resp?.success) {
        const codes: Record<string, string> = {
          EMAIL_SEND_FAILED: "L'email n'a pas pu être envoyé",
          USER_NOT_FOUND: "Utilisateur introuvable",
          FORBIDDEN: "Accès réservé aux administrateurs",
          SERVER_ERROR: "Erreur serveur, veuillez réessayer",
        };
        toast.error((resp?.code && codes[resp.code]) || resp?.message || "Échec de l'envoi");
        return;
      }
      toast.success(`Nouveaux identifiants envoyés à ${resp.email}`);
    } catch (err: unknown) {
      logger.error("[UtilisateursAdmin] resend error:", err);
      toast.error("Erreur réseau lors de l'envoi");
    } finally {
      setResendingId(null);
    }
  };

  const { data: userConnections } = useUserConnections(selectedUser?.id || null);

  // Filter utilisateurs - include phone in search
  const filtered = utilisateurs?.filter((u) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      u.email.toLowerCase().includes(searchLower) ||
      `${u.prenom} ${u.nom}`.toLowerCase().includes(searchLower) ||
      (u.telephone && u.telephone.toLowerCase().includes(searchLower));
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: utilisateurs?.length || 0,
    actifs: utilisateurs?.filter((u) => u.status === "actif").length || 0,
    desactives: utilisateurs?.filter((u) => u.status === "desactive").length || 0,
  };

  // Available members (not linked to any user)
  const availableMembers = membres?.filter(
    (m) => !m.user_id || m.id === selectedUser?.membre_id
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "actif":
        return <Badge className="bg-green-500">Actif</Badge>;
      case "desactive":
        return <Badge variant="secondary">Désactivé</Badge>;
      case "supprime":
        return <Badge variant="destructive">Supprimé</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleStatusChange = (userId: string, newStatus: string) => {
    updateStatus.mutate({ userId, status: newStatus });
  };

  const handleForcePasswordChange = (userId: string) => {
    forcePasswordChange.mutate(userId);
  };

  const handleAssignRole = () => {
    if (selectedUser && selectedRoleId) {
      assignRole.mutate({ userId: selectedUser.id, roleId: selectedRoleId });
      setSelectedRoleId("");
    }
  };

  const handleRemoveRole = (roleId: string) => {
    if (selectedUser) {
      removeRole.mutate({ userId: selectedUser.id, roleId });
    }
  };

  const handleLinkMembre = () => {
    if (selectedUser && selectedMembreId) {
      linkMembre.mutate({ membreId: selectedMembreId, userId: selectedUser.id });
      setSelectedMembreId("");
    }
  };

  const handleUnlinkMembre = () => {
    if (selectedUser?.membre_id) {
      unlinkMembre.mutate(selectedUser.membre_id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              Gestion des Utilisateurs
            </h1>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur d'accès</AlertTitle>
          <AlertDescription>
            {error instanceof Error && error.message.includes("permission")
              ? "Vous n'avez pas les droits nécessaires pour accéder à cette page. Vérifiez que votre rôle (administrateur, trésorier) est correctement assigné."
              : `Impossible de charger les utilisateurs: ${error instanceof Error ? error.message : "Erreur inconnue"}`}
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              Gestion des Utilisateurs
            </h1>
            <p className="text-muted-foreground mt-2">
              Gérez les comptes utilisateurs, leurs rôles et leurs accès
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Créer un utilisateur
          </Button>
        </div>
      )}
      {embedded && (
        <div className="flex justify-end">
          <Button onClick={() => setShowCreateDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Créer un utilisateur
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Utilisateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.actifs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Désactivés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {stats.desactives}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par email, nom ou téléphone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="actif">Actif</SelectItem>
                <SelectItem value="desactive">Désactivé</SelectItem>
                <SelectItem value="supprime">Supprimé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Rôle(s)</TableHead>
                <TableHead>Membre lié</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserCircle className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {user.prenom} {user.nom}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <Badge key={role.id} variant="outline">
                            {role.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Aucun rôle
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.membre_nom ? (
                      <Badge variant="secondary">{user.membre_nom}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Non lié
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.last_login ? (
                      <span className="text-sm">
                        {format(new Date(user.last_login), "dd/MM/yyyy HH:mm", {
                          locale: fr,
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Jamais
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                          <Shield className="h-4 w-4 mr-2" />
                          Gérer les rôles
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleForcePasswordChange(user.id)}
                        >
                          <KeyRound className="h-4 w-4 mr-2" />
                          Forcer changement MDP
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleResendCredentials(user.id)}
                          disabled={resendingId === user.id}
                        >
                          {resendingId === user.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4 mr-2" />
                          )}
                          Renvoyer les identifiants
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.status === "actif" ? (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(user.id, "desactive")}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Désactiver
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(user.id, "actif")}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Activer
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(user.id, "supprime")}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!filtered || filtered.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {utilisateurs && utilisateurs.length > 0
                          ? "Aucun utilisateur ne correspond à vos critères de recherche"
                          : "Aucun utilisateur trouvé. Créez le premier compte !"}
                      </p>
                      {utilisateurs && utilisateurs.length === 0 && (
                        <Button onClick={() => setShowCreateDialog(true)} variant="outline" className="mt-2">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Créer un utilisateur
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Detail Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Détails de {selectedUser?.prenom} {selectedUser?.nom}
            </SheetTitle>
          </SheetHeader>

          {selectedUser && (
            <div className="mt-6 space-y-6">
              {/* User Info */}
              <div className="space-y-2">
                <h3 className="font-semibold">Informations</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{selectedUser.email}</span>
                  <span className="text-muted-foreground">Téléphone:</span>
                  <span>{selectedUser.telephone || "Non renseigné"}</span>
                  <span className="text-muted-foreground">Statut:</span>
                  <span>{getStatusBadge(selectedUser.status)}</span>
                  <span className="text-muted-foreground">MDP changé:</span>
                  <span>{selectedUser.password_changed ? "Oui" : "Non"}</span>
                </div>
              </div>

              {/* Roles Management */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Rôles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.roles.map((role) => (
                    <Badge
                      key={role.id}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {role.name}
                      <button
                        onClick={() => handleRemoveRole(role.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Ajouter un rôle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles
                        ?.filter(
                          (r) => !selectedUser.roles.some((ur) => ur.id === r.id)
                        )
                        .map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAssignRole} disabled={!selectedRoleId}>
                    Ajouter
                  </Button>
                </div>
              </div>

              {/* Member Link */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Membre associé
                </h3>
                {selectedUser.membre_id ? (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span>{selectedUser.membre_nom}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnlinkMembre}
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      Délier
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select
                      value={selectedMembreId}
                      onValueChange={setSelectedMembreId}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Lier à un membre..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembers?.map((membre) => (
                          <SelectItem key={membre.id} value={membre.id}>
                            {membre.prenom} {membre.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleLinkMembre} disabled={!selectedMembreId}>
                      Lier
                    </Button>
                  </div>
                )}
              </div>

              {/* Connection History */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Historique des connexions
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {userConnections && userConnections.length > 0 ? (
                    userConnections.map((conn: any) => (
                      <div
                        key={conn.id}
                        className="flex justify-between items-center p-2 bg-muted rounded text-sm"
                      >
                        <span>
                          {format(
                            new Date(conn.date_connexion),
                            "dd/MM/yyyy HH:mm",
                            { locale: fr }
                          )}
                        </span>
                        <Badge
                          variant={
                            conn.statut === "succes" ? "default" : "destructive"
                          }
                        >
                          {conn.statut}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucune connexion enregistrée
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create User Dialog */}
      <CreateUserDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
}
