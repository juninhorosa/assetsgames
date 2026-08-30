/**
 * Exportação MU Online (OZT/OZJ) no servidor — sem Canvas/DOM.
 *
 * Usa UPNG.js (descodificador PNG puro-JS) para obter RGBA e jpeg-js para o
 * OZJ. Gera o mesmo pacote que o módulo de browser (`muonline-export.ts`):
 * .OZT (TGA + 4 bytes), .OZJ (JPEG + 24 bytes), frames por movimento e
 * `anim.json` com fps, pivô e ordem dos frames.
 */
import UPNG from "upng-js";
import { encode as jpegEncode } from "jpeg-js";
import { zipSync, strToU8 } from "fflate";
import { dataUrlToBytes, type FrameRect, type MapType } from "./image-pipeline";
import type { AssetMode, StyleProfile } from "./style-profile";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "asset"
  );
}

const OZT_HEADER = 4;
const OZJ_HEADER = 24;

export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface ServerAssetExport {
  name: string;
  mode: AssetMode;
  style: StyleProfile;
  prompt: string;
  image: string;
  maps?: Partial<Record<MapType, string>> | undefined;
  frames?: string[] | undefined;
  frameRects?: FrameRect[] | undefined;
  animation?:
    | { name: string; label?: string | undefined; fps: number; columns: number; rows: number }
    | undefined;
  motion3d?:
    | { fps: number; frameCount: number; depth: number; segments: number; style?: string | undefined }
    | undefined;
}

/** Descodifica PNG (bytes) em RGBA. */
export function pngBytesToRgba(png: Uint8Array): Rgba {
  const decoded = UPNG.decode(png);
  const frames = UPNG.toRGBA8(decoded) as ArrayBuffer[];
  const buf = frames[0] ?? new ArrayBuffer(0);
  return { width: decoded.width, height: decoded.height, data: new Uint8Array(buf) };
}

/** TGA 32 bits sem compressão, origem no canto superior esquerdo (BGRA). */
export function writeTga({ width, height, data }: Rgba): Uint8Array {
  const out = new Uint8Array(18 + width * height * 4);
  out[2] = 2; // truecolor sem RLE
  out[12] = width & 0xff;
  out[13] = (width >> 8) & 0xff;
  out[14] = height & 0xff;
  out[15] = (height >> 8) & 0xff;
  out[16] = 32; // bits por pixel
  out[17] = 0x28; // 8 bits de alpha + origem em cima
  for (let i = 0, o = 18; i < data.length; i += 4, o += 4) {
    out[o] = data[i + 2]!; // B
    out[o + 1] = data[i + 1]!; // G
    out[o + 2] = data[i]!; // R
    out[o + 3] = data[i + 3]!; // A
  }
  return out;
}

function withJunkHeader(payload: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size + payload.length);
  for (let i = 0; i < size; i++) out[i] = payload[i % payload.length] ?? 0;
  out.set(payload, size);
  return out;
}

/** Converte PNG (data URL) num ficheiro .OZT do MU Online. */
export async function dataUrlToOztServer(dataUrl: string): Promise<Uint8Array> {
  const rgba = pngBytesToRgba(dataUrlToBytes(dataUrl));
  return withJunkHeader(writeTga(rgba), OZT_HEADER);
}

/** Converte PNG (data URL) num ficheiro .OZJ (JPEG + 24 bytes) do MU Online. */
export async function dataUrlToOzjServer(
  dataUrl: string,
  background: [number, number, number] = [0, 0, 0],
): Promise<Uint8Array> {
  const rgba = pngBytesToRgba(dataUrlToBytes(dataUrl));
  // Composta sobre um fundo opaco para o JPEG (sem alpha).
  const flat = new Uint8Array(rgba.data.length);
  for (let i = 0; i < rgba.data.length; i += 4) {
    const a = rgba.data[i + 3]! / 255;
    flat[i] = Math.round(rgba.data[i]! * a + background[0] * (1 - a));
    flat[i + 1] = Math.round(rgba.data[i + 1]! * a + background[1] * (1 - a));
    flat[i + 2] = Math.round(rgba.data[i + 2]! * a + background[2] * (1 - a));
    flat[i + 3] = 255;
  }
  const jpeg = jpegEncode(
    { data: flat, width: rgba.width, height: rgba.height },
    0.92,
  );
  return withJunkHeader(jpeg.data as Uint8Array, OZJ_HEADER);
}

