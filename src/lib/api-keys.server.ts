/**
 * Helpers server-only para chaves de API.
 *
 * A chave em claro só existe no momento da criação/rotação: o banco guarda
 * apenas o hash SHA-256 e um prefixo curto para exibição.
 */

const KEY_PREFIX = "f3d";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Gera uma chave nova em claro (`f3d_live_<random>`). */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${KEY_PREFIX}_live_${toBase64Url(bytes)}`;
}

/** Hash SHA-256 em hex — usado tanto na criação como na validação. */
export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key.trim()));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Trecho exibido na UI (`f3d_live_ab12…`). */
export function keyPrefix(key: string): string {
  return key.slice(0, 16);
}

export interface VerifiedApiKey {
  id: string;
  userId: string;
  scopes: string[];
}

/**
 * Valida uma chave em claro contra os hashes do banco.
 * Devolve null quando a chave é inexistente ou revogada.
 */
export async function verifyApiKey(provided: string): Promise<VerifiedApiKey | null> {
  const clean = provided.trim();
  if (!clean) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id,user_id,scopes,revoked_at")
    .eq("key_hash", await hashApiKey(clean))
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; user_id: string; scopes: string[] | null; revoked_at: string | null };
  if (row.revoked_at) return null;
  return { id: row.id, userId: row.user_id, scopes: row.scopes ?? ["generate"] };
}

/** Contabiliza uso da chave (best-effort, nunca quebra a requisição). */
export async function trackApiKeyUsage(id: string, credits: number, requests = 1): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("api_keys")
      .select("request_count,credits_used")
      .eq("id", id)
      .maybeSingle();
    const cur = (data ?? { request_count: 0, credits_used: 0 }) as {
      request_count: number | null;
      credits_used: number | null;
    };
    await supabaseAdmin
      .from("api_keys")
      .update({
        request_count: (cur.request_count ?? 0) + requests,
        credits_used: Number(cur.credits_used ?? 0) + credits,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch {
    /* telemetria não deve derrubar a geração */
  }
}

/** Registra a execução vinda da API pública no histórico (best-effort). */
export async function recordApiRun(input: {
  userId: string;
  apiKeyId: string;
  kind: string;
  mode?: string | null;
  view?: string | null;
  size?: string | null;
  status: string;
  credits: number;
  durationMs?: number;
  prompt?: string | null;
  error?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("generation_runs").insert({
      user_id: input.userId,
      api_key_id: input.apiKeyId,
      source: "api",
      kind: input.kind,
      mode: input.mode ?? null,
      view: input.view ?? null,
      size: input.size ?? null,
      model: "openai/gpt-image-2",
      status: input.status,
      credits: input.credits,
      duration_ms: input.durationMs ?? null,
      prompt: input.prompt ?? null,
      error: input.error ?? null,
      meta: input.meta ?? {},
    });
  } catch {
    /* telemetria não deve derrubar a geração */
  }
}
