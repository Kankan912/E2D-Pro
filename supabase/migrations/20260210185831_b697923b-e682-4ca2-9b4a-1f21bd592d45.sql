
-- =============================================
-- Fix: Update create_caisse_operation_from_source to handle DELETE and status changes
-- =============================================

CREATE OR REPLACE FUNCTION create_caisse_operation_from_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operateur_id uuid;
  v_libelle text;
  v_type_operation text;
  v_categorie text;
  v_montant numeric;
  v_date_operation date;
  v_reunion_id uuid;
  v_exercice_id uuid;
  v_source_id uuid;
BEGIN
  -- Handle DELETE: clean up linked caisse operation
  IF TG_OP = 'DELETE' THEN
    DELETE FROM fond_caisse_operations 
    WHERE source_table = TG_TABLE_NAME AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Handle UPDATE: clean up old operation if status changed away from triggering status
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'aides' AND OLD.statut = 'alloue' AND NEW.statut != 'alloue' THEN
      DELETE FROM fond_caisse_operations WHERE source_table = 'aides' AND source_id = NEW.id;
      RETURN NEW;
    END IF;
    IF TG_TABLE_NAME = 'cotisations' AND OLD.statut = 'paye' AND NEW.statut != 'paye' THEN
      DELETE FROM fond_caisse_operations WHERE source_table = 'cotisations' AND source_id = NEW.id;
      RETURN NEW;
    END IF;
    IF TG_TABLE_NAME = 'reunions_sanctions' AND OLD.statut = 'paye' AND NEW.statut != 'paye' THEN
      DELETE FROM fond_caisse_operations WHERE source_table = 'reunions_sanctions' AND source_id = NEW.id;
      RETURN NEW;
    END IF;
  END IF;

  -- Déterminer l'opérateur par défaut
  SELECT id INTO v_operateur_id FROM membres LIMIT 1;
  
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
      RETURN NEW;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'reunions_sanctions' THEN
    IF NEW.statut = 'paye' THEN
      v_type_operation := 'entree';
      v_categorie := 'sanction';
      v_montant := NEW.montant;
      v_reunion_id := NEW.reunion_id;
      SELECT CONCAT('Sanction - ', m.prenom, ' ', m.nom, ' - ', NEW.motif) INTO v_libelle
      FROM membres m WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
    ELSE
      RETURN NEW;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'prets' THEN
    IF TG_OP = 'INSERT' THEN
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
      v_exercice_id := NEW.exercice_id;
      v_reunion_id := NEW.reunion_id;
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
  
  -- Upsert: delete old then insert new to handle amount/status changes
  DELETE FROM fond_caisse_operations 
  WHERE source_table = TG_TABLE_NAME AND source_id = NEW.id;

  INSERT INTO fond_caisse_operations (
    type_operation, montant, libelle, categorie, operateur_id,
    source_table, source_id, date_operation, reunion_id, exercice_id
  ) VALUES (
    v_type_operation, v_montant,
    COALESCE(v_libelle, 'Opération automatique'),
    v_categorie,
    COALESCE(v_operateur_id, (SELECT id FROM membres LIMIT 1)),
    TG_TABLE_NAME, NEW.id, v_date_operation, v_reunion_id, v_exercice_id
  );
  
  RETURN NEW;
END;
$$;

-- =============================================
-- 1. Trigger UPDATE sur aides (statut change)
-- =============================================
DROP TRIGGER IF EXISTS trigger_caisse_aides_update ON aides;
CREATE TRIGGER trigger_caisse_aides_update
  AFTER UPDATE OF statut ON aides
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

-- =============================================
-- 2. Triggers sur reunions_sanctions
-- =============================================
DROP TRIGGER IF EXISTS trigger_caisse_sanctions_insert ON reunions_sanctions;
CREATE TRIGGER trigger_caisse_sanctions_insert
  AFTER INSERT ON reunions_sanctions
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_sanctions_update ON reunions_sanctions;
CREATE TRIGGER trigger_caisse_sanctions_update
  AFTER UPDATE OF statut ON reunions_sanctions
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_sanctions_delete ON reunions_sanctions;
CREATE TRIGGER trigger_caisse_sanctions_delete
  BEFORE DELETE ON reunions_sanctions
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

-- =============================================
-- 3. Trigger DELETE sur prets
-- =============================================
DROP TRIGGER IF EXISTS trigger_caisse_prets_delete ON prets;
CREATE TRIGGER trigger_caisse_prets_delete
  BEFORE DELETE ON prets
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();
