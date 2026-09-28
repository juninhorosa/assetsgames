import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import {
  base64ToBytes,
  composePrompt,
  findActionOrDefault,
  generatePngBase64,
  resolveProfile,
} from "../generate";
import {
  DEFAULT_SERVER_FRAMING,
  DEFAULT_SHEET_FRAMING,
  bytesToBase64,
  frameAssetPngDetailed,
  frameSpriteSheetPng,
  finishPixelPng,
  shouldFrameMode,
} from "@/lib/server-framing";
import {
  buildMuOnlineMultiPackServer,
  type ServerAssetExport,
} from "@/lib/muonline-export.server";
import { zipSync } from "fflate";


import { DIRECTION_SETS, VIEW_LABELS, type ViewKey } from "@/lib/style-profile";


const MAX_JOBS = 4;

export default defineTool({
  name: "generate_asset",
  title: "Generate game asset",
  description:
    "Generate a game asset (sprite, animated sprite sheet, grid-aligned tileset, PBR texture, UI icon or 3D-ready relief) and save it to a project. Use direction_set to get the same subject and action from 4 or 8 camera directions. Returns the PNGs plus grid, fps and pivot metadata.",
  inputSchema: {
    project_id: z
      .string()
      .uuid()
      .nullable()
      .describe("Project to save into. Null uses the newest project of the user."),
    prompt: z.string().trim().min(3).describe("What to create, e.g. 'stone golem warrior'."),
    mode: z
      .enum(["sprite", "spritesheet", "tileset", "texture", "ui", "model3d"])
      .nullable()
      .describe("Asset mode, default sprite. Use spritesheet for animation."),
    action: z
      .string()
      .nullable()
      .describe("Animation action id from list_capabilities (spritesheet only), e.g. walk."),
    direction_set: z
      .enum(["single", "four", "eight"])
      .nullable()
      .describe("single = project view only; four/eight = generate one asset per direction."),
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
      .describe("Override the camera view for a single-direction generation."),
    model3d_style: z
      .enum(["low-poly", "hand-painted", "pbr-realistic", "toon-cel", "clay-sculpt"])
      .nullable()
      .describe("3D style variation (model3d mode)."),
    ui_kind: z.string().nullable().describe("UI kind, e.g. icon, button, frame (ui mode)."),
    tile_size: z.number().int().min(16).max(64).nullable().describe("Logical tile size in pixels. Default 32."),
    tile_columns: z.number().int().min(3).max(8).nullable().describe("Tileset grid columns. Default 4."),
    tile_rows: z.number().int().min(3).max(8).nullable().describe("Tileset grid rows. Default 4."),
    tileset_kind: z.enum(["terrain", "autotile", "walls", "objects"]).nullable().describe("Tileset category."),
    pixel_grid: z.number().int().min(16).max(256).nullable().describe("Logical pixel-art size per sprite cell. Default 64."),
    palette_size: z.number().int().min(4).max(64).nullable().describe("Maximum colors after pixel cleanup. Default 24."),
    size: z
      .enum(["1024x1024", "1024x1536", "1536x1024"])
      .nullable()
      .describe("Image size, default 1024x1024."),
    frame: z
      .boolean()
      .nullable()
      .describe(
        "Normalize framing: cut out the white background and fit the subject to a fixed square canvas with the same scale and pivot, so every asset has the same size. Default true for sprite/ui/model3d.",
      ),
    frame_size: z
      .number()
      .int()
      .min(64)
      .max(2048)
      .nullable()
      .describe("Side of the normalized square canvas in px. Default 512."),
    target_body_height: z
      .number()
      .int()
      .min(16)
      .max(1024)
      .nullable()
      .describe(
        "Auto-fit the canvas/cell so the character body ends up this tall in px (e.g. 100-110). Overrides frame_size; scale stays identical across actions.",
      ),

    return_images: z
      .boolean()
      .nullable()
      .describe("Include the PNG bytes in the reply. Default true; false returns only URLs."),

    export_format: z
      .enum(["none", "muonline"])
      .nullable()
      .describe(
        "Build an extra download pack. muonline = ZIP base64 with .OZT/.OZJ, per-frame .OZT and anim.json (fps, pivot bottom-center, frame order) ready for the MU Online client.",
      ),

  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const uid = ctx.getUserId();

    let projectId = input.project_id;
    let projectProfile: Record<string, unknown> | null = null;
    if (projectId) {
      const { data, error } = await supabase
        .from("projects")
        .select("id,style_profile")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw new ToolError(error.message);
      if (!data) throw new ToolError("Project not found for this user");
      projectProfile = data.style_profile as Record<string, unknown>;
    } else {
      const { data, error } = await supabase
        .from("projects")
        .select("id,style_profile")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new ToolError(error.message);
      if (!data) throw new ToolError("No project yet — call create_project first");
      projectId = data.id;
      projectProfile = data.style_profile as Record<string, unknown>;
    }

    const profile = resolveProfile({
      style: (projectProfile?.["style"] as string | undefined) ?? null,
      view: input.view ?? ((projectProfile?.["view"] as string | undefined) ?? null),
      palette: (projectProfile?.["palette"] as string | undefined) ?? null,
      detail: (projectProfile?.["detail"] as number | undefined) ?? null,
      extra: (projectProfile?.["extra"] as string | undefined) ?? null,
      pixelGrid: input.pixel_grid ?? ((projectProfile?.["pixelGrid"] as number | undefined) ?? null),
      paletteSize: input.palette_size ?? ((projectProfile?.["paletteSize"] as number | undefined) ?? null),
    });

    const mode = input.mode ?? "sprite";
    const size = input.size ?? "1024x1024";
    const action = mode === "spritesheet" ? findActionOrDefault(input.action) : null;
    const set = DIRECTION_SETS.find((d) => d.id === (input.direction_set ?? "single"));
    const views: (ViewKey | null)[] = set?.views.length ? set.views : [input.view ?? null];
    if (views.length > MAX_JOBS) {
      throw new ToolError(
        `Too many directions for one call (${views.length}). Use direction_set "four" at most, or call once per view.`,
      );
    }

    const results: Record<string, unknown>[] = [];
    const images: { type: "image"; data: string; mimeType: string }[] = [];
    const packAssets: {
      name: string;
      b64: string;
      action: { id: string; fps: number; columns: number; rows: number } | null;
      view: string | null;
    }[] = [];

    for (const view of views) {
      const finalPrompt = composePrompt({
        prompt: input.prompt,
        mode,
        profile,
        action,
        view,
        uiKind: input.ui_kind,
        model3dStyle: input.model3d_style,
        ...(mode === "tileset" ? { tileSize: input.tile_size ?? 32, tileColumns: input.tile_columns ?? 4, tileRows: input.tile_rows ?? 4, tilesetKind: input.tileset_kind ?? "terrain" } : {}),
      });
      const raw = await generatePngBase64(finalPrompt, size);
      const framed = input.frame !== false && shouldFrameMode(mode);
      const targetBody = input.target_body_height ?? null;
      let frameSize = input.frame_size ?? (action ? 128 : DEFAULT_SERVER_FRAMING.canvas);
      let pngBytes = base64ToBytes(raw);
      let sheetInfo: { cell: number; bodyHeight: number; groundLine: number } | null = null;
      if (framed && action) {
        const sheet = frameSpriteSheetPng(pngBytes, {
          ...DEFAULT_SHEET_FRAMING,
          canvas: frameSize,
          ...(targetBody ? { targetBodyHeight: targetBody, minCanvas: 32, maxCanvas: 1024 } : {}),
          columns: action.columns,
          rows: action.rows,
        });
        pngBytes = sheet.png;
        frameSize = sheet.cell;
        sheetInfo = { cell: sheet.cell, bodyHeight: sheet.bodyHeight, groundLine: sheet.groundLine };
      } else if (framed) {
        const out = frameAssetPngDetailed(pngBytes, {
          ...DEFAULT_SERVER_FRAMING,
          canvas: frameSize,
          ...(targetBody ? { targetBodyHeight: targetBody, maxCanvas: 2048 } : {}),
        });
        pngBytes = out.png;
        frameSize = out.canvas;
      }

      if (mode === "tileset" || profile.style === "pixel-art" || profile.style === "tibia-retro") {
        const cols = input.tile_columns ?? 4;
        const rows = input.tile_rows ?? 4;
        const tile = input.tile_size ?? 32;
        const logical = input.pixel_grid ?? profile.pixelGrid ?? 64;
        const targetWidth = mode === "tileset" ? cols * tile : action ? action.columns * logical : logical;
        const targetHeight = mode === "tileset" ? rows * tile : action ? action.rows * logical : logical;
        pngBytes = finishPixelPng(pngBytes, targetWidth, targetHeight, input.palette_size ?? profile.paletteSize ?? 24);
      }

      const pixelFinished = mode === "tileset" || profile.style === "pixel-art" || profile.style === "tibia-retro";
      const b64 = framed || pixelFinished ? bytesToBase64(pngBytes) : raw;

      const viewLabel = view ? VIEW_LABELS[view] : null;
      const name = [
        input.prompt.slice(0, 40),
        action ? action.label : null,
        viewLabel,
      ]
        .filter(Boolean)
        .join(" — ");

      packAssets.push({
        name,
        b64,
        action: action ? { id: action.id, fps: action.fps, columns: action.columns, rows: action.rows } : null,
        view: view ?? profile.view,
      });

      const { data: asset, error } = await supabase
        .from("assets")
        .insert({
          project_id: projectId,
          user_id: uid,
          name,
          asset_type: mode,
          prompt: input.prompt,
          final_prompt: finalPrompt,
          params: {
            mode,
            size,
            view: view ?? profile.view,
            ...(action ? { animation: action.id, columns: action.columns, rows: action.rows } : {}),
            ...(input.model3d_style ? { model3dStyle: input.model3d_style } : {}),
            ...(input.ui_kind ? { uiKind: input.ui_kind } : {}),
            ...(mode === "tileset" ? { tileSize: input.tile_size ?? 32, tileColumns: input.tile_columns ?? 4, tileRows: input.tile_rows ?? 4, tilesetKind: input.tileset_kind ?? "terrain" } : {}),
            ...(framed ? { framed: true, frameSize, pivot: "bottom-center" } : {}),
            ...(sheetInfo ? { cellSize: sheetInfo.cell, bodyHeight: sheetInfo.bodyHeight, groundLine: sheetInfo.groundLine } : {}),

            source: "mcp",
          } as unknown as never,
          metadata: { frameCount: action ? action.columns * action.rows : 0 } as unknown as never,
        })
        .select("id")
        .single();
      if (error) throw new ToolError(error.message);

      const assetId = (asset as { id: string }).id;
      const path = `${uid}/${projectId}/${assetId}/source.png`;
      const { error: upErr } = await supabase.storage
        .from("assets")
        .upload(path, pngBytes, { contentType: "image/png", upsert: true });

      if (upErr) throw new ToolError(upErr.message);
      await supabase.from("assets").update({ storage_path: path }).eq("id", assetId);

      if (action) {
        await supabase.from("animations").insert({
          asset_id: assetId,
          user_id: uid,
          name: view ? `${action.id}_${view}` : action.id,
          fps: action.fps,
          frame_data: { columns: action.columns, rows: action.rows } as unknown as never,
        });
      }

      const signed = await supabase.storage.from("assets").createSignedUrl(path, 3600);

      results.push({
        asset_id: assetId,
        name,
        mode,
        view: view ?? profile.view,
        action: action?.id ?? null,
        ...(action
          ? {
              grid: { columns: action.columns, rows: action.rows },
              fps: action.fps,
              pivot: "bottom-center",
              read_order: "left-to-right, top-to-bottom",
            }
          : {}),
        ...(mode === "tileset" ? { grid: { columns: input.tile_columns ?? 4, rows: input.tile_rows ?? 4 }, tile_size: input.tile_size ?? 32, tileset_kind: input.tileset_kind ?? "terrain", read_order: "left-to-right, top-to-bottom" } : {}),
        ...(framed
          ? { framed: true, canvas: { width: frameSize, height: frameSize }, pivot: "bottom-center" }
          : {}),
        ...(sheetInfo
          ? {
              cell: { width: sheetInfo.cell, height: sheetInfo.cell },
              body_height: sheetInfo.bodyHeight,
              ground_line: sheetInfo.groundLine,
            }
          : {}),

        download_url: signed.data?.signedUrl ?? null,
        prompt: finalPrompt,
      });

      if (input.return_images !== false) {
        images.push({ type: "image", data: b64, mimeType: "image/png" });
      }
    }

    let muonline: { zipBase64: string; fileCount: number } | undefined;
    if (input.export_format === "muonline" && packAssets.length) {
      const assets: ServerAssetExport[] = packAssets.map((a) => ({
        name: a.name,
        mode,
        style: profile as unknown as never,
        prompt: input.prompt,
        image: `data:image/png;base64,${a.b64}`,
        animation: a.action
          ? { name: a.action.id, fps: a.action.fps, columns: a.action.columns, rows: a.action.rows }
          : undefined,
      }));
      const files = await buildMuOnlineMultiPackServer(assets);
      const zipped = zipSync(files, { level: 6 }) as Uint8Array;
      muonline = { zipBase64: bytesToBase64(zipped), fileCount: Object.keys(files).length };
    }

    const payload = {
      project_id: projectId,
      style_lock: profile,
      results,
      ...(muonline ? { export: { format: "muonline", ...muonline } } : {}),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }, ...images],
      structuredContent: payload,
    };
  },
});
