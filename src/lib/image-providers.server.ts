/**
 * Provedores de geração de imagem selecionáveis no painel Admin.
 * Todas as gerações do site (Studio, edição, lote, API pública e MCP) passam por aqui.
 */

import { resolveKey } from "./provider-credentials.server";

export type ImageProviderId =
  | "lovable"
  | "openai"
  | "gemini"
  | "replicate"
  | "fal"
  | "huggingface"
  | "pollinations";

export interface ProviderInfo {
  id: ImageProviderId;
  label: string;
  free: boolean;
  secret: string | null;
  defaultModel: string;
  supportsEdit: boolean;
}

export const IMAGE_PROVIDERS: ProviderInfo[] = [
  { id: "lovable", label: "Lovable AI (padrão)", free: false, secret: "LOVABLE_API_KEY", defaultModel: "openai/gpt-image-2.5-sunburst", supportsEdit: true },
  { id: "openai", label: "OpenAI (sua chave)", free: false, secret: "OPENAI_API_KEY", defaultModel: "gpt-image-1", supportsEdit: true },
  { id: "gemini", label: "Google Gemini", free: false, secret: "GEMINI_API_KEY", defaultModel: "gemini-2.5-flash-image", supportsEdit: true },
  { id: "replicate", label: "Replicate", free: false, secret: "REPLICATE_API_TOKEN", defaultModel: "black-forest-labs/flux-schnell", supportsEdit: true },
  { id: "fal", label: "Fal.ai", free: false, secret: "FAL_KEY", defaultModel: "fal-ai/flux/schnell", supportsEdit: true },
  { id: "huggingface", label: "Hugging Face (cota grátis)", free: true, secret: "HF_TOKEN", defaultModel: "black-forest-labs/FLUX.1-schnell", supportsEdit: false },
  { id: "pollinations", label: "Pollinations (grátis, sem chave)", free: true, secret: null, defaultModel: "flux", supportsEdit: false },
];

export class ProviderError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

/**
 * Chave do provedor: primeiro a que foi gravada no painel Admin, depois a
 * variável de ambiente equivalente.
 */
async function env(name: string): Promise<string> {
  const v = await resolveKey(name);
  if (!v) {
    throw new ProviderError(
      `Chave ${name} não configurada — cole a chave do provedor no painel Admin.`,
      500,
    );
  }
  return v;
}

export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

async function urlToB64(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new ProviderError(
      `Falha ao baixar imagem (${r.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      r.status,
    );
  }
  return bytesToB64(new Uint8Array(await r.arrayBuffer()));
}

/**
 * Dica anexada quando o provedor recusa a credencial: sem isto o usuário lê
 * apenas "401" e não sabe que precisa corrigir a chave no painel Admin.
 */
const KEY_HINTS: Record<string, string> = {
  Gateway:
    "a chave LOVABLE_API_KEY do servidor foi recusada — reconfigure-a em Admin › Chaves ou desative este provedor",
  OpenAI: "a chave OPENAI_API_KEY foi recusada — confira em Admin › Chaves",
};

async function fail(r: Response, who: string): Promise<never> {
  const t = await r.text().catch(() => "");
  const hint = (r.status === 401 || r.status === 403) && KEY_HINTS[who] ? ` — ${KEY_HINTS[who]}` : "";
  throw new ProviderError(`${who} ${r.status}: ${t.slice(0, 300)}${hint}`, r.status);
}

/**
 * O Pollinations recebe o prompt na própria URL, então prompts longos (que é o
 * caso dos prompts de pixel-art/spritesheet) estouram o limite do serviço e
 * voltam 404. Aqui o texto vira uma frase curta e sem caracteres problemáticos.
 */
function pollinationsPrompt(prompt: string): string {
  const clean = prompt
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\p{L}\p{N} ,.\-:/()']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const MAX = 460;
  if (clean.length <= MAX) return clean;
  const cut = clean.slice(0, MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > MAX * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Pollinations é o caminho grátis do produto, por isso ele não pode depender de
 * um único modelo: tentamos o modelo configurado, os modelos grátis conhecidos,
 * a chamada sem `model` (padrão do serviço) e por fim o host de compartilhamento.
 */
async function pollinationsRun(model: string, prompt: string, w: number, h: number): Promise<string> {
  const text = pollinationsPrompt(prompt);
  const seed = Math.floor(Math.random() * 1e9);
  const models = [model.trim(), "flux", "turbo", ""].filter((m, i, a) => a.indexOf(m) === i);

  const urls: string[] = [];
  for (const m of models) {
    const modelParam = m ? `&model=${encodeURIComponent(m)}` : "";
    urls.push(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=${w}&height=${h}${modelParam}&nologo=true&private=true&seed=${seed}`,
    );
  }
  urls.push(
    `https://pollinations.ai/p/${encodeURIComponent(text)}?width=${w}&height=${h}&nologo=true&seed=${seed}`,
  );

  const errors: string[] = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { Accept: "image/*" } });
      const type = r.headers.get("content-type") ?? "";
      if (r.ok && type.startsWith("image/")) {
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (bytes.length > 1024) return bytesToB64(bytes);
        errors.push("resposta de imagem vazia");
        continue;
      }
      const detail = (await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 120);
      errors.push(`${r.status}${detail ? ` ${detail}` : ""}`.trim());
    } catch (e) {
      errors.push((e as Error).message.slice(0, 80));
    }
  }
  throw new ProviderError(
    `Pollinations não devolveu imagem (${errors.slice(0, 3).join(" | ")})`,
  );
}

