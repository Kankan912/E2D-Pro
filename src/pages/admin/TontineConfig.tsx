import { useState, useEffect } from "react";
import { Settings, Save, Plus, Trash2, Edit } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BackButton from "@/components/BackButton";
import { formatFCFA } from "@/lib/utils";
import { ExercicesCotisationsTypesManager } from "@/components/config/ExercicesCotisationsTypesManager";
import CalendrierBeneficiairesManager from "@/components/config/CalendrierBeneficiairesManager";

import { logger } from "@/lib/logger";
interface TontineConfig {
  id: string;
  cle: string;
  valeur: string;
  categorie: string;
  type_valeur: string;
  description: string;
}

interface BeneficiaireConfig {
  id: string;
  nom: string;
  description?: string;
  mode_calcul: string;
  montant_fixe?: number;
  pourcentage_cotisations?: number;
  actif: boolean;
}

export default function TontineConfig() {
  const [configs, setConfigs] = useState<TontineConfig[]>([]);
  const [beneficiaireConfigs, setBeneficiaireConfigs] = useState<BeneficiaireConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BeneficiaireConfig | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nom: "",
    description: "",
    mode_calcul: "pourcentage",
    montant_fixe: "",
    pourcentage_cotisations: "",
    actif: true
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchConfigs();
    fetchBeneficiaireConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('tontine_configurations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error: unknown) {
      logger.error('Erreur chargement configs:', error);
    }
  };

  const fetchBeneficiaireConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('beneficiaires_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBeneficiaireConfigs(data || []);
    } catch (error: unknown) {
      logger.error('Erreur chargement configs bénéficiaires:', error);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      const dataToSave = {
        nom: formData.nom,
        description: formData.description || null,
        mode_calcul: formData.mode_calcul,
        montant_fixe: formData.mode_calcul === 'fixe' ? parseFloat(formData.montant_fixe) : null,
        pourcentage_cotisations: formData.mode_calcul === 'pourcentage' ? parseFloat(formData.pourcentage_cotisations) : null,
        actif: formData.actif
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('beneficiaires_config')
          .update(dataToSave)
          .eq('id', editingConfig.id);

        if (error) throw error;
        toast({ title: "Configuration mise à jour" });
      } else {
        const { error } = await supabase
          .from('beneficiaires_config')
          .insert(dataToSave);

        if (error) throw error;
        toast({ title: "Configuration créée" });
      }

      setShowAddDialog(false);
      setEditingConfig(null);
      setFormData({
        nom: "",
        description: "",
        mode_calcul: "pourcentage",
        montant_fixe: "",
        pourcentage_cotisations: "",
        actif: true
      });
      fetchBeneficiaireConfigs();
    } catch (error: unknown) {
      logger.error('Erreur sauvegarde:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config: BeneficiaireConfig) => {
    setEditingConfig(config);
    setFormData({
      nom: config.nom,
      description: config.description || "",
      mode_calcul: config.mode_calcul,
      montant_fixe: config.montant_fixe?.toString() || "",
      pourcentage_cotisations: config.pourcentage_cotisations?.toString() || "",
      actif: config.actif
    });
    setShowAddDialog(true);
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      const { error } = await supabase
        .from('beneficiaires_config')
        .delete()
        .eq('id', pendingDeleteId);

      if (error) throw error;
      toast({ title: "Configuration supprimée" });
      fetchBeneficiaireConfigs();
    } catch (error: unknown) {
      logger.error('Erreur suppression:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la configuration",
        variant: "destructive"
      });
    }
    setShowDeleteConfirm(false);
    setPendingDeleteId(null);
  };

  const handleToggleActif = async (id: string, actif: boolean) => {
    try {
      const { error } = await supabase
        .from('beneficiaires_config')
        .update({ actif: !actif })
        .eq('id', id);

      if (error) throw error;
      fetchBeneficiaireConfigs();
    } catch (error: unknown) {
      logger.error('Erreur toggle actif:', error);
    }
  };

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <BackButton />
          <h1 className="text-2xl sm:text-3xl font-bold mt-4 flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Configuration Tontine
          </h1>
          <p className="text-muted-foreground mt-2">
            Gérer les paramètres de calcul et d'attribution de la tontine
          </p>
        </div>
      </div>

      <Tabs defaultValue="calendrier" className="space-y-6">
        <TabsList>
          <TabsTrigger value="calendrier">Calendrier des Bénéficiaires</TabsTrigger>
          <TabsTrigger value="beneficiaires">Configurations Bénéficiaires</TabsTrigger>
          <TabsTrigger value="cotisations-exercice">Types Cotisations / Exercice</TabsTrigger>
          <TabsTrigger value="general">Paramètres Généraux</TabsTrigger>
        </TabsList>
        
        <TabsContent value="calendrier">
          <CalendrierBeneficiairesManager />
        </TabsContent>

        <TabsContent value="beneficiaires" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Configurations des Bénéficiaires</CardTitle>
                  <CardDescription>
                    Définir les modes de calcul et montants pour les bénéficiaires
                  </CardDescription>
                </div>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingConfig(null);
                      setFormData({
                        nom: "",
                        description: "",
                        mode_calcul: "pourcentage",
                        montant_fixe: "",
                        pourcentage_cotisations: "",
                        actif: true
                      });
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nouvelle Configuration
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingConfig ? 'Modifier' : 'Nouvelle'} Configuration
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Nom</Label>
                        <Input
                          value={formData.nom}
                          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                          placeholder="Ex: Configuration 2025"
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Description optionnelle"
                        />
                      </div>
                      <div>
                        <Label>Mode de Calcul</Label>
                        <Select
                          value={formData.mode_calcul}
                          onValueChange={(value) => setFormData({ ...formData, mode_calcul: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pourcentage">Pourcentage des cotisations</SelectItem>
                            <SelectItem value="fixe">Montant fixe</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.mode_calcul === 'pourcentage' ? (
                        <div>
                          <Label>Pourcentage des Cotisations (%)</Label>
                          <Input
                            type="number"
                            value={formData.pourcentage_cotisations}
                            onChange={(e) => setFormData({ ...formData, pourcentage_cotisations: e.target.value })}
                            placeholder="Ex: 10"
                          />
                        </div>
                      ) : (
                        <div>
                          <Label>Montant Fixe (FCFA)</Label>
                          <Input
                            type="number"
                            value={formData.montant_fixe}
                            onChange={(e) => setFormData({ ...formData, montant_fixe: e.target.value })}
                            placeholder="Ex: 500"
                          />
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={formData.actif}
                          onCheckedChange={(checked) => setFormData({ ...formData, actif: checked })}
                        />
                        <Label>Configuration active</Label>
                      </div>
                      <Button onClick={handleSaveConfig} disabled={loading} className="w-full">
                        <Save className="w-4 h-4 mr-2" />
                        {loading ? 'Enregistrement...' : 'Enregistrer'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {beneficiaireConfigs.map((config) => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{config.nom}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {config.mode_calcul === 'pourcentage'
                          ? `${config.pourcentage_cotisations}% des cotisations`
                          : `Montant fixe: ${formatFCFA(config.montant_fixe || 0)}`}
                      </p>
                      {config.description && (
                        <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.actif}
                        onCheckedChange={() => handleToggleActif(config.id, config.actif)}
                      />
                      <Button size="sm" variant="outline" onClick={() => handleEdit(config)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(config.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {beneficiaireConfigs.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune configuration. Créez-en une pour commencer.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cotisations-exercice" className="space-y-6">
          <ExercicesCotisationsTypesManager />
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres Généraux</CardTitle>
              <CardDescription>
                Configuration globale de la tontine
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Fonctionnalité en développement - Paramètres généraux à venir
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Voulez-vous vraiment supprimer cette configuration ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
