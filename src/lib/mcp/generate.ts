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
  pixelGrid?: number | null;
  paletteSize?: number | null;
}): StyleProfile {
  return {
    style: (input.style ?? DEFAULT_STYLE_PROFILE.style) as StyleKey,
    view: (input.view ?? DEFAULT_STYLE_PROFILE.view) as ViewKey,
    palette: input.palette ?? DEFAULT_STYLE_PROFILE.palette,
    resolution: DEFAULT_STYLE_PROFILE.resolution,
    detail: input.detail ?? DEFAULT_STYLE_PROFILE.detail,
    extra: input.extra ?? "",
    pixelGrid: input.pixelGrid ?? DEFAULT_STYLE_PROFILE.pixelGrid ?? 64,
    paletteSize: input.paletteSize ?? DEFAULT_STYLE_PROFILE.paletteSize ?? 24,
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
  tileSize?: number;
  tileColumns?: number;
  tileRows?: number;
  tilesetKind?: "terrain" | "autotile" | "walls" | "objects";
}): string {
  return buildPrompt(input.prompt, input.profile, {
    mode: input.mode,
    ...(input.action
      ? { animation: input.action.id, columns: input.action.columns, rows: input.action.rows }
      : {}),
    ...(input.uiKind ? { uiKind: input.uiKind } : {}),
    ...(input.model3dStyle ? { model3dStyle: input.model3dStyle as Model3dStyleKey } : {}),
    ...(input.mode === "tileset" ? {
      tileSize: input.tileSize,
      tileColumns: input.tileColumns,
      tileRows: input.tileRows,
      tilesetKind: input.tilesetKind,
    } : {}),
    ...(input.view ? { view: input.view } : {}),
  });
}

/** Gera uma imagem no gateway e devolve o PNG em base64 (sem prefixo data URL). */
export async function generatePngBase64(prompt: string, size: string): Promise<string> {
  const { checkSpendGuard, guardMessage } = await import("@/lib/spend-guard.server");
  const guard = await checkSpendGuard(1);
  if (guard.public_api_enabled === false) {
    throw new Error("API/MCP desligada pelo administrador.");
  }
  if (!guard.allowed) throw new Error(guardMessage(guard));
  const { generateImageB64 } = await import("@/lib/image-providers.server");
  return generateImageB64(prompt, size);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
