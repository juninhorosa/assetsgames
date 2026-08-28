CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS device_fingerprints_fp_idx ON public.device_fingerprints (fingerprint);

GRANT SELECT ON public.device_fingerprints TO authenticated;
GRANT ALL ON public.device_fingerprints TO service_role;

ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices"
ON public.device_fingerprints FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all devices"
ON public.device_fingerprints FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.register_device_fingerprint(_fingerprint text, _components jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _flagged boolean := false;
BEGIN
  IF _uid IS NULL OR _fingerprint IS NULL OR length(_fingerprint) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'duplicate', false);
  END IF;

  INSERT INTO public.device_fingerprints (user_id, fingerprint, components)
  VALUES (_uid, _fingerprint, coalesce(_components, '{}'::jsonb))
  ON CONFLICT (user_id, fingerprint)
  DO UPDATE SET last_seen_at = now(), components = coalesce(_components, '{}'::jsonb);

  SELECT d.user_id INTO _owner
  FROM public.device_fingerprints d
  JOIN public.profiles p ON p.id = d.user_id
  WHERE d.fingerprint = _fingerprint AND d.user_id <> _uid
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF _owner IS NOT NULL THEN
    UPDATE public.profiles
    SET duplicate_suspect = true,
        duplicate_of = COALESCE(duplicate_of, _owner),
        trial_credits = CASE WHEN plan = 'admin' THEN trial_credits ELSE 0 END
    WHERE id = _uid AND plan <> 'admin';
    _flagged := true;
  END IF;

  RETURN jsonb_build_object('ok', true, 'duplicate', _flagged);
END;
$$;

REVOKE ALL ON FUNCTION public.register_device_fingerprint(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_device_fingerprint(text, jsonb) TO authenticated;