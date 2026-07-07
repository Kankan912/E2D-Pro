DROP TRIGGER IF EXISTS loan_request_init_steps ON public.loan_requests;
DROP TRIGGER IF EXISTS loan_requests_updated_at ON public.loan_requests;
DROP TRIGGER IF EXISTS loan_request_advance ON public.loan_request_validations;
DROP TRIGGER IF EXISTS loan_validation_config_updated_at ON public.loan_validation_config;