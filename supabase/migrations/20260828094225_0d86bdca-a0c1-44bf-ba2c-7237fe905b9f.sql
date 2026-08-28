REVOKE ALL ON FUNCTION public.normalize_email_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_email_key(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.normalize_email_key(text) TO service_role;