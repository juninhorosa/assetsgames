import type { SupabaseClient } from "@supabase/supabase-js";

interface ServerAuditInput {
  action: string;
  actorId: string;
  actorEmail?: string | null;
  targetType?: string;
  targetId?: string;
  targetUserId?: string;
  details?: Record<string, unknown>;
}

/** Registro de auditoria no lado do servidor (nunca interrompe a operação). */
export async function recordAuditServer(
  client: SupabaseClient,
  input: ServerAuditInput,
): Promise<void> {
  const { error } = await client.from("audit_log").insert({
    actor_id: input.actorId,
    actor_email: input.actorEmail ?? null,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    target_user_id: input.targetUserId ?? null,
    details: input.details ?? {},
  });
  if (error) console.warn("audit_log insert failed", error.message);
}
