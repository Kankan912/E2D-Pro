import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Search, UserCheck, UserX, Clock, FileDown, Lock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportService } from "@/lib/exportService";
import { cn } from "@/lib/utils";

// Composant Textarea avec debounce pour les observations
function DebouncedTextarea({ 
  value, 
  onChange, 
  placeholder,
  className,
  rows 
}: { 
  value: string; 
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchroniser avec la valeur externe quand elle change
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // Annuler le timeout précédent
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Debounce de 500ms avant de sauvegarder
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 500);
  }, [onChange]);

  // Cleanup du timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Textarea
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      rows={rows}
    />
  );
}
interface ReunionPresencesManagerProps {
  reunionId: string;
}

export default function ReunionPresencesManager({ reunionId }: ReunionPresencesManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<string>("all");

  // Vérifier si la réunion est clôturée (verrouillée)
  const { data: reunionInfo } = useQuery({
    queryKey: ['reunion-info', reunionId],
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

  // Charger uniquement les membres E2D actifs
  const { data: membres } = useQuery({
    queryKey: ['membres-actifs-e2d'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom, photo_url')
        .eq('statut', 'actif')
        .eq('est_membre_e2d', true)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Charger les présences de la réunion
  const { data: presences } = useQuery({
    queryKey: ['reunion-presences', reunionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions_presences')
        .select('*')
        .eq('reunion_id', reunionId);
      if (error) throw error;
      return data;
    },
    enabled: !!reunionId,
  });

  // Mutation pour sauvegarder/mettre à jour les présences
  const updatePresence = useMutation({
    mutationFn: async ({ 
      membreId, 
      statutPresence, 
      heureArrivee, 
      observations 
    }: { 
      membreId: string; 
      statutPresence: string;
      heureArrivee?: string;
      observations?: string;
    }) => {
      const existingPresence = presences?.find(p => p.membre_id === membreId);

      const presenceData = {
        reunion_id: reunionId,
        membre_id: membreId,
        statut_presence: statutPresence,
        present: statutPresence === 'present',
        heure_arrivee: heureArrivee || null,
        observations: observations || null,
      };

      if (existingPresence) {
        const { error } = await supabase
          .from('reunions_presences')
          .update(presenceData)
          .eq('id', existingPresence.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reunions_presences')
          .insert([presenceData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunion-presences', reunionId] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Marquer tous comme présents
  const markAllPresent = useMutation({
    mutationFn: async () => {
      if (!membres) return;
      
      const updates = membres.map(membre => ({
        reunion_id: reunionId,
        membre_id: membre.id,
        statut_presence: 'present',
        present: true,
      }));

      const { error } = await supabase
        .from('reunions_presences')
        .upsert(updates, { onConflict: 'reunion_id,membre_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunion-presences', reunionId] });
      toast({
        title: "Succès",
        description: "Tous les membres ont été marqués présents.",
      });
    },
  });

  // Marquer tous comme absents
  const markAllAbsent = useMutation({
    mutationFn: async () => {
      if (!membres) return;
      
      const updates = membres.map(membre => ({
        reunion_id: reunionId,
        membre_id: membre.id,
        statut_presence: 'absent_non_excuse',
        present: false,
      }));

      const { error } = await supabase
        .from('reunions_presences')
        .upsert(updates, { onConflict: 'reunion_id,membre_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunion-presences', reunionId] });
      toast({
        title: "Succès",
        description: "Tous les membres ont été marqués absents.",
      });
    },
  });

  const filteredMembres = membres?.filter(membre => {
    const nomComplet = `${membre.nom} ${membre.prenom}`.toLowerCase();
    const matchSearch = nomComplet.includes(searchTerm.toLowerCase());
    
    if (filtreStatut === 'all') return matchSearch;
    
    const presence = presences?.find(p => p.membre_id === membre.id);
    const statut = presence?.statut_presence || null;
    
    if (filtreStatut === 'present' && statut !== 'present') return false;
    if (filtreStatut === 'absent_non_excuse' && statut !== 'absent_non_excuse') return false;
    if (filtreStatut === 'absent_excuse' && statut !== 'absent_excuse') return false;
    if (filtreStatut === 'non_marque' && statut !== null) return false;
    
    return matchSearch;
  });

  const getPresence = (membreId: string) => {
    return presences?.find(p => p.membre_id === membreId);
  };

  const handleStatutChange = (membreId: string, statut: string) => {
    const presence = getPresence(membreId);
    updatePresence.mutate({
      membreId,
      statutPresence: statut,
      heureArrivee: presence?.heure_arrivee,
      observations: presence?.observations,
    });
  };

  const handleHeureChange = (membreId: string, heure: string) => {
    const presence = getPresence(membreId);
    updatePresence.mutate({
      membreId,
      statutPresence: presence?.statut_presence || 'present',
      heureArrivee: heure,
      observations: presence?.observations,
    });
  };

  const handleObservationsChange = (membreId: string, obs: string) => {
    const presence = getPresence(membreId);
    updatePresence.mutate({
      membreId,
      statutPresence: presence?.statut_presence || 'present',
      heureArrivee: presence?.heure_arrivee,
      observations: obs,
    });
  };

  // Calcul des statistiques basé sur les présences enregistrées uniquement
  const presentsCount = presences?.filter(p => p.statut_presence === 'present').length || 0;
  const absentsExcusesCount = presences?.filter(p => p.statut_presence === 'absent_excuse').length || 0;
  const absentsNonExcusesCount = presences?.filter(p => p.statut_presence === 'absent_non_excuse').length || 0;
  const nonMarquesCount = (membres?.length || 0) - (presences?.length || 0);

  const stats = {
    presents: presentsCount,
    absentsExcuses: absentsExcusesCount,
    absentsNonExcuses: absentsNonExcusesCount,
    nonMarques: nonMarquesCount,
    total: membres?.length || 0,
  };

  const tauxPresence = stats.total > 0 
    ? ((stats.presents / stats.total) * 100).toFixed(1) 
    : '0';

  const handleExport = async (exportFormat: 'excel' | 'pdf' | 'csv') => {
    try {
      // Récupérer les infos de la réunion pour le titre
      const { data: reunion } = await supabase
        .from('reunions')
        .select('date_reunion, type_reunion')
        .eq('id', reunionId)
        .single();

      await ExportService.export({
        type: 'presences_reunion',
        format: exportFormat,
        nom: `feuille_presence_${reunion?.date_reunion || reunionId}`,
        configuration: { 
          reunion_id: reunionId,
          date: reunion?.date_reunion,
          type: reunion?.type_reunion
        },
      });
      toast({
        title: "Export réussi",
        description: `La feuille de présence a été exportée en ${exportFormat.toUpperCase()}`,
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur d'export",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Avertissement si réunion clôturée */}
      {isLocked && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Réunion clôturée</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Cette réunion a été clôturée. Les modifications ne sont plus possibles.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.presents}</p>
              <p className="text-xs text-muted-foreground">Présents</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.absentsExcuses}</p>
              <p className="text-xs text-muted-foreground">Abs. Excusées</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.absentsNonExcuses}</p>
              <p className="text-xs text-muted-foreground">Abs. Non Excusées</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-400 bg-gray-50 dark:bg-gray-950/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{stats.nonMarques}</p>
              <p className="text-xs text-muted-foreground">Non marqués</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total E2D</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{tauxPresence}%</p>
              <p className="text-xs text-muted-foreground">Taux</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <div className="flex gap-2 justify-between">
        <div className="flex gap-2">
          <Button
            onClick={() => markAllPresent.mutate()}
            disabled={markAllPresent.isPending || isLocked}
            variant="outline"
            size="sm"
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Tous présents
          </Button>
          <Button
            onClick={() => markAllAbsent.mutate()}
            disabled={markAllAbsent.isPending || isLocked}
            variant="outline"
            size="sm"
          >
            <UserX className="w-4 h-4 mr-2" />
            Tous absents
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
            <FileDown className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
            <FileDown className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Feuille de présence */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Feuille de Présence
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={filtreStatut} onValueChange={setFiltreStatut}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="present">Présents</SelectItem>
                  <SelectItem value="absent_non_excuse">Absents non excusés</SelectItem>
                  <SelectItem value="absent_excuse">Absents excusés</SelectItem>
                  <SelectItem value="non_marque">Non marqués</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">N°</TableHead>
                  <TableHead>Nom du membre</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead className="text-center">Heure d'arrivée</TableHead>
                  <TableHead>Observations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembres?.map((membre, index) => {
                  const presence = getPresence(membre.id);
                  const statut = presence?.statut_presence || null;

                  return (
                    <TableRow 
                      key={membre.id}
                      className={cn(
                        statut === 'present' && 'bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50 border-l-4 border-l-green-500',
                        statut === 'absent_non_excuse' && 'bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 border-l-4 border-l-red-500',
                        statut === 'absent_excuse' && 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 border-l-4 border-l-orange-500',
                        !statut && 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-950/30 dark:hover:bg-gray-950/50 border-l-4 border-l-gray-400'
                      )}
                    >
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {membre.prenom} {membre.nom}
                      </TableCell>
                      <TableCell>
                        <RadioGroup
                          value={statut || ''}
                          onValueChange={(value) => handleStatutChange(membre.id, value)}
                          className="flex gap-4"
                          disabled={isLocked}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="present" id={`${membre.id}-present`} disabled={isLocked} />
                            <Label htmlFor={`${membre.id}-present`} className={cn("flex items-center gap-1", isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                              <UserCheck className="w-4 h-4 text-green-600" />
                              Présent
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="absent_non_excuse" id={`${membre.id}-absent`} disabled={isLocked} />
                            <Label htmlFor={`${membre.id}-absent`} className={cn("flex items-center gap-1", isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                              <UserX className="w-4 h-4 text-red-600" />
                              Absent
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="absent_excuse" id={`${membre.id}-excuse`} disabled={isLocked} />
                            <Label htmlFor={`${membre.id}-excuse`} className={cn("flex items-center gap-1", isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                              <UserX className="w-4 h-4 text-orange-600" />
                              Excusé
                            </Label>
                          </div>
                        </RadioGroup>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <Input
                            type="time"
                            value={presence?.heure_arrivee || ''}
                            onChange={(e) => handleHeureChange(membre.id, e.target.value)}
                            className="w-32"
                            disabled={statut !== 'present' || isLocked}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <DebouncedTextarea
                          value={presence?.observations || ''}
                          onChange={(obs) => !isLocked && handleObservationsChange(membre.id, obs)}
                          placeholder={isLocked ? "Verrouillé" : "Observations..."}
                          className={cn("min-h-[60px] text-sm", isLocked && "opacity-50 cursor-not-allowed")}
                          rows={2}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filteredMembres?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Aucun membre trouvé
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