/**
 * Recorta uma sprite sheet em frames RGBA (um por célula), da esquerda para a
 * direita, de cima para baixo. Devolve os rects também.
 */
export function splitSheetServer(
  rgba: Rgba,
  columns: number,
  rows: number,
): { frames: Rgba[]; rects: FrameRect[] } {
  const cellW = Math.floor(rgba.width / columns);
  const cellH = Math.floor(rgba.height / rows);
  const frames: Rgba[] = [];
  const rects: FrameRect[] = [];
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = col * cellW;
      const y = row * cellH;
      const cell = new Uint8Array(cellW * cellH * 4);
      for (let r = 0; r < cellH; r++) {
        const src = ((y + r) * rgba.width + x) * 4;
        cell.set(rgba.data.subarray(src, src + cellW * 4), r * cellW * 4);
      }
      frames.push({ width: cellW, height: cellH, data: cell });
      rects.push({ index, x, y, w: cellW, h: cellH });
      index++;
    }
  }
  return { frames, rects };
}

function readme(asset: ServerAssetExport, id: string, frameCount: number): string {
  const anim = asset.animation;
  return `# ${asset.name} — MU Online (OZT/OZJ)

Gerado pelo Forge3D Asset Studio (API/MCP).

- Tipo: ${asset.mode}
- Estilo: ${asset.style.style}
- Prompt: ${asset.prompt}

## O que vem no pacote

- \`Data/Object/Forge3D/${id}.OZT\` — textura principal com transparência (TGA + 4 bytes de cabeçalho).
- \`Data/Object/Forge3D/${id}.OZJ\` — a mesma textura sem alpha (JPEG + 24 bytes de cabeçalho), para superfícies opacas.
- \`Data/Object/Forge3D/frames/\` — ${frameCount} frame(s) do movimento em OZT, um por pose.
- \`Data/Object/Forge3D/${id}.anim.json\` — fps, pivô, ordem dos frames e grelha da sprite sheet.
- \`raw/${id}.tga\` — TGA puro, para abrir no editor antes de converter.

## Como usar no cliente

1. Copie a pasta \`Data\` para a raiz do cliente (junta-se ao \`Data\` existente).
2. Aponte a textura do modelo (BMD) para \`Object/Forge3D/${id}.OZT\`.
3. Para movimento detalhado, cada ação do BMD usa a sequência em \`frames/\` na ordem do \`anim.json\`${
    anim ? ` (${anim.name}, ${anim.fps} fps, grelha ${anim.columns}×${anim.rows})` : ""
  }.
4. Mantenha o pivô em bottom-center: é o alinhamento usado na geração, o que evita o personagem "flutuar" entre poses.

## Notas

- OZT/OZJ não são encriptados: são apenas o formato original com bytes extra à frente. Qualquer conversor (ex.: OZTtoTGA) funciona.
- Texturas do cliente antigo preferem lados potência de dois (128, 256, 512). Os assets já saem quadrados e normalizados.
`;
}

/**
 * Constrói o mapa de ficheiros do pacote MU Online no servidor.
 * Se o asset for uma sprite sheet sem `frames` já recortados, recorta a grelha
 * automaticamente a partir da imagem principal.
 */
/**
 * Constrói os ficheiros de um único asset (sem README) com um id explícito,
 * para que vários assets possam partilhar o mesmo ZIP sem colisão de chaves.
 */
