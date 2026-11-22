import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CUSTOM_PROVIDER_PREFIX,
  customProviderId,
  type CustomProviderConfig,
  type CustomProviderInput,
} from "./custom-provider-config";
import { maskKey } from "./provider-credentials.server";
import { isPrivateAddress } from "./custom-provider-network.server";

const FIELD = /^[A-Za-z_][A-Za-z0-9_.-]{0,79}$/;
const PATH = /^[A-Za-z_][A-Za-z0-9_-]*(?:\.(?:[A-Za-z_][A-Za-z0-9_-]*|\d+)){0,7}$/;

const inputSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(2).max(80),
  kind: z.enum(["openai", "advanced"]),
  enabled: z.boolean(),
  baseUrl: z.string().trim().max(500),
  endpoint: z.string().trim().min(1).max(500),
  method: z.enum(["POST", "PUT"]),
  model: z.string().trim().max(200),
  authHeader: z.string().trim().regex(FIELD).max(80),
  authPrefix: z.string().trim().max(30),
  promptField: z.string().trim().regex(FIELD),
  modelField: z
    .string()
    .trim()
    .max(80)
    .refine((v) => !v || FIELD.test(v)),
  widthField: z
    .string()
    .trim()
    .max(80)
    .refine((v) => !v || FIELD.test(v)),
  heightField: z
    .string()
    .trim()
    .max(80)
    .refine((v) => !v || FIELD.test(v)),
  sizeField: z
    .string()
    .trim()
    .max(80)
    .refine((v) => !v || FIELD.test(v)),
  imagePath: z.string().trim().regex(PATH),
  editEnabled: z.boolean(),
  editEndpoint: z.string().trim().max(500),
  editImageField: z
    .string()
    .trim()
    .max(80)
    .refine((v) => !v || FIELD.test(v)),
  apiKey: z.string().max(4000).optional(),
});

export type CustomProviderRow = CustomProviderConfig & {
  maskedKey: string;
  configured: boolean;
};

interface StoredProvider {
  id: string;
  label: string;
  kind: CustomProviderConfig["kind"];
  enabled: boolean;
  base_url: string;
  endpoint: string;
  method: CustomProviderConfig["method"];
  model: string;
  auth_header: string;
  auth_prefix: string;
  prompt_field: string;
  model_field: string;
  width_field: string;
  height_field: string;
  size_field: string;
  image_path: string;
  edit_enabled: boolean;
  edit_endpoint: string;
  edit_image_field: string;
  api_key?: string;
  has_key?: boolean;
  created_at: string | null;
  updated_at: string | null;
}

/** Converte as colunas do Postgres para o contrato consumido pelo gerador. */
export function customProviderFromRow(row: StoredProvider): CustomProviderRow {
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    enabled: row.enabled,
    baseUrl: row.base_url,
    endpoint: row.endpoint,
    method: row.method,
    model: row.model,
    authHeader: row.auth_header,
    authPrefix: row.auth_prefix,
    promptField: row.prompt_field,
    modelField: row.model_field,
    widthField: row.width_field,
    heightField: row.height_field,
    sizeField: row.size_field,
    imagePath: row.image_path,
    editEnabled: row.edit_enabled,
    editEndpoint: row.edit_endpoint,
    editImageField: row.edit_image_field,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    maskedKey: row.api_key ? maskKey(row.api_key) : "",
    configured: row.has_key ?? Boolean(row.api_key),
  };
}

/** Destinos externos HTTPS: impede que o Admin transforme o servidor em proxy de rede interna. */
export function assertPublicHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL inválida.");
  }
  if (
    url.protocol !== "https:" &&
    !(process.env["NODE_ENV"] !== "production" && url.protocol === "http:")
  ) {
    throw new Error("Use uma URL HTTPS para o provedor.");
  }
  if (url.username || url.password) throw new Error("Não coloque credenciais na URL.");
  if (isPrivateAddress(url.hostname))
    throw new Error("Endereços de rede interna não são permitidos.");
  return url;
}

