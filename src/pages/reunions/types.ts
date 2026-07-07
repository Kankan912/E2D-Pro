export interface Reunion {
  id: string;
  sujet?: string;
  date_reunion: string;
  statut: string;
  ordre_du_jour: string;
  lieu_description: string;
  compte_rendu_url: string;
  lieu_membre_id?: string;
  beneficiaire_id?: string;
  taux_presence?: number;
}
