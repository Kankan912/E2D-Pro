import { Suspense, lazy } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar, Plus, Users, FileText, CalendarDays, TrendingDown, BarChart3, UserCog, Mail, Coins } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import LogoHeader from "@/components/LogoHeader";
import BackButton from "@/components/BackButton";
import ReunionForm from "@/components/forms/ReunionForm";
import CompteRenduForm from "@/components/forms/CompteRenduForm";
import CompteRenduViewer from "@/components/CompteRenduViewer";
import ClotureReunionModal from "@/components/ClotureReunionModal";
import ReouvrirReunionModal from "@/components/ReouvrirReunionModal";
import NotifierReunionModal from "@/components/NotifierReunionModal";
import PresencesEtatAbsences from "@/components/PresencesEtatAbsences";
import PresencesHistoriqueMembre from "@/components/PresencesHistoriqueMembre";
import ReunionStatCards from "./components/ReunionStatCards";
import { useReunionsData } from "./hooks/useReunionsData";

const ReunionsListTab = lazy(() => import("./components/ReunionsListTab"));
const CotisationsTab = lazy(() => import("./components/CotisationsTab"));
const PresencesTab = lazy(() => import("./components/PresencesTab"));
const SanctionsTab = lazy(() => import("./components/SanctionsTab"));
const BeneficiairesTab = lazy(() => import("./components/BeneficiairesTab"));
const RappelsTab = lazy(() => import("./components/RappelsTab"));
const RecapitulatifsTab = lazy(() => import("./components/RecapitulatifsTab"));
const HistoriqueTab = lazy(() => import("./components/HistoriqueTab"));

const TabFallback = () => <Card><CardContent className="py-8 text-center text-muted-foreground">Chargement...</CardContent></Card>;

