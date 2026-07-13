import { useEffect, Suspense } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PermissionRoute } from "@/components/auth/PermissionRoute";
import { PageLoader, SuspenseFallback } from "@/components/ui/page-loader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// ============================================
// ALL PAGES LAZY LOADED WITH AUTO-RETRY
// ============================================

// Dashboard Pages (Member)
const DashboardHome = lazyWithRetry(() => import("./dashboard/DashboardHome"));
const Profile = lazyWithRetry(() => import("./dashboard/Profile"));
const MyDonations = lazyWithRetry(() => import("./dashboard/MyDonations"));
const MyCotisations = lazyWithRetry(() => import("./dashboard/MyCotisations"));
const MyEpargnes = lazyWithRetry(() => import("./dashboard/MyEpargnes"));
const MySanctions = lazyWithRetry(() => import("./dashboard/MySanctions"));
const MyPrets = lazyWithRetry(() => import("./dashboard/MyPrets"));
const MyPresences = lazyWithRetry(() => import("./dashboard/MyPresences"));
const MyAides = lazyWithRetry(() => import("./dashboard/MyAides"));
const MesDemandesPret = lazyWithRetry(() => import("./dashboard/MesDemandesPret"));
const MesAvalisations = lazyWithRetry(() => import("./dashboard/MesAvalisations"));
const DemandesPretAdmin = lazyWithRetry(() => import("./admin/DemandesPretAdmin"));
const LoanWorkflowConfig = lazyWithRetry(() => import("./admin/LoanWorkflowConfig"));

// Admin Pages - Core
const DonationsAdmin = lazyWithRetry(() => import("./admin/DonationsAdmin"));
const MobileMoneyAdmin = lazyWithRetry(() => import("./admin/MobileMoneyAdmin"));
const RolesAdmin = lazyWithRetry(() => import("./admin/RolesAdmin"));
const PermissionsAdmin = lazyWithRetry(() => import("./admin/PermissionsAdmin"));
const MembresAdmin = lazyWithRetry(() => import("./admin/MembresAdmin"));
const AdhesionsAdmin = lazyWithRetry(() => import("./admin/AdhesionsAdmin"));
const PaymentConfigAdmin = lazyWithRetry(() => import("./admin/PaymentConfigAdmin"));
const StatsAdmin = lazyWithRetry(() => import("./admin/StatsAdmin"));
const UtilisateursAdmin = lazyWithRetry(() => import("./admin/UtilisateursAdmin"));
const MonitoringAdmin = lazyWithRetry(() => import("./admin/MonitoringAdmin"));

// Admin Pages - Tontine/Finance
const Epargnes = lazyWithRetry(() => import("./Epargnes"));
const Beneficiaires = lazyWithRetry(() => import("./admin/Beneficiaires"));
const TontineConfig = lazyWithRetry(() => import("./admin/TontineConfig"));
const CaisseAdmin = lazyWithRetry(() => import("./admin/CaisseAdmin"));
const PretsAdmin = lazyWithRetry(() => import("./admin/PretsAdmin"));
const PretsConfigAdmin = lazyWithRetry(() => import("./admin/PretsConfigAdmin"));
const AidesAdmin = lazyWithRetry(() => import("./admin/AidesAdmin"));
const RapportsAdmin = lazyWithRetry(() => import("./admin/RapportsAdmin"));
const CotisationsAdmin = lazyWithRetry(() => import("./admin/CotisationsAdmin"));

// Admin Pages - Reunions
const Reunions = lazyWithRetry(() => import("./reunions"));
const GestionPresences = lazyWithRetry(() => import("./GestionPresences"));

// Admin Pages - Sport
const Sport = lazyWithRetry(() => import("./Sport"));
const SportE2D = lazyWithRetry(() => import("./SportE2D"));
const SportPhoenix = lazyWithRetry(() => import("./SportPhoenix"));
const SportEquipes = lazyWithRetry(() => import("./SportEquipes"));
const SportEntrainements = lazyWithRetry(() => import("./admin/SportEntrainements"));
const SportSanctions = lazyWithRetry(() => import("./admin/SportSanctions"));
const MatchGalaConfig = lazyWithRetry(() => import("./admin/MatchGalaConfig"));
const E2DConfigAdmin = lazyWithRetry(() => import("./admin/E2DConfigAdmin"));