function dims(size: string): { w: number; h: number; ratio: string } {
  const [w, h] = size.split("x").map(Number) as [number, number];
  return { w: w || 1024, h: h || 1024, ratio: w > h ? "3:2" : w < h ? "2:3" : "1:1" };
}

export const AUTO_INFO: ProviderInfo = { id: "auto" as ImageProviderId, label: "Automático", free: true, secret: null, defaultModel: "", supportsEdit: true };

export interface ProviderSettings {
  mode: string;
  model: string | null;
  order: ImageProviderId[];
  disabled: string[];
}

export async function getProviderSettings(): Promise<ProviderSettings> {
  const fallback: ProviderSettings = { mode: "lovable", model: null, order: IMAGE_PROVIDERS.map((p) => p.id), disabled: [] };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_limits")
      .select("image_provider,image_model,image_provider_order,image_provider_disabled")
      .maybeSingle();
    if (!data) return fallback;
    const order = (data.image_provider_order ?? []).filter((id: string) => IMAGE_PROVIDERS.some((p) => p.id === id)) as ImageProviderId[];
    for (const p of IMAGE_PROVIDERS) if (!order.includes(p.id)) order.push(p.id);
    return { mode: data.image_provider ?? "lovable", model: data.image_model ?? null, order, disabled: data.image_provider_disabled ?? [] };
  } catch {
    return fallback;
  }
}

/**
 * Uma chave colada errada (ex.: um token de outro serviço na variável do
 * Lovable) faz o gateway responder 401 "Invalid API key format". Nesses casos o
 * provedor é tratado como indisponível, em vez de gastar uma tentativa e
 * esconder a causa real do erro.
 */
function keyLooksUsable(secret: string, key: string): boolean {
  const k = key.trim();
  if (k.length < 8) return false;
  switch (secret) {
    case "LOVABLE_API_KEY":
      return k.startsWith("sk_");
    case "OPENAI_API_KEY":
      return k.startsWith("sk-");
    case "GEMINI_API_KEY":
      return k.startsWith("AIza");
    case "HF_TOKEN":
      return k.startsWith("hf_");
    default:
      return true;
  }
}

export async function isConfigured(p: ProviderInfo): Promise<boolean> {
  if (!p.secret) return true;
  const key = await resolveKey(p.secret);
  return !!key && keyLooksUsable(p.secret, key);
}

/** Motivo legível de cada provedor que não pode ser usado agora. */
export async function providerIssues(): Promise<string[]> {
  const s = await getProviderSettings();
  const now = Date.now();
  const out: string[] = [];
  for (const p of s.order.map((id) => IMAGE_PROVIDERS.find((x) => x.id === id)).filter(Boolean) as ProviderInfo[]) {
    if (s.disabled.includes(p.id)) continue;
    if (p.secret) {
      const key = await resolveKey(p.secret);
      if (!key) out.push(`${p.label}: falta a chave ${p.secret}`);
      else if (!keyLooksUsable(p.secret, key)) {
        out.push(
          `${p.label}: a chave ${p.secret} está num formato inválido (confira no painel Admin › Chaves)`,
        );
      }
    }
    const cool = cooldown.get(p.id);
    if (cool && cool.until > now) out.push(`${p.label}: em pausa (${cool.reason})`);
  }
  return out;
}