function endpointFor(input: CustomProviderInput): string {
  if (input.kind === "advanced") return input.endpoint;
  return new URL(
    input.endpoint.replace(/^\//, ""),
    `${input.baseUrl.replace(/\/+$/, "")}/`,
  ).toString();
}

export function validateCustomProvider(
  input: CustomProviderInput,
  existing?: CustomProviderRow,
): CustomProviderInput {
  const clean = inputSchema.parse(input);
  if (!clean.apiKey && !existing?.configured) throw new Error("Cole a chave de API do provedor.");
  if (clean.apiKey && clean.apiKey.trim().length < 8)
    throw new Error("A chave de API é muito curta.");
  if (clean.kind === "openai") {
    assertPublicHttpUrl(clean.baseUrl);
    if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(clean.endpoint))
      throw new Error("Caminho do endpoint inválido.");
  }
  assertPublicHttpUrl(endpointFor(input));
  if (clean.editEnabled) {
    if (clean.kind === "openai")
      assertPublicHttpUrl(
        new URL(
          clean.editEndpoint.replace(/^\//, ""),
          `${clean.baseUrl.replace(/\/+$/, "")}/`,
        ).toString(),
      );
    else assertPublicHttpUrl(clean.editEndpoint);
    if (!clean.editImageField) throw new Error("Informe o campo da imagem usado na edição.");
  }
  if (clean.kind === "advanced" && !clean.modelField && !clean.promptField)
    throw new Error("Informe o campo do prompt.");
  return {
    ...clean,
    ...(clean.id ? { id: clean.id } : {}),
    ...(clean.apiKey ? { apiKey: clean.apiKey } : {}),
  };
}

export async function listCustomProviders(): Promise<CustomProviderRow[]> {
  const rows = await listCustomProviderConfigs();
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: keys, error } = await supabaseAdmin
    .from("custom_image_providers")
    .select("id")
    .in("id", ids)
    .neq("api_key", "");
  if (error) throw new Error(error.message);
  const configured = new Set((keys as { id: string }[] | null)?.map((row) => row.id) ?? []);
  return rows.map((row) => ({
    ...row,
    maskedKey: configured.has(row.id) ? "••••••••" : "",
    configured: configured.has(row.id),
  }));
}

export async function listCustomProviderConfigs(): Promise<CustomProviderConfig[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("custom_image_providers")
    .select(
      "id,label,kind,enabled,base_url,endpoint,method,model,auth_header,auth_prefix,prompt_field,model_field,width_field,height_field,size_field,image_path,edit_enabled,edit_endpoint,edit_image_field,created_at,updated_at",
    )
    .order("created_at", { ascending: true });
  if (error)
    throw new Error(`Não foi possível carregar os provedores personalizados: ${error.message}`);
  return (data as unknown as StoredProvider[]).map((row) => {
    const { maskedKey: _masked, configured: _configured, ...config } = customProviderFromRow(row);
    return config;
  });
}

export async function customProviderSecret(id: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("custom_image_providers")
    .select("api_key")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { api_key?: string } | null)?.api_key || null;
}

export function isCustomProviderId(id: string): boolean {
  return id.startsWith(CUSTOM_PROVIDER_PREFIX);
}

export function customProviderUuid(providerId: string): string {
  const id = providerId.slice(CUSTOM_PROVIDER_PREFIX.length);
  if (!z.string().uuid().safeParse(id).success)
    throw new Error("Identificador de provedor personalizado inválido.");
  return id;
}

