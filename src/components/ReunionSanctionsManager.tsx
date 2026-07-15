import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, AlertTriangle, Check, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReunionSanctionsManagerProps {
  reunionId: string;
}

interface SanctionType {
  id: string;
  nom: string;
  description: string | null;
  categorie: string;
  montant: number;
}

export default function ReunionSanctionsManager({ reunionId }: ReunionSanctionsManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [membreId, setMembreId] = useState("");
  const [typeSanctionId, setTypeSanctionId] = useState<string>("");
  const [motif, setMotif] = useState("");
  const [montantAmende, setMontantAmende] = useState("");

  // Vérifier si la réunion est clôturée (verrouillée)
  const { data: reunionInfo } = useQuery({
    queryKey: ['reunion-info-sanctions', reunionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions')
        .select('statut')
        .eq('id', reunionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!reunionId,
  });

  const isLocked = reunionInfo?.statut === 'terminee';

  // Charger les types de sanctions standardisés
  const { data: sanctionsTypes } = useQuery({
    queryKey: ['sanctions-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sanctions_types')
        .select('*')
        .order('categorie', { ascending: true });
      if (error) throw error;
      return data as SanctionType[];
    },
  });

  // Charger les membres E2D actifs
  const { data: membres } = useQuery({
    queryKey: ['membres-e2d-sanctions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom')
        .eq('statut', 'actif')
        .eq('est_membre_e2d', true)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Charger les sanctions de la réunion
  const { data: sanctions } = useQuery({
    queryKey: ['reunion-sanctions', reunionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions_sanctions')
        .select(`
          *,
          membre:membre_id(nom, prenom)
        `)
        .eq('reunion_id', reunionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!reunionId,
  });

  // Auto-remplir le montant quand un type est sélectionné
  useEffect(() => {
    if (typeSanctionId && sanctionsTypes) {
      const selectedType = sanctionsTypes.find(t => t.id === typeSanctionId);
      if (selectedType && selectedType.montant > 0) {
        setMontantAmende(selectedType.montant.toString());
      }
    }
  }, [typeSanctionId, sanctionsTypes]);

  // Ajouter une sanction
  const addSanction = useMutation({
    mutationFn: async (sanction: unknown) => {
      const { data, error } = await supabase
        .from('reunions_sanctions')
        .insert([sanction])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunion-sanctions', reunionId] });
      toast({
        title: "Sanction ajoutée",
        description: "La sanction a été enregistrée avec succès.",
      });
      resetForm();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Supprimer une sanction
  const deleteSanction = useMutation({
    mutationFn: async (sanctionId: string) => {
      const { error } = await supabase
        .from('reunions_sanctions')
        .delete()
        .eq('id', sanctionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunion-sanctions', reunionId] });
      queryClient.invalidateQueries({ queryKey: ['fond-caisse-operations'] });
      toast({
        title: "Sanction supprimée",
        description: "La sanction a été supprimée avec succès.",
      });
    },
  });

  // Marquer une amende comme payée
  const markAsPaid = useMutation({
    mutationFn: async (sanctionId: string) => {
      const { error } = await supabase
        .from('reunions_sanctions')
        .update({ statut: 'paye' })
        .eq('id', sanctionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunion-sanctions', reunionId] });
      queryClient.invalidateQueries({ queryKey: ['fond-caisse-operations'] });
      toast({
        title: "Amende payée",
        description: "L'amende a été marquée comme payée et synchronisée avec la caisse.",
      });
    },
  });

  const resetForm = () => {
    setMembreId("");
    setTypeSanctionId("");
    setMotif("");
    setMontantAmende("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedType = sanctionsTypes?.find(t => t.id === typeSanctionId);
    
    if (!membreId || !typeSanctionId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un membre et un type de sanction.",
        variant: "destructive",
      });
      return;
    }

    addSanction.mutate({
      reunion_id: reunionId,
      membre_id: membreId,
      type_sanction: selectedType?.nom || 'Autre',
      motif: motif || selectedType?.description || '',
      montant_amende: montantAmende ? parseFloat(montantAmende) : null,
      statut: 'active',
    });
  };

  const getSanctionBadgeVariant = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('carton rouge') || lowerType.includes('suspension')) return 'destructive';
    if (lowerType.includes('amende') || lowerType.includes('absence')) return 'destructive';
    if (lowerType.includes('carton jaune') || lowerType.includes('retard')) return 'secondary';
    if (lowerType.includes('avertissement') || lowerType.includes('blâme')) return 'default';
    return 'outline';
  };

  const getCategorieLabel = (categorie: string) => {
    switch (categorie) {
      case 'reunion': return '📅 Réunion';
      case 'sport': return '⚽ Sport';
      case 'discipline': return '⚠️ Discipline';
      case 'financiere': return '💰 Financière';
      default: return categorie;
    }
  };

  // Grouper les types par catégorie
  const groupedTypes = sanctionsTypes?.reduce((acc, type) => {
    if (!acc[type.categorie]) acc[type.categorie] = [];
    acc[type.categorie].push(type);
    return acc;
  }, {} as Record<string, SanctionType[]>);

  return (
    <div className="space-y-6">
      {/* Avertissement si réunion clôturée */}
      {isLocked && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Réunion clôturée - Lecture seule</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Cette réunion a été clôturée. Les sanctions ne peuvent plus être modifiées.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulaire d'ajout */}
      {!isLocked && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Ajouter une Sanction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Membre *</Label>
                <Select value={membreId} onValueChange={setMembreId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un membre" />
                  </SelectTrigger>
                  <SelectContent>
                    {membres?.map((membre) => (
                      <SelectItem key={membre.id} value={membre.id}>
                        {membre.prenom} {membre.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Type de Sanction *</Label>
                <Select value={typeSanctionId} onValueChange={setTypeSanctionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupedTypes && Object.entries(groupedTypes).map(([categorie, types]) => (
                      <div key={categorie}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                          {getCategorieLabel(categorie)}
                        </div>
                        {types.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.nom} {type.montant > 0 && `(${formatFCFA(type.montant)})`}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Montant de l'amende (FCFA)</Label>
              <Input
                type="number"
                value={montantAmende}
                onChange={(e) => setMontantAmende(e.target.value)}
                placeholder="Montant auto-rempli selon le type"
                min="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Le montant est pré-rempli selon le type sélectionné mais peut être modifié
              </p>
            </div>

            <div>
              <Label>Motif / Détails</Label>
              <Textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Décrire le motif de la sanction (optionnel)..."
                rows={2}
              />
            </div>

            <Button type="submit" disabled={addSanction.isPending}>
              <Plus className="w-4 h-4 mr-2" />
              {addSanction.isPending ? 'Ajout...' : 'Ajouter la Sanction'}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}

      {/* Liste des sanctions */}
      <Card>
        <CardHeader>
          <CardTitle>Sanctions Enregistrées ({sanctions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {sanctions && sanctions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sanctions.map((sanction: unknown) => (
                  <TableRow key={sanction.id}>
                    <TableCell>
                      {sanction.membre?.prenom} {sanction.membre?.nom}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSanctionBadgeVariant(sanction.type_sanction)}>
                        {sanction.type_sanction}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {sanction.motif || '-'}
                    </TableCell>
                    <TableCell>
                      {sanction.montant_amende 
                        ? formatFCFA(parseFloat(sanction.montant_amende))
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={sanction.statut === 'paye' ? 'default' : sanction.statut === 'active' ? 'secondary' : 'outline'}>
                        {sanction.statut === 'paye' ? '✓ Payé' : sanction.statut}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {sanction.statut === 'active' && sanction.montant_amende > 0 && !isLocked && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markAsPaid.mutate(sanction.id)}
                            title="Marquer comme payé"
                          >
                            <CreditCard className="w-4 h-4" />
                          </Button>
                        )}
                        {!isLocked && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteSanction.mutate(sanction.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Aucune sanction enregistrée pour cette réunion
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