/** Provedores que falharam por falta de crédito/limite ficam em pausa por um tempo. */
const cooldown = new Map<string, { until: number; reason: string }>();
const COOLDOWN_MS = 10 * 60 * 1000;
export function providerCooldowns() {
  const now = Date.now();
  return [...cooldown.entries()].filter(([, v]) => v.until > now).map(([id, v]) => ({ id, ...v }));
}

export async function getActiveProvider(): Promise<{ info: ProviderInfo; model: string }> {
  const s = await getProviderSettings();
  if (s.mode === "auto") return { info: AUTO_INFO, model: "" };
  const info = IMAGE_PROVIDERS.find((p) => p.id === s.mode) ?? IMAGE_PROVIDERS[0]!;
  return { info, model: s.model?.trim() || info.defaultModel };
}

async function candidates(needEdit: boolean): Promise<{ info: ProviderInfo; model: string }[]> {
  const s = await getProviderSettings();
  if (s.mode !== "auto") {
    const a = await getActiveProvider();
    return [a];
  }
  const now = Date.now();
  const list = s.order
    .map((id) => IMAGE_PROVIDERS.find((p) => p.id === id)!)
    .filter((p) => !s.disabled.includes(p.id) && (cooldown.get(p.id)?.until ?? 0) < now);
  const checks = await Promise.all(list.map(async (p) => ({ p, ok: await isConfigured(p) })));
  const ready = checks.filter((c) => c.ok).map((c) => c.p);
  const sorted = needEdit
    ? [...ready.filter((p) => p.supportsEdit), ...ready.filter((p) => !p.supportsEdit)]
    : ready;
  return sorted.map((info) => ({ info, model: info.defaultModel }));
}

async function withFallback(needEdit: boolean, run: (c: { info: ProviderInfo; model: string }) => Promise<string>): Promise<string> {
  const list = await candidates(needEdit);
  if (!list.length) {
    const issues = await providerIssues();
    throw new ProviderError(
      `Nenhum provedor de IA disponível agora. ${issues.length ? issues.join(" | ") : "Todos desligados no painel Admin."}`,
      503,
    );
  }
  const errors: string[] = [];
  for (const c of list) {
    try {
      return await run(c);
    } catch (e) {
      const err = e as ProviderError;
      errors.push(`${c.info.label}: ${err.message.slice(0, 160)}`);
      if (list.length > 1) cooldown.set(c.info.id, { until: Date.now() + COOLDOWN_MS, reason: err.message.slice(0, 160) });
    }
  }
  throw new ProviderError(
    `Todos os provedores falharam — ${errors.join(" | ")}. ` +
      "Corrija as chaves em Admin › Chaves (ou use o Pollinations, que é grátis e não precisa de chave).",
    502,
  );
}

async function replicateRun(model: string, input: Record<string, unknown>): Promise<string> {
  const token = await env("REPLICATE_API_TOKEN");
  const r = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait" },
    body: JSON.stringify({ input }),
  });
  if (!r.ok) await fail(r, "Replicate");
  let pred = (await r.json()) as { status: string; output?: unknown; error?: string; urls?: { get: string } };
  while (pred.status === "starting" || pred.status === "processing") {
    await new Promise((res) => setTimeout(res, 1500));
    const p = await fetch(pred.urls!.get, { headers: { Authorization: `Bearer ${token}` } });
    pred = await p.json();
  }
  if (pred.status !== "succeeded") throw new ProviderError(`Replicate: ${pred.error ?? pred.status}`);
  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (typeof out !== "string") throw new ProviderError("Replicate sem imagem");
  return urlToB64(out);
}

async function falRun(model: string, input: Record<string, unknown>): Promise<string> {
  const falKey = await env("FAL_KEY");
  const r = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) await fail(r, "Fal");
  const j = (await r.json()) as { images?: { url: string }[] };
  const url = j.images?.[0]?.url;
  if (!url) throw new ProviderError("Fal sem imagem");
  return url.startsWith("data:") ? url.split(",")[1]! : urlToB64(url);
}

async function geminiRun(model: string, parts: unknown[]): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": env("GEMINI_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"] } }),
    },
  );
  if (!r.ok) await fail(r, "Gemini");
  const j = (await r.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[];
  };
  const data = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!data) throw new ProviderError("Gemini não retornou imagem (pode ter recusado o pedido).");
  return data;
}

/**
 * Gera uma imagem com o provedor ativo e devolve PNG base64 (sem prefixo).
 * Se todos os provedores configurados falharem, o Pollinations (grátis, sem
 * chave) ainda é tentado como último recurso — é melhor entregar uma imagem do
 * que devolver erro só porque as chaves pagas estão erradas/sem crédito.
 */
