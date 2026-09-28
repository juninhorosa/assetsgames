import { createFileRoute } from "@tanstack/react-router";
import {
  ANIMATION_ACTIONS,
  DIRECTION_SETS,
  MODE_LABELS,
  MODEL3D_STYLES,
  STYLE_LABELS,
  VIEW_LABELS,
  DEFAULT_STYLE_PROFILE,
} from "@/lib/style-profile";

/**
 * Manifesto de capacidades — endpoint de descoberta para agentes/IAs.
 * GET público (somente leitura, sem dados de usuário).
 */
export const Route = createFileRoute("/api/public/forge3d/capabilities")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            $schema: "forge3d.capabilities/1",
            generate: {
              url: "/api/public/forge3d/generate",
              method: "POST",
              auth: "header x-forge3d-key: <FORGE3D_API_KEY>",
              maxJobsPerRequest: 8,
              body: {
                prompt: "string (obrigatório) — descrição do personagem/asset",
                mode: Object.keys(MODE_LABELS),
                style: Object.keys(STYLE_LABELS),
                view: Object.keys(VIEW_LABELS),
                directionSet: DIRECTION_SETS.map((d) => d.id),
                actions: ANIMATION_ACTIONS.map((a) => a.id),
                model3dStyle: MODEL3D_STYLES.map((s) => s.id),
                palette: "string",
                detail: "1..10",
                extra: "string — notas de direção de arte",
                size: "1024x1024 | 1024x1536 | 1536x1024",
                tileSize: "16 | 32 | 48 | 64 (modo tileset)",
                tileColumns: "3..8 (modo tileset)",
                tileRows: "3..8 (modo tileset)",
                tilesetKind: "terrain | autotile | walls | objects",
                pixelGrid: "16..256 — resolução lógica por célula pixel-art",
                paletteSize: "4..64 — limite de cores no acabamento pixel",
                exportFormat: "none | muonline — muonline devolve um ZIP base64 com .OZT/.OZJ, frames e anim.json",
              },
              response:
                "{ results: [{ mode, action, view, prompt, image (data URL png), grid?, fps? }], export?: { format: 'muonline', zipBase64, fileCount } }",
            },
            muonline: {
              description:
                "Exportação MU Online (cliente Webzen/MuEmu/OpenMU). Gera .OZT (TGA + 4 bytes) e .OZJ (JPEG + 24 bytes), frames por movimento e anim.json com fps, pivô bottom-center e ordem dos frames.",
              files: ["Data/Object/Forge3D/<id>.OZT", "<id>.OZJ", "frames/*.OZT", "<id>.anim.json", "raw/<id>.tga", "README_MUONLINE.md"],
            },
            modes: Object.entries(MODE_LABELS).map(([id, label]) => ({ id, label })),
            styles: Object.entries(STYLE_LABELS).map(([id, label]) => ({ id, label })),
            views: Object.entries(VIEW_LABELS).map(([id, label]) => ({ id, label })),
            directionSets: DIRECTION_SETS,
            actions: ANIMATION_ACTIONS.map((a) => ({
              id: a.id,
              label: a.label,
              columns: a.columns,
              rows: a.rows,
              fps: a.fps,
            })),
            model3dStyles: MODEL3D_STYLES.map((s) => ({ id: s.id, label: s.label, hint: s.hint })),
            defaults: DEFAULT_STYLE_PROFILE,
            conventions: {
              spritePivot: "bottom-center",
              spriteReadOrder: "esquerda→direita, topo→base",
              background: "branco puro (recortar alpha no cliente)",
              pixelFinish: "Pixel Art, Tibia e tilesets recebem grade lógica, alpha binário e paleta limitada.",
              tileset: "Tiles alinhados sem margem, lidos da esquerda para a direita e de cima para baixo.",
            },
          },
          { headers: { "Cache-Control": "public, max-age=300" } },
        ),
    },
  },
});
