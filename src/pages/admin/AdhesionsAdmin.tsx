import { useState, useMemo } from "react";
import { UserPlus, Check, X, Clock, Download, Search, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BackButton from "@/components/BackButton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import * as XLSX from "xlsx";

export default function AdhesionsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: adhesions = [], isLoading } = useQuery({
    queryKey: ['adhesions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('adhesions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Mutation pour valider une adhésion
  const validateMutation = useMutation({
    mutationFn: async (adhesionId: string) => {
      const { error } = await supabase
        .from('adhesions')
        .update({ 
          payment_status: 'completed', 
          processed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', adhesionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adhesions'] });
      toast({ title: "Adhésion validée avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de valider l'adhésion", variant: "destructive" });
    }
  });

  // Mutation pour rejeter une adhésion
  const rejectMutation = useMutation({
    mutationFn: async (adhesionId: string) => {
      const { error } = await supabase
        .from('adhesions')
        .update({ 
          payment_status: 'failed', 
          processed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', adhesionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adhesions'] });
      toast({ title: "Adhésion rejetée" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de rejeter l'adhésion", variant: "destructive" });
    }
  });

  // Filtrage des adhésions
  const filteredAdhesions = useMemo(() => {
    return adhesions.filter(adhesion => {
      const matchesSearch = searchTerm === "" || 
        adhesion.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adhesion.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adhesion.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === "all" || adhesion.type_adhesion === typeFilter;
      const matchesStatus = statusFilter === "all" || adhesion.payment_status === statusFilter;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [adhesions, searchTerm, typeFilter, statusFilter]);

  const stats = {
    total: adhesions.length,
    completed: adhesions.filter(a => a.payment_status === 'completed').length,
    pending: adhesions.filter(a => a.payment_status === 'pending').length,
    failed: adhesions.filter(a => a.payment_status === 'failed').length,
    montantTotal: adhesions
      .filter(a => a.payment_status === 'completed')
      .reduce((sum, a) => sum + a.montant_paye, 0)
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600"><Check className="w-3 h-3 mr-1" /> Complétée</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> En attente</Badge>;
      case 'failed':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" /> Échouée</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'e2d': return 'E2D';
      case 'phoenix': return 'Phoenix';
      case 'both': return 'E2D + Phoenix';
      default: return type;
    }
  };

  const handleExport = () => {
    const dataToExport = filteredAdhesions.map(a => ({
      'Nom': a.nom,
      'Prénom': a.prenom,
      'Email': a.email,
      'Téléphone': a.telephone,
      'Type': getTypeLabel(a.type_adhesion),
      'Montant (FCFA)': a.montant_paye,
      'Méthode': a.payment_method,
      'Statut': a.payment_status === 'completed' ? 'Complétée' : 
               a.payment_status === 'pending' ? 'En attente' : 'Échouée',
      'Date': format(new Date(a.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Adhésions");
    XLSX.writeFile(wb, `adhesions_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    
    toast({ title: "Export réussi", description: `${dataToExport.length} adhésion(s) exportée(s)` });
  };

  const resetFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <BackButton />
          <h1 className="text-2xl sm:text-3xl font-bold mt-4 flex items-center gap-2">
            <UserPlus className="h-8 w-8" />
            Gestion des Adhésions
          </h1>
          <p className="text-muted-foreground mt-2">
            Suivre et gérer les adhésions à l'association
          </p>
        </div>
        <Button onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Exporter Excel
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Complétées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En Attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Échouées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Montant Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.montantTotal.toLocaleString('fr-FR')} FCFA</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, prénom, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type d'adhésion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="e2d">E2D</SelectItem>
                <SelectItem value="phoenix">Phoenix</SelectItem>
                <SelectItem value="both">E2D + Phoenix</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="completed">Complétée</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="failed">Échouée</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={resetFilters}>
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des adhésions */}
      <Card>
        <CardHeader>
          <CardTitle>Adhésions</CardTitle>
          <CardDescription>
            {filteredAdhesions.length} adhésion(s) trouvée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : filteredAdhesions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune adhésion trouvée
            </p>
          ) : (
            <div className="space-y-3">
              {filteredAdhesions.map((adhesion) => (
                <div
                  key={adhesion.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-semibold">
                      {adhesion.nom} {adhesion.prenom}
                    </p>
                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{adhesion.email}</span>
                      <span>{adhesion.telephone}</span>
                      <Badge variant="outline">{getTypeLabel(adhesion.type_adhesion)}</Badge>
                    </div>
                    <div className="flex gap-4 mt-1 text-sm">
                      <span>Montant: {adhesion.montant_paye.toLocaleString('fr-FR')} FCFA</span>
                      <span>Méthode: {adhesion.payment_method}</span>
                      <span>
                        Date: {format(new Date(adhesion.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(adhesion.payment_status)}
                    
                    {adhesion.payment_status === 'pending' && (
                      <>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="default">
                              <Check className="w-4 h-4 mr-1" />
                              Valider
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Valider l'adhésion ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Confirmer la validation de l'adhésion de {adhesion.nom} {adhesion.prenom}.
                                Cette action marquera l'adhésion comme complétée.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => validateMutation.mutate(adhesion.id)}>
                                Valider
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <X className="w-4 h-4 mr-1" />
                              Rejeter
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Rejeter l'adhésion ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir rejeter l'adhésion de {adhesion.nom} {adhesion.prenom} ?
                                Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => rejectMutation.mutate(adhesion.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Rejeter
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
