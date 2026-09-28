export type StyleKey =
  | "pixel-art"
  | "tibia-retro"
  | "low-poly"
  | "stylized"
  | "pbr-realistic";

export type AssetMode = "sprite" | "spritesheet" | "tileset" | "texture" | "ui" | "model3d";

export type TilesetKind = "terrain" | "autotile" | "walls" | "objects";

/** Sentido/vista travada do projeto — mantém todos os assets no mesmo ângulo. */
export type ViewKey =
  | "side-right"
  | "side-left"
  | "front"
  | "back"
  | "three-quarter"
  | "three-quarter-back"
  | "top-down"
  | "isometric";

export const VIEW_LABELS: Record<ViewKey, string> = {
  "side-right": "Lateral — virado para a direita",
  "side-left": "Lateral — virado para a esquerda",
  front: "Frontal (de frente para a câmera)",
  back: "De costas (afastando-se da câmera)",
  "three-quarter": "3/4 frontal (semi-perfil)",
  "three-quarter-back": "3/4 de costas",
  "top-down": "Top-down (visto de cima)",
  isometric: "Isométrico (45°)",
};

const VIEW_PROMPTS: Record<ViewKey, string> = {
  "side-right":
    "strict side view (pure profile) with the subject facing to the RIGHT of the frame, camera at subject height, perfectly level horizon, no rotation and no perspective drift",
  "side-left":
    "strict side view (pure profile) with the subject facing to the LEFT of the frame, camera at subject height, perfectly level horizon, no rotation and no perspective drift",
  front:
    "strict front view with the subject facing the camera straight on, symmetrical, camera at subject height, no rotation and no perspective drift",
  back:
    "strict back view with the subject facing directly away from the camera, showing the back of the head, back and heels, symmetrical, camera at subject height, no rotation and no perspective drift",
  "three-quarter":
    "consistent three-quarter FRONT view, subject rotated 45 degrees to its right so both the front and one side are visible, camera at subject height, identical rotation in every asset",
  "three-quarter-back":
    "consistent three-quarter BACK view, subject rotated 135 degrees so the back and one side are visible and the face is hidden, camera at subject height, identical rotation in every asset",
  "top-down":
    "strict top-down view straight from above, orthographic, subject facing up the frame, no perspective",
  isometric:
    "consistent isometric view at 45 degrees horizontally and about 30 degrees above, orthographic projection, identical camera angle in every asset",
};

export function viewLine(profile: StyleProfile, override?: ViewKey): string {
  return VIEW_PROMPTS[override ?? profile.view ?? "side-right"];
}

/** Conjuntos de direções para gerar o personagem/ação visto de todos os lados. */
export interface DirectionSet {
  id: string;
  label: string;
  views: ViewKey[];
}

export const DIRECTION_SETS: DirectionSet[] = [
  { id: "single", label: "Só o sentido do projeto", views: [] },
  {
    id: "four",
    label: "4 direções (frente, costas, esquerda, direita)",
    views: ["front", "back", "side-left", "side-right"],
  },
  {
    id: "eight",
    label: "8 direções (4 + diagonais + topo/isométrico)",
    views: [
      "front",
      "three-quarter",
      "side-right",
      "three-quarter-back",
      "back",
      "side-left",
      "top-down",
      "isometric",
    ],
  },
];

export function findDirectionSet(id: string): DirectionSet {
  return DIRECTION_SETS.find((d) => d.id === id) ?? DIRECTION_SETS[0]!;
}


export interface StyleProfile {
  style: StyleKey;
  /** Vista/direção travada: todos os assets do projeto usam este ângulo. */
  view: ViewKey;
  palette: string;
  resolution: number;
  detail: number; // 1..10
  extra: string;
  /** Grade lógica final para acabamento pixel-art. */
  pixelGrid?: number;
  /** Máximo de cores no acabamento pixel-art. */
  paletteSize?: number;
}

export const DEFAULT_STYLE_PROFILE: StyleProfile = {
  style: "stylized",
  view: "side-right",
  palette: "warm earth tones with teal accents",
  resolution: 1024,
  detail: 6,
  extra: "",
  pixelGrid: 64,
  paletteSize: 24,
};

export const STYLE_LABELS: Record<StyleKey, string> = {
  "pixel-art": "Pixel Art",
  "tibia-retro": "Tibia / MMORPG retro 2D",
  "low-poly": "Low Poly",
  stylized: "Stylized / Hand-painted",
  "pbr-realistic": "PBR Realista",
};

/** Estilos que devem ser renderizados sem suavização (image-rendering: pixelated). */
export function isPixelStyle(style: StyleKey): boolean {
  return style === "pixel-art" || style === "tibia-retro";
}

