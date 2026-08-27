/**
 * AI-readable asset pack manifest.
 *
 * Every export (sprite, sprite sheet, textura PBR, UI, modelo 3D e movimento 3D)
 * carries `forge3d.manifest.json` + `AGENTS.md`. O objetivo é que outra IA/agente
 * (ou um plugin de engine) possa ler o pacote e colocar os assets, tiles, sprites
 * e animações no jogo sem adivinhar nada: cada arquivo tem papel declarado,
 * unidades, pivot, grade, FPS e instruções de uso por engine.
 */

import type { Engine } from "./engine-export";
import type { AssetMode, StyleProfile } from "./style-profile";
import type { FrameRect } from "./image-pipeline";

export const MANIFEST_SCHEMA = "forge3d.asset-pack/1";

export type FileRole =
  | "albedo"
  | "normal"
  | "roughness"
  | "metallic"
  | "ao"
  | "height"
  | "spritesheet"
  | "sprite-frame"
  | "mesh-static"
  | "mesh-frame"
  | "mesh-animated"
  | "sprite-metadata"
  | "manifest"
  | "engine-script"
  | "docs";

export interface ManifestInput {
  name: string;
  slug: string;
  mode: AssetMode;
  prompt: string;
  style: StyleProfile;
  engine: Engine | null;
  paths: string[];
  maps: string[];
  animation?:
    | {
        name: string;
        label?: string | undefined;
        fps: number;
        columns: number;
        rows: number;
        cellWidth: number;
        cellHeight: number;
        frameCount: number;
        rects: FrameRect[];
      }
    | undefined;
  motion3d?:
    | {
        fps: number;
        frameCount: number;
        depth: number;
        segments: number;
      }
    | undefined;
}

function roleFor(path: string, maps: string[]): FileRole {
  const file = path.split("/").pop() ?? path;
  if (file === "forge3d.manifest.json" || file === "forge3d.json") return "manifest";
  if (file.endsWith(".md")) return "docs";
  if (file.endsWith(".cs") || file.endsWith(".py") || file.endsWith(".tres"))
    return "engine-script";
  if (file === "frames.json") return "sprite-metadata";
  if (file.endsWith("_animated.glb")) return "mesh-animated";
  if (path.startsWith("models/frames/")) return "mesh-frame";
  if (file.endsWith(".glb")) return "mesh-static";
  if (path.startsWith("frames/")) return "sprite-frame";
  if (file.endsWith("_sheet.png")) return "spritesheet";
  for (const map of maps) {
    if (file.endsWith(`_${map}.png`)) return map as FileRole;
  }
  return "albedo";
}

const ROLE_NOTES: Record<FileRole, string> = {
  albedo: "Cor base (sRGB). Alpha = silhueta recortada.",
  normal: "Normal map tangent-space, OpenGL (+Y para cima). Importar como normal map linear.",
  roughness: "Rugosidade linear (grayscale), 0 = espelho, 1 = difuso.",
  metallic: "Metalness linear (grayscale), 0 = dielétrico, 1 = metal.",
  ao: "Ambient occlusion linear (grayscale).",
  height: "Height/displacement linear (grayscale), usado para parallax ou relevo.",
  spritesheet: "Atlas de animação em grade uniforme. Ver `sprites` e `animations`.",
  "sprite-frame": "Quadro individual já fatiado, ordem = índice no nome do arquivo.",
  "mesh-static": "Malha 3D estática (glTF binário), pronta para instanciar na cena.",
  "mesh-frame": "Malha 3D de um quadro da animação (stop-motion), ordem pelo índice do nome.",
  "mesh-animated": "glTF binário com a animação stop-motion embutida em um único clip.",
  "sprite-metadata": "Grade, retângulos de cada quadro e FPS da animação.",
  manifest: "Este manifesto — leia primeiro.",
  "engine-script": "Script de importação automática para a engine alvo.",
  docs: "Instruções em linguagem natural para humanos e agentes.",
};

