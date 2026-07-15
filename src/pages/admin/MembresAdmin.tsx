import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Edit, Trash2, Search, Download, Mail, Phone, CheckCircle, Clock, UserPlus, Ban, UserX } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMembers, Member } from "@/hooks/useMembers";
import { useMemberCotisationStats } from "@/hooks/useMembers";
import BackButton from "@/components/BackButton";
import { useToast } from "@/hooks/use-toast";
import MemberForm from "@/components/forms/MemberForm";
import MemberDetailSheet from "@/components/MemberDetailSheet";
import UserMemberLinkManager from "@/components/UserMemberLinkManager";
import { ExportService } from "@/lib/exportService";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Composant pour afficher les stats de cotisation d'un membre dans la table
function MemberCotisationCell({ membreId }: { membreId: string }) {
  const { data: stats, isLoading } = useMemberCotisationStats(membreId);
  
  if (isLoading) {
    return <span className="text-muted-foreground text-xs">Chargement...</span>;
  }
  
  if (!stats) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }
  
  return (
    <div className="space-y-1">
      <Badge variant={stats.enRetard ? 'destructive' : 'default'} className="text-xs">
        {stats.pourcentage}%{stats.enRetard && ' - En retard'}
      </Badge>
      <p className="text-xs text-muted-foreground">{stats.payees}/{stats.total} réunions payées</p>
      {stats.dernierPaiement && (
        <p className="text-xs text-muted-foreground">
          Dernière: {format(new Date(stats.dernierPaiement), 'dd/MM/yyyy', { locale: fr })}
        </p>
      )}
    </div>
  );
}