const STYLE_PROMPTS: Record<StyleKey, string> = {
  "pixel-art":
    "crisp pixel art, limited palette, hard pixel edges, no anti-aliasing, retro 16-bit game sprite aesthetic",
  "tibia-retro":
    "classic early-2000s 2D MMORPG sprite art in the exact spirit of Tibia: tiny low-resolution pixel sprite designed to fit a 64x64 pixel cell on a 32x32 tile grid, orthographic 3/4 top-down camera slightly above the subject, chunky readable silhouette with a big head and short stocky body, thick dark 1px outline on every shape, flat cel shading with only 2 or 3 tones per material and one hard shadow side, very limited dull medieval-fantasy palette (browns, greys, muted greens, deep reds), no gradients, no anti-aliasing, no glow, no bloom, no modern rendering, no cast shadow on the ground, simple gear and weapons readable at tiny size, faithful old-school MMORPG tileset look",
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
  tileset: "Tileset / Mapa",
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
  /** Variação de estilo 3D — só usada no modo `model3d`. */
  model3dStyle?: Model3dStyleKey | undefined;
  /** Sobrescreve o sentido travado do projeto (usado na geração multidirecional). */
  view?: ViewKey | undefined;
  tileSize?: number | undefined;
  tileColumns?: number | undefined;
  tileRows?: number | undefined;
  tilesetKind?: TilesetKind | undefined;

}

/** Variações controladas de estilo para a geração 3D. */
export type Model3dStyleKey =
  | "low-poly"
  | "hand-painted"
  | "pbr-realistic"
  | "toon-cel"
  | "clay-sculpt";

export interface Model3dStyleVariant {
  id: Model3dStyleKey;
  label: string;
  hint: string;
  /** Injetado no prompt — descreve superfície/shading, nunca a câmera ou a silhueta. */
  prompt: string;
  /** Preset de malha coerente com o estilo (relevo 2.5D). */
  relief: { segments: number; depth: number; smooth: number };
}

export const MODEL3D_STYLES: Model3dStyleVariant[] = [
  {
    id: "low-poly",
    label: "Low poly",
    hint: "faces planas, malha leve",
    prompt:
      "low poly 3D render look: flat faceted planes, hard shading breaks between facets, no micro texture, chunky simplified forms while keeping the overall proportions and outline intact",
    relief: { segments: 72, depth: 0.3, smooth: 0.05 },
  },
  {
    id: "hand-painted",
    label: "Hand-painted",
    hint: "pintado à mão, volume suave",
    prompt:
      "hand-painted 3D game asset look: painterly brushwork baked into the diffuse, soft gradient shading that sculpts volume, gentle rim light, no photographic grain",
    relief: { segments: 128, depth: 0.35, smooth: 0.45 },
  },
  {
    id: "pbr-realistic",
    label: "PBR realista",
    hint: "materiais físicos, alto detalhe",
    prompt:
      "photorealistic PBR 3D asset look: physically accurate materials, fine micro-surface detail, crisp ambient occlusion in the recesses, neutral studio lighting, no stylization",
    relief: { segments: 192, depth: 0.42, smooth: 0.3 },
  },
  {
    id: "toon-cel",
    label: "Toon / cel-shaded",
    hint: "bandas de luz, contorno limpo",
    prompt:
      "cel-shaded 3D look: two or three flat light bands instead of smooth gradients, clean dark outline hugging the silhouette, saturated flat fills, no texture noise",
    relief: { segments: 96, depth: 0.28, smooth: 0.25 },
  },
  {
    id: "clay-sculpt",
    label: "Clay / escultura",
    hint: "massa modelada, formas cheias",
    prompt:
      "sculpted clay 3D look: matte modelling-clay surface, thumb-pressed planes, plump rounded volumes with strong soft shading, no glossy highlights and no surface pattern",
    relief: { segments: 144, depth: 0.5, smooth: 0.6 },
  },
];

export const DEFAULT_MODEL3D_STYLE: Model3dStyleKey = "hand-painted";

export function findModel3dStyle(id: string | undefined): Model3dStyleVariant {
  return (
    MODEL3D_STYLES.find((s) => s.id === id) ??
    MODEL3D_STYLES.find((s) => s.id === DEFAULT_MODEL3D_STYLE)!
  );
}

export function detailWord(detail: number): string {
  if (detail <= 3) return "minimal detail, very clean and readable";
  if (detail <= 6) return "moderate detail, readable at small sizes";
  return "high detail, rich micro-surface information";
}

/**
 * Trava de enquadramento — mesma escala e margem em todos os assets do projeto,
 * para que o recorte (trim) produza sempre saídas do mesmo tamanho.
 */
export const FRAMING_LOCK =
  "Framing lock: square composition, subject perfectly centered horizontally, standing on an invisible baseline at the same height in every image, the subject occupies exactly 85% of the frame height with a constant empty safe margin of about 7% on all four sides, nothing touching or cropped by the frame edges, identical zoom level, identical subject scale and identical distance from camera in every image so all assets can be trimmed to the same size.";

/**
 * Trava de escala entre ações: o corpo tem sempre a mesma altura, independente
 * da pose, e o excedente (arma erguida, salto) usa a margem — nunca aumenta o
 * personagem. Também exige a arma colada à mão.
 */
