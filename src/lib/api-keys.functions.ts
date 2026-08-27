import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateApiKey, hashApiKey, keyPrefix } from "./api-keys.server";

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  request_count: number;
  credits_used: number;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

/** Lista as chaves do usuário (sem nunca devolver o segredo). */
export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("api_keys")
      .select("id,name,prefix,scopes,request_count,credits_used,last_used_at,revoked_at,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ApiKeyRow[];
  });

/** Cria uma chave nova; a versão em claro é devolvida uma única vez. */
export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ name: z.string().min(1).max(60) }).parse(data))
  .handler(async ({ data, context }) => {
    const secret = generateApiKey();
    const { data: row, error } = await context.supabase
      .from("api_keys")
      .insert({
        user_id: context.userId,
        name: data.name,
        prefix: keyPrefix(secret),
        key_hash: await hashApiKey(secret),
      })
      .select("id,name,prefix,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { key: secret, id: (row as { id: string }).id };
  });

/**
 * Rotação: revoga a chave atual e emite uma substituta ligada a ela, mantendo
 * o histórico de uso auditável.
 */
export const rotateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: current, error: readErr } = await context.supabase
      .from("api_keys")
      .select("id,name")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Chave não encontrada");

    const secret = generateApiKey();
    const { data: row, error } = await context.supabase
      .from("api_keys")
      .insert({
        user_id: context.userId,
        name: (current as { name: string }).name,
        prefix: keyPrefix(secret),
        key_hash: await hashApiKey(secret),
        rotated_from: data.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: revokeErr } = await context.supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (revokeErr) throw new Error(revokeErr.message);

    return { key: secret, id: (row as { id: string }).id };
  });

/** Revogação imediata — a chave para de autenticar sem apagar o histórico. */
export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove a chave definitivamente (apenas depois de revogada). */
export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("api_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
