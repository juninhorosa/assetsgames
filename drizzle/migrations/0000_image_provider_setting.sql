ALTER TABLE public.platform_limits ADD COLUMN IF NOT EXISTS image_provider text NOT NULL DEFAULT 'lovable';
ALTER TABLE public.platform_limits ADD COLUMN IF NOT EXISTS image_model text;