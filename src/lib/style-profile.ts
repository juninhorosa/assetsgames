export type StyleKey = "pixel-art" | "low-poly" | "stylized" | "pbr-realistic";

export type AssetMode = "sprite" | "spritesheet" | "texture" | "ui";

export interface StyleProfile {
  style: StyleKey;
  palette: string;
  resolution: number;
  detail: number; // 1..10
  extra: string;
}

export const DEFAULT_STYLE_PROFILE: StyleProfile = {
  style: "stylized",
  palette: "warm earth tones with teal accents",
  resolution: 1024,
  detail: 6,
  extra: "",
};

export const STYLE_LABELS: Record<StyleKey, string> = {
  "pixel-art": "Pixel Art",
  "low-poly": "Low Poly",
  stylized: "Stylized / Hand-painted",
  "pbr-realistic": "PBR Realista",
};

const STYLE_PROMPTS: Record<StyleKey, string> = {
  "pixel-art":
    "crisp pixel art, limited palette, hard pixel edges, no anti-aliasing, retro 16-bit game sprite aesthetic",
  "low-poly":
    "low poly game art look, flat faceted shading, simple geometric forms, clean silhouettes",
  stylized:
    "stylized hand-painted game art, painterly brushwork, soft rim light, exaggerated shapes, AAA stylized fantasy look",
  "pbr-realistic":
    "photorealistic PBR game asset, physically accurate materials, neutral studio lighting, high fidelity surface detail",
};

export const MODE_LABELS: Record<AssetMode, string> = {
  sprite: "Sprite / Personagem",
  spritesheet: "Sprite Sheet + Animação",
  texture: "Textura PBR",
  ui: "UI / Ícone",
};

export interface GenerationParams {
  mode: AssetMode;
  animation?: string;
  columns?: number;
  rows?: number;
  uiKind?: string;
}

export function detailWord(detail: number): string {
  if (detail <= 3) return "minimal detail, very clean and readable";
  if (detail <= 6) return "moderate detail, readable at small sizes";
  return "high detail, rich micro-surface information";
}

/**
 * Style profile + mode template = the consistency mechanism.
 * The same profile is injected into every prompt of a project.
 */
export function buildPrompt(
  userPrompt: string,
  profile: StyleProfile,
  params: GenerationParams,
): string {
  const styleLine = `${STYLE_PROMPTS[profile.style]}, color palette: ${profile.palette}, ${detailWord(profile.detail)}`;
  const extra = profile.extra?.trim() ? ` Art direction notes: ${profile.extra.trim()}.` : "";

  switch (params.mode) {
    case "spritesheet": {
      const cols = params.columns ?? 4;
      const rows = params.rows ?? 2;
      const frames = cols * rows;
      return [
        `A game sprite sheet of: ${userPrompt}.`,
        `Render exactly ${frames} animation frames laid out in a strict uniform grid of ${cols} columns by ${rows} rows.`,
        `The animation is "${params.animation ?? "idle"}": each cell is one sequential keyframe of that motion, same character, same scale, same camera angle, centered inside its cell.`,
        `Uniform cell size, no gaps, no borders, no numbers, no captions, no drop shadow outside the cell.`,
        `Solid flat pure white background so it can be keyed out.`,
        styleLine + ".",
        "Side-view full body, consistent proportions across every frame." + extra,
      ].join(" ");
    }
    case "texture":
      return [
        `A seamless tileable PBR albedo texture of: ${userPrompt}.`,
        "Perfectly flat orthographic top-down view, evenly lit with diffuse light and no directional shadows, no highlights baked in, edges tile seamlessly on all four sides.",
        "No objects, no perspective, no vignette, fills the whole frame.",
        styleLine + "." + extra,
      ].join(" ");
    case "ui":
      return [
        `A single game UI ${params.uiKind ?? "icon"}: ${userPrompt}.`,
        "Centered, isolated on a solid flat pure white background, no text, no watermark, crisp clean edges suitable for alpha cut-out, subtle inner bevel and readable silhouette.",
        styleLine + "." + extra,
      ].join(" ");
    case "sprite":
    default:
      return [
        `A single game asset sprite of: ${userPrompt}.`,
        "One subject, centered, full body, isolated on a solid flat pure white background, no text, no props outside the subject, clean readable silhouette suitable for alpha cut-out.",
        styleLine + "." + extra,
      ].join(" ");
  }
}

export const ANIMATION_PRESETS = ["idle", "walk", "run", "attack", "jump", "death"] as const;
