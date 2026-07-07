import { AssociationSwitcher } from "@/components/AssociationSwitcher";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User, Home, Menu } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { SidebarTrigger } from "@/components/ui/sidebar";

const routeTitles: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/dashboard/profile": "Mon Profil",
  "/dashboard/my-cotisations": "Mes Cotisations",
  "/dashboard/my-epargnes": "Mes Épargnes",
  "/dashboard/my-prets": "Mes Prêts",
  "/dashboard/my-presences": "Mes Présences",
  "/dashboard/my-sanctions": "Mes Sanctions",
  "/dashboard/my-aides": "Mes Aides",
  "/dashboard/my-donations": "Mes Dons",
  "/dashboard/mes-demandes-pret": "Mes Demandes de Prêt",
  "/dashboard/mes-avalisations": "Mes Avalisations",
  "/dashboard/admin/membres": "Gestion des Membres",
  "/dashboard/admin/cotisations": "Gestion des Cotisations",
  "/dashboard/admin/reunions": "Gestion des Réunions",
  "/dashboard/admin/presences": "Gestion des Présences",
  "/dashboard/admin/caisse": "Caisse",
  "/dashboard/admin/donations": "Gestion des Dons",
  "/dashboard/admin/sport": "Gestion Sportive",
  "/dashboard/admin/communication/notifications": "Notifications",
  "/dashboard/admin/stats": "Statistiques",
  "/dashboard/admin/roles": "Gestion des Rôles",
  "/dashboard/admin/utilisateurs": "Gestion des Utilisateurs",
  "/dashboard/admin/permissions": "Permissions",
  "/dashboard/admin/finances/prets": "Gestion des Prêts",
  "/dashboard/admin/finances/demandes-pret": "Demandes de Prêt",
  "/dashboard/admin/finances/aides": "Aides Financières",
  "/dashboard/admin/site/hero": "Hero du Site",
  "/dashboard/admin/site/activities": "Activités",
  "/dashboard/admin/site/events": "Événements",
  "/dashboard/admin/site/gallery": "Galerie Photos",
  "/dashboard/admin/site/partners": "Partenaires",
  "/dashboard/admin/site/config": "Configuration du Site",
  "/dashboard/admin/site/about": "À Propos",
  "/dashboard/admin/site/messages": "Messages",
  "/dashboard/admin/rapports": "Rapports",
  "/dashboard/admin/config/exports": "Exports",
  "/dashboard/admin/e2d-config": "Configuration E2D",
  "/dashboard/admin/monitoring": "Monitoring",
};

function useRouteTitle(): string {
  const location = useLocation();
  const pathname = location.pathname;
  return routeTitles[pathname] || "Tableau de bord";
}

export const DashboardHeader = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const pageTitle = useRouteTitle();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: "Succès", description: "Déconnexion réussie" });
      navigate("/");
    } catch (error: unknown) {
      toast({ title: "Erreur", description: "Erreur lors de la déconnexion", variant: "destructive" });
    }
  };

  const getInitials = () => {
    if (!profile) return "U";
    return `${profile.prenom?.[0] || ""}${profile.nom?.[0] || ""}`.toUpperCase();
  };

  return (
    <header className="h-14 sm:h-16 border-b border-border bg-card flex items-center justify-between px-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <SidebarTrigger className="h-8 w-8" />
        <h1 className="hidden sm:block text-xl font-semibold text-foreground">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-4">
        <AssociationSwitcher />
          <NotificationCenter />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.photo_url} alt={profile?.prenom} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">
                  {profile?.prenom} {profile?.nom}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/dashboard/profile")}>
              <User className="mr-2 h-4 w-4" />
              Mon Profil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/")}>
              <Home className="mr-2 h-4 w-4" />
              Retour au site
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
