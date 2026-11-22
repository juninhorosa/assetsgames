import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IDS = [
  "lovable",
  "openai",
  "gemini",
  "replicate",
  "fal",
  "huggingface",
  "pollinations",
] as const;
const PROVIDER_ID = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^(?:[a-z][a-z0-9-]*|custom:[0-9a-fA-F-]{36})$/);

async function assertAdmin(supabase: unknown, userId: string) {
  const { data, error } = await (
    supabase as {
      rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    }
  ).rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

export const getImageProvider = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const m = await import("./image-providers.server");
    const s = await m.getProviderSettings();
    const cool = m.providerCooldowns();
    const providers = await m.allImageProviders();
    return {
      active: s.mode,
      model: s.model ?? "",
      order: s.order as string[],
      disabled: s.disabled,
      providers: await Promise.all(
        providers.map(async (p) => ({
          id: p.id,
          label: p.label,
          free: p.free,
          secret: p.custom ? null : p.secret,
          defaultModel: p.defaultModel,
          supportsEdit: p.supportsEdit,
          configured: await m.isConfigured(p),
          cooldown: cool.find((c) => c.id === p.id)?.reason ?? null,
        })),
      ),
    };
  });

export const setImageProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        provider: z.union([z.enum([...IDS, "auto"]), PROVIDER_ID]),
        model: z.string().max(200),
        order: z.array(PROVIDER_ID).max(100),
        disabled: z.array(PROVIDER_ID).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_limits")
      .update({
        image_provider: data.provider,
        image_model: data.model.trim() || null,
        image_provider_order: data.order,
        image_provider_disabled: data.disabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
