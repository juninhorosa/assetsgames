import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  const [a = 0, b = 0] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

export function isPrivateAddress(address: string): boolean {
  const host = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  )
    return true;
  if (isIP(host) === 4) return isPrivateIpv4(host);
  if (isIP(host) === 6) {
    if (host === "::" || host === "::1" || /^f[cd]/i.test(host) || /^fe[89ab]/i.test(host))
      return true;
    const mapped = host.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mapped) return isPrivateIpv4(mapped);
    const embedded = host
      .match(/^(?:\d{1,4}:){6}(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
      ?.slice(1)
      .map(Number);
    if (embedded?.length === 4) return isPrivateIpv4(embedded.join("."));
  }
  return false;
}

export function assertPublicImageUrl(value: string, allowLocal = false): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL da imagem inválida.");
  }
  if (url.protocol !== "https:" && !(allowLocal && url.protocol === "http:"))
    throw new Error("A imagem precisa usar HTTPS.");
  if (url.username || url.password) throw new Error("A URL da imagem não pode conter credenciais.");
  if (!allowLocal && isPrivateAddress(url.hostname))
    throw new Error("Endereço de imagem interno não permitido.");
  return url;
}

export async function publicFetch(
  input: URL,
  init: RequestInit,
  allowLocal = false,
): Promise<Response> {
  let url = input;
  for (let redirects = 0; redirects < 6; redirects++) {
    if (!allowLocal) {
      const addresses = await lookup(url.hostname, { all: true, verbatim: true });
      if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
        throw new Error("O endereço do provedor resolve para uma rede interna.");
      }
    }
    const response = await fetch(url, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("Redirecionamento do provedor sem destino.");
    url = assertPublicImageUrl(new URL(location, url).toString(), allowLocal);
    if (response.status === 303) {
      const { method: _method, body: _body, ...rest } = init;
      init = { ...rest, method: "GET" };
    }
  }
  throw new Error("O provedor excedeu o limite de redirecionamentos.");
}