async function buildAssetFilesServer(
  asset: ServerAssetExport,
  id: string,
): Promise<{ files: Record<string, Uint8Array>; frameCount: number }> {
  const files: Record<string, Uint8Array> = {};
  const base = `Data/Object/Forge3D`;

  const rgba = pngBytesToRgba(dataUrlToBytes(asset.image));
  files[`${base}/${id}.OZT`] = withJunkHeader(writeTga(rgba), OZT_HEADER);
  files[`${base}/${id}.OZJ`] = await dataUrlToOzjServer(asset.image);
  files[`raw/${id}.tga`] = writeTga(rgba);

  for (const [map, dataUrl] of Object.entries(asset.maps ?? {})) {
    if (!dataUrl || map === "albedo") continue;
    files[`${base}/${id}_${map}.OZT`] = await dataUrlToOztServer(dataUrl);
  }

  // Frames: usa os fornecidos ou recorta a grelha da imagem principal.
  let frameRgbaList: Rgba[] = [];
  let frameRects: FrameRect[] = asset.frameRects ?? [];
  if (asset.frames && asset.frames.length) {
    frameRgbaList = asset.frames.map((f) => pngBytesToRgba(dataUrlToBytes(f)));
  } else if (asset.animation) {
    const split = splitSheetServer(rgba, asset.animation.columns, asset.animation.rows);
    frameRgbaList = split.frames;
    frameRects = split.rects;
  }

  const frameNames: string[] = [];
  for (let i = 0; i < frameRgbaList.length; i++) {
    const name = `${id}_${asset.animation?.name ?? "pose"}_${String(i).padStart(2, "0")}.OZT`;
    files[`${base}/frames/${name}`] = withJunkHeader(writeTga(frameRgbaList[i]!), OZT_HEADER);
    frameNames.push(`frames/${name}`);
  }

  files[`${base}/${id}.anim.json`] = strToU8(
    JSON.stringify(
      {
        generator: "Forge3D Asset Studio",
        source: "api",
        client: "MU Online",
        name: asset.name,
        slug: id,
        texture: `${id}.OZT`,
        textureOpaque: `${id}.OZJ`,
        pivot: "bottom-center",
        sheet: asset.animation
          ? {
              columns: asset.animation.columns,
              rows: asset.animation.rows,
              cellWidth: frameRects[0]?.w ?? 0,
              cellHeight: frameRects[0]?.h ?? 0,
            }
          : null,
        animation: asset.animation
          ? {
              action: asset.animation.name,
              label: asset.animation.label ?? asset.animation.name,
              fps: asset.animation.fps,
              loop: true,
              frameCount: frameNames.length,
              frames: frameNames,
              rects: frameRects,
            }
          : null,
        motion3d: asset.motion3d ?? null,
      },
      null,
      2,
    ),
  );

  return { files, frameCount: frameNames.length };
}

/**
 * Constrói o mapa de ficheiros do pacote MU Online no servidor.
 * Se o asset for uma sprite sheet sem `frames` já recortados, recorta a grelha
 * automaticamente a partir da imagem principal.
 */
export async function buildMuOnlineFilesServer(
  asset: ServerAssetExport,
): Promise<Record<string, Uint8Array>> {
  const id = slugify(asset.name);
  const { files, frameCount } = await buildAssetFilesServer(asset, id);
  files["README_MUONLINE.md"] = strToU8(readme(asset, id, frameCount));
  return files;
}

/**
 * Pacote MU Online combinando vários assets (várias direções/ações) num único
 * ZIP. Cada asset fica com o seu próprio id (slug único por nome) e o seu
 * próprio `anim.json`; o README e um `manifest.json` global são escritos uma vez.
 */
export async function buildMuOnlineMultiPackServer(
  assets: ServerAssetExport[],
): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  const usedIds = new Set<string>();
  const manifest: unknown[] = [];
  for (const asset of assets) {
    let id = slugify(asset.name);
    if (usedIds.has(id)) id = `${id}_${usedIds.size}`;
    usedIds.add(id);
    const { files: assetFiles, frameCount } = await buildAssetFilesServer(asset, id);
    Object.assign(files, assetFiles);
    manifest.push({
      name: asset.name,
      slug: id,
      texture: `${id}.OZT`,
      animation: asset.animation?.name ?? null,
      frameCount,
    });
    files["README_MUONLINE.md"] = strToU8(readme(asset, id, frameCount));
  }
  files["Data/Object/Forge3D/manifest.json"] = strToU8(
    JSON.stringify(
      { generator: "Forge3D Asset Studio", source: "api", client: "MU Online", assets: manifest },
      null,
      2,
    ),
  );
  return files;
}

/** ZIP MU Online pronto (bytes). */
export async function buildMuOnlineZipServer(asset: ServerAssetExport): Promise<Uint8Array> {
  const files = await buildMuOnlineFilesServer(asset);
  return zipSync(files, { level: 6 }) as Uint8Array;
}
