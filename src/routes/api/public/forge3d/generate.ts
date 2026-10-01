import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  ANIMATION_ACTIONS,
  DEFAULT_STYLE_PROFILE,
  buildPrompt,
  findDirectionSet,
  type StyleKey,
  type ViewKey,
  type AssetMode,
  type Model3dStyleKey,
  type StyleProfile,
} from "@/lib/style-profile";
import { estimateCredits } from "@/lib/pricing";
import {
  buildMuOnlineMultiPackServer,
  type ServerAssetExport,
} from "@/lib/muonline-export.server";
import {
  DEFAULT_SERVER_FRAMING,
  DEFAULT_SHEET_FRAMING,
  base64ToBytes,
  bytesToBase64,
  frameAssetPngDetailed,
  frameSpriteSheetPng,
  finishPixelPng,
  shouldFrameMode,
} from "@/lib/server-framing";


const MAX_JOBS = 8;

const BodySchema = z.object({
  prompt: z.string().min(3),
  mode: z
    .enum(["sprite", "spritesheet", "tileset", "texture", "ui", "model3d"])
    .default("sprite"),
  style: z.enum(["pixel-art", "tibia-retro", "low-poly", "stylized", "pbr-realistic"]).nullable().default(null),
  view: z
    .enum([
      "side-right",
      "side-left",
      "front",
      "back",
      "three-quarter",
      "three-quarter-back",
      "top-down",
      "isometric",
    ])
    .nullable()
    .default(null),
  directionSet: z.enum(["single", "four", "eight"]).default("single"),
  actions: z.array(z.string()).default([]),
  model3dStyle: z
    .enum(["low-poly", "hand-painted", "pbr-realistic", "toon-cel", "clay-sculpt"])
    .nullable()
    .default(null),
  palette: z.string().nullable().default(null),
  detail: z.number().min(1).max(10).nullable().default(null),
  extra: z.string().nullable().default(null),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).default("1024x1024"),
  uiKind: z.string().nullable().default(null),
  tileSize: z.number().int().min(16).max(64).default(32),
  tileColumns: z.number().int().min(3).max(8).default(4),
  tileRows: z.number().int().min(3).max(8).default(4),
  tilesetKind: z.enum(["terrain", "autotile", "walls", "objects"]).default("terrain"),
  pixelGrid: z.number().int().min(16).max(256).default(64),
  paletteSize: z.number().int().min(4).max(64).default(24),
  /** Enquadramento normalizado: fundo removido, escala/pivô fixos, tela quadrada. */
  frame: z.boolean().default(true),
  frameSize: z.number().int().min(64).max(2048).default(512),
  /** Lado da célula (px) do sprite sheet normalizado. */
  cellSize: z.number().int().min(32).max(512).default(128),
  /** Altura alvo do corpo na tela (px). Auto-ajusta frameSize/cellSize. */
  targetBodyHeight: z.number().int().min(16).max(1024).nullable().default(null),
  /**
   * Formato de exportação do pacote final. "muonline" devolve, além dos PNGs,
   * um ZIP base64 com .OZT/.OZJ, frames e anim.json prontos para o cliente MU.
   */
  exportFormat: z.enum(["none", "muonline"]).default("none"),


});

/** Baixa a imagem gerada e devolve os bytes PNG. */
async function toPngBytes(image: string): Promise<Uint8Array> {
  if (image.startsWith("data:")) return base64ToBytes(image.split(",")[1] ?? "");
  const res = await fetch(image);
  return new Uint8Array(await res.arrayBuffer());
}

async function generateImage(prompt: string, size: string, _key: string): Promise<string> {
  const { generateImageB64 } = await import("@/lib/image-providers.server");
  return `data:image/png;base64,${await generateImageB64(prompt, size)}`;
}

/**
 * Endpoint público para agentes/IAs gerarem assets direto.
 * Autenticação por `x-forge3d-key` com as chaves criadas em /app/settings/keys
 * (comparação por hash SHA-256; chaves revogadas são rejeitadas).
 */
