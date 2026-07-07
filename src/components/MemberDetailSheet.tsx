import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle 
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  ArrowLeft, Edit, Users, PiggyBank, Banknote, AlertTriangle, 
  Wallet, History, BarChart3, Phone, Mail, CheckCircle, XCircle, Clock, UserCircle, Shield
} from "lucide-react";
import { Member, useMemberDetails } from "@/hooks/useMembers";
import { formatFCFA } from "@/lib/utils";
import logoE2D from "@/assets/logo-e2d.png";

// Hook pour récupérer les infos du compte utilisateur lié au membre
function useLinkedUserAccount(userId: string | null) {
  return useQuery({
    queryKey: ["linked-user-account", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, nom, prenom, telephone, status, last_login, password_changed")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) return null;

      // Get user roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("roles(name)")
        .eq("user_id", userId);

      const roles = userRoles?.map((ur: unknown) => (ur as { roles?: { name?: string } }).roles?.name).filter(Boolean) || [];

      return {
        ...profile,
        roles,
      };
    },
    enabled: !!userId,
  });
}

interface MemberDetailSheetProps {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (member: Member) => void;
}

export default function MemberDetailSheet({ member, open, onOpenChange, onEdit }: MemberDetailSheetProps) {
  const { cotisations, epargnes, prets, sanctions, operations, stats, isLoading } = useMemberDetails(member?.id || null);
  const { data: linkedAccount, isLoading: isLoadingAccount } = useLinkedUserAccount(member?.user_id || null);
  const [activeTab, setActiveTab] = useState("cotisations");

  if (!member) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logoE2D} alt="E2D" className="h-10 w-10 object-contain" />
              <SheetTitle className="text-xl">Fiche de {member.prenom} {member.nom}</SheetTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              <Button size="sm" onClick={() => onEdit(member)}>
                <Edit className="h-4 w-4 mr-1" /> Éditer
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* En-tête Profil */}
        <div className="py-4 border-b">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={member.photo_url || undefined} />
              <AvatarFallback className="text-2xl bg-primary/10">
                {member.prenom[0]}{member.nom[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{member.prenom} {member.nom}</h2>
                <Badge variant={member.statut === 'actif' ? 'default' : 'secondary'}>
                  {member.statut === 'actif' ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                  {member.statut}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" /> {member.email || "Non renseigné"}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" /> {member.telephone}
                </span>
              </div>
              <div className="flex gap-2">
                {member.est_membre_e2d && <Badge variant="outline" className="bg-cyan-50 border-cyan-300 text-cyan-700">E2D</Badge>}
                {member.est_adherent_phoenix && <Badge variant="outline" className="bg-red-50 border-red-300 text-red-700">Phoenix</Badge>}
                {member.fonction && <Badge variant="secondary">{member.fonction}</Badge>}
              </div>
            </div>
          </div>

          {/* Encart Compte Utilisateur (lecture seule) */}
          <Card className="mt-4 bg-muted/50">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Compte Utilisateur
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-3">
              {isLoadingAccount ? (
                <Skeleton className="h-8 w-full" />
              ) : linkedAccount ? (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={linkedAccount.status === 'actif' ? 'default' : linkedAccount.status === 'desactive' ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {linkedAccount.status === 'actif' ? 'Actif' : linkedAccount.status === 'desactive' ? 'Désactivé' : 'Supprimé'}
                    </Badge>
                    {linkedAccount.roles.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {linkedAccount.roles.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {linkedAccount.last_login 
                      ? `Dernière connexion: ${format(new Date(linkedAccount.last_login), 'dd/MM/yyyy HH:mm', { locale: fr })}`
                      : 'Jamais connecté'
                    }
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Aucun compte utilisateur lié à ce membre
                </p>
              )}
            </CardContent>
          </Card>

          {/* Statistiques rapides */}
          {isLoading ? (
            <div className="grid grid-cols-3 gap-4 mt-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 mt-4">
              <Card className="bg-green-50 dark:bg-green-950/30 border-green-200">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatFCFA(stats.totalEpargne)}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Épargne totale</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatFCFA(stats.totalEmprunte)}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-500">Total emprunté</p>
                </CardContent>
              </Card>
              <Card className={`${stats.pourcentageCotisation < 100 ? 'bg-red-50 dark:bg-red-950/30 border-red-200' : 'bg-gray-50 dark:bg-gray-950/30 border-gray-200'}`}>
                <CardContent className="p-3 text-center">
                  <p className={`text-lg font-bold ${stats.pourcentageCotisation < 100 ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-400'}`}>
                    {stats.cotisationsTotal - stats.cotisationsPayees}
                  </p>
                  <p className={`text-xs ${stats.pourcentageCotisation < 100 ? 'text-red-600 dark:text-red-500' : 'text-gray-600 dark:text-gray-500'}`}>
                    Cotisations en retard
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Onglets */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-7 h-auto">
            <TabsTrigger value="cotisations" className="text-xs py-2 flex flex-col gap-1">
              <Users className="h-4 w-4" />
              Cotisations
            </TabsTrigger>
            <TabsTrigger value="epargnes" className="text-xs py-2 flex flex-col gap-1">
              <PiggyBank className="h-4 w-4" />
              Épargnes
            </TabsTrigger>
            <TabsTrigger value="prets" className="text-xs py-2 flex flex-col gap-1">
              <Banknote className="h-4 w-4" />
              Prêts
            </TabsTrigger>
            <TabsTrigger value="sanctions" className="text-xs py-2 flex flex-col gap-1">
              <AlertTriangle className="h-4 w-4" />
              Sanctions
            </TabsTrigger>
            <TabsTrigger value="caisse" className="text-xs py-2 flex flex-col gap-1">
              <Wallet className="h-4 w-4" />
              F. Caisse
            </TabsTrigger>
            <TabsTrigger value="historique" className="text-xs py-2 flex flex-col gap-1">
              <History className="h-4 w-4" />
              Historique
            </TabsTrigger>
            <TabsTrigger value="resume" className="text-xs py-2 flex flex-col gap-1">
              <BarChart3 className="h-4 w-4" />
              Résumé
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <>
              {/* Onglet Cotisations */}
              <TabsContent value="cotisations" className="mt-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Historique des Cotisations</span>
                      <Badge variant={stats.pourcentageCotisation >= 100 ? 'default' : 'destructive'}>
                        {stats.pourcentageCotisation}% payées
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Réunion</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cotisations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Aucune cotisation enregistrée
                            </TableCell>
                          </TableRow>
                        ) : cotisations.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{c.type_cotisation?.nom || "Standard"}</TableCell>
                            <TableCell className="text-xs">{c.reunion?.sujet || "-"}</TableCell>
                            <TableCell>{formatFCFA(c.montant)}</TableCell>
                            <TableCell className="text-xs">{c.date_paiement ? format(new Date(c.date_paiement), 'dd/MM/yyyy', { locale: fr }) : "-"}</TableCell>
                            <TableCell>
                              <Badge variant={c.statut === 'paye' ? 'default' : 'secondary'}>
                                {c.statut === 'paye' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                                {c.statut}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Onglet Épargnes */}
              <TabsContent value="epargnes" className="mt-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Dépôts d'Épargne</span>
                      <Badge className="bg-green-600">{formatFCFA(stats.totalEpargne)}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Réunion</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {epargnes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Aucune épargne enregistrée
                            </TableCell>
                          </TableRow>
                        ) : epargnes.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs">{format(new Date(e.date_depot), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                            <TableCell className="text-xs">{e.reunion?.sujet || "-"}</TableCell>
                            <TableCell className="font-medium text-green-600">{formatFCFA(e.montant)}</TableCell>
                            <TableCell><Badge variant="outline">{e.statut}</Badge></TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate">{e.notes || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Onglet Prêts */}
              <TabsContent value="prets" className="mt-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Historique des Prêts</span>
                      <Badge className="bg-blue-600">{stats.pretsEnCours} en cours</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Remboursé</TableHead>
                          <TableHead>Échéance</TableHead>
                          <TableHead>Taux</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {prets.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Aucun prêt enregistré
                            </TableCell>
                          </TableRow>
                        ) : prets.map((p) => {
                          const progression = p.montant > 0 ? ((p.montant_paye || 0) / p.montant) * 100 : 0;
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs">{format(new Date(p.date_pret), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                              <TableCell className="font-medium">{formatFCFA(p.montant)}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <span className="text-xs">{formatFCFA(p.montant_paye || 0)}</span>
                                  <Progress value={progression} className="h-1" />
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">{format(new Date(p.echeance), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                              <TableCell>{p.taux_interet}%</TableCell>
                              <TableCell>
                                <Badge variant={p.statut === 'rembourse' ? 'default' : p.statut === 'en_cours' ? 'secondary' : 'destructive'}>
                                  {p.statut}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Onglet Sanctions */}
              <TabsContent value="sanctions" className="mt-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Sanctions et Amendes</span>
                      <Badge variant="destructive">{stats.sanctionsEnCours} en attente</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Motif</TableHead>
                          <TableHead>Amende</TableHead>
                          <TableHead>Réunion</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sanctions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Aucune sanction enregistrée
                            </TableCell>
                          </TableRow>
                        ) : sanctions.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="text-xs">{format(new Date(s.created_at), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                            <TableCell>{s.motif}</TableCell>
                            <TableCell className="font-medium text-red-600">{formatFCFA(s.montant_amende)}</TableCell>
                            <TableCell className="text-xs">{s.reunion?.sujet || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={s.statut === 'payee' ? 'default' : 'secondary'}>
                                {s.statut}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Onglet Fond Caisse */}
              <TabsContent value="caisse" className="mt-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Opérations Fond de Caisse</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Libellé</TableHead>
                          <TableHead>Montant</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {operations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              Aucune opération trouvée
                            </TableCell>
                          </TableRow>
                        ) : operations.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="text-xs">{format(new Date(o.date_operation), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                            <TableCell>
                              <Badge variant={o.type_operation === 'entree' ? 'default' : 'secondary'}>
                                {o.type_operation === 'entree' ? '+' : '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{o.libelle}</TableCell>
                            <TableCell className={o.type_operation === 'entree' ? 'text-green-600' : 'text-red-600'}>
                              {formatFCFA(o.montant)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Onglet Historique */}
              <TabsContent value="historique" className="mt-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Historique Complet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {[
                        ...cotisations.map(c => ({ type: 'cotisation', date: c.date_paiement || '', data: c })),
                        ...epargnes.map(e => ({ type: 'epargne', date: e.date_depot, data: e })),
                        ...prets.map(p => ({ type: 'pret', date: p.date_pret, data: p })),
                        ...sanctions.map(s => ({ type: 'sanction', date: s.created_at, data: s })),
                      ]
                        .filter(item => item.date)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 20)
                        .map((item, index) => (
                          <div key={index} className="flex items-center gap-3 p-2 border rounded-lg text-sm">
                            <Badge variant="outline" className="shrink-0">
                              {item.type === 'cotisation' && <Users className="h-3 w-3 mr-1" />}
                              {item.type === 'epargne' && <PiggyBank className="h-3 w-3 mr-1" />}
                              {item.type === 'pret' && <Banknote className="h-3 w-3 mr-1" />}
                              {item.type === 'sanction' && <AlertTriangle className="h-3 w-3 mr-1" />}
                              {item.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(item.date), 'dd/MM/yyyy', { locale: fr })}
                            </span>
                            <span className="font-medium">
                              {formatFCFA('montant' in item.data ? item.data.montant : ('montant_amende' in item.data ? item.data.montant_amende : 0))}
                            </span>
                          </div>
                        ))
                      }
                      {cotisations.length === 0 && epargnes.length === 0 && prets.length === 0 && sanctions.length === 0 && (
                        <p className="text-center py-8 text-muted-foreground">Aucune activité enregistrée</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Onglet Résumé */}
              <TabsContent value="resume" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Cotisations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-medium">{stats.cotisationsTotal}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payées</span>
                          <span className="font-medium text-green-600">{stats.cotisationsPayees}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">En retard</span>
                          <span className="font-medium text-red-600">{stats.cotisationsTotal - stats.cotisationsPayees}</span>
                        </div>
                        <Progress value={stats.pourcentageCotisation} className="mt-2" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <PiggyBank className="h-4 w-4" />
                        Épargne
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total épargné</span>
                          <span className="font-medium text-green-600">{formatFCFA(stats.totalEpargne)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Nb de dépôts</span>
                          <span className="font-medium">{epargnes.length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        Prêts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total emprunté</span>
                          <span className="font-medium">{formatFCFA(stats.totalEmprunte)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total remboursé</span>
                          <span className="font-medium text-green-600">{formatFCFA(stats.totalRembourse)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Prêts en cours</span>
                          <span className="font-medium text-blue-600">{stats.pretsEnCours}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Sanctions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total sanctions</span>
                          <span className="font-medium">{sanctions.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">En attente</span>
                          <span className="font-medium text-red-600">{stats.sanctionsEnCours}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
