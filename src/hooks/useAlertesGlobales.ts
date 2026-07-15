import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatFCFA } from "@/lib/utils";

export interface Alerte {
  id: string;
  type: 'pret_retard' | 'sanction_impayee' | 'caisse_bas' | 'reunion_proche';
  niveau: 'info' | 'warning' | 'danger';
  titre: string;
  description: string;
  lien?: string;
  dateCreation: Date;
  membreId?: string;
  membreNom?: string;
  montant?: number;
}

export function useAlertesGlobales() {
  const { user } = useAuth();

  // Prêts en retard
  const { data: pretsRetard = [] } = useQuery({
    queryKey: ['alertes-prets-retard'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('prets')
        .select(`
          id,
          montant,
          echeance,
          montant_paye,
          montant_total_du,
          membre:membres!fk_prets_membre(id, nom, prenom)
        `)
        .in('statut', ['en_cours', 'partiel'])
        .lt('echeance', today);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  // Sanctions impayées
  //
  // Task 20 — Phase 3-e Fix 2 :
  // La table `reunions_sanctions` expose `montant_amende` (NUMERIC nullable)
  // et NON `montant` — l'ancien select renvoyait `null` pour `montant` et le
  // `formatFCFA(Number(null))` produisait "NaN FCFA" dans l'UI. Le filtre
  // `.gt('montant', 0)` ne matchait rien non plus (colonne inexistante).
  // Schéma confirmé par migration `20251126102120` + types générés.
  const { data: sanctionsImpayees = [] } = useQuery({
    queryKey: ['alertes-sanctions-impayees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions_sanctions')
        .select(`
          id,
          montant_amende,
          statut,
          created_at,
          membre:membres!fk_reunions_sanctions_membre(id, nom, prenom),
          reunion:reunions!fk_reunions_sanctions_reunion(date_reunion)
        `)
        .neq('statut', 'paye')
        .gt('montant_amende', 0);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  // Configuration caisse pour seuils
  const { data: caisseConfig } = useQuery({
    queryKey: ['caisse-config-alertes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caisse_config')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  // Solde caisse (via RPC serveur pour éviter la pagination)
  const { data: soldeCaisse } = useQuery({
    queryKey: ['solde-caisse-alertes'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_solde_caisse');
      if (error) throw error;
      return Number(data) || 0;
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  // Réunions proches (7 jours)
  const { data: reunionsProches = [] } = useQuery({
    queryKey: ['alertes-reunions-proches'],
    queryFn: async () => {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const { data, error } = await supabase
        .from('reunions')
        .select('id, date_reunion, ordre_du_jour, lieu_description')
        .gte('date_reunion', today.toISOString().split('T')[0])
        .lte('date_reunion', nextWeek.toISOString().split('T')[0])
        .eq('statut', 'planifiee');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Construire la liste des alertes
  const alertes: Alerte[] = [];

  // Alertes prêts en retard
  pretsRetard.forEach((pret: unknown) => {
    const joursRetard = Math.floor(
      (new Date().getTime() - new Date(pret.echeance).getTime()) / (1000 * 60 * 60 * 24)
    );
    const resteDu = (pret.montant_total_du || pret.montant) - (pret.montant_paye || 0);
    
    alertes.push({
      id: `pret-${pret.id}`,
      type: 'pret_retard',
      niveau: joursRetard >= 30 ? 'danger' : 'warning',
      titre: `Prêt en retard (${joursRetard}j)`,
      description: `${pret.membre?.prenom} ${pret.membre?.nom} - Reste ${formatFCFA(resteDu)}`,
      lien: '/dashboard/admin/finances/prets',
      dateCreation: new Date(pret.echeance),
      membreId: pret.membre?.id,
      membreNom: `${pret.membre?.prenom} ${pret.membre?.nom}`,
      montant: resteDu,
    });
  });

  // Alertes sanctions impayées
  //
  // Task 20 — Phase 3-e Fix 2 :
  // Lit `sanction.montant_amende` (et non `sanction.montant` qui n'existe pas
  // sur `reunions_sanctions`). `formatFCFA(Number(montant_amende ?? 0))`
  // affiche désormais le montant réel de l'amende au lieu de "NaN FCFA" /
  // "0 FCFA" systématique.
  sanctionsImpayees.forEach((sanction: unknown) => {
    const montantAmende = Number(sanction.montant_amende ?? 0);
    alertes.push({
      id: `sanction-${sanction.id}`,
      type: 'sanction_impayee',
      niveau: 'warning',
      titre: 'Sanction impayée',
      description: `${sanction.membre?.prenom} ${sanction.membre?.nom} - ${formatFCFA(montantAmende)}`,
      lien: '/dashboard/admin/reunions',
      dateCreation: new Date(sanction.created_at),
      membreId: sanction.membre?.id,
      membreNom: `${sanction.membre?.prenom} ${sanction.membre?.nom}`,
      montant: montantAmende,
    });
  });

  // Alerte caisse basse
  const seuilAlerte = caisseConfig?.seuil_alerte_solde || 50000;
  if (soldeCaisse !== undefined && soldeCaisse < seuilAlerte) {
    alertes.push({
      id: 'caisse-basse',
      type: 'caisse_bas',
      niveau: soldeCaisse < seuilAlerte / 2 ? 'danger' : 'warning',
      titre: 'Solde caisse bas',
      description: `Solde actuel: ${formatFCFA(soldeCaisse)} (seuil: ${formatFCFA(seuilAlerte)})`,
      lien: '/dashboard/admin/caisse',
      dateCreation: new Date(),
      montant: soldeCaisse,
    });
  }

  // Alertes réunions proches
  reunionsProches.forEach((reunion: unknown) => {
    const dateReunion = new Date(reunion.date_reunion);
    const joursRestants = Math.ceil(
      (dateReunion.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    alertes.push({
      id: `reunion-${reunion.id}`,
      type: 'reunion_proche',
      niveau: 'info',
      titre: joursRestants === 0 ? "Réunion aujourd'hui" : `Réunion dans ${joursRestants}j`,
      description: reunion.ordre_du_jour || reunion.lieu_description || 'Réunion à venir',
      lien: '/dashboard/admin/reunions',
      dateCreation: dateReunion,
    });
  });

  // Trier par niveau de gravité puis par date
  const niveauPoids = { danger: 3, warning: 2, info: 1 };
  alertes.sort((a, b) => {
    const poidsDiff = niveauPoids[b.niveau] - niveauPoids[a.niveau];
    if (poidsDiff !== 0) return poidsDiff;
    return b.dateCreation.getTime() - a.dateCreation.getTime();
  });

  const alertesCritiques = alertes.filter(a => a.niveau === 'danger' || a.niveau === 'warning');

  return {
    alertes,
    alertesCritiques,
    nombreTotal: alertes.length,
    nombreCritiques: alertesCritiques.length,
    pretsRetard: pretsRetard.length,
    sanctionsImpayees: sanctionsImpayees.length,
  };
}
