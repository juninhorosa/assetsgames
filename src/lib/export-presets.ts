/**
 * Presets de exportação por engine.
 *
 * Cada preset resolve, de uma vez, o que normalmente é ajustado à mão depois da
 * importação: unidade/escala do mundo, pivô do sprite, canal e espaço de cor dos
 * mapas, tipo de material e a árvore de pastas onde os arquivos devem morar.
 */

import type { Engine } from "./engine-export";

export type PivotPreset = "bottom-center" | "center" | "top-left";

export interface MaterialPreset {
  /** Nome do material/shader criado na engine. */
  shader: string;
  /** Se o alpha deve ser tratado como recorte (cutout) em vez de blend. */
  alphaCutout: boolean;
  /** Espaço de cor do normal map. */
  normalSpace: "tangent-+y" | "tangent--y";
  /** Canais empacotados (quando a engine espera ORM/ARM). */
  packedChannels?: string | undefined;
  srgbAlbedo: boolean;
  linearData: boolean;
}

export interface ExportPreset {
  id: Engine;
  label: string;
  /** Unidade base da engine, em metros. */
  unit: string;
  /** Pixels por unidade do mundo (2D). */
  pixelsPerUnit: number;
  /** Escala aplicada às malhas exportadas. */
  meshScale: number;
  /** Eixo "para cima" esperado pela engine. */
  upAxis: "Y" | "Z";
  pivot: PivotPreset;
  material: MaterialPreset;
  /** Caminho de destino dos assets dentro do projeto da engine. */
  paths: {
    root: string;
    textures: string;
    sprites: string;
    meshes: string;
    materials: string;
    animations: string;
  };
  /** Ajustes automáticos do importador. */
  importer: {
    filterMode: "point" | "bilinear";
    mipmaps: boolean;
    compression: "none" | "default";
    wrap: "clamp" | "repeat";
    generatePhysicsShape: boolean;
  };
  notes: string[];
}

function paths(root: string) {
  return {
    root,
    textures: `${root}/textures`,
    sprites: `${root}/sprites`,
    meshes: `${root}/meshes`,
    materials: `${root}/materials`,
    animations: `${root}/animations`,
  };
}

export const EXPORT_PRESETS: Record<Engine, ExportPreset> = {
  unity: {
    id: "unity",
    label: "Unity (URP)",
    unit: "1 unidade = 1 metro",
    pixelsPerUnit: 100,
    meshScale: 1,
    upAxis: "Y",
    pivot: "bottom-center",
    material: {
      shader: "Universal Render Pipeline/Lit",
      alphaCutout: true,
      normalSpace: "tangent-+y",
      packedChannels: "metallic(R) + smoothness(A) no MetallicGloss",
      srgbAlbedo: true,
      linearData: true,
    },
    paths: paths("Assets/Forge3D"),
    importer: {
      filterMode: "point",
      mipmaps: false,
      compression: "none",
      wrap: "clamp",
      generatePhysicsShape: false,
    },
    notes: [
      "Sprites entram com Pixels Per Unit 100 e pivô na base para alinhar com colliders.",
      "Normal maps são marcados como NormalMap no importador (tangent +Y).",
    ],
  },
  unreal: {
    id: "unreal",
    label: "Unreal Engine 5",
    unit: "1 unidade = 1 centímetro",
    pixelsPerUnit: 1,
    meshScale: 100,
    upAxis: "Z",
    pivot: "bottom-center",
    material: {
      shader: "M_Forge3D (Default Lit)",
      alphaCutout: true,
      normalSpace: "tangent--y",
      packedChannels: "ORM: AO(R) + Roughness(G) + Metallic(B)",
      srgbAlbedo: true,
      linearData: true,
    },
    paths: paths("/Game/Forge3D"),
    importer: {
      filterMode: "bilinear",
      mipmaps: true,
      compression: "default",
      wrap: "clamp",
      generatePhysicsShape: false,
    },
    notes: [
      "Malhas são escaladas ×100 porque a unidade do Unreal é centímetro e o eixo up é Z.",
      "Normal map usa Y invertido (padrão DirectX do Unreal).",
    ],
  },
  godot: {
    id: "godot",
    label: "Godot 4",
    unit: "1 unidade = 1 metro",
    pixelsPerUnit: 1,
    meshScale: 1,
    upAxis: "Y",
    pivot: "center",
    material: {
      shader: "StandardMaterial3D",
      alphaCutout: true,
      normalSpace: "tangent-+y",
      srgbAlbedo: true,
      linearData: true,
    },
    paths: paths("res://forge3d"),
    importer: {
      filterMode: "point",
      mipmaps: false,
      compression: "none",
      wrap: "clamp",
      generatePhysicsShape: true,
    },
    notes: [
      "SpriteFrames já sai com FPS e regiões calculadas; AnimatedSprite2D só precisa do recurso.",
      "Texturas ficam com filtro Nearest quando o estilo é pixel-art.",
    ],
  },
};

export function findPreset(engine: Engine): ExportPreset {
  return EXPORT_PRESETS[engine];
}

/**
 * Ajusta o preset ao asset concreto: estilo pixel-art troca o filtro, textura
 * tileável passa a repetir, e o pivô pode ser sobrescrito pelo alinhamento
 * escolhido no estúdio.
 */
export function resolvePreset(
  engine: Engine,
  opts: { pixelArt?: boolean; tiling?: boolean; pivot?: PivotPreset | undefined },
): ExportPreset {
  const base = EXPORT_PRESETS[engine];
  return {
    ...base,
    pivot: opts.pivot ?? base.pivot,
    importer: {
      ...base.importer,
      filterMode: opts.pixelArt ? "point" : base.importer.filterMode,
      mipmaps: opts.tiling ? true : base.importer.mipmaps,
      wrap: opts.tiling ? "repeat" : base.importer.wrap,
    },
  };
}
