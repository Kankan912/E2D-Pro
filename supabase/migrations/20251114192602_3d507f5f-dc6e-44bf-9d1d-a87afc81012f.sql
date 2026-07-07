-- Fix critical RLS security issues
-- 1. Lock down smtp_config to admin-only access
-- 2. Remove duplicate adhesions policy
-- 3. Add policies to recurring_donations table

-- ==========================================
-- 1. SMTP Config - Admin Only Access
-- ==========================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent voir SMTP" ON smtp_config;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent gérer SMTP" ON smtp_config;

-- Create admin-only policies
CREATE POLICY "Admin can view SMTP config" ON smtp_config
  FOR SELECT USING (is_admin());

CREATE POLICY "Admin can manage SMTP config" ON smtp_config
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

-- ==========================================
-- 2. Adhesions - Remove Duplicate Policy
-- ==========================================

-- Remove the duplicate French policy, keep the English one
DROP POLICY IF EXISTS "Public peut insérer des adhesions" ON adhesions;

-- ==========================================
-- 3. Recurring Donations - Add Policies
-- ==========================================

-- Service role policy for backend operations
CREATE POLICY "Service role can manage recurring donations" 
ON recurring_donations
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Admin policy for viewing recurring donations
CREATE POLICY "Admin can view recurring donations" 
ON recurring_donations
FOR SELECT
USING (is_admin());

-- Admin policy for managing recurring donations
CREATE POLICY "Admin can manage recurring donations" 
ON recurring_donations
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());