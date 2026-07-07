import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Link2, Unlink, Mail, Search, Loader2, AlertCircle, CheckCircle, RefreshCw, Ban, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Member {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string;
  user_id: string | null;
  statut: string | null;
}

interface Profile {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
}

// Helper function to check data desynchronization
const isDesynchronized = (member: Member, profile: Profile | null): boolean => {
  if (!profile) return false;
  return member.nom !== profile.nom || 
         member.prenom !== profile.prenom || 
         member.telephone !== profile.telephone;
};

// Get status badge styling
const getStatusStyle = (statut: string | null) => {
  switch (statut) {
    case 'actif':
      return { className: 'bg-green-100 text-green-800', icon: CheckCircle };
    case 'inactif':
      return { className: 'bg-orange-100 text-orange-800', icon: Clock };
    case 'suspendu':
      return { className: 'bg-red-100 text-red-800', icon: Ban };
    default:
      return { className: 'bg-gray-100 text-gray-800', icon: AlertCircle };
  }
};

export default function UserMemberLinkManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showCreateAccountDialog, setShowCreateAccountDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // Fetch members with their link status
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members-with-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom, email, telephone, user_id, statut')
        .order('nom');
      if (error) throw error;
      return data as Member[];
    }
  });

  // Fetch orphan profiles (profiles without a linked member)
  const { data: orphanProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['orphan-profiles'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, nom, prenom, telephone');
      if (profError) throw profError;

      // Get all members with user_id
      const { data: linkedMembers, error: memError } = await supabase
        .from('membres')
        .select('user_id')
        .not('user_id', 'is', null);
      if (memError) throw memError;

      const linkedUserIds = linkedMembers.map(m => m.user_id);
      return (profiles || []).filter(p => !linkedUserIds.includes(p.id)) as Profile[];
    }
  });

  // Fetch all profiles for sync check
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nom, prenom, telephone');
      if (error) throw error;
      return data as Profile[];
    }
  });

  // Sync member data to profile
  const syncMemberMutation = useMutation({
    mutationFn: async (member: Member) => {
      if (!member.user_id) throw new Error('Membre non lié à un compte');
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          nom: member.nom, 
          prenom: member.prenom, 
          telephone: member.telephone 
        })
        .eq('id', member.user_id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      toast({ title: "Synchronisé", description: "Les données du profil ont été mises à jour." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  // Get profile for a member
  const getProfileForMember = (member: Member): Profile | null => {
    if (!member.user_id) return null;
    return allProfiles.find(p => p.id === member.user_id) || null;
  };

  // Link member to existing profile
  const linkMemberMutation = useMutation({
    mutationFn: async ({ memberId, userId }: { memberId: string; userId: string }) => {
      const { error } = await supabase
        .from('membres')
        .update({ user_id: userId })
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members-with-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['orphan-profiles'] });
      toast({ title: "Liaison effectuée", description: "Le compte utilisateur a été lié au membre." });
      setShowLinkDialog(false);
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  // Unlink member from profile
  const unlinkMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('membres')
        .update({ user_id: null })
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members-with-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['orphan-profiles'] });
      toast({ title: "Déliaison effectuée", description: "Le membre n'est plus lié à un compte." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  // Create account for member
  const handleCreateAccount = async () => {
    if (!selectedMember || !newAccountEmail) return;
    
    setIsCreatingAccount(true);
    try {
      // Call edge function to create account
      const { data, error } = await supabase.functions.invoke('create-user-account', {
        body: {
          email: newAccountEmail,
          memberId: selectedMember.id,
          memberNom: selectedMember.nom,
          memberPrenom: selectedMember.prenom,
          memberTelephone: selectedMember.telephone,
          tempPassword: tempPassword || undefined
        }
      });

      if (error) {
        const errorMessage = data?.error || error.message;
        throw new Error(errorMessage);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({ 
        title: "Compte créé", 
        description: `Un email avec les identifiants a été envoyé à ${newAccountEmail}` 
      });
      
      queryClient.invalidateQueries({ queryKey: ['members-with-accounts'] });
      setShowCreateAccountDialog(false);
      setSelectedMember(null);
      setNewAccountEmail("");
      setTempPassword("");
    } catch (error: unknown) {
      toast({ 
        title: "Erreur de création", 
        description: error instanceof Error ? error.message : "Impossible de créer le compte", 
        variant: "destructive" 
      });
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const openCreateAccountDialog = (member: Member) => {
    setSelectedMember(member);
    setNewAccountEmail(member.email || "");
    setTempPassword(Math.random().toString(36).slice(-8) + "A1!");
    setShowCreateAccountDialog(true);
  };

  const openLinkDialog = (member: Member) => {
    setSelectedMember(member);
    setShowLinkDialog(true);
  };

  const filteredMembers = members.filter(m =>
    `${m.nom} ${m.prenom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const membersWithoutAccount = members.filter(m => !m.user_id);
  const membersWithAccount = members.filter(m => m.user_id);

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Membres avec compte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-green-600">{membersWithAccount.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Membres sans compte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-orange-600">{membersWithoutAccount.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Unlink className="h-4 w-4 text-blue-500" />
              Profils orphelins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">{orphanProfiles.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alert for members without account */}
      {membersWithoutAccount.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            {membersWithoutAccount.length} membre(s) n'ont pas encore de compte utilisateur. 
            Créez un compte pour leur permettre de se connecter.
          </AlertDescription>
        </Alert>
      )}

      {/* Members list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Gestion des comptes utilisateurs
              </CardTitle>
              <CardDescription>
                Créez et liez des comptes utilisateurs aux membres
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un membre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="text-center py-8 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Chargement...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Statut membre</TableHead>
                  <TableHead>Statut compte</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun membre trouvé
                    </TableCell>
                  </TableRow>
                ) : filteredMembers.map((member) => {
                  const profile = getProfileForMember(member);
                  const desync = isDesynchronized(member, profile);
                  const { className: statusClass, icon: StatusIcon } = getStatusStyle(member.statut);
                  
                  return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {member.nom} {member.prenom}
                        {desync && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">
                                  <RefreshCw className="h-3 w-3" />
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Données désynchronisées avec le profil</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {member.email || "Non renseigné"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`flex items-center gap-1 w-fit ${statusClass}`}>
                        <StatusIcon className="h-3 w-3" />
                        {member.statut || 'inconnu'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.user_id ? (
                        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Compte lié
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pas de compte
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.user_id ? (
                        <div className="flex gap-1 justify-end">
                          {desync && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => syncMemberMutation.mutate(member)}
                              disabled={syncMemberMutation.isPending}
                            >
                              <RefreshCw className={`h-4 w-4 mr-1 ${syncMemberMutation.isPending ? 'animate-spin' : ''}`} />
                              Sync
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => unlinkMemberMutation.mutate(member.id)}
                          >
                            <Unlink className="h-4 w-4 mr-1" />
                            Délier
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          {member.statut !== 'actif' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="bg-orange-100 text-orange-700 text-xs">
                                    <AlertCircle className="h-3 w-3" />
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ce membre est {member.statut}. Le compte ne pourra pas se connecter.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openLinkDialog(member)}
                          >
                            <Link2 className="h-4 w-4 mr-1" />
                            Lier
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openCreateAccountDialog(member)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Créer compte
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create account dialog */}
      <Dialog open={showCreateAccountDialog} onOpenChange={setShowCreateAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un compte utilisateur</DialogTitle>
            <DialogDescription>
              Un email sera envoyé au membre avec ses identifiants de connexion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Membre</Label>
              <Input 
                value={selectedMember ? `${selectedMember.nom} ${selectedMember.prenom}` : ''} 
                disabled 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email du compte</Label>
              <Input
                id="email"
                type="email"
                value={newAccountEmail}
                onChange={(e) => setNewAccountEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe temporaire</Label>
              <Input
                id="password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Sera généré automatiquement si vide"
              />
              <p className="text-xs text-muted-foreground">
                L'utilisateur devra changer ce mot de passe à sa première connexion.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAccountDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateAccount} disabled={isCreatingAccount || !newAccountEmail}>
              {isCreatingAccount ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Créer et envoyer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to existing profile dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lier à un compte existant</DialogTitle>
            <DialogDescription>
              Sélectionnez un compte utilisateur existant à lier à ce membre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Membre</Label>
              <Input 
                value={selectedMember ? `${selectedMember.nom} ${selectedMember.prenom}` : ''} 
                disabled 
              />
            </div>
            <div className="space-y-2">
              <Label>Comptes disponibles ({orphanProfiles.length})</Label>
              {profilesLoading ? (
                <div className="text-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </div>
              ) : orphanProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucun compte utilisateur orphelin disponible. 
                  Créez un nouveau compte pour ce membre.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {orphanProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => selectedMember && linkMemberMutation.mutate({ 
                        memberId: selectedMember.id, 
                        userId: profile.id 
                      })}
                    >
                      <span className="text-sm">{profile.nom} {profile.prenom}</span>
                      <Button size="sm" variant="ghost">
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