export default function MembresAdmin() {
  const { members: membres = [], isLoading, createMember, updateMember, deleteMember } = useMembers();
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedMemberForDetail, setSelectedMemberForDetail] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState("membres");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusChangeDialog, setStatusChangeDialog] = useState<{ memberId: string; newStatus: string; memberName: string } | null>(null);
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  // Handle status change with confirmation
  const handleStatusChange = async (memberId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('membres')
        .update({ statut: newStatus })
        .eq('id', memberId);
      
      if (error) throw error;
      
      toast({
        title: "Statut modifié",
        description: `Le statut du membre a été changé en "${newStatus}".`
      });
      
      // Invalidate and refetch
      updateMember.mutate({ id: memberId, data: { statut: newStatus } });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de modifier le statut",
        variant: "destructive"
      });
    } finally {
      setStatusChangeDialog(null);
    }
  };

  const openStatusChangeDialog = (membre: Member, newStatus: string) => {
    setStatusChangeDialog({
      memberId: membre.id,
      newStatus,
      memberName: `${membre.prenom} ${membre.nom}`
    });
  };

  // Get status badge variant and icon
  const getStatusBadge = (statut: string | null) => {
    switch (statut) {
      case 'actif':
        return { variant: 'default' as const, icon: CheckCircle, className: 'bg-green-100 text-green-800 hover:bg-green-100' };
      case 'inactif':
        return { variant: 'secondary' as const, icon: Clock, className: 'bg-orange-100 text-orange-800' };
      case 'suspendu':
        return { variant: 'destructive' as const, icon: Ban, className: 'bg-red-100 text-red-800' };
      default:
        return { variant: 'secondary' as const, icon: Clock, className: '' };
    }
  };

  const filteredMembres = membres.filter((membre) =>
    `${membre.nom} ${membre.prenom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    membre.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    membre.telephone?.includes(searchTerm)
  );

  const handleExport = async () => {
    await ExportService.export({
      type: 'membres',
      format: 'excel',
      nom: 'Liste_des_Membres',
    });
  };

  const handleEdit = (membre: Member) => {
    setSelectedMember(membre);
    setShowForm(true);
    setSelectedMemberForDetail(null);
  };

  const handleCreate = () => {
    setSelectedMember(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (data: unknown) => {
    const { role_id, ...memberData } = data;
    
    if (selectedMember) {
      updateMember.mutate(
        { id: selectedMember.id, data: memberData },
        {
          onSuccess: async () => {
            // Gérer le rôle si sélectionné
            if (role_id && role_id !== 'none') {
              // Supprimer l'ancien rôle
              await supabase
                .from('membres_roles')
                .delete()
                .eq('membre_id', selectedMember.id);
              
              // Insérer le nouveau rôle
              await supabase
                .from('membres_roles')
                .insert({ membre_id: selectedMember.id, role_id });
            } else if (role_id === 'none') {
              // Supprimer le rôle si "Aucun" sélectionné
              await supabase
                .from('membres_roles')
                .delete()
                .eq('membre_id', selectedMember.id);
            }
            setShowForm(false);
            setSelectedMember(null);
          },
        }
      );
    } else {
      createMember.mutate(
        { ...memberData, date_inscription: new Date().toISOString().split('T')[0] },
        {
          onSuccess: async (newMember: unknown) => {
            // Assigner le rôle si sélectionné
            if (role_id && role_id !== 'none' && newMember?.id) {
              await supabase
                .from('membres_roles')
                .insert({ membre_id: newMember.id, role_id });
            }
            setShowForm(false);
          },
        }
      );
    }
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMember.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  // Statistiques
  const totalMembres = membres.length;
  const membresActifs = membres.filter(m => m.statut === 'actif').length;
  const membresE2D = membres.filter(m => m.est_membre_e2d).length;
  const membresPhoenix = membres.filter(m => m.est_adherent_phoenix).length;

  return (
    <div className="container mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <BackButton />
          <h1 className="text-2xl font-bold mt-4 text-[#0B6B7C] flex items-center gap-2">
            <Users className="h-7 w-7" />
            Gestion des Membres
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les membres de l'association E2D
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
          {hasPermission('membres', 'create') && (
            <Button onClick={handleCreate} className="bg-[#0B6B7C] hover:bg-[#0a5a68]">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau membre
            </Button>
          )}
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-gray-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Membres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{totalMembres}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              Membres Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">{membresActifs}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-500" />
              Membres E2D
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-cyan-600">{membresE2D}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-red-500" />
              Adhérents Phoenix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-red-600">{membresPhoenix}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Members and Accounts */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="membres" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Liste des membres
          </TabsTrigger>
          <TabsTrigger value="comptes" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Comptes utilisateurs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="membres">
          {/* Section Liste des Membres */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Liste des Membres
                </CardTitle>
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
              <CardDescription>
                {filteredMembres.length} membre(s) trouvé(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Chargement...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom Complet</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Cotisations</TableHead>
                        <TableHead>Types</TableHead>
                        <TableHead>Date d'inscription</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembres.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Aucun membre trouvé
                          </TableCell>
                        </TableRow>
                      ) : filteredMembres.map((membre) => (
                        <TableRow 
                          key={membre.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedMemberForDetail(membre)}
                        >
                          <TableCell className="font-medium">
                            {membre.nom} {membre.prenom}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {membre.email || "Non renseigné"}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {membre.telephone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {hasPermission('membres', 'update') ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="p-0 h-auto">
                                    {(() => {
                                      const { icon: StatusIcon, className } = getStatusBadge(membre.statut);
                                      return (
                                        <Badge variant="outline" className={`flex items-center gap-1 w-fit cursor-pointer ${className}`}>
                                          <StatusIcon className="h-3 w-3" />
                                          {membre.statut || 'inconnu'}
                                        </Badge>
                                      );
                                    })()}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem 
                                    onClick={() => openStatusChangeDialog(membre, 'actif')}
                                    className="text-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Actif
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => openStatusChangeDialog(membre, 'inactif')}
                                    className="text-orange-700"
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    Inactif
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => openStatusChangeDialog(membre, 'suspendu')}
                                    className="text-red-700"
                                  >
                                    <Ban className="h-4 w-4 mr-2" />
                                    Suspendu
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              (() => {
                                const { icon: StatusIcon, className } = getStatusBadge(membre.statut);
                                return (
                                  <Badge variant="outline" className={`flex items-center gap-1 w-fit ${className}`}>
                                    <StatusIcon className="h-3 w-3" />
                                    {membre.statut || 'inconnu'}
                                  </Badge>
                                );
                              })()
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <MemberCotisationCell membreId={membre.id} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {membre.est_membre_e2d && (
                                <Badge variant="outline" className="bg-cyan-50 border-cyan-300 text-cyan-700 text-xs">
                                  E2D
                                </Badge>
                              )}
                              {membre.est_adherent_phoenix && (
                                <Badge variant="outline" className="bg-red-50 border-red-300 text-red-700 text-xs">
                                  Phoenix
                                </Badge>
                              )}
                              {!membre.est_membre_e2d && !membre.est_adherent_phoenix && (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {membre.date_inscription 
                              ? format(new Date(membre.date_inscription), 'dd/MM/yyyy', { locale: fr })
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              {hasPermission('membres', 'update') && (
                                <Button size="sm" variant="ghost" onClick={() => handleEdit(membre)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {hasPermission('membres', 'delete') && (
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(membre.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comptes">
          <UserMemberLinkManager />
        </TabsContent>
      </Tabs>

      {/* Fiche membre détaillée */}
      <MemberDetailSheet
        member={selectedMemberForDetail}
        open={!!selectedMemberForDetail}
        onOpenChange={(open) => !open && setSelectedMemberForDetail(null)}
        onEdit={handleEdit}
      />

      <MemberForm
        open={showForm}
        onOpenChange={setShowForm}
        member={selectedMember}
        onSubmit={handleFormSubmit}
        isLoading={createMember.isPending || updateMember.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce membre ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status change confirmation dialog */}
      <AlertDialog open={!!statusChangeDialog} onOpenChange={() => setStatusChangeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le changement de statut</AlertDialogTitle>
            <AlertDialogDescription>
              {statusChangeDialog?.newStatus === 'inactif' && (
                <span className="text-orange-700">
                  <strong>⚠️ Attention :</strong> En passant {statusChangeDialog?.memberName} en <strong>inactif</strong>, 
                  ce membre ne pourra plus se connecter à l'application.
                </span>
              )}
              {statusChangeDialog?.newStatus === 'suspendu' && (
                <span className="text-red-700">
                  <strong>⚠️ Attention :</strong> En <strong>suspendant</strong> {statusChangeDialog?.memberName}, 
                  ce membre sera immédiatement déconnecté et ne pourra plus accéder à l'application jusqu'à réactivation.
                </span>
              )}
              {statusChangeDialog?.newStatus === 'actif' && (
                <span className="text-green-700">
                  {statusChangeDialog?.memberName} pourra à nouveau se connecter à l'application.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => statusChangeDialog && handleStatusChange(statusChangeDialog.memberId, statusChangeDialog.newStatus)}
              className={
                statusChangeDialog?.newStatus === 'suspendu' ? 'bg-red-600 hover:bg-red-700' :
                statusChangeDialog?.newStatus === 'inactif' ? 'bg-orange-600 hover:bg-orange-700' :
                'bg-green-600 hover:bg-green-700'
              }
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
