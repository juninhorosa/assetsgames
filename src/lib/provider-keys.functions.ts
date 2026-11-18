import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Chaves de API dos provedores de geração, configuradas no painel Admin.
 *
 * A chave nunca volta para o navegador: o painel só recebe o nome do secret, um
 * resumo mascarado e a origem (painel, ambiente ou nenhuma). Salvar uma chave
 * aqui passa a valer para todo o site (Studio, lote, API pública e MCP), porque
 * a resolução da chave (painel -> variável de ambiente) é feita no servidor.
 */

const SECRETS = [
  "LOVABLE_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "REPLICATE_API_TOKEN",
  "FAL_KEY",
  "HF_TOKEN",
  "HARBOR_API_KEY",
] as const;

type SecretName = (typeof SECRETS)[number];

async function assertAdmin(supabase: unknown, userId: string) {
  const { data, error } = await (
    supabase as {
      rpc: (
        f: string,
        a: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>;
    }
  ).rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

export interface ProviderKeyRow {
  secret: SecretName;
  providerId: string;
  providerLabel: string;
  free: boolean;
  defaultModel: string;
  docsUrl: string;
  masked: string;
  source: "panel" | "env" | "none";
  updatedAt: string | null;
}

const DOCS: Record<SecretName, string> = {
  LOVABLE_API_KEY: "https://docs.lovable.dev/features/cloud",
  OPENAI_API_KEY: "https://platform.openai.com/api-keys",
  GEMINI_API_KEY: "https://aistudio.google.com/app/apikey",
  REPLICATE_API_TOKEN: "https://replicate.com/account/api-tokens",
  FAL_KEY: "https://fal.ai/dashboard/keys",
  HF_TOKEN: "https://huggingface.co/settings/tokens",
  // Chave de uso interno: sem página de documentação pública para linkar.
  HARBOR_API_KEY: "",
};

/**
 * Chaves que não pertencem a um provedor de imagem, mas devem poder ser
 * coladas no painel (guardadas no servidor e lidas via `resolveKey`).
 */
const EXTRA_KEYS: {
  secret: SecretName;
  providerId: string;
  providerLabel: string;
  free: boolean;
  defaultModel: string;
}[] = [
  {
    secret: "HARBOR_API_KEY",
    providerId: "harbor",
    providerLabel: "Harbor (token de API)",
    free: false,
    defaultModel: "",
  },
];

export const listProviderKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProviderKeyRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const providers = await import("./image-providers.server");
    const creds = await import("./provider-credentials.server");

    const known = SECRETS as readonly string[];
    const fromProviders = providers.IMAGE_PROVIDERS.flatMap((p) => {
      const secret = p.secret && known.includes(p.secret) ? (p.secret as SecretName) : null;
      return secret
        ? [
            {
              secret,
              providerId: p.id as string,
              providerLabel: p.label,
              free: p.free,
              defaultModel: p.defaultModel,
            },
          ]
        : [];
    });
    const covered = fromProviders.map((p) => p.secret);
    const withSecret = [...fromProviders, ...EXTRA_KEYS.filter((k) => !covered.includes(k.secret))];
    const summaries = await creds.listCredentials(withSecret.map((p) => p.secret));

    return withSecret.map((p) => {
      const s = summaries.find((x) => x.secret === p.secret);
      return {
        secret: p.secret,
        providerId: p.providerId,
        providerLabel: p.providerLabel,
        free: p.free,
        defaultModel: p.defaultModel,
        docsUrl: DOCS[p.secret],
        masked: s?.masked ?? "",
        source: s?.source ?? "none",
        updatedAt: s?.updatedAt ?? null,
      };
    });
  });

export const saveProviderKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        secret: z.enum(SECRETS),
        apiKey: z.string().min(8, "Chave muito curta.").max(4000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const creds = await import("./provider-credentials.server");
    await creds.saveCredential(data.secret, data.apiKey, context.userId);
    const { recordAuditServer } = await import("./audit-log.server");
    await recordAuditServer(context.supabase, {
      action: "ai_key.update",
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
      targetType: "provider_credentials",
      targetId: data.secret,
      details: { secret: data.secret, chave: creds.maskKey(data.apiKey.trim()) },
    });
    return { ok: true };
  });

export const deleteProviderKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ secret: z.enum(SECRETS) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const creds = await import("./provider-credentials.server");
    await creds.removeCredential(data.secret);
    const { recordAuditServer } = await import("./audit-log.server");
    await recordAuditServer(context.supabase, {
      action: "ai_key.delete",
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
      targetType: "provider_credentials",
      targetId: data.secret,
      details: { secret: data.secret },
    });
    return { ok: true };
  });