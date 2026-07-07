DROP TRIGGER IF EXISTS loan_request_init_steps ON public.loan_requests;
CREATE TRIGGER loan_request_init_steps
AFTER INSERT ON public.loan_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_loan_request_init_steps();

DROP TRIGGER IF EXISTS loan_request_advance ON public.loan_request_validations;
CREATE TRIGGER loan_request_advance
AFTER UPDATE OF statut ON public.loan_request_validations
FOR EACH ROW
WHEN (OLD.statut IS DISTINCT FROM NEW.statut)
EXECUTE FUNCTION public.trg_loan_request_advance();

DROP TRIGGER IF EXISTS loan_requests_updated_at ON public.loan_requests;
CREATE TRIGGER loan_requests_updated_at
BEFORE UPDATE ON public.loan_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS loan_validation_config_updated_at ON public.loan_validation_config;
CREATE TRIGGER loan_validation_config_updated_at
BEFORE UPDATE ON public.loan_validation_config
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();