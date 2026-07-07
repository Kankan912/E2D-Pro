-- Trigger pour synchroniser automatiquement les sanctions payées avec la caisse
CREATE OR REPLACE FUNCTION sync_sanction_to_caisse()
RETURNS TRIGGER AS $$
DECLARE
  v_membre_nom text;
  v_operateur_id uuid;
BEGIN
  -- Si la sanction a une amende et vient d'être payée
  IF NEW.montant_amende > 0 AND NEW.statut = 'paye' AND 
     (OLD IS NULL OR OLD.statut != 'paye') THEN
    
    -- Récupérer le nom du membre pour le libellé
    SELECT CONCAT(prenom, ' ', nom) INTO v_membre_nom
    FROM membres WHERE id = NEW.membre_id;
    
    -- Utiliser le membre comme opérateur
    v_operateur_id := NEW.membre_id;
    
    -- Vérifier qu'il n'existe pas déjà une opération pour cette sanction
    IF NOT EXISTS (
      SELECT 1 FROM fond_caisse_operations 
      WHERE source_table = 'reunions_sanctions' AND source_id = NEW.id
    ) THEN
      INSERT INTO fond_caisse_operations (
        date_operation,
        montant,
        type_operation,
        categorie,
        libelle,
        source_table,
        source_id,
        beneficiaire_id,
        operateur_id,
        reunion_id
      ) VALUES (
        CURRENT_DATE,
        NEW.montant_amende,
        'entree',
        'sanction',
        CONCAT('Amende sanction - ', v_membre_nom, ' - ', COALESCE(NEW.motif, 'Sanction')),
        'reunions_sanctions',
        NEW.id,
        NEW.membre_id,
        v_operateur_id,
        NEW.reunion_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_sync_sanction_caisse ON reunions_sanctions;

-- Créer le trigger sur les insertions et mises à jour
CREATE TRIGGER trigger_sync_sanction_caisse
AFTER INSERT OR UPDATE ON reunions_sanctions
FOR EACH ROW EXECUTE FUNCTION sync_sanction_to_caisse();