ALTER TABLE public.loan_request_validations DROP CONSTRAINT IF EXISTS loan_request_validations_statut_check;
ALTER TABLE public.loan_request_validations
  ADD CONSTRAINT loan_request_validations_statut_check
  CHECK (statut IN ('pending','approved','rejected','cancelled'));