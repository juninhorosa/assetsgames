export type StyleKey = "pixel-art" | "low-poly" | "stylized" | "pbr-realistic";

export type AssetMode = "sprite" | "spritesheet" | "texture" | "ui" | "model3d";

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
  model3d: "Modelo 3D (relevo)",
};

export interface GenerationParams {
  mode: AssetMode;
  animation?: string | undefined;
  columns?: number | undefined;
  rows?: number | undefined;
  uiKind?: string | undefined;
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
    case "model3d":
      return [
        `A single game prop for 3D conversion: ${userPrompt}.`,
        "Strict orthographic front view, perfectly centered and axis-aligned, no perspective distortion, no camera tilt.",
        "Even diffuse lighting with soft self-shading that reads as volume: brighter where the surface faces the viewer, darker in recesses and cavities, so luminance can be used as a depth map.",
        "No cast shadows, no ground plane, no background elements, solid flat pure white background for alpha cut-out, clean readable silhouette, subject fills the frame.",
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

/** Catálogo de ações de personagem — cada uma com beats de movimento e grade sugerida. */
export interface AnimationAction {
  id: string;
  label: string;
  /** Descrição em inglês dos keyframes, injetada no prompt. */
  motion: string;
  columns: number;
  rows: number;
  fps: number;
}

export const ANIMATION_ACTIONS: AnimationAction[] = [
  {
    id: "idle",
    label: "Parado (idle)",
    motion:
      "idle breathing loop: weight settled on both feet, chest rising and falling, small shoulder and head sway, arms relaxed, loops seamlessly back to the first frame",
    columns: 4,
    rows: 1,
    fps: 8,
  },
  {
    id: "walk",
    label: "Andando",
    motion:
      "walk cycle seen from the side: contact, down, passing, up poses for the left leg then mirrored for the right leg, arms swinging opposite to the legs, torso bobbing slightly, loops seamlessly",
    columns: 4,
    rows: 2,
    fps: 12,
  },
  {
    id: "run",
    label: "Correndo",
    motion:
      "run cycle seen from the side: strong forward lean, longer stride, both feet off the ground on the airborne frames, bent arms pumping, hair and cloth trailing back, loops seamlessly",
    columns: 4,
    rows: 2,
    fps: 16,
  },
  {
    id: "attack",
    label: "Atacando (batendo)",
    motion:
      "melee attack: anticipation wind-up, fast swing through the impact frame with a short motion arc, follow-through, then recovery back to guard; does not loop",
    columns: 3,
    rows: 2,
    fps: 14,
  },
  {
    id: "hurt",
    label: "Tomando dano",
    motion:
      "hit reaction: body recoils backwards, head snapped back, arms flailing briefly, then returns to stance; does not loop",
    columns: 4,
    rows: 1,
    fps: 12,
  },
  {
    id: "death",
    label: "Morrendo",
    motion:
      "death sequence: staggered off balance, knees buckling, falling forward onto the ground, final frame lying motionless on the floor; does not loop",
    columns: 3,
    rows: 2,
    fps: 10,
  },
  {
    id: "getup",
    label: "Levantando",
    motion:
      "getting up from the ground: lying prone, pushing up with the arms, one knee planted, rising to a crouch, standing upright in the last frame; does not loop",
    columns: 3,
    rows: 2,
    fps: 10,
  },
  {
    id: "sit",
    label: "Sentando",
    motion:
      "sitting down: standing, bending the knees, lowering the hips, seated on the ground with legs folded in the final frame; does not loop",
    columns: 3,
    rows: 2,
    fps: 10,
  },
  {
    id: "jump",
    label: "Pulando",
    motion:
      "jump arc: crouch anticipation, explosive take-off, rising with legs tucked, apex, falling with legs extending, landing squash on the last frame; does not loop",
    columns: 3,
    rows: 2,
    fps: 12,
  },
  {
    id: "climb",
    label: "Escalando",
    motion:
      "climbing loop seen from the side against a vertical surface: alternating hand and foot reaches pulling the body upward, loops seamlessly",
    columns: 4,
    rows: 1,
    fps: 10,
  },
  {
    id: "cast",
    label: "Conjurando / habilidade",
    motion:
      "spell cast: gathering pose with hands drawing energy inward, charge build-up, release with arms thrown forward, recovery; does not loop",
    columns: 3,
    rows: 2,
    fps: 12,
  },
];

export function findAction(id: string): AnimationAction | undefined {
  return ANIMATION_ACTIONS.find((a) => a.id === id);
}

export const ANIMATION_PRESETS = ANIMATION_ACTIONS.map((a) => a.id);