export async function saveCustomProviderRecord(
  input: CustomProviderInput,
): Promise<CustomProviderRow> {
  const rows = await listCustomProviders();
  const existing = input.id ? rows.find((row) => row.id === input.id) : undefined;
  if (input.id && !existing) throw new Error("Provedor personalizado não encontrado.");
  const clean = validateCustomProvider(input, existing);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const id = clean.id ?? randomUUID();
  const { data, error } = await supabaseAdmin
    .from("custom_image_providers")
    .upsert(
      clean.apiKey
        ? {
            id,
            label: clean.label,
            kind: clean.kind,
            enabled: clean.enabled,
            base_url: clean.baseUrl,
            endpoint: clean.endpoint,
            method: clean.method,
            model: clean.model,
            auth_header: clean.authHeader,
            auth_prefix: clean.authPrefix,
            prompt_field: clean.promptField,
            model_field: clean.modelField,
            width_field: clean.widthField,
            height_field: clean.heightField,
            size_field: clean.sizeField,
            image_path: clean.imagePath,
            edit_enabled: clean.editEnabled,
            edit_endpoint: clean.editEndpoint,
            edit_image_field: clean.editImageField,
            api_key: clean.apiKey,
            updated_at: new Date().toISOString(),
          }
        : {
            id,
            label: clean.label,
            kind: clean.kind,
            enabled: clean.enabled,
            base_url: clean.baseUrl,
            endpoint: clean.endpoint,
            method: clean.method,
            model: clean.model,
            auth_header: clean.authHeader,
            auth_prefix: clean.authPrefix,
            prompt_field: clean.promptField,
            model_field: clean.modelField,
            width_field: clean.widthField,
            height_field: clean.heightField,
            size_field: clean.sizeField,
            image_path: clean.imagePath,
            edit_enabled: clean.editEnabled,
            edit_endpoint: clean.editEndpoint,
            edit_image_field: clean.editImageField,
            updated_at: new Date().toISOString(),
          },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  if (!input.id) {
    const { data: settings } = await supabaseAdmin
      .from("platform_limits")
      .select("image_provider_order")
      .eq("id", true)
      .maybeSingle();
    const order = Array.isArray(settings?.image_provider_order)
      ? settings.image_provider_order
      : [];
    await supabaseAdmin
      .from("platform_limits")
      .update({ image_provider_order: [...order, customProviderId(id)] })
      .eq("id", true);
  }
  return customProviderFromRow({ ...(data as unknown as StoredProvider), has_key: true });
}

export async function deleteCustomProviderRecord(id: string): Promise<void> {
  if (!z.string().uuid().safeParse(id).success) throw new Error("Identificador inválido.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("custom_image_providers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  const { data: settings } = await supabaseAdmin
    .from("platform_limits")
    .select("image_provider,image_provider_order,image_provider_disabled")
    .eq("id", true)
    .maybeSingle();
  const providerId = customProviderId(id);
  const order = (
    Array.isArray(settings?.image_provider_order) ? settings.image_provider_order : []
  ).filter((value: unknown) => value !== providerId);
  const disabled = (
    Array.isArray(settings?.image_provider_disabled) ? settings.image_provider_disabled : []
  ).filter((value: unknown) => value !== providerId);
  await supabaseAdmin
    .from("platform_limits")
    .update({
      image_provider:
        settings?.image_provider === providerId ? "auto" : (settings?.image_provider ?? "lovable"),
      image_provider_order: order,
      image_provider_disabled: disabled,
    })
    .eq("id", true);
}

async function assertAdmin(supabase: unknown, userId: string) {
  const { data, error } = await (
    supabase as {
      rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    }
  ).rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

export const listCustomProvidersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return listCustomProviders();
  });

export const saveCustomProviderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const row = await saveCustomProviderRecord(data);
    const { recordAuditServer } = await import("./audit-log.server");
    await recordAuditServer(context.supabase, {
      action: "ai_key.update",
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
      targetType: "custom_image_provider",
      targetId: row.id,
      details: { nome: row.label, tipo: row.kind, endpoint: row.endpoint },
    });
    return row;
  });

export const deleteCustomProviderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await deleteCustomProviderRecord(data.id);
    return { ok: true };
  });
