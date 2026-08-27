import {
  ANIMATION_ACTIONS,
  DEFAULT_STYLE_PROFILE,
  buildPrompt,
  type AssetMode,
  type Model3dStyleKey,
  type StyleKey,
  type StyleProfile,
  type ViewKey,
} from "@/lib/style-profile";

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

export function lovableApiKey(): string {
  const key = (globalThis as RuntimeGlobals).process?.env?.["LOVABLE_API_KEY"]?.trim();
  if (!key) throw new Error("LOVABLE_API_KEY ausente no servidor");
  return key;
}

export function resolveProfile(input: {
  style?: string | null;
  view?: string | null;
  palette?: string | null;
  detail?: number | null;
  extra?: string | null;
}): StyleProfile {
  return {
    style: (input.style ?? DEFAULT_STYLE_PROFILE.style) as StyleKey,
    view: (input.view ?? DEFAULT_STYLE_PROFILE.view) as ViewKey,
    palette: input.palette ?? DEFAULT_STYLE_PROFILE.palette,
    resolution: DEFAULT_STYLE_PROFILE.resolution,
    detail: input.detail ?? DEFAULT_STYLE_PROFILE.detail,
    extra: input.extra ?? "",
  };
}

export function findActionOrDefault(id: string | null | undefined) {
  return ANIMATION_ACTIONS.find((a) => a.id === id) ?? ANIMATION_ACTIONS[0]!;
}

export function composePrompt(input: {
  prompt: string;
  mode: AssetMode;
  profile: StyleProfile;
  action?: { id: string; columns: number; rows: number } | null;
  view?: ViewKey | null;
  uiKind?: string | null;
  model3dStyle?: string | null;
}): string {
  return buildPrompt(input.prompt, input.profile, {
    mode: input.mode,
    ...(input.action
      ? { animation: input.action.id, columns: input.action.columns, rows: input.action.rows }
      : {}),
    ...(input.uiKind ? { uiKind: input.uiKind } : {}),
    ...(input.model3dStyle ? { model3dStyle: input.model3dStyle as Model3dStyleKey } : {}),
    ...(input.view ? { view: input.view } : {}),
  });
}

/** Gera uma imagem no gateway e devolve o PNG em base64 (sem prefixo data URL). */
export async function generatePngBase64(prompt: string, size: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-image-2", prompt, size, quality: "low", n: 1 }),
  });
  if (!res.ok) {
    throw new Error(`Gateway ${res.status}: ${await res.text().catch(() => "falha na geração")}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const first = json.data?.[0];
  if (first?.b64_json) return first.b64_json;
  if (first?.url) {
    const img = await fetch(first.url);
    const buf = new Uint8Array(await img.arrayBuffer());
    let binary = "";
    for (const byte of buf) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  throw new Error("Resposta do gateway sem imagem");
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
