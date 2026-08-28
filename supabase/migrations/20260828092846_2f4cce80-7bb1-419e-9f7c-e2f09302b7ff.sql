ALTER TABLE public.profiles ALTER COLUMN trial_credits SET DEFAULT 50;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_key text,
  ADD COLUMN IF NOT EXISTS duplicate_suspect boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.normalize_email_key(_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _email IS NULL THEN NULL
    ELSE
      CASE
        WHEN split_part(lower(_email), '@', 2) IN ('gmail.com', 'googlemail.com')
          THEN replace(split_part(split_part(lower(_email), '@', 1), '+', 1), '.', '') || '@gmail.com'
        ELSE split_part(split_part(lower(_email), '@', 1), '+', 1) || '@' || split_part(lower(_email), '@', 2)
      END
  END
$$;

UPDATE public.profiles SET email_key = public.normalize_email_key(email) WHERE email_key IS NULL;

CREATE INDEX IF NOT EXISTS profiles_email_key_idx ON public.profiles (email_key);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text;
  _existing uuid;
BEGIN
  _key := public.normalize_email_key(NEW.email);

  SELECT id INTO _existing
  FROM public.profiles
  WHERE email_key = _key AND id <> NEW.id
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO public.profiles (
    id, display_name, email, email_key, plan,
    trial_started_at, trial_ends_at, trial_credits,
    duplicate_suspect, duplicate_of
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    _key,
    'trial',
    now(),
    now() + interval '14 days',
    CASE WHEN _existing IS NULL THEN 50 ELSE 0 END,
    _existing IS NOT NULL,
    _existing
  )
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'juninhorosa11@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles
      SET plan = 'admin', duplicate_suspect = false, duplicate_of = NULL
      WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;