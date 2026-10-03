import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IDS = ["lovable", "openai", "gemini", "replicate", "fal", "huggingface", "pollinations"] as const;

async function assertAdmin(supabase: unknown, userId: string) {
  const { data, error } = await (supabase as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  }).rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

export const getImageProvider = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const m = await import("./image-providers.server");
    const s = await m.getProviderSettings();
    const cool = m.providerCooldowns();
    return {
      active: s.mode,
      model: s.model ?? "",
      order: s.order as string[],
      disabled: s.disabled,
      providers: m.IMAGE_PROVIDERS.map((p) => ({
        ...p,
        configured: m.isConfigured(p),
        cooldown: cool.find((c) => c.id === p.id)?.reason ?? null,
      })),
    };
  });

export const setImageProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        provider: z.enum([...IDS, "auto"]),
        model: z.string().max(200),
        order: z.array(z.enum(IDS)),
        disabled: z.array(z.enum(IDS)),
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
