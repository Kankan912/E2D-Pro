-- ============================================
-- TRIGGERS POUR SYNCHRONISATION AUTOMATIQUE
-- ============================================

-- Fonction générique pour créer une opération de caisse
CREATE OR REPLACE FUNCTION public.create_caisse_operation_from_source()
RETURNS TRIGGER AS $$
DECLARE
  v_operateur_id uuid;
  v_libelle text;
  v_type_operation text;
  v_categorie text;
  v_montant numeric;
BEGIN
  -- Déterminer l'opérateur (utiliser le premier admin si pas de membre associé)
  SELECT id INTO v_operateur_id FROM membres LIMIT 1;
  
  -- Configuration selon la table source
  CASE TG_TABLE_NAME
    WHEN 'epargnes' THEN
      v_type_operation := 'entree';
      v_categorie := 'epargne';
      v_montant := NEW.montant;
      SELECT CONCAT('Épargne - ', m.prenom, ' ', m.nom) INTO v_libelle
      FROM membres m WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
      
    WHEN 'cotisations' THEN
      IF NEW.statut = 'paye' THEN
        v_type_operation := 'entree';
        v_categorie := 'cotisation';
        v_montant := NEW.montant;
        SELECT CONCAT('Cotisation - ', m.prenom, ' ', m.nom, ' - ', COALESCE(ct.nom, 'Type inconnu')) INTO v_libelle
        FROM membres m 
        LEFT JOIN cotisations_types ct ON ct.id = NEW.type_cotisation_id
        WHERE m.id = NEW.membre_id;
        v_operateur_id := NEW.membre_id;
      ELSE
        RETURN NEW; -- Ne pas créer d'opération si pas payé
      END IF;
      
    WHEN 'reunions_sanctions' THEN
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
      
    WHEN 'prets' THEN
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
      
    WHEN 'prets_paiements' THEN
      v_type_operation := 'entree';
      v_categorie := 'pret_remboursement';
      v_montant := NEW.montant_paye;
      SELECT CONCAT('Remboursement prêt - ', m.prenom, ' ', m.nom) INTO v_libelle
      FROM prets p JOIN membres m ON m.id = p.membre_id WHERE p.id = NEW.pret_id;
      SELECT p.membre_id INTO v_operateur_id FROM prets p WHERE p.id = NEW.pret_id;
      
    WHEN 'aides' THEN
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
  END CASE;
  
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
      COALESCE(
        CASE TG_TABLE_NAME
          WHEN 'epargnes' THEN NEW.date_depot
          WHEN 'cotisations' THEN NEW.date_paiement
          ELSE CURRENT_DATE
        END,
        CURRENT_DATE
      ),
      CASE WHEN TG_TABLE_NAME IN ('epargnes', 'cotisations') THEN NEW.reunion_id ELSE NULL END,
      CASE WHEN TG_TABLE_NAME IN ('epargnes', 'cotisations') THEN NEW.exercice_id ELSE NULL END
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fonction pour supprimer l'opération de caisse quand la source est supprimée
CREATE OR REPLACE FUNCTION public.delete_caisse_operation_from_source()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM fond_caisse_operations 
  WHERE source_table = TG_TABLE_NAME AND source_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fonction pour mettre à jour l'opération de caisse quand le statut change
CREATE OR REPLACE FUNCTION public.update_caisse_operation_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le statut passe à payé, créer l'opération
  IF (TG_TABLE_NAME = 'cotisations' AND NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye')) OR
     (TG_TABLE_NAME = 'reunions_sanctions' AND NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye')) THEN
    PERFORM public.create_caisse_operation_from_source();
  END IF;
  
  -- Si le statut passe à non-payé, supprimer l'opération
  IF (OLD.statut = 'paye' AND NEW.statut != 'paye') THEN
    DELETE FROM fond_caisse_operations 
    WHERE source_table = TG_TABLE_NAME AND source_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- CRÉATION DES TRIGGERS
-- ============================================

-- Trigger sur épargnes
DROP TRIGGER IF EXISTS trigger_caisse_epargnes_insert ON epargnes;
CREATE TRIGGER trigger_caisse_epargnes_insert
  AFTER INSERT ON epargnes
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_epargnes_delete ON epargnes;
CREATE TRIGGER trigger_caisse_epargnes_delete
  AFTER DELETE ON epargnes
  FOR EACH ROW
  EXECUTE FUNCTION delete_caisse_operation_from_source();

-- Trigger sur cotisations
DROP TRIGGER IF EXISTS trigger_caisse_cotisations_insert ON cotisations;
CREATE TRIGGER trigger_caisse_cotisations_insert
  AFTER INSERT ON cotisations
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_cotisations_update ON cotisations;
CREATE TRIGGER trigger_caisse_cotisations_update
  AFTER UPDATE OF statut ON cotisations
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_cotisations_delete ON cotisations;
CREATE TRIGGER trigger_caisse_cotisations_delete
  AFTER DELETE ON cotisations
  FOR EACH ROW
  EXECUTE FUNCTION delete_caisse_operation_from_source();

-- Trigger sur aides
DROP TRIGGER IF EXISTS trigger_caisse_aides_insert ON aides;
CREATE TRIGGER trigger_caisse_aides_insert
  AFTER INSERT ON aides
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_aides_delete ON aides;
CREATE TRIGGER trigger_caisse_aides_delete
  AFTER DELETE ON aides
  FOR EACH ROW
  EXECUTE FUNCTION delete_caisse_operation_from_source();

-- ============================================
-- MIGRATION DES DONNÉES EXISTANTES
-- ============================================

-- Importer les épargnes existantes
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id, 
  source_table, source_id, date_operation, reunion_id, exercice_id
)
SELECT 
  'entree',
  e.montant,
  CONCAT('Épargne - ', m.prenom, ' ', m.nom),
  'epargne',
  e.membre_id,
  'epargnes',
  e.id,
  COALESCE(e.date_depot, e.created_at::date),
  e.reunion_id,
  e.exercice_id
FROM epargnes e
JOIN membres m ON m.id = e.membre_id
WHERE NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'epargnes' AND fco.source_id = e.id
);

-- Importer les cotisations payées existantes
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id,
  source_table, source_id, date_operation, reunion_id, exercice_id
)
SELECT 
  'entree',
  c.montant,
  CONCAT('Cotisation - ', m.prenom, ' ', m.nom, ' - ', COALESCE(ct.nom, 'Type inconnu')),
  'cotisation',
  c.membre_id,
  'cotisations',
  c.id,
  COALESCE(c.date_paiement, c.created_at::date),
  c.reunion_id,
  c.exercice_id
FROM cotisations c
JOIN membres m ON m.id = c.membre_id
LEFT JOIN cotisations_types ct ON ct.id = c.type_cotisation_id
WHERE c.statut = 'paye'
AND NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'cotisations' AND fco.source_id = c.id
);

-- Importer les aides distribuées existantes
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id,
  source_table, source_id, date_operation
)
SELECT 
  'sortie',
  a.montant,
  CONCAT('Aide - ', m.prenom, ' ', m.nom, ' - ', at.nom),
  'aide',
  a.beneficiaire_id,
  'aides',
  a.id,
  COALESCE(a.date_allocation, a.created_at::date)
FROM aides a
JOIN membres m ON m.id = a.beneficiaire_id
JOIN aides_types at ON at.id = a.type_aide_id
WHERE a.statut = 'alloue'
AND NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'aides' AND fco.source_id = a.id
);