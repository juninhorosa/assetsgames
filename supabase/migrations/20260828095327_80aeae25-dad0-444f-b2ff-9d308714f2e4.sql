DROP FUNCTION IF EXISTS public.spend_guard_update(boolean, boolean, numeric, numeric);
REVOKE ALL ON FUNCTION public.spend_guard_check(numeric) FROM authenticated;
REVOKE ALL ON FUNCTION public.spend_guard_check(numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.spend_guard_check(numeric) TO service_role;
REVOKE SELECT ON public.platform_limits FROM authenticated;