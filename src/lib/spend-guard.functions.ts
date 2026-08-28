import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SpendLimits {
  ai_enabled: boolean;
  public_api_enabled: boolean;
  daily_credit_cap: number;
  monthly_credit_cap: number;
  daily_used: number;
  monthly_used: number;
  updated_at: string | null;
}

async function assertAdmin(supabase: {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

async function readLimits(): Promise<SpendLimits> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: row }, { data: guard }] = await Promise.all([
    supabaseAdmin
      .from("platform_limits")
      .select("ai_enabled,public_api_enabled,daily_credit_cap,monthly_credit_cap,updated_at")
      .maybeSingle(),
    supabaseAdmin.rpc("spend_guard_check", { _credits: 0 }),
  ]);
  const status = (guard ?? {}) as { daily_used?: number; monthly_used?: number };
  const limits = (row ?? {}) as Partial<SpendLimits>;
  return {
    ai_enabled: limits.ai_enabled ?? true,
    public_api_enabled: limits.public_api_enabled ?? true,
    daily_credit_cap: Number(limits.daily_credit_cap ?? 0),
    monthly_credit_cap: Number(limits.monthly_credit_cap ?? 0),
    daily_used: Number(status.daily_used ?? 0),
    monthly_used: Number(status.monthly_used ?? 0),
    updated_at: limits.updated_at ?? null,
  };
}

export const getSpendLimits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    return readLimits();
  });

export const updateSpendLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        ai_enabled: z.boolean(),
        public_api_enabled: z.boolean(),
        daily_credit_cap: z.number().min(0).max(100000),
        monthly_credit_cap: z.number().min(0).max(1000000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_limits")
      .update({
        ai_enabled: data.ai_enabled,
        public_api_enabled: data.public_api_enabled,
        daily_credit_cap: data.daily_credit_cap,
        monthly_credit_cap: data.monthly_credit_cap,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    const { recordAuditServer } = await import("./audit-log.server");
    await recordAuditServer(context.supabase, {
      action: "platform_limits.update",
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
      targetType: "platform_limits",
      details: { ...data },
    });
    return readLimits();
  });