export const CROSS_ACTION_SCALE_LOCK =
  "Cross-action scale lock: the character body is drawn at exactly the same size in every frame and in every animation — idle, walk, run, attack, jump, hurt and death all use the identical character height measured from the feet to the top of the head, the same limb thickness and the same head-to-body ratio; never zoom in or enlarge the character for action poses. Raised weapons, swings, jumps and capes extend into the empty margin instead of scaling the figure up or down. Feet always rest on one common ground line at the same height. Every prop and weapon stays rigidly attached to the hand or body it belongs to, never detached, never floating, no loose blade fragments or separated pieces.";

export const PIXEL_RENDER_LOCK =
  "Pixel rendering lock: draw on a strict low-resolution pixel grid with square pixels only, hard 1-pixel edges, a compact shared palette, no anti-aliasing, no sub-pixel details, no blur, no gradients, no texture noise and no semi-transparent edge pixels. Every repeated feature must use the same pixel clusters and colors.";

export const TILE_GRID_LOCK =
  "Tile grid lock: every tile occupies exactly one equal square cell, all cell boundaries align perfectly, terrain edges continue seamlessly into compatible neighboring tiles, corners and transitions meet without gaps, no perspective drift, no lighting changes between cells, no labels, separators, padding or gutters.";


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
  const view = `Camera and orientation lock: ${viewLine(profile, params.view)}.`;
  const framing = FRAMING_LOCK;


  switch (params.mode) {
    case "spritesheet": {
      const cols = params.columns ?? 4;
      const rows = params.rows ?? 2;
      const frames = cols * rows;
      const actionId = params.animation ?? "idle";
      const action = ANIMATION_ACTIONS.find((a) => a.id === actionId);
      const motion = action
        ? action.motion
        : `${actionId}: each cell is one sequential keyframe of that motion`;
      return [
        `A game character sprite sheet of: ${userPrompt}.`,
        `Render exactly ${frames} animation frames laid out in a strict uniform grid of ${cols} columns by ${rows} rows, read left to right, top to bottom.`,
        `The animation is "${actionId}" — ${motion}.`,
        `Every cell shows the same character with identical proportions, identical outfit, identical colors, identical scale and identical camera angle, centered inside its cell, feet on the same baseline; only the pose changes between cells.`,
        `Uniform cell size, no gaps, no borders, no numbers, no captions, no onion-skin ghosting, no drop shadow outside the cell.`,
        `Inside every cell the character keeps the same scale and a constant empty safe margin around it (about 7% of the cell), never touching or crossing the cell edges, so all frames trim to the same size.`,
        CROSS_ACTION_SCALE_LOCK,
        ...(isPixelStyle(profile.style) ? [PIXEL_RENDER_LOCK] : []),
        `Solid flat pure white background so it can be keyed out.`,

        styleLine + ".",
        view,
        "Full body, consistent proportions and the exact same facing direction across every frame." +
          extra,
      ].join(" ");
    }

    case "tileset": {
      const cols = params.tileColumns ?? 4;
      const rows = params.tileRows ?? 4;
      const tileSize = params.tileSize ?? 32;
      const kind = params.tilesetKind ?? "terrain";
      return [
        `A production-ready ${kind} pixel-art game tileset of: ${userPrompt}.`,
        `Render exactly ${cols * rows} tiles in a strict ${cols} columns by ${rows} rows grid. Each tile represents a logical ${tileSize}x${tileSize} pixel cell.`,
        TILE_GRID_LOCK,
        "Include useful gameplay variants: seamless center fills, straight edges, inner corners, outer corners, transition pieces and small readable variations.",
        "Strict orthographic top-down game-map view, evenly lit, no characters, no text, no mockup, no border around the full sheet.",
        PIXEL_RENDER_LOCK,
        styleLine + "." + extra,
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
        framing,
        styleLine + "." + extra,
      ].join(" ");
    case "model3d": {
      const variant = findModel3dStyle(params.model3dStyle);
      return [
        `A single game asset for 3D conversion: ${userPrompt}.`,
        "Strict orthographic projection, perfectly centered and axis-aligned, no perspective distortion, no camera tilt.",
        "Even diffuse lighting with soft self-shading that reads as volume: brighter where the surface faces the viewer, darker in recesses and cavities, so luminance can be used as a depth map.",
        "No cast shadows, no ground plane, no background elements, solid flat pure white background for alpha cut-out.",
        framing,
        `Style variation: ${variant.prompt}.`,
        "The style variation only changes surface, shading and material treatment — keep the exact same subject, the same proportions, the same volume distribution and the same crisp readable silhouette, with the outline unbroken and no part of the shape cropped or dissolved.",
        styleLine + ".",
        view + extra,
      ].join(" ");
    }
    case "sprite":
    default:
      return [
        `A single game asset sprite of: ${userPrompt}.`,
        "One subject, centered, full body, isolated on a solid flat pure white background, no text, no props outside the subject, clean readable silhouette suitable for alpha cut-out.",
        framing,
        CROSS_ACTION_SCALE_LOCK,
        styleLine + ".",
        view + extra,
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