export default function Reunions() {
  const data = useReunionsData();
  const { hasPermission } = usePermissions();
  useBackNavigation();

  if (data.loading) {
    return (
      <div className="space-y-6">
        <LogoHeader title="Gestion des Réunions" subtitle="Planification et suivi des réunions" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-16 bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <LogoHeader title="Gestion des Réunions" subtitle="Planification et suivi des réunions" />
        </div>
        {hasPermission('reunions', 'create') && (
          <Button className="bg-gradient-to-r from-primary to-secondary" onClick={() => data.setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />Nouvelle réunion
          </Button>
        )}
      </div>

      <ReunionStatCards {...data.stats} />

      <Tabs defaultValue="reunions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="reunions" className="flex items-center gap-2"><Calendar className="w-4 h-4" />Réunions</TabsTrigger>
          <TabsTrigger value="cotisations" className="flex items-center gap-2"><Coins className="w-4 h-4" />Cotisations</TabsTrigger>
          <TabsTrigger value="presences" className="flex items-center gap-2"><Users className="w-4 h-4" />Présences</TabsTrigger>
          <TabsTrigger value="etat-absences" className="flex items-center gap-2"><TrendingDown className="w-4 h-4" />État Absences</TabsTrigger>
          <TabsTrigger value="recapitulatifs" className="flex items-center gap-2"><BarChart3 className="w-4 h-4" />Récapitulatifs</TabsTrigger>
          <TabsTrigger value="historique" className="flex items-center gap-2"><UserCog className="w-4 h-4" />Historique</TabsTrigger>
          <TabsTrigger value="sanctions" className="flex items-center gap-2"><FileText className="w-4 h-4" />Sanctions</TabsTrigger>
          <TabsTrigger value="beneficiaires" className="flex items-center gap-2"><CalendarDays className="w-4 h-4" />Bénéficiaires</TabsTrigger>
          <TabsTrigger value="rappels" className="flex items-center gap-2"><Mail className="w-4 h-4" />Rappels</TabsTrigger>
        </TabsList>

        <Suspense fallback={<TabFallback />}>
          <TabsContent value="reunions">
            <ReunionsListTab
              filteredReunions={data.filteredReunions}
              searchTerm={data.searchTerm}
              setSearchTerm={data.setSearchTerm}
              getMemberName={data.getMemberName}
              handleEdit={data.handleEdit}
              handleDelete={data.handleDelete}
              handleCompteRendu={data.handleCompteRendu}
              handleViewCompteRendu={data.handleViewCompteRendu}
              setSelectedReunion={data.setSelectedReunion}
              setShowCompteRenduForm={data.setShowCompteRenduForm}
              setShowNotifierModal={data.setShowNotifierModal}
              setShowReouvrirModal={data.setShowReouvrirModal}
              loadReunions={data.loadReunions}
            />
          </TabsContent>
          <TabsContent value="cotisations">
            <CotisationsTab reunions={data.reunions} selectedReunion={data.selectedReunion} onSelectReunion={data.setSelectedReunion} />
          </TabsContent>
          <TabsContent value="presences">
            <PresencesTab reunions={data.reunions} selectedReunion={data.selectedReunion} setSelectedReunion={data.setSelectedReunion} />
          </TabsContent>
          <TabsContent value="etat-absences"><PresencesEtatAbsences /></TabsContent>
          <TabsContent value="recapitulatifs"><RecapitulatifsTab /></TabsContent>
          <TabsContent value="historique"><HistoriqueTab /></TabsContent>
          <TabsContent value="sanctions">
            <SanctionsTab reunions={data.reunions} selectedReunion={data.selectedReunion} setSelectedReunion={data.setSelectedReunion} />
          </TabsContent>
          <TabsContent value="beneficiaires">
            <BeneficiairesTab reunions={data.reunions} selectedReunion={data.selectedReunion} setSelectedReunion={data.setSelectedReunion} />
          </TabsContent>
          <TabsContent value="rappels"><RappelsTab /></TabsContent>
        </Suspense>
      </Tabs>

      {/* Modals */}
      <Dialog open={data.showForm} onOpenChange={data.setShowForm}>
        <DialogContent className="sm:max-w-[600px]">
          <ReunionForm initialData={data.editingReunion} onSuccess={data.handleFormSuccess} />
        </DialogContent>
      </Dialog>

      <Dialog open={data.showCompteRenduForm} onOpenChange={data.setShowCompteRenduForm}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-background pb-4 border-b">
            <h2 className="text-lg font-semibold">
              {data.selectedReunion ? `Compte-rendu - ${data.selectedReunion.ordre_du_jour}` : 'Compte-rendu'}
            </h2>
          </div>
          <div className="py-4">
            {data.selectedReunion && (
              <CompteRenduForm
                reunionId={data.selectedReunion.id}
                ordreJour={data.selectedReunion.ordre_du_jour}
                onSuccess={data.handleCompteRenduSuccess}
                onCancel={() => data.setShowCompteRenduForm(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CompteRenduViewer
        open={data.showCompteRenduViewer}
        onOpenChange={data.setShowCompteRenduViewer}
        reunion={data.selectedReunion}
        onEdit={() => {
          data.setShowCompteRenduViewer(false);
          data.setShowCompteRenduForm(true);
        }}
      />

      {data.selectedReunion && (
        <>
          <ClotureReunionModal
            open={data.showClotureModal}
            onOpenChange={data.setShowClotureModal}
            reunionId={data.selectedReunion.id}
            reunionData={{ sujet: data.selectedReunion.sujet || '', date_reunion: data.selectedReunion.date_reunion }}
            onSuccess={data.loadReunions}
          />
          <ReouvrirReunionModal
            open={data.showReouvrirModal}
            onOpenChange={data.setShowReouvrirModal}
            reunionId={data.selectedReunion.id}
            reunionData={{ sujet: data.selectedReunion.sujet || data.selectedReunion.ordre_du_jour, date_reunion: data.selectedReunion.date_reunion }}
            onSuccess={() => {
              data.loadReunions();
              const currentId = data.selectedReunion!.id;
              data.setSelectedReunion(null);
              setTimeout(() => { data.loadReunions(); }, 100);
            }}
          />
          <NotifierReunionModal
            open={data.showNotifierModal}
            onOpenChange={data.setShowNotifierModal}
            reunionId={data.selectedReunion.id}
            reunionData={{
              sujet: data.selectedReunion.sujet,
              date_reunion: data.selectedReunion.date_reunion,
              ordre_du_jour: data.selectedReunion.ordre_du_jour,
              lieu_description: data.selectedReunion.lieu_description
            }}
          />
        </>
      )}

      {data.selectedMembreId && (
        <PresencesHistoriqueMembre
          membreId={data.selectedMembreId}
          membreNom={data.selectedMembreNom}
          open={data.showHistoriqueMembre}
          onClose={() => {
            data.setShowHistoriqueMembre(false);
            data.setSelectedMembreId(null);
            data.setSelectedMembreNom("");
          }}
        />
      )}

      <AlertDialog open={data.showDeleteConfirm} onOpenChange={data.setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Voulez-vous vraiment supprimer cette réunion ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={data.confirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