export function buildManifest(input: ManifestInput) {
  const files = input.paths.map((path) => {
    const role = roleFor(path, input.maps);
    return { path, role, notes: ROLE_NOTES[role] };
  });

  const anim = input.animation;
  const motion = input.motion3d;

  return {
    $schema: MANIFEST_SCHEMA,
    generator: { name: "Forge3D Asset Studio", pipeline: "browser", version: 1 },
    generatedAt: new Date().toISOString(),
    asset: {
      name: input.name,
      id: input.slug,
      type: input.mode,
      description: input.prompt,
      engineTarget: input.engine,
    },
    styleLock: {
      style: input.style.style,
      view: input.style.view,
      palette: input.style.palette,
      resolution: input.style.resolution,
      detail: input.style.detail,
      notes: input.style.extra || null,
      rule: "Todos os assets deste projeto usam este estilo e este sentido de vista. Ao gerar novos assets, reutilize styleLock sem alterações para manter coerência visual.",
    },
    conventions: {
      colorSpace: { albedo: "sRGB", dataMaps: "linear" },
      alpha: "canal alpha = silhueta; alpha < 0.06 é vazio",
      spritePivot: "bottom-center (pés do personagem no meio da base da célula)",
      spriteReadOrder: "esquerda→direita, topo→base",
      meshUnits: "malha normalizada para 2×2 unidades em X/Y, origem no centro",
      meshUp: "+Y",
      meshFacing: "+Z (frente do relevo aponta para a câmera)",
      meshHandedness: "right-handed (glTF)",
    },
    sprites: anim
      ? {
          sheet: `${input.slug}_sheet.png`,
          columns: anim.columns,
          rows: anim.rows,
          cellWidth: anim.cellWidth,
          cellHeight: anim.cellHeight,
          frameCount: anim.frameCount,
          pivot: "bottom-center",
        }
      : null,
    animations: anim
      ? [
          {
            name: anim.name,
            label: anim.label ?? anim.name,
            fps: anim.fps,
            loop: anim.name !== "death",
            frameCount: anim.frameCount,
            frames: anim.rects,
            frameFiles: Array.from({ length: anim.frameCount }, (_, i) =>
              `frames/${input.slug}_${String(i).padStart(2, "0")}.png`,
            ),
            models3d: motion
              ? Array.from({ length: motion.frameCount }, (_, i) =>
                  `models/frames/${input.slug}_${String(i).padStart(2, "0")}.glb`,
                )
              : [],
          },
        ]
      : [],
    pbr: input.maps.length ? { maps: input.maps, workflow: "metallic-roughness" } : null,
    model3d: input.paths.some((p) => p.endsWith(".glb"))
      ? {
          format: "glb",
          technique: "2.5D relief (alpha = silhueta, luminância = altura)",
          ...(motion
            ? {
                animated: {
                  file: `models/${input.slug}_animated.glb`,
                  clip: anim?.name ?? "motion",
                  technique: "stop-motion: uma malha por quadro, visibilidade por escala",
                  fps: motion.fps,
                  frameCount: motion.frameCount,
                  depth: motion.depth,
                  segments: motion.segments,
                },
              }
            : {}),
        }
      : null,
    usage: {
      unity:
        "Copie a pasta para Assets/Forge3D/<id>/. Sheets: Sprite (Multiple) com a grade de `sprites`; PBR: crie material URP/Lit ligando cada mapa; .glb: importe com glTFast/UnityGLTF.",
      unreal:
        "Execute o script Python incluído (Tools > Execute Python Script) para importar texturas e montar o material; .glb via Interchange/glTF importer.",
      godot:
        "Copie para res://forge3d/<id>/. Use o .tres de material em MeshInstance3D, o SpriteFrames em AnimatedSprite2D e o .glb como cena importada.",
      agentInstructions: [
        "Leia `files[]` e use `role` para decidir o destino de cada arquivo — nunca deduza pelo nome.",
        "Para sprites 2D, monte o atlas com `sprites` (colunas, linhas, célula) e crie um clip por item de `animations` usando `fps` e `loop`.",
        "Para tiles, use os arquivos de role `albedo`/`spritesheet` com pivot `bottom-center` e o tamanho de célula declarado.",
        "Para 3D, prefira `model3d.animated.file` quando existir; caso a engine não aceite o clip, instancie a sequência `animations[].models3d` e troque a visibilidade a `fps`.",
        "Ao pedir novos assets para o Forge3D, repita `styleLock` na íntegra para manter o mesmo estilo e o mesmo sentido de vista.",
      ],
    },
  };
}

export type Manifest = ReturnType<typeof buildManifest>;

export function buildAgentGuide(manifest: Manifest): string {
  const a = manifest.asset;
  const anim = manifest.animations[0];
  return `# ${a.name} — pacote de asset legível por IA

Este pacote foi gerado pelo **Forge3D Asset Studio** e é auto-descritivo:
entregue a pasta inteira (ou só \`forge3d.manifest.json\`) para um agente/IA e ele
tem tudo para inserir os assets no jogo.

- Manifesto: \`forge3d.manifest.json\` (schema \`${manifest.$schema}\`)
- Tipo: \`${a.type}\`${a.engineTarget ? ` · engine alvo: \`${a.engineTarget}\`` : ""}
- Estilo travado: \`${manifest.styleLock.style}\` · vista \`${manifest.styleLock.view}\`
- Prompt de origem: ${a.description}

## Arquivos

${manifest.files.map((f) => `- \`${f.path}\` — **${f.role}**: ${f.notes}`).join("\n")}

## Convenções

- Cor base em sRGB, mapas de dados em linear.
- Pivot de sprite: **bottom-center**; leitura da grade da esquerda para a direita, de cima para baixo.
- Malhas: normalizadas em 2×2 unidades, origem no centro, up \`+Y\`, frente \`+Z\`, right-handed (glTF).
${
  anim
    ? `
## Animação

- Clip \`${anim.name}\` — ${anim.frameCount} quadros a ${anim.fps} FPS, loop: ${anim.loop}.
- Quadros 2D: \`${anim.frameFiles[0] ?? "frames/…"}\` …
${anim.models3d.length ? `- Quadros 3D (stop-motion): \`${anim.models3d[0]}\` … + clip único em \`${manifest.model3d?.animated?.file}\`.` : ""}
`
    : ""
}
## Instruções para o agente

${manifest.usage.agentInstructions.map((line, i) => `${i + 1}. ${line}`).join("\n")}
`;
}