export async function generateImageB64(prompt: string, size = "1024x1024"): Promise<string> {
  try {
    return await withFallback(false, ({ info, model }) => runGenerate(info, model, prompt, size));
  } catch (e) {
    const { w, h } = dims(size);
    try {
      return await pollinationsRun("flux", prompt, w, h);
    } catch {
      throw e;
    }
  }
}

async function runGenerate(info: ProviderInfo, model: string, prompt: string, size: string): Promise<string> {
  const { w, h, ratio } = dims(size);
  switch (info.id) {
    case "lovable":
    case "openai": {
      const isLovable = info.id === "lovable";
      const r = await fetch(
        isLovable
          ? "https://ai.gateway.lovable.dev/v1/images/generations"
          : "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env(isLovable ? "LOVABLE_API_KEY" : "OPENAI_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model, prompt, size, quality: "low", background: "transparent", n: 1 }),
        },
      );
      if (!r.ok) await fail(r, isLovable ? "Gateway" : "OpenAI");
      const j = (await r.json()) as { data?: { b64_json?: string; url?: string }[] };
      const first = j.data?.[0];
      if (first?.b64_json) return first.b64_json;
      if (first?.url) return urlToB64(first.url);
      throw new ProviderError("Resposta sem imagem");
    }
    case "gemini":
      return geminiRun(model, [{ text: `${prompt}\nPlain transparent or flat background, ${ratio} aspect.` }]);
    case "replicate":
      return replicateRun(model, { prompt, aspect_ratio: ratio, output_format: "png" });
    case "fal":
      return falRun(model, { prompt, image_size: { width: w, height: h }, output_format: "png", sync_mode: true });
    case "huggingface": {
      const r = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env("HF_TOKEN")}`, "Content-Type": "application/json", Accept: "image/png" },
        body: JSON.stringify({ inputs: prompt, parameters: { width: w, height: h } }),
      });
      if (!r.ok) await fail(r, "Hugging Face");
      return bytesToB64(new Uint8Array(await r.arrayBuffer()));
    }
    case "pollinations":
      return pollinationsRun(model, prompt, w, h);
  }
  throw new ProviderError("Provedor desconhecido", 500);
}

/** Edita uma imagem (image-to-image). Provedores sem edição geram a partir do prompt. */
export function editImageB64(image: Blob, prompt: string): Promise<string> {
  return withFallback(true, ({ info, model }) => runEdit(info, model, image, prompt));
}

async function runEdit(info: ProviderInfo, model: string, image: Blob, prompt: string): Promise<string> {
  const b64 = bytesToB64(new Uint8Array(await image.arrayBuffer()));
  const dataUrl = `data:image/png;base64,${b64}`;
  switch (info.id) {
    case "lovable":
    case "openai": {
      const isLovable = info.id === "lovable";
      const fd = new FormData();
      fd.append("image", image, "asset.png");
      fd.append("prompt", prompt);
      fd.append("model", model);
      fd.append("background", "transparent");
      const r = await fetch(
        isLovable ? "https://ai.gateway.lovable.dev/v1/images/edits" : "https://api.openai.com/v1/images/edits",
        { method: "POST", headers: { Authorization: `Bearer ${env(isLovable ? "LOVABLE_API_KEY" : "OPENAI_API_KEY")}` }, body: fd },
      );
      if (!r.ok) await fail(r, isLovable ? "Gateway" : "OpenAI");
      const j = (await r.json()) as { data?: { b64_json?: string; url?: string }[] };
      const first = j.data?.[0];
      if (first?.b64_json) return first.b64_json;
      if (first?.url) return urlToB64(first.url);
      throw new ProviderError("Resposta sem imagem");
    }
    case "gemini":
      return geminiRun(model, [{ text: prompt }, { inlineData: { mimeType: "image/png", data: b64 } }]);
    case "replicate":
      return replicateRun("black-forest-labs/flux-kontext-pro", { prompt, input_image: dataUrl, output_format: "png" });
    case "fal":
      return falRun("fal-ai/flux-pro/kontext", { prompt, image_url: dataUrl, output_format: "png", sync_mode: true });
    default:
      return runGenerate(info, model, prompt, "1024x1024");
  }
}

/** SSE de evento único compatível com o leitor do Studio. */
export function singleImageSse(b64: string, kind: "generation" | "edit"): Response {
  const ev = `image_${kind}.completed`;
  const body = `event: ${ev}\ndata: ${JSON.stringify({ type: ev, b64_json: b64 })}\n\n`;
  return new Response(body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
