import { useState } from "react";
import { Mail, Plus, Edit, Trash2, Eye, ToggleLeft, ToggleRight, FileText, Send, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sanitizeHtml } from "@/lib/sanitize";
import BackButton from "@/components/BackButton";
import { useNotificationsTemplates, NotificationTemplate, NotificationTemplateInsert } from "@/hooks/useNotificationsTemplates";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORIES = [
  { value: 'compte', label: 'Gestion de compte' },
  { value: 'cotisation', label: 'Cotisations' },
  { value: 'reunion', label: 'Réunions' },
  { value: 'pret', label: 'Prêts' },
  { value: 'sport', label: 'Sport' },
  { value: 'general', label: 'Général' },
];

const VARIABLES_COMMUNES = [
  { var: '{{nom}}', desc: 'Nom du membre' },
  { var: '{{prenom}}', desc: 'Prénom du membre' },
  { var: '{{email}}', desc: 'Email du membre' },
  { var: '{{date}}', desc: 'Date actuelle' },
  { var: '{{montant}}', desc: 'Montant (si applicable)' },
  { var: '{{lien}}', desc: 'Lien de l\'application' },
];

interface NotificationsTemplatesAdminProps {
  embedded?: boolean;
}

export default function NotificationsTemplatesAdmin({ embedded = false }: NotificationsTemplatesAdminProps) {
  const { templates, isLoading, createTemplate, updateTemplate, toggleTemplateStatus, deleteTemplate } = useNotificationsTemplates();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [formData, setFormData] = useState<NotificationTemplateInsert>({
    code: '',
    nom: '',
    categorie: 'general',
    description: '',
    template_sujet: '',
    template_contenu: '',
    email_expediteur: '',
    actif: true
  });

  const filteredTemplates = templates?.filter(t => 
    filterCategory === 'all' || t.categorie === filterCategory
  );

  const handleOpenDialog = (template?: NotificationTemplate) => {
    if (template) {
      setSelectedTemplate(template);
      setFormData({
        code: template.code,
        nom: template.nom,
        categorie: template.categorie,
        description: template.description || '',
        template_sujet: template.template_sujet,
        template_contenu: template.template_contenu,
        email_expediteur: template.email_expediteur || '',
        actif: template.actif
      });
    } else {
      setSelectedTemplate(null);
      setFormData({
        code: '',
        nom: '',
        categorie: 'general',
        description: '',
        template_sujet: '',
        template_contenu: '',
        email_expediteur: '',
        actif: true
      });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (selectedTemplate) {
      updateTemplate.mutate({ 
        id: selectedTemplate.id, 
        data: {
          nom: formData.nom,
          categorie: formData.categorie,
          description: formData.description,
          template_sujet: formData.template_sujet,
          template_contenu: formData.template_contenu,
          email_expediteur: formData.email_expediteur,
          actif: formData.actif
        }
      });
    } else {
      createTemplate.mutate(formData);
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (templateToDelete) {
      deleteTemplate.mutate(templateToDelete);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handlePreview = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setPreviewDialogOpen(true);
  };

  const getCategoryBadge = (categorie: string) => {
    const cat = CATEGORIES.find(c => c.value === categorie);
    const colors: Record<string, string> = {
      'compte': 'bg-blue-100 text-blue-800',
      'cotisation': 'bg-green-100 text-green-800',
      'reunion': 'bg-purple-100 text-purple-800',
      'pret': 'bg-orange-100 text-orange-800',
      'sport': 'bg-yellow-100 text-yellow-800',
      'general': 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[categorie] || colors.general}>
        {cat?.label || categorie}
      </Badge>
    );
  };

  // Remplacer les variables par des valeurs d'exemple pour la prévisualisation
  const getPreviewContent = (content: string | null | undefined) => {
    if (!content) return '';
    return content
      .replace(/\{\{nom\}\}/g, 'DUPONT')
      .replace(/\{\{prenom\}\}/g, 'Jean')
      .replace(/\{\{email\}\}/g, 'jean.dupont@example.com')
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('fr-FR'))
      .replace(/\{\{montant\}\}/g, '50 000 FCFA')
      .replace(/\{\{lien\}\}/g, 'https://e2d-connect.lovable.app')
      .replace(/\{\{mot_de_passe\}\}/g, '********');
  };

  if (isLoading) {
    return (
      <div className={embedded ? "space-y-6" : "container mx-auto space-y-6"}>
        {!embedded && <BackButton />}
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-6" : "container mx-auto space-y-6"}>
      {!embedded && <BackButton />}
      
      <div className="flex items-center justify-between">
        {!embedded && (
          <div className="flex items-center gap-2">
            <Mail className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Templates de Notifications</h1>
              <p className="text-muted-foreground">Gérez les modèles d'emails automatiques</p>
            </div>
          </div>
        )}
        <Button onClick={() => handleOpenDialog()} className={embedded ? "ml-auto" : ""}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold">{templates?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">
              {templates?.filter(t => t.actif).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Inactifs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold text-orange-600">
              {templates?.filter(t => !t.actif).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Catégories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold">
              {new Set(templates?.map(t => t.categorie)).size || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et liste */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liste des Templates</CardTitle>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrer par catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates?.map(template => (
                <TableRow key={template.id}>
                  <TableCell className="font-mono text-sm">{template.code}</TableCell>
                  <TableCell className="font-medium">{template.nom}</TableCell>
                  <TableCell>{getCategoryBadge(template.categorie)}</TableCell>
                  <TableCell className="max-w-xs truncate">{template.template_sujet}</TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleTemplateStatus.mutate({ id: template.id, actif: !template.actif })}
                          >
                            {template.actif ? (
                              <ToggleRight className="h-5 w-5 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-gray-400" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {template.actif ? 'Désactiver' : 'Activer'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handlePreview(template)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(template)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setTemplateToDelete(template.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de création/édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Modifier le template' : 'Nouveau template'}
            </DialogTitle>
            <DialogDescription>
              Configurez le contenu de l'email avec les variables disponibles
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="contenu">Contenu</TabsTrigger>
              <TabsTrigger value="variables">Variables</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code (unique)</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="ex: creation_compte"
                    disabled={!!selectedTemplate}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={formData.nom}
                    onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                    placeholder="ex: Email de création de compte"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select 
                    value={formData.categorie} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, categorie: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email expéditeur (optionnel)</Label>
                  <Input
                    value={formData.email_expediteur || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, email_expediteur: e.target.value }))}
                    placeholder="ex: noreply@e2d.org"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description de ce template..."
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="actif"
                  checked={formData.actif}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, actif: checked }))}
                />
                <Label htmlFor="actif">Template actif</Label>
              </div>
            </TabsContent>

            <TabsContent value="contenu" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Sujet de l'email</Label>
                <Input
                  value={formData.template_sujet}
                  onChange={(e) => setFormData(prev => ({ ...prev, template_sujet: e.target.value }))}
                  placeholder="ex: Bienvenue sur E2D Connect, {{prenom}} !"
                />
              </div>

              <div className="space-y-2">
                <Label>Contenu (HTML)</Label>
                <Textarea
                  value={formData.template_contenu}
                  onChange={(e) => setFormData(prev => ({ ...prev, template_contenu: e.target.value }))}
                  placeholder="<h1>Bonjour {{prenom}},</h1>..."
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </TabsContent>

            <TabsContent value="variables" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Variables disponibles
                  </CardTitle>
                  <CardDescription>
                    Utilisez ces variables dans le sujet et le contenu de l'email
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {VARIABLES_COMMUNES.map(v => (
                      <div key={v.var} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <code className="text-sm font-mono bg-background px-2 py-1 rounded">{v.var}</code>
                        <span className="text-sm text-muted-foreground">{v.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!formData.code || !formData.nom || !formData.template_sujet}>
              {selectedTemplate ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de prévisualisation */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Prévisualisation: {selectedTemplate?.nom}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Sujet:</p>
                <p className="font-medium">{getPreviewContent(selectedTemplate.template_sujet || '')}</p>
              </div>
              
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(getPreviewContent(selectedTemplate.template_contenu || "")),
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce template ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le template sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}