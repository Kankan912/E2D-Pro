-- Corriger la fonction create_caisse_operation_from_source
-- Problème: le CASE évalue NEW.date_depot même pour la table cotisations
-- Solution: utiliser IF/ELSIF pour accéder conditionnellement aux champs

CREATE OR REPLACE FUNCTION public.create_caisse_operation_from_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_operateur_id uuid;
  v_libelle text;
  v_type_operation text;
  v_categorie text;
  v_montant numeric;
  v_date_operation date;
  v_reunion_id uuid;
  v_exercice_id uuid;
BEGIN
  -- Déterminer l'opérateur (utiliser le premier admin si pas de membre associé)
  SELECT id INTO v_operateur_id FROM membres LIMIT 1;
  
  -- Initialiser les valeurs par défaut
  v_date_operation := CURRENT_DATE;
  v_reunion_id := NULL;
  v_exercice_id := NULL;
  
  -- Configuration selon la table source
  IF TG_TABLE_NAME = 'epargnes' THEN
    v_type_operation := 'entree';
    v_categorie := 'epargne';
    v_montant := NEW.montant;
    v_date_operation := COALESCE(NEW.date_depot, CURRENT_DATE);
    v_reunion_id := NEW.reunion_id;
    v_exercice_id := NEW.exercice_id;
    SELECT CONCAT('Épargne - ', m.prenom, ' ', m.nom) INTO v_libelle
    FROM membres m WHERE m.id = NEW.membre_id;
    v_operateur_id := NEW.membre_id;
    
  ELSIF TG_TABLE_NAME = 'cotisations' THEN
    IF NEW.statut = 'paye' THEN
      v_type_operation := 'entree';
      v_categorie := 'cotisation';
      v_montant := NEW.montant;
      v_date_operation := COALESCE(NEW.date_paiement, CURRENT_DATE);
      v_reunion_id := NEW.reunion_id;
      v_exercice_id := NEW.exercice_id;
      SELECT CONCAT('Cotisation - ', m.prenom, ' ', m.nom, ' - ', COALESCE(ct.nom, 'Type inconnu')) INTO v_libelle
      FROM membres m 
      LEFT JOIN cotisations_types ct ON ct.id = NEW.type_cotisation_id
      WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
    ELSE
      RETURN NEW; -- Ne pas créer d'opération si pas payé
    END IF;
    
  ELSIF TG_TABLE_NAME = 'reunions_sanctions' THEN
    IF NEW.statut = 'paye' THEN
      v_type_operation := 'entree';
      v_categorie := 'sanction';
      v_montant := NEW.montant;
      SELECT CONCAT('Sanction - ', m.prenom, ' ', m.nom, ' - ', NEW.motif) INTO v_libelle
      FROM membres m WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
    ELSE
      RETURN NEW;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'prets' THEN
    IF TG_OP = 'INSERT' THEN
      -- Décaissement du prêt
      v_type_operation := 'sortie';
      v_categorie := 'pret_decaissement';
      v_montant := NEW.montant;
      SELECT CONCAT('Prêt accordé - ', m.prenom, ' ', m.nom) INTO v_libelle
      FROM membres m WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
    ELSE
      RETURN NEW;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'prets_paiements' THEN
    v_type_operation := 'entree';
    v_categorie := 'pret_remboursement';
    v_montant := NEW.montant_paye;
    SELECT CONCAT('Remboursement prêt - ', m.prenom, ' ', m.nom) INTO v_libelle
    FROM prets p JOIN membres m ON m.id = p.membre_id WHERE p.id = NEW.pret_id;
    SELECT p.membre_id INTO v_operateur_id FROM prets p WHERE p.id = NEW.pret_id;
    
  ELSIF TG_TABLE_NAME = 'aides' THEN
    IF NEW.statut = 'alloue' THEN
      v_type_operation := 'sortie';
      v_categorie := 'aide';
      v_montant := NEW.montant;
      SELECT CONCAT('Aide - ', m.prenom, ' ', m.nom, ' - ', at.nom) INTO v_libelle
      FROM membres m 
      JOIN aides_types at ON at.id = NEW.type_aide_id
      WHERE m.id = NEW.beneficiaire_id;
      v_operateur_id := NEW.beneficiaire_id;
    ELSE
      RETURN NEW;
    END IF;
    
  ELSE
    RETURN NEW;
  END IF;
  
  -- Vérifier qu'il n'existe pas déjà une opération pour cette source
  IF NOT EXISTS (
    SELECT 1 FROM fond_caisse_operations 
    WHERE source_table = TG_TABLE_NAME AND source_id = NEW.id
  ) THEN
    INSERT INTO fond_caisse_operations (
      type_operation,
      montant,
      libelle,
      categorie,
      operateur_id,
      source_table,
      source_id,
      date_operation,
      reunion_id,
      exercice_id
    ) VALUES (
      v_type_operation,
      v_montant,
      COALESCE(v_libelle, 'Opération automatique'),
      v_categorie,
      COALESCE(v_operateur_id, (SELECT id FROM membres LIMIT 1)),
      TG_TABLE_NAME,
      NEW.id,
      v_date_operation,
      v_reunion_id,
      v_exercice_id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;