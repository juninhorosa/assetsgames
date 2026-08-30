import { zipSync, strToU8 } from "fflate";

import { fetchAsset, signedUrl, type AssetRow } from "./assets-repo";
import {
  buildEngineFiles,
  slugify,
  type AssetExport,
  type Engine,
  ENGINE_LABELS,
} from "./engine-export";
import type { MapType } from "./image-pipeline";
import { DEFAULT_STYLE_PROFILE, MODE_LABELS, type StyleProfile } from "./style-profile";

/** Converte um caminho de storage num data URL utilizável pelo empacotador. */
async function pathToDataUrl(path: string): Promise<string | null> {
  const url = await signedUrl(path);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha a ler o ficheiro do asset"));
    reader.readAsDataURL(blob);
  });
}

export interface LibraryExportProgress {
  done: number;
  total: number;
  current: string;
}

/**
 * Empacota vários assets da biblioteca num único ZIP, uma pasta por asset,
 * cada uma com as texturas, metadata e scripts de importação da engine
 * escolhida (`engine === null` → pacote para IA com todos os scripts).
 */
export async function buildLibraryZip(
  assets: AssetRow[],
  style: StyleProfile,
  engine: Engine | null | "muonline",
  onProgress?: (p: LibraryExportProgress) => void,
): Promise<{ blob: Blob; included: number; skipped: string[] }> {
  const files: Record<string, Uint8Array> = {};
  const skipped: string[] = [];
  const used = new Set<string>();
  let included = 0;

  for (let i = 0; i < assets.length; i++) {
    const row = assets[i]!;
    onProgress?.({ done: i, total: assets.length, current: row.name });

    try {
      const { asset, maps, animations } = await fetchAsset(row.id);
      if (!asset.storage_path) {
        skipped.push(row.name);
        continue;
      }
      const image = await pathToDataUrl(asset.storage_path);
      if (!image) {
        skipped.push(row.name);
        continue;
      }

      const mapEntries: Partial<Record<MapType, string>> = {};
      for (const map of maps) {
        const dataUrl = await pathToDataUrl(map.storage_path);
        if (dataUrl) mapEntries[map.map_type] = dataUrl;
      }

      const anim = animations[0];
      const rects = anim?.frame_data?.rects ?? [];
      const exportInput: AssetExport = {
        name: asset.name,
        mode: asset.asset_type,
        style: (row.params?.["style"] as StyleProfile) ?? style ?? DEFAULT_STYLE_PROFILE,
        prompt: asset.final_prompt ?? asset.prompt,
        image,
        maps: Object.keys(mapEntries).length ? mapEntries : undefined,
        frameRects: rects.length ? rects : undefined,
        animation: anim
          ? {
              name: anim.name,
              fps: anim.fps,
              columns: anim.frame_data?.columns ?? 1,
              rows: anim.frame_data?.rows ?? 1,
            }
          : undefined,
      };

      let folder = slugify(asset.name);
      let n = 2;
      while (used.has(folder)) folder = `${slugify(asset.name)}_${n++}`;
      used.add(folder);

      const built =
        engine === "muonline"
          ? await (await import("./muonline-export")).buildMuOnlineFiles(exportInput)
          : buildEngineFiles(exportInput, engine);
      for (const [path, bytes] of Object.entries(built)) {
        files[`${folder}/${path}`] = bytes;
      }
      included++;
    } catch {
      skipped.push(row.name);
    }
  }

  files["biblioteca.json"] = strToU8(
    JSON.stringify(
      {
        generator: "Forge3D Asset Studio",
        engine: engine ? ENGINE_LABELS[engine] : "engine-agnostic (pacote para IA)",
        exportedAt: new Date().toISOString(),
        assets: assets.map((a) => ({
          name: a.name,
          type: MODE_LABELS[a.asset_type] ?? a.asset_type,
          folder: slugify(a.name),
          createdAt: a.created_at,
        })),
      },
      null,
      2,
    ),
  );

  onProgress?.({ done: assets.length, total: assets.length, current: "" });
  const zipped = zipSync(files, { level: 6 });
  return {
    blob: new Blob([zipped as unknown as BlobPart], { type: "application/zip" }),
    included,
    skipped,
  };
}
