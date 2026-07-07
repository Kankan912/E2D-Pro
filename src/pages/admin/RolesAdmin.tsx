import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRoles } from "@/hooks/useRoles";
import { Plus, Shield, UserPlus, Trash2, Users, Search, Info } from "lucide-react";
import { PermissionsMatrix } from "@/components/admin/PermissionsMatrix";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/admin/StatCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
export default function RolesAdmin() {
  const { roles, isLoading, useUsersWithRoles, assignRole, removeRole } = useRoles();
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState<string>("");
  const [roleToDelete, setRoleToDelete] = useState<{userId: string; roleId: string; roleName: string; userName: string} | null>(null);

  const { data: usersData, isLoading: usersLoading } = useUsersWithRoles();

  // Type assertion needed: useUsersWithRoles returns joined Supabase data with unknown relation types
  const users = (usersData as Array<{ user_id: string; role_id: string | null; profiles: Record<string, string | null>; roles: { id: string; name: string; description: string | null } | null }>) || [];

  // Filter users based on search query
  const filteredUsers = users.filter((user: any) => {
    const fullName = `${user.profiles?.prenom || ''} ${user.profiles?.nom || ''}`.toLowerCase();
    const phone = user.profiles?.telephone || '';
    return fullName.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
  });

  // Calculate statistics
  const totalUsers = users.length;
  const usersWithRolesCount = users.filter((u: any) => u.roles?.name).length;
  const usersWithoutRoles = totalUsers - usersWithRolesCount;

  // Get role distribution
  const roleDistribution = users.reduce((acc: Record<string, number>, user: any) => {
    if (user.roles?.name) {
      acc[user.roles.name] = (acc[user.roles.name] || 0) + 1;
    }
    return acc;
  }, {});

  const mostAssignedRole = Object.entries(roleDistribution).sort((a, b) => (b[1] as number) - (a[1] as number))[0];

  const handleAssignRole = () => {
    if (selectedUser && selectedRoleToAssign) {
      assignRole.mutate(
        { userId: selectedUser.user_id, roleId: selectedRoleToAssign },
        {
          onSuccess: () => {
            setAssignDialogOpen(false);
            setSelectedUser(null);
            setSelectedRoleToAssign("");
          }
        }
      );
    }
  };

  const handleRemoveRole = () => {
    if (roleToDelete) {
      removeRole.mutate(roleToDelete.roleId, {
        onSuccess: () => {
          setRoleToDelete(null);
        }
      });
    }
  };

  const getUserInitials = (prenom?: string, nom?: string) => {
    return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase() || '?';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gestion des Rôles & Permissions</h1>
          <p className="text-muted-foreground mt-1">
            Configurez les droits d'accès pour chaque rôle de l'application
          </p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau Rôle
        </Button>
      </div>

      <Tabs defaultValue="permissions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="permissions">
            <Shield className="mr-2 h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Liste des rôles */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Rôles</CardTitle>
                <CardDescription>
                  Sélectionnez un rôle pour gérer ses permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                ) : (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-2">
                      {roles?.map(role => (
                        <Button
                          key={role.id}
                          variant={selectedRole?.id === role.id ? "default" : "outline"}
                          className="w-full justify-start"
                          onClick={() => setSelectedRole(role)}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          <span className="flex-1 text-left">{role.name}</span>
                          {role.description && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {role.description.substring(0, 3)}
                            </Badge>
                          )}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Permissions du rôle sélectionné */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedRole ? `Permissions - ${selectedRole.name}` : 'Sélectionnez un rôle'}
                </CardTitle>
                <CardDescription>
                  {selectedRole 
                    ? selectedRole.description || "Gérez les permissions d'accès pour ce rôle"
                    : "Cliquez sur un rôle dans la liste pour voir et modifier ses permissions"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedRole ? (
                  <ScrollArea className="h-[500px]">
                    <PermissionsMatrix roleId={selectedRole.id} />
                  </ScrollArea>
                ) : (
                  <div className="flex items-center justify-center h-[500px]">
                    <div className="text-center">
                      <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Aucun rôle sélectionné
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Choisissez un rôle pour configurer ses permissions
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Total Utilisateurs"
              value={totalUsers}
              icon={Users}
            />
            <StatCard
              title="Avec Rôle"
              value={usersWithRolesCount}
              icon={Shield}
            />
            <StatCard
              title="Sans Rôle"
              value={usersWithoutRoles}
              icon={Users}
            />
            <StatCard
              title="Rôle Principal"
              value={mostAssignedRole?.[0] || "N/A"}
              description={mostAssignedRole ? `${mostAssignedRole[1]} utilisateur(s)` : ""}
              icon={Shield}
            />
          </div>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Pour créer un nouveau compte utilisateur, rendez-vous dans{" "}
              <Link to="/admin/membres" className="font-medium underline hover:text-primary">
                Administration &gt; Membres &gt; Onglet Comptes
              </Link>
            </AlertDescription>
          </Alert>

          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Gestion des Utilisateurs</CardTitle>
              <CardDescription>
                Visualisez et gérez les rôles de tous les utilisateurs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom ou téléphone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Badge variant="secondary">
                  {filteredUsers.length} utilisateur(s) trouvé(s)
                </Badge>
              </div>

              {usersLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Chargement des utilisateurs...
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Rôle(s)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Aucun utilisateur trouvé
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={user.profiles?.avatar_url || undefined} />
                                  <AvatarFallback>
                                    {getUserInitials(user.profiles?.prenom, user.profiles?.nom)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">
                                    {user.profiles?.prenom} {user.profiles?.nom}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    ID: {user.user_id.slice(0, 8)}...
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{user.profiles?.telephone || 'N/A'}</TableCell>
                            <TableCell>
                              {user.roles?.name ? (
                                <Badge 
                                  variant={user.roles.name.toLowerCase().includes('admin') ? 'default' : 'secondary'}
                                  className="gap-1"
                                >
                                  {user.roles.name}
                                  <button
                                    onClick={() => setRoleToDelete({
                                      userId: user.user_id,
                                      roleId: user.role_id,
                                      roleName: user.roles.name,
                                      userName: `${user.profiles?.prenom} ${user.profiles?.nom}`
                                    })}
                                    className="ml-1 hover:bg-background/20 rounded-full p-0.5"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ) : (
                                <Badge variant="outline">Aucun rôle</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setAssignDialogOpen(true);
                                }}
                                disabled={assignRole.isPending}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Assigner un rôle
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Assign Role Dialog */}
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assigner un rôle</DialogTitle>
                <DialogDescription>
                  Assigner un rôle à {selectedUser?.profiles?.prenom} {selectedUser?.profiles?.nom}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Select value={selectedRoleToAssign} onValueChange={setSelectedRoleToAssign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map(role => (
                      <SelectItem 
                        key={role.id} 
                        value={role.id}
                        disabled={selectedUser?.roles?.id === role.id}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{role.name}</span>
                          {role.description && (
                            <span className="text-xs text-muted-foreground">{role.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRoleToAssign && roles?.find(r => r.id === selectedRoleToAssign)?.description && (
                  <p className="text-sm text-muted-foreground">
                    {roles.find(r => r.id === selectedRoleToAssign)?.description}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                  Annuler
                </Button>
                <Button 
                  onClick={handleAssignRole}
                  disabled={!selectedRoleToAssign || assignRole.isPending}
                >
                  {assignRole.isPending ? "Assignation..." : "Assigner"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Remove Role Alert Dialog */}
          <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Retirer le rôle ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir retirer le rôle <strong>{roleToDelete?.roleName}</strong> à <strong>{roleToDelete?.userName}</strong> ? Cette action est réversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRemoveRole}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {removeRole.isPending ? "Suppression..." : "Retirer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
