import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMembers } from "@/hooks/useMembers";
import type { Reunion } from "../types";

export function useReunionsData() {
  const [reunions, setReunions] = useState<Reunion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCompteRenduForm, setShowCompteRenduForm] = useState(false);
  const [showCompteRenduViewer, setShowCompteRenduViewer] = useState(false);
  const [showClotureModal, setShowClotureModal] = useState(false);
  const [showReouvrirModal, setShowReouvrirModal] = useState(false);
  const [showNotifierModal, setShowNotifierModal] = useState(false);
  const [selectedReunion, setSelectedReunion] = useState<Reunion | null>(null);
  const [editingReunion, setEditingReunion] = useState<Reunion | null>(null);
  const [selectedMembreId, setSelectedMembreId] = useState<string | null>(null);
  const [selectedMembreNom, setSelectedMembreNom] = useState<string>("");
  const [showHistoriqueMembre, setShowHistoriqueMembre] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { members } = useMembers();

  const membresMap = useMemo(() => {
    return new Map(members?.map(m => [m.id, m]) || []);
  }, [members]);

  const getMemberName = (memberId: string | undefined | null) => {
    if (!memberId) return null;
    const membre = membresMap.get(memberId);
    return membre ? `${membre.prenom} ${membre.nom}` : null;
  };

  useEffect(() => {
    loadReunions();
  }, []);

  const loadReunions = async () => {
    try {
      const { data, error } = await supabase
        .from('reunions')
        .select(`*`)
        .order('date_reunion', { ascending: false });

      if (error) throw error;
      setReunions((data || []) as Reunion[]);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les réunions: " + (error instanceof Error ? error.message : "Erreur"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (reunion: Reunion) => {
    setEditingReunion(reunion);
    setShowForm(true);
  };

  const handleDelete = (reunionId: string) => {
    setPendingDeleteId(reunionId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      const { error } = await supabase.from('reunions').delete().eq('id', pendingDeleteId);
      if (error) throw error;
      toast({ title: "Succès", description: "Réunion supprimée avec succès" });
      loadReunions();
    } catch (error: unknown) {
      toast({ title: "Erreur", description: "Impossible de supprimer la réunion: " + (error instanceof Error ? error.message : "Erreur"), variant: "destructive" });
    }
    setShowDeleteConfirm(false);
    setPendingDeleteId(null);
  };

  const handleCompteRendu = (reunion: Reunion) => {
    setSelectedReunion(reunion);
    setShowCompteRenduForm(true);
  };

  const handleViewCompteRendu = (reunion: Reunion) => {
    setSelectedReunion(reunion);
    setShowCompteRenduViewer(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingReunion(null);
    loadReunions();
  };

  const handleCompteRenduSuccess = () => {
    setShowCompteRenduForm(false);
    setSelectedReunion(null);
    loadReunions();
  };

  const filteredReunions = reunions.filter(reunion =>
    reunion.ordre_du_jour?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reunion.lieu_description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const reunionsPlanifiees = reunions.filter(r => r.statut === 'planifie').length;
  const reunionsTerminees = reunions.filter(r => r.statut === 'terminee').length;
  const reunionsEnCours = reunions.filter(r => r.statut === 'en_cours').length;
  const reunionsMois = reunions.filter(r => {
    const date = new Date(r.date_reunion);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  return {
    reunions,
    loading,
    searchTerm,
    setSearchTerm,
    showForm,
    setShowForm,
    showCompteRenduForm,
    setShowCompteRenduForm,
    showCompteRenduViewer,
    setShowCompteRenduViewer,
    showClotureModal,
    setShowClotureModal,
    showReouvrirModal,
    setShowReouvrirModal,
    showNotifierModal,
    setShowNotifierModal,
    selectedReunion,
    setSelectedReunion,
    editingReunion,
    setEditingReunion,
    selectedMembreId,
    setSelectedMembreId,
    selectedMembreNom,
    setSelectedMembreNom,
    showHistoriqueMembre,
    setShowHistoriqueMembre,
    showDeleteConfirm,
    setShowDeleteConfirm,
    pendingDeleteId,
    confirmDelete,
    filteredReunions,
    getMemberName,
    handleEdit,
    handleDelete,
    handleCompteRendu,
    handleViewCompteRendu,
    handleFormSuccess,
    handleCompteRenduSuccess,
    loadReunions,
    stats: { reunionsPlanifiees, reunionsTerminees, reunionsEnCours, reunionsMois },
  };
}
