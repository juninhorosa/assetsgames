/**
 * Chaves de API dos provedores de IA configuradas pelo painel Admin.
 *
 * A chave digitada no painel fica em `provider_credentials` (tabela com RLS
 * ativa e sem policies: só o service role do servidor consegue ler). Quando não
 * existe chave na tabela, usamos a variável de ambiente equivalente — assim o
 * que já estava a funcionar continua a funcionar e o painel passa a ser a
 * forma mais simples de configurar uma IA nova sem mexer em secrets.
 */

const CACHE_MS = 60_000;
const cache = new Map<string, { value: string | null; at: number }>();

interface CredentialRow {
  secret_name: string;
  api_key: string;
  updated_at?: string | null;
}

type CredentialsClient = {
  from: (table: "provider_credentials") => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: CredentialRow | null;
          error: { message: string } | null;
        }>;
      };
      order: (
        column: string,
        options?: { ascending?: boolean },
      ) => Promise<{ data: CredentialRow[] | null; error: { message: string } | null }>;
    };
    upsert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

async function credentialsClient(): Promise<CredentialsClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as CredentialsClient;
}

/** Mostra apenas os últimos 4 caracteres — a chave nunca volta ao navegador. */
export function maskKey(key: string): string {
  const clean = key.trim();
  if (clean.length <= 8) return "••••••••";
  return `••••••••${clean.slice(-4)}`;
}

/** Chave salva pelo painel Admin (ou null quando não existe). */
export async function storedKey(secretName: string): Promise<string | null> {
  const hit = cache.get(secretName);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  let value: string | null = null;
  try {
    const db = await credentialsClient();
    const { data } = await db
      .from("provider_credentials")
      .select("api_key")
      .eq("secret_name", secretName)
      .maybeSingle();
    value = data?.api_key?.trim() || null;
  } catch {
    value = null;
  }
  cache.set(secretName, { value, at: Date.now() });
  return value;
}

/** Chave efetiva: primeiro o que está no painel Admin, depois a env var. */
export async function resolveKey(secretName: string): Promise<string | null> {
  const fromPanel = await storedKey(secretName);
  if (fromPanel) return fromPanel;
  return process.env[secretName]?.trim() || null;
}

export interface CredentialSummary {
  secret: string;
  masked: string;
  source: "panel" | "env" | "none";
  updatedAt: string | null;
}

/** Resumo (mascarado) das chaves de uma lista de secrets. */
export async function listCredentials(secretNames: string[]): Promise<CredentialSummary[]> {
  let rows: CredentialRow[] = [];
  try {
    const db = await credentialsClient();
    const { data } = await db
      .from("provider_credentials")
      .select("secret_name,api_key,updated_at")
      .order("secret_name", { ascending: true });
    rows = (data ?? []) as CredentialRow[];
  } catch {
    rows = [];
  }

  return secretNames.map((secret) => {
    const row = rows.find((r) => r.secret_name === secret);
    const fromPanel = row?.api_key?.trim() || null;
    const fromEnv = process.env[secret]?.trim() || null;
    const effective = fromPanel ?? fromEnv;
    return {
      secret,
      masked: effective ? maskKey(effective) : "",
      source: fromPanel ? "panel" : fromEnv ? "env" : "none",
      updatedAt: fromPanel ? (row?.updated_at ?? null) : null,
    };
  });
}

/** Guarda (ou substitui) a chave de um provedor. */
export async function saveCredential(
  secretName: string,
  apiKey: string,
  userId: string,
): Promise<void> {
  const clean = apiKey.trim();
  if (clean.length < 8) throw new Error("Chave muito curta — cole a chave completa do provedor.");
  const db = await credentialsClient();
  const { error } = await db.from("provider_credentials").upsert({
    secret_name: secretName,
    api_key: clean,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  cache.delete(secretName);
}

/** Remove a chave salva (volta a usar a variável de ambiente, se existir). */
export async function removeCredential(secretName: string): Promise<void> {
  const db = await credentialsClient();
  const { error } = await db.from("provider_credentials").delete().eq("secret_name", secretName);
  if (error) throw new Error(error.message);
  cache.delete(secretName);
}