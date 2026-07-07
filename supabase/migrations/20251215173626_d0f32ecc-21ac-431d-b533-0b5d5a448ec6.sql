-- Ajouter duree_reconduction à prets_config
ALTER TABLE prets_config 
ADD COLUMN IF NOT EXISTS duree_reconduction INTEGER NOT NULL DEFAULT 2;

-- Ajouter duree_mois par défaut à prets_config
ALTER TABLE prets_config 
ADD COLUMN IF NOT EXISTS duree_mois INTEGER NOT NULL DEFAULT 2;

-- Ajouter taux_interet_defaut à prets_config
ALTER TABLE prets_config 
ADD COLUMN IF NOT EXISTS taux_interet_defaut NUMERIC NOT NULL DEFAULT 5.0;

-- S'assurer qu'une config existe
INSERT INTO prets_config (duree_mois, duree_reconduction, max_reconductions, interet_avant_capital, taux_interet_defaut)
SELECT 2, 2, 3, true, 5.0
WHERE NOT EXISTS (SELECT 1 FROM prets_config);

-- Corriger les échéances des prêts qui ont été reconduits avec +1 mois au lieu de +2
-- Ajouter 1 mois supplémentaire par reconduction pour ceux qui ne sont pas remboursés
UPDATE prets
SET echeance = echeance + (reconductions * interval '1 month')
WHERE reconductions > 0 AND statut != 'rembourse';