export const Route = createFileRoute("/api/public/forge3d/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-forge3d-key") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const { verifyApiKey, trackApiKeyUsage, recordApiRun } = await import("@/lib/api-keys.server");
        const legacy = process.env["FORGE3D_API_KEY"];
        const verified = await verifyApiKey(provided);
        const legacyOk = !!legacy && provided === legacy;
        if (!verified && !legacyOk) return new Response("Chave inválida", { status: 401 });


        const { spendGuardResponse } = await import("@/lib/spend-guard.server");
        const guardBlocked = await spendGuardResponse(1, { publicApi: true });
        if (guardBlocked) return guardBlocked;

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("LOVABLE_API_KEY ausente", { status: 500 });

        const parsed = BodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Body inválido", issues: parsed.error.issues }, { status: 400 });
        }
        const b = parsed.data;

        const profile = {
          style: (b.style ?? DEFAULT_STYLE_PROFILE.style) as StyleKey,
          view: (b.view ?? DEFAULT_STYLE_PROFILE.view) as ViewKey,
          palette: b.palette ?? DEFAULT_STYLE_PROFILE.palette,
          resolution: DEFAULT_STYLE_PROFILE.resolution,
          detail: b.detail ?? DEFAULT_STYLE_PROFILE.detail,
          extra: b.extra ?? "",
          pixelGrid: b.pixelGrid,
          paletteSize: b.paletteSize,
        };

        const views = findDirectionSet(b.directionSet).views;
        const viewList: (ViewKey | undefined)[] = views.length ? views : [undefined];

        const actions =
          b.mode === "spritesheet"
            ? ANIMATION_ACTIONS.filter((a) =>
                b.actions.length ? b.actions.includes(a.id) : a.id === "idle",
              )
            : [null];

        const jobs = actions.flatMap((action) => viewList.map((view) => ({ action, view })));
        if (jobs.length > MAX_JOBS) {
          return Response.json(
            { error: `Máximo de ${MAX_JOBS} jobs por requisição (pedido: ${jobs.length})` },
            { status: 400 },
          );
        }

        const results: unknown[] = [];
        const startedAt = Date.now();
        try {
          for (const { action, view } of jobs) {
            const finalPrompt = buildPrompt(b.prompt, profile, {
              mode: b.mode as AssetMode,
              ...(action ? { animation: action.id, columns: action.columns, rows: action.rows } : {}),
              ...(b.uiKind ? { uiKind: b.uiKind } : {}),
              ...(b.model3dStyle ? { model3dStyle: b.model3dStyle as Model3dStyleKey } : {}),
              ...(b.mode === "tileset" ? { tileSize: b.tileSize, tileColumns: b.tileColumns, tileRows: b.tileRows, tilesetKind: b.tilesetKind } : {}),
              ...(view ? { view } : {}),
            });
            const image = await generateImage(finalPrompt, b.size, key);
            const framed = b.frame && shouldFrameMode(b.mode);
            const targetBody = b.targetBodyHeight;
            let finalImage = image;
            let canvasSize = b.frameSize;
            let bodyHeight: number | null = null;
            let sheet: { cell: number; bodyHeight: number; groundLine: number } | null = null;
            if (framed && action) {
              const out = frameSpriteSheetPng(await toPngBytes(image), {
                ...DEFAULT_SHEET_FRAMING,
                canvas: b.cellSize,
                ...(targetBody
                  ? { targetBodyHeight: targetBody, minCanvas: 32, maxCanvas: 1024 }
                  : {}),
                columns: action.columns,
                rows: action.rows,
              });
              sheet = { cell: out.cell, bodyHeight: out.bodyHeight, groundLine: out.groundLine };
              finalImage = `data:image/png;base64,${bytesToBase64(out.png)}`;
            } else if (framed) {
              const out = frameAssetPngDetailed(await toPngBytes(image), {
                ...DEFAULT_SERVER_FRAMING,
                canvas: b.frameSize,
                ...(targetBody ? { targetBodyHeight: targetBody, maxCanvas: 2048 } : {}),
              });
              canvasSize = out.canvas;
              bodyHeight = out.bodyHeight;
              finalImage = `data:image/png;base64,${bytesToBase64(out.png)}`;
            }
            if (b.mode === "tileset" || profile.style === "pixel-art" || profile.style === "tibia-retro") {
              const targetWidth = b.mode === "tileset" ? b.tileColumns * b.tileSize : action ? action.columns * b.pixelGrid : b.pixelGrid;
              const targetHeight = b.mode === "tileset" ? b.tileRows * b.tileSize : action ? action.rows * b.pixelGrid : b.pixelGrid;
              const pixelBytes = finishPixelPng(await toPngBytes(finalImage), targetWidth, targetHeight, b.paletteSize);
              finalImage = `data:image/png;base64,${bytesToBase64(pixelBytes)}`;
            }
            results.push({
              mode: b.mode,
              action: action?.id ?? null,
              view: view ?? profile.view,
              prompt: finalPrompt,
              image: finalImage,
              ...(framed && !sheet
                ? {
                    framed: true,
                    canvas: { width: canvasSize, height: canvasSize },
                    ...(bodyHeight ? { bodyHeight } : {}),
                    pivot: "bottom-center",
                  }
                : {}),

              ...(sheet
                ? {
                    framed: true,
                    cell: { width: sheet.cell, height: sheet.cell },
                    bodyHeight: sheet.bodyHeight,
                    groundLine: sheet.groundLine,
                    pivot: "bottom-center",
                  }
                : {}),
              ...(action
                ? {
                    grid: { columns: action.columns, rows: action.rows },
                    fps: action.fps,
                    pivot: "bottom-center",
                    readOrder: "left-to-right, top-to-bottom",
                  }
                : {}),
              ...(b.mode === "tileset" ? { grid: { columns: b.tileColumns, rows: b.tileRows }, tileSize: b.tileSize, tilesetKind: b.tilesetKind, readOrder: "left-to-right, top-to-bottom" } : {}),
            });

          }
        } catch (e) {
          const err = e as Error & { status?: number };
          if (verified) {
            const credits = results.length
              ? estimateCredits({ images: results.length, size: b.size, mode: b.mode })
              : 0;
            if (results.length) await trackApiKeyUsage(verified.id, credits);
            else await trackApiKeyUsage(verified.id, 0);
            await recordApiRun({
              userId: verified.userId,
              apiKeyId: verified.id,
              kind: b.mode === "model3d" ? "model3d" : "image",
              mode: b.mode,
              view: profile.view,
              size: b.size,
              status: "error",
              credits,
              durationMs: Date.now() - startedAt,
              prompt: b.prompt,
              error: err.message.slice(0, 500),
              meta: { images: results.length, jobs: jobs.length },
            });
          }
          return Response.json(
            { error: err.message, partial: results },
            { status: err.status ?? 500 },
          );
        }

        if (verified) {
          const credits = estimateCredits({
            images: results.length,
            size: b.size,
            mode: b.mode,
          });
          await trackApiKeyUsage(verified.id, credits);
          await recordApiRun({
            userId: verified.userId,
            apiKeyId: verified.id,
            kind: b.mode === "model3d" ? "model3d" : "image",
            mode: b.mode,
            view: profile.view,
            size: b.size,
            status: "success",
            credits,
            durationMs: Date.now() - startedAt,
            prompt: b.prompt,
            meta: { images: results.length, jobs: jobs.length },
          });
        }

        let muonline: { zipBase64: string; fileCount: number } | undefined;
        if (b.exportFormat === "muonline" && results.length) {
          const assets: ServerAssetExport[] = results.map((r) => {
            const rr = r as {
              mode?: string;
              action?: string | null;
              view?: string | null;
              prompt?: string;
              image?: string;
              grid?: { columns: number; rows: number } | null;
              fps?: number | null;
            };
            return {
              name: [b.prompt, rr.action, rr.view].filter(Boolean).join(" — "),
              mode: b.mode,
              style: profile as unknown as StyleProfile,
              prompt: b.prompt,
              image: rr.image ?? "",
              animation:
                rr.grid && rr.action
                  ? {
                      name: rr.action,
                      fps: rr.fps ?? 12,
                      columns: rr.grid.columns,
                      rows: rr.grid.rows,
                    }
                  : undefined,
            };
          });
          const { zipSync } = await import("fflate");
          const files = await buildMuOnlineMultiPackServer(assets);
          const zipped = zipSync(files, { level: 6 }) as Uint8Array;
          muonline = { zipBase64: bytesToBase64(zipped), fileCount: Object.keys(files).length };
        }

        return Response.json({
          styleLock: profile,
          count: results.length,
          results,
          ...(muonline ? { export: { format: "muonline", ...muonline } } : {}),
        });

      },
    },
  },
});