// Admin Pages - Communication
const NotificationsAdmin = lazyWithRetry(() => import("./admin/NotificationsAdmin"));
const NotificationsTemplatesAdmin = lazyWithRetry(() => import("./admin/NotificationsTemplatesAdmin"));
const ExportsAdmin = lazyWithRetry(() => import("./admin/ExportsAdmin"));

// V5 Evolution Pages
const MonEtatFinancier = lazyWithRetry(() => import("./dashboard/MonEtatFinancier"));
const CalendrierBeneficiairesMensuels = lazyWithRetry(() => import("./admin/CalendrierBeneficiairesMensuels"));
const ConfigCotisationsExercice = lazyWithRetry(() => import("./admin/ConfigCotisationsExercice"));

// Admin Pages - Site CMS
const HeroAdmin = lazyWithRetry(() => import("./admin/site/HeroAdmin"));
const ActivitiesAdmin = lazyWithRetry(() => import("./admin/site/ActivitiesAdmin"));
const EventsAdmin = lazyWithRetry(() => import("./admin/site/EventsAdmin"));
const GalleryAdmin = lazyWithRetry(() => import("./admin/site/GalleryAdmin"));
const PartnersAdmin = lazyWithRetry(() => import("./admin/site/PartnersAdmin"));
const ConfigAdmin = lazyWithRetry(() => import("./admin/site/ConfigAdmin"));
const AboutAdmin = lazyWithRetry(() => import("./admin/site/AboutAdmin"));
const MessagesAdmin = lazyWithRetry(() => import("./admin/site/MessagesAdmin"));
const ImagesAdmin = lazyWithRetry(() => import("./admin/site/ImagesAdmin"));

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, mustChangePassword } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    } else if (!loading && user && mustChangePassword) {
      navigate("/change-password");
    }
  }, [user, loading, mustChangePassword, navigate]);

  if (loading) {
    return <PageLoader fullPage />;
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
          {/* ==================== MEMBER ROUTES ==================== */}
          <Route path="/" element={<ErrorBoundary fallbackTitle="Erreur - Tableau de bord"><DashboardHome /></ErrorBoundary>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/my-donations" element={<ErrorBoundary fallbackTitle="Erreur - Mes dons"><MyDonations /></ErrorBoundary>} />
          <Route path="/my-cotisations" element={<ErrorBoundary fallbackTitle="Erreur - Mes cotisations"><MyCotisations /></ErrorBoundary>} />
          <Route path="/my-epargnes" element={<ErrorBoundary fallbackTitle="Erreur - Mes épargnes"><MyEpargnes /></ErrorBoundary>} />
          <Route path="/my-sanctions" element={<ErrorBoundary fallbackTitle="Erreur - Mes sanctions"><MySanctions /></ErrorBoundary>} />
          <Route path="/my-prets" element={<ErrorBoundary fallbackTitle="Erreur - Mes prêts"><MyPrets /></ErrorBoundary>} />
          <Route path="/my-presences" element={<ErrorBoundary fallbackTitle="Erreur - Mes présences"><MyPresences /></ErrorBoundary>} />
          <Route path="/my-aides" element={<ErrorBoundary fallbackTitle="Erreur - Mes aides"><MyAides /></ErrorBoundary>} />
          <Route path="/mes-demandes-pret" element={<ErrorBoundary fallbackTitle="Erreur - Mes demandes de prêt"><MesDemandesPret /></ErrorBoundary>} />
          <Route path="/mes-avalisations" element={<ErrorBoundary fallbackTitle="Erreur - Mes avalisations"><MesAvalisations /></ErrorBoundary>} />
          {/* ==================== ADMIN ROUTES - FINANCE ==================== */}
          <Route path="/admin/donations" element={<PermissionRoute resource="donations" permission="read"><ErrorBoundary fallbackTitle="Erreur - Donations"><DonationsAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/donations/mobile-money" element={<PermissionRoute resource="donations" permission="read"><ErrorBoundary fallbackTitle="Erreur - Mobile Money"><MobileMoneyAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/adhesions" element={<PermissionRoute resource="adhesions" permission="read"><ErrorBoundary fallbackTitle="Erreur - Adhésions"><AdhesionsAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/payment-config" element={<PermissionRoute resource="config" permission="write"><ErrorBoundary fallbackTitle="Erreur - Config paiement"><PaymentConfigAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/membres" element={<PermissionRoute resource="membres" permission="read"><ErrorBoundary fallbackTitle="Erreur - Membres"><MembresAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/roles" element={<PermissionRoute resource="roles" permission="write"><ErrorBoundary fallbackTitle="Erreur - Rôles"><RolesAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/utilisateurs" element={<PermissionRoute resource="roles" permission="write"><ErrorBoundary fallbackTitle="Erreur - Utilisateurs"><UtilisateursAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/permissions" element={<PermissionRoute resource="configuration" permission="read"><ErrorBoundary fallbackTitle="Erreur - Permissions"><PermissionsAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/stats" element={<PermissionRoute resource="stats" permission="read"><ErrorBoundary fallbackTitle="Erreur - Statistiques"><StatsAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/monitoring" element={<PermissionRoute resource="roles" permission="write"><ErrorBoundary fallbackTitle="Erreur - Monitoring"><MonitoringAdmin /></ErrorBoundary></PermissionRoute>} />
          
          {/* ==================== ROUTES TONTINE ==================== */}
          <Route path="/admin/cotisations" element={<PermissionRoute resource="cotisations" permission="read"><ErrorBoundary fallbackTitle="Erreur - Cotisations"><CotisationsAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/tontine/epargnes" element={<PermissionRoute resource="epargnes" permission="read"><ErrorBoundary fallbackTitle="Erreur - Épargnes"><Epargnes /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/tontine/beneficiaires" element={<PermissionRoute resource="epargnes" permission="read"><ErrorBoundary fallbackTitle="Erreur - Bénéficiaires"><Beneficiaires /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/caisse" element={<PermissionRoute resource="caisse" permission="read"><ErrorBoundary fallbackTitle="Erreur - Caisse"><CaisseAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/tontine/config" element={<PermissionRoute resource="config" permission="write"><ErrorBoundary fallbackTitle="Erreur - Config Tontine"><TontineConfig /></ErrorBoundary></PermissionRoute>} />
          
          
          {/* ==================== ROUTES RÉUNIONS ==================== */}
          <Route path="/admin/reunions" element={<PermissionRoute resource="reunions" permission="read"><ErrorBoundary fallbackTitle="Erreur - Réunions"><Reunions /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/presences" element={<PermissionRoute resource="presences" permission="read"><ErrorBoundary fallbackTitle="Erreur - Présences"><GestionPresences /></ErrorBoundary></PermissionRoute>} />
          
          {/* ==================== ROUTES SPORT ==================== */}
          <Route path="/admin/sport" element={<PermissionRoute resource="sport_e2d" permission="read"><ErrorBoundary fallbackTitle="Erreur - Sport"><Sport /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/sport/e2d" element={<PermissionRoute resource="sport_e2d" permission="read"><ErrorBoundary fallbackTitle="Erreur - Sport E2D"><SportE2D /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/sport/phoenix" element={<PermissionRoute resource="sport_phoenix" permission="read"><ErrorBoundary fallbackTitle="Erreur - Sport Phoenix"><SportPhoenix /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/sport/equipes" element={<PermissionRoute resource="sport_phoenix" permission="read"><ErrorBoundary fallbackTitle="Erreur - Équipes"><SportEquipes /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/sport/entrainements" element={<PermissionRoute resource="sport_phoenix" permission="read"><ErrorBoundary fallbackTitle="Erreur - Entraînements"><SportEntrainements /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/sport/sanctions" element={<PermissionRoute resource="sport_phoenix" permission="read"><ErrorBoundary fallbackTitle="Erreur - Sanctions Sport"><SportSanctions /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/sport/match-gala" element={<PermissionRoute resource="sport_phoenix" permission="read"><ErrorBoundary fallbackTitle="Erreur - Match Gala"><MatchGalaConfig /></ErrorBoundary></PermissionRoute>} />
          
          {/* ==================== ROUTES FINANCES AVANCÉES ==================== */}
          <Route path="/admin/finances/prets" element={<PermissionRoute resource="prets" permission="read"><ErrorBoundary fallbackTitle="Erreur - Prêts"><PretsAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/finances/prets/config" element={<PermissionRoute resource="config" permission="write"><ErrorBoundary fallbackTitle="Erreur - Config Prêts"><PretsConfigAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/finances/demandes-pret" element={<PermissionRoute resource="prets_requests" permission="validate"><ErrorBoundary fallbackTitle="Erreur - Demandes de prêt"><DemandesPretAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/finances/demandes-pret/workflow" element={<PermissionRoute resource="prets_requests" permission="configure"><ErrorBoundary fallbackTitle="Erreur - Workflow"><LoanWorkflowConfig /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/finances/aides" element={<PermissionRoute resource="aides" permission="read"><ErrorBoundary fallbackTitle="Erreur - Aides"><AidesAdmin /></ErrorBoundary></PermissionRoute>} />
          
          {/* ==================== ROUTES COMMUNICATION ==================== */}
          <Route path="/admin/communication/notifications" element={<PermissionRoute resource="notifications" permission="read"><ErrorBoundary fallbackTitle="Erreur - Notifications"><NotificationsAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/communication/notifications-templates" element={<PermissionRoute resource="notifications" permission="write"><ErrorBoundary fallbackTitle="Erreur - Templates"><NotificationsTemplatesAdmin /></ErrorBoundary></PermissionRoute>} />
          
          {/* ==================== ROUTES CONFIGURATION ==================== */}
          <Route path="/admin/config/exports" element={<PermissionRoute resource="config" permission="write"><ErrorBoundary fallbackTitle="Erreur - Exports"><ExportsAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/rapports" element={<PermissionRoute resource="stats" permission="read"><ErrorBoundary fallbackTitle="Erreur - Rapports"><RapportsAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/e2d-config" element={<PermissionRoute resource="config" permission="write"><ErrorBoundary fallbackTitle="Erreur - Config E2D"><E2DConfigAdmin /></ErrorBoundary></PermissionRoute>} />
          
          {/* ==================== ROUTES CMS SITE WEB ==================== */}
          <Route path="/admin/site/hero" element={<PermissionRoute resource="site" permission="write"><ErrorBoundary fallbackTitle="Erreur - Hero"><HeroAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/site/activities" element={<PermissionRoute resource="site" permission="write"><ErrorBoundary fallbackTitle="Erreur - Activités"><ActivitiesAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/site/events" element={<PermissionRoute resource="site" permission="write"><ErrorBoundary fallbackTitle="Erreur - Événements"><EventsAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/site/gallery" element={<PermissionRoute resource="site" permission="write"><ErrorBoundary fallbackTitle="Erreur - Galerie"><GalleryAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/site/partners" element={<PermissionRoute resource="site" permission="write"><ErrorBoundary fallbackTitle="Erreur - Partenaires"><PartnersAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/site/config" element={<PermissionRoute resource="site" permission="write"><ErrorBoundary fallbackTitle="Erreur - Config Site"><ConfigAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/site/about" element={<PermissionRoute resource="site" permission="write"><ErrorBoundary fallbackTitle="Erreur - À propos"><AboutAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/site/messages" element={<PermissionRoute resource="site" permission="write"><ErrorBoundary fallbackTitle="Erreur - Messages"><MessagesAdmin /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/site/images" element={<PermissionRoute resource="site" permission="write"><ErrorBoundary fallbackTitle="Erreur - Images"><ImagesAdmin /></ErrorBoundary></PermissionRoute>} />

          {/* V5 Evolution Routes */}
          <Route path="/my-financial-status" element={<ErrorBoundary fallbackTitle="Erreur - Mon État Financier"><MonEtatFinancier /></ErrorBoundary>} />
          <Route path="/admin/calendrier-beneficiaires" element={<PermissionRoute resource="cotisations" permission="read"><ErrorBoundary fallbackTitle="Erreur - Calendrier Bénéficiaires"><CalendrierBeneficiairesMensuels /></ErrorBoundary></PermissionRoute>} />
          <Route path="/admin/config-cotisations" element={<PermissionRoute resource="config" permission="write"><ErrorBoundary fallbackTitle="Erreur - Config Cotisations"><ConfigCotisationsExercice /></ErrorBoundary></PermissionRoute>} />
        </Routes>
      </Suspense>
    </DashboardLayout>
  );
};

export default Dashboard;
