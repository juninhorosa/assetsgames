CREATE TABLE public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Chave',
  prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['generate']::text[],
  request_count integer NOT NULL DEFAULT 0,
  credits_used numeric NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  revoked_at timestamptz,
  rotated_from uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own api keys"
ON public.api_keys FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX api_keys_user_idx ON public.api_keys(user_id, created_at DESC);

CREATE TABLE public.generation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'studio',
  kind text NOT NULL DEFAULT 'image',
  mode text,
  action text,
  view text,
  model text,
  size text,
  status text NOT NULL DEFAULT 'success',
  credits numeric NOT NULL DEFAULT 0,
  duration_ms integer,
  prompt text,
  error text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generation_runs TO authenticated;
GRANT ALL ON public.generation_runs TO service_role;
ALTER TABLE public.generation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own generation runs"
ON public.generation_runs FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX generation_runs_user_idx ON public.generation_runs(user_id, created_at DESC);
CREATE INDEX generation_runs_project_idx ON public.generation_runs(project_id, created_at DESC);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS credit_budget numeric NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS export_preset jsonb NOT NULL DEFAULT '{}'::jsonb;