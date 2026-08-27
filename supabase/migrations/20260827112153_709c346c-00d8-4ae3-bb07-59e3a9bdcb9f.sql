CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  target_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own audit entries" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE POLICY "users read own audit entries" ON public.audit_log
  FOR SELECT TO authenticated USING (actor_id = auth.uid());

CREATE POLICY "admins read all audit entries" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX audit_log_actor_idx ON public.audit_log (actor_id, created_at DESC);