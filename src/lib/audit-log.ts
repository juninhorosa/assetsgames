import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "api_key.create"
  | "api_key.rotate"
  | "api_key.revoke"
  | "api_key.delete"
  | "trial.update"
  | "credits.update";

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "api_key.create": "Criou API key",
  "api_key.rotate": "Rotacionou API key",
  "api_key.revoke": "Revogou API key",
  "api_key.delete": "Excluiu API key",
  "trial.update": "Alterou trial/plano",
  "credits.update": "Alterou créditos",
};

export interface AuditEntry {
  id: string;
  actor_id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuditInput {
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  targetUserId?: string;
  details?: Record<string, unknown>;
}

/**
 * Registra uma ação sensível. Nunca lança: auditoria não deve quebrar o fluxo
 * do usuário, mas qualquer falha é visível no console.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    const { error } = await supabase.from("audit_log").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      target_user_id: input.targetUserId ?? null,
      details: (input.details ?? {}) as never,
    });
    if (error) console.warn("audit_log insert failed", error.message);
  } catch (e) {
    console.warn("audit_log insert failed", (e as Error).message);
  }
}

export interface AuditFilter {
  /** ISO date (yyyy-mm-dd) inclusive */
  from?: string;
  /** ISO date (yyyy-mm-dd) inclusive */
  to?: string;
  action?: string;
  search?: string;
}

export async function fetchAuditLog(filter: AuditFilter = {}): Promise<AuditEntry[]> {
  let query = supabase
    .from("audit_log")
    .select("id,actor_id,actor_email,action,target_type,target_id,target_user_id,details,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (filter.from) query = query.gte("created_at", new Date(`${filter.from}T00:00:00`).toISOString());
  if (filter.to) query = query.lte("created_at", new Date(`${filter.to}T23:59:59.999`).toISOString());
  if (filter.action && filter.action !== "all") query = query.eq("action", filter.action);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as AuditEntry[];
  const term = filter.search?.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) =>
    [r.actor_email, r.action, r.target_type, r.target_id, JSON.stringify(r.details)]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
}

export function describeAudit(entry: AuditEntry): string {
  const d = entry.details ?? {};
  const parts: string[] = [];
  for (const [k, v] of Object.entries(d)) {
    if (v === null || v === undefined || v === "") continue;
    parts.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  return parts.join(" · ");
}
