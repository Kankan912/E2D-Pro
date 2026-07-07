import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import BackButton from "@/components/BackButton";
import { Settings, Calendar, Users, Shield, Receipt, Bell, Gift, AlertTriangle, Wrench, Download, Banknote, Clock, Mail, Send, Cog, AtSign, Coins } from "lucide-react";
import { ExercicesManager } from "@/components/config/ExercicesManager";
import { CotisationsTypesManager } from "@/components/config/CotisationsTypesManager";
import { CotisationsMembresManager } from "@/components/config/CotisationsMembresManager";
import { CotisationsMensuellesExerciceManager } from "@/components/config/CotisationsMensuellesExerciceManager";
import { SanctionsTarifsManager } from "@/components/config/SanctionsTarifsManager";
import { GestionGeneraleManager } from "@/components/config/GestionGeneraleManager";
import { SauvegardeManager } from "@/components/config/SauvegardeManager";
import { SessionsConfigManager } from "@/components/config/SessionsConfigManager";
import { NotificationsConfigManager } from "@/components/config/NotificationsConfigManager";
import { EmailConfigManager } from "@/components/config/EmailConfigManager";

// Import des pages existantes pour intégration
import UtilisateursAdmin from "./UtilisateursAdmin";
import PermissionsAdmin from "./PermissionsAdmin";
import NotificationsAdmin from "./NotificationsAdmin";
import NotificationsTemplatesAdmin from "./NotificationsTemplatesAdmin";
import TontineConfig from "./TontineConfig";
import PretsConfigAdmin from "./PretsConfigAdmin";
import ExportsAdmin from "./ExportsAdmin";

const E2DConfigAdmin = () => {
  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Configuration E2D
          </h1>
          <p className="text-muted-foreground">
            Paramètres généraux de l'association et de la tontine
          </p>
        </div>
      </div>

      <Tabs defaultValue="exercices" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="exercices" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Exercices
          </TabsTrigger>
          <TabsTrigger value="utilisateurs" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="cotisations" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Cotisations
          </TabsTrigger>
          <TabsTrigger value="prets" className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Prêts
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="tontine" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Tontine
          </TabsTrigger>
          <TabsTrigger value="sanctions" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Sanctions
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <AtSign className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="gestion" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Gestion
          </TabsTrigger>
          <TabsTrigger value="sauvegarde" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Sauvegarde
          </TabsTrigger>
          <TabsTrigger value="exports" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exercices">
          <ExercicesManager />
        </TabsContent>

        <TabsContent value="utilisateurs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestion des Utilisateurs
              </CardTitle>
              <CardDescription>
                Créez des comptes, assignez des rôles et gérez les accès
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UtilisateursAdmin embedded={true} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Matrice des Permissions
              </CardTitle>
              <CardDescription>
                Configurez les droits d'accès par rôle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionsAdmin />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsConfigManager />
        </TabsContent>

        <TabsContent value="cotisations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Gestion des Cotisations
              </CardTitle>
              <CardDescription>
                Types de cotisations, cotisation mensuelle par membre et montants personnalisés
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="mensuelle" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="mensuelle" className="flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    Cotisation Mensuelle
                  </TabsTrigger>
                  <TabsTrigger value="types">Types de Cotisations</TabsTrigger>
                  <TabsTrigger value="montants">Autres Montants</TabsTrigger>
                </TabsList>
                <TabsContent value="mensuelle">
                  <CotisationsMensuellesExerciceManager />
                </TabsContent>
                <TabsContent value="types">
                  <CotisationsTypesManager />
                </TabsContent>
                <TabsContent value="montants">
                  <CotisationsMembresManager />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prets">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                Configuration des Prêts
              </CardTitle>
              <CardDescription>
                Durées, taux d'intérêt et règles de reconduction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PretsConfigAdmin embedded={true} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Configuration des Notifications
              </CardTitle>
              <CardDescription>
                Gérez les campagnes, templates et paramètres de notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="campagnes" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="campagnes" className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Campagnes
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Modèles Email
                  </TabsTrigger>
                  <TabsTrigger value="parametres" className="flex items-center gap-2">
                    <Cog className="h-4 w-4" />
                    Paramètres
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="campagnes">
                  <NotificationsAdmin embedded={true} />
                </TabsContent>

                <TabsContent value="templates">
                  <NotificationsTemplatesAdmin embedded={true} />
                </TabsContent>

                <TabsContent value="parametres">
                  <NotificationsConfigManager />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tontine">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Configuration Tontine
              </CardTitle>
              <CardDescription>
                Paramètres de la tontine et des bénéficiaires
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TontineConfig />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sanctions">
          <SanctionsTarifsManager />
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AtSign className="h-5 w-5" />
                Configuration Email
              </CardTitle>
              <CardDescription>
                Configurez le service d'envoi d'emails (Resend ou SMTP) et l'URL de l'application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailConfigManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gestion">
          <GestionGeneraleManager />
        </TabsContent>

        <TabsContent value="sauvegarde">
          <SauvegardeManager />
        </TabsContent>

        <TabsContent value="exports">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Exports Programmés
              </CardTitle>
              <CardDescription>
                Configurez des exports automatiques de vos données
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExportsAdmin embedded={true} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default E2DConfigAdmin;
