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
