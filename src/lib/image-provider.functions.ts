import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    const { IMAGE_PROVIDERS, getActiveProvider } = await import("./image-providers.server");
    const active = await getActiveProvider();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("platform_limits").select("image_model").maybeSingle();
    return {
      active: active.info.id,
      model: data?.image_model ?? "",
      providers: IMAGE_PROVIDERS.map((p) => ({
        ...p,
        configured: p.secret ? !!process.env[p.secret]?.trim() : true,
      })),
    };
  });

export const setImageProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        provider: z.enum(["lovable", "openai", "gemini", "replicate", "fal", "huggingface", "pollinations"]),
        model: z.string().max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_limits")
      .update({ image_provider: data.provider, image_model: data.model.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
