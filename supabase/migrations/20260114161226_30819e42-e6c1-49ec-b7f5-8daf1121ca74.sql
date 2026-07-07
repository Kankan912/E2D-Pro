-- Phase 2: Nettoyer les anciennes RLS policies permissives

-- Réunions
DROP POLICY IF EXISTS "Tous peuvent voir les réunions" ON reunions;
DROP POLICY IF EXISTS "Secrétaires peuvent gérer les réunions" ON reunions;

-- Sanctions
DROP POLICY IF EXISTS "Tous peuvent voir les sanctions" ON sanctions;
DROP POLICY IF EXISTS "Censeurs peuvent gérer les sanctions" ON sanctions;

-- Aides
DROP POLICY IF EXISTS "Tous peuvent voir les aides" ON aides;
DROP POLICY IF EXISTS "Trésoriers peuvent gérer les aides" ON aides;

-- Épargnes
DROP POLICY IF EXISTS "Membres peuvent voir leurs épargnes et trésoriers toutes" ON epargnes;
DROP POLICY IF EXISTS "Trésoriers peuvent supprimer les épargnes" ON epargnes;

-- Cotisations (anciennes policies)
DROP POLICY IF EXISTS "Membres peuvent voir leurs cotisations" ON cotisations;
DROP POLICY IF EXISTS "Trésoriers peuvent tout faire" ON cotisations;

-- Prêts (anciennes policies)
DROP POLICY IF EXISTS "Membres peuvent voir leurs prêts" ON prets;
DROP POLICY IF EXISTS "Trésoriers peuvent gérer les prêts" ON prets;

-- Membres (anciennes policies)
DROP POLICY IF EXISTS "Membres actifs visibles par tous" ON membres;
DROP POLICY IF EXISTS "Secrétaires peuvent gérer les membres" ON membres;