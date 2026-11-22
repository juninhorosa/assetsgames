-- Configurações de APIs de imagem cadastradas pelo administrador.
-- Sem policies para authenticated: somente o service role do servidor acessa a tabela.
CREATE TABLE IF NOT EXISTS public.custom_image_providers (
  id uuid PRIMARY KEY,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('openai', 'advanced')),
  enabled boolean NOT NULL DEFAULT true,
  base_url text NOT NULL DEFAULT '',
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'POST' CHECK (method IN ('POST', 'PUT')),
  model text NOT NULL DEFAULT '',
  auth_header text NOT NULL DEFAULT 'Authorization',
  auth_prefix text NOT NULL DEFAULT 'Bearer',
  prompt_field text NOT NULL DEFAULT 'prompt',
  model_field text NOT NULL DEFAULT 'model',
  width_field text NOT NULL DEFAULT '',
  height_field text NOT NULL DEFAULT '',
  size_field text NOT NULL DEFAULT 'size',
  image_path text NOT NULL DEFAULT 'data.0.b64_json',
  edit_enabled boolean NOT NULL DEFAULT false,
  edit_endpoint text NOT NULL DEFAULT '/images/edits',
  edit_image_field text NOT NULL DEFAULT 'image',
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.custom_image_providers FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.custom_image_providers TO service_role;
ALTER TABLE public.custom_image_providers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.custom_image_providers IS 'APIs de imagem configuradas pelo Admin. Leitura e escrita apenas pelo service role do servidor.';
COMMENT ON COLUMN public.custom_image_providers.api_key IS 'Segredo usado somente no servidor; nunca enviado ao navegador.';
