import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePersonalSummary } from "@/hooks/usePersonalData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { User, Heart, Receipt, Settings, PiggyBank, AlertTriangle, Wallet, Calendar, HandHeart } from "lucide-react";
import { formatFCFA } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

const DashboardHome = () => {
  const navigate = useNavigate();
  const { profile, userRole } = useAuth();
  const { membre, summary, isLoading } = usePersonalSummary();
  const { hasAnyPermission } = usePermissions();

  const quickActions = [
    { title: "Mon Profil", description: "Informations personnelles", icon: User, href: "/dashboard/profile", color: "text-blue-500" },
    { title: "Mes Dons", description: "Historique des dons", icon: Heart, href: "/dashboard/my-donations", color: "text-red-500" },
    { title: "Mes Cotisations", description: "Cotisations et paiements", icon: Receipt, href: "/dashboard/my-cotisations", color: "text-green-500" },
    { title: "Mes Épargnes", description: "Dépôts d'épargne", icon: PiggyBank, href: "/dashboard/my-epargnes", color: "text-emerald-500" },
    { title: "Mes Présences", description: "Historique des réunions", icon: Calendar, href: "/dashboard/my-presences", color: "text-purple-500" },
    { title: "Mes Sanctions", description: "Sanctions et pénalités", icon: AlertTriangle, href: "/dashboard/my-sanctions", color: "text-orange-500" },
    { title: "Mes Prêts", description: "Prêts et remboursements", icon: Wallet, href: "/dashboard/my-prets", color: "text-cyan-500" },
    { title: "Mes Aides", description: "Aides reçues", icon: HandHeart, href: "/dashboard/my-aides", color: "text-pink-500" },
  ];

  const isAdmin = userRole === "administrateur";
  const hasAdminAccess = hasAnyPermission([
    { resource: 'membres', permission: 'read' },
    { resource: 'prets', permission: 'read' },
    { resource: 'cotisations', permission: 'read' },
    { resource: 'epargnes', permission: 'read' },
    { resource: 'reunions', permission: 'read' },
    { resource: 'aides', permission: 'read' },
    { resource: 'donations', permission: 'read' },
    { resource: 'config', permission: 'read' },
    { resource: 'stats', permission: 'read' },
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Bienvenue, {profile?.prenom} {profile?.nom} !
        </h1>
        <p className="text-muted-foreground mt-2">Votre tableau de bord E2D Connect</p>
      </div>

      {/* Résumé Personnel */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-green-500" />
              Total Épargnes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold text-green-600">
                {formatFCFA(summary.totalEpargnes)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Taux de Présence
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold text-blue-600">{summary.tauxPresence}%</div>
            )}
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${summary.sanctionsImpayees > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${summary.sanctionsImpayees > 0 ? 'text-red-500' : ''}`} />
              Sanctions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              summary.sanctionsImpayees > 0 ? (
                <div className="text-2xl font-bold text-red-600">
                  {summary.sanctionsImpayees} impayée(s)
                </div>
              ) : (
                <div className="text-2xl font-bold text-green-600">Aucune</div>
              )
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-cyan-500" />
              Prêts en cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold text-cyan-600">{summary.pretsEnCours}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Statut membre */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rôle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {userRole === 'administrateur' && '👑 Super Administrateur'}
              {userRole === 'tresorier' && '💰 Trésorier'}
              {userRole === 'secretaire_general' && '📝 Secrétaire Général'}
              {userRole === 'responsable_sportif' && '⚽ Responsable Sportif'}
              {userRole === 'censeur' && '⚖️ Censeur'}
              {userRole === 'commissaire_comptes' && '🔍 Commissaire aux Comptes'}
              {userRole === 'membre' && '👤 Membre'}
              {!userRole && '👤 Membre'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Statut Membre</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <Badge variant={membre?.statut === 'actif' ? 'default' : 'secondary'} className="text-lg px-3 py-1">
                {membre?.statut === 'actif' ? '✅ Actif' : membre?.statut || 'Non lié'}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">Actions rapides</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Card key={action.href} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(action.href)}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <action.icon className={`h-6 w-6 ${action.color}`} />
                  <div>
                    <CardTitle className="text-base">{action.title}</CardTitle>
                    <CardDescription className="text-xs">{action.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {hasAdminAccess && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>{isAdmin ? '👑 Accès Super Administrateur' : '🔧 Accès Administration'}</CardTitle>
            <CardDescription>
              {isAdmin ? 'Accès complet à toutes les fonctionnalités' : "Accès aux fonctionnalités d'administration"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => navigate("/dashboard/admin/permissions")} variant={isAdmin ? "default" : "outline"}>
              <Settings className="h-4 w-4 mr-2" />
              Permissions
            </Button>
            <Button onClick={() => navigate("/dashboard/admin/donations")} variant="outline">
              Gérer les Dons
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardHome;
