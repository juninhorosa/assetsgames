CREATE TABLE IF NOT EXISTS public.platform_limits (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ai_enabled boolean NOT NULL DEFAULT true,
  public_api_enabled boolean NOT NULL DEFAULT true,
  daily_credit_cap numeric NOT NULL DEFAULT 20,
  monthly_credit_cap numeric NOT NULL DEFAULT 200,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.platform_limits TO authenticated;
GRANT ALL ON public.platform_limits TO service_role;
ALTER TABLE public.platform_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read platform limits" ON public.platform_limits;
CREATE POLICY "Admins read platform limits" ON public.platform_limits
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.platform_limits (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.spend_guard_check(_credits numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim public.platform_limits;
  daily numeric;
  monthly numeric;
  allowed boolean := true;
  reason text := '';
BEGIN
  SELECT * INTO lim FROM public.platform_limits WHERE id LIMIT 1;
  IF lim IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', '');
  END IF;

  SELECT COALESCE(SUM(credits), 0) INTO daily
  FROM public.generation_runs
  WHERE created_at >= date_trunc('day', now());

  SELECT COALESCE(SUM(credits), 0) INTO monthly
  FROM public.generation_runs
  WHERE created_at >= date_trunc('month', now());

  IF NOT lim.ai_enabled THEN
    allowed := false; reason := 'ai_disabled';
  ELSIF lim.daily_credit_cap > 0 AND daily + COALESCE(_credits, 0) > lim.daily_credit_cap THEN
    allowed := false; reason := 'daily_cap';
  ELSIF lim.monthly_credit_cap > 0 AND monthly + COALESCE(_credits, 0) > lim.monthly_credit_cap THEN
    allowed := false; reason := 'monthly_cap';
  END IF;

  RETURN jsonb_build_object(
    'allowed', allowed,
    'reason', reason,
    'ai_enabled', lim.ai_enabled,
    'public_api_enabled', lim.public_api_enabled,
    'daily_used', daily,
    'monthly_used', monthly,
    'daily_cap', lim.daily_credit_cap,
    'monthly_cap', lim.monthly_credit_cap
  );
END;
$$;

REVOKE ALL ON FUNCTION public.spend_guard_check(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_guard_check(numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.spend_guard_update(
  _ai_enabled boolean,
  _public_api_enabled boolean,
  _daily_cap numeric,
  _monthly_cap numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.platform_limits SET
    ai_enabled = COALESCE(_ai_enabled, ai_enabled),
    public_api_enabled = COALESCE(_public_api_enabled, public_api_enabled),
    daily_credit_cap = GREATEST(0, COALESCE(_daily_cap, daily_credit_cap)),
    monthly_credit_cap = GREATEST(0, COALESCE(_monthly_cap, monthly_credit_cap)),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id;

  RETURN public.spend_guard_check(0);
END;
$$;

REVOKE ALL ON FUNCTION public.spend_guard_update(boolean, boolean, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_guard_update(boolean, boolean, numeric, numeric) TO authenticated, service_role;