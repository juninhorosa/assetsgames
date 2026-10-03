/**
 * Provedores de geração de imagem selecionáveis no painel Admin.
 * Todas as gerações do site (Studio, edição, lote, API pública e MCP) passam por aqui.
 */

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

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new ProviderError(`Chave ${name} não configurada para este provedor.`, 500);
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
  if (!r.ok) throw new ProviderError(`Falha ao baixar imagem (${r.status})`);
  return bytesToB64(new Uint8Array(await r.arrayBuffer()));
}

async function fail(r: Response, who: string): Promise<never> {
  const t = await r.text().catch(() => "");
  throw new ProviderError(`${who} ${r.status}: ${t.slice(0, 400)}`, r.status);
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

export function isConfigured(p: ProviderInfo): boolean {
  return p.secret ? !!process.env[p.secret]?.trim() : true;
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
    .filter((p) => !s.disabled.includes(p.id) && isConfigured(p) && (cooldown.get(p.id)?.until ?? 0) < now);
  const sorted = needEdit ? [...list.filter((p) => p.supportsEdit), ...list.filter((p) => !p.supportsEdit)] : list;
  return sorted.map((info) => ({ info, model: info.defaultModel }));
}

async function withFallback(needEdit: boolean, run: (c: { info: ProviderInfo; model: string }) => Promise<string>): Promise<string> {
  const list = await candidates(needEdit);
  if (!list.length) throw new ProviderError("Nenhum provedor de IA disponível agora (todos sem crédito, sem chave ou desligados).", 503);
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
  throw new ProviderError(`Todos os provedores falharam — ${errors.join(" | ")}`, 502);
}

async function replicateRun(model: string, input: Record<string, unknown>): Promise<string> {
  const token = env("REPLICATE_API_TOKEN");
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
  const r = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${env("FAL_KEY")}`, "Content-Type": "application/json" },
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

/** Gera uma imagem com o provedor ativo e devolve PNG base64 (sem prefixo). */
export function generateImageB64(prompt: string, size = "1024x1024"): Promise<string> {
  return withFallback(false, ({ info, model }) => runGenerate(info, model, prompt, size));
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
    case "pollinations": {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1800))}?width=${w}&height=${h}&model=${encodeURIComponent(model)}&nologo=true&seed=${Math.floor(Math.random() * 1e9)}`;
      return urlToB64(url);
    }
  }
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
