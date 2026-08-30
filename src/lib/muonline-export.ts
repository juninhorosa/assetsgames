import { zipSync, strToU8 } from "fflate";

import { loadImage } from "./image-pipeline";
import { slugify, type AssetExport } from "./engine-export";

/**
 * Exportação para MU Online (cliente Webzen / MuEmu / OpenMU).
 *
 * O cliente do MU não lê PNG: as texturas são ficheiros "ofuscados" com um
 * cabeçalho lixo à frente do formato real:
 *
 * - `.OZT` → TGA (com alpha) precedido de 4 bytes;
 * - `.OZJ` → JPEG precedido de 24 bytes.
 *
 * Aqui geramos ambos (OZT como principal, por manter transparência) mais os
 * frames individuais de cada movimento e um `.anim.json` com fps, pivô e a
 * ordem dos frames, para ligar às ações do BMD.
 */

const OZT_HEADER = 4;
const OZJ_HEADER = 24;

interface Rgba {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

async function decode(dataUrl: string): Promise<Rgba> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível para converter a textura");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data };
}

async function toJpegBytes(dataUrl: string, background = "#000000"): Promise<Uint8Array> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível para converter a textura");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const jpeg = canvas.toDataURL("image/jpeg", 0.92);
  const binary = atob(jpeg.split(",")[1] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
  // O cabeçalho é ignorado pelo cliente; repetimos os primeiros bytes do
  // formato real para que ferramentas que só cortam N bytes continuem válidas.
  for (let i = 0; i < size; i++) out[i] = payload[i % payload.length] ?? 0;
  out.set(payload, size);
  return out;
}

/** Converte um PNG (data URL) num ficheiro `.OZT` do MU Online. */
export async function dataUrlToOzt(dataUrl: string): Promise<Uint8Array> {
  return withJunkHeader(writeTga(await decode(dataUrl)), OZT_HEADER);
}

/** Converte um PNG (data URL) num ficheiro `.OZJ` do MU Online. */
export async function dataUrlToOzj(dataUrl: string): Promise<Uint8Array> {
  return withJunkHeader(await toJpegBytes(dataUrl), OZJ_HEADER);
}

function readme(asset: AssetExport, id: string, frameCount: number) {
  const anim = asset.animation;
  return `# ${asset.name} — MU Online (OZT/OZJ)

Gerado pelo Forge3D Asset Studio.

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
4. Mantenha o pivô em bottom-center: é o alinhamento usado na geração, o que evita o personagem “flutuar” entre poses.

## Notas

- OZT/OZJ não são encriptados: são apenas o formato original com bytes extra à frente. Qualquer conversor (ex.: OZTtoTGA) funciona.
- Texturas do cliente antigo preferem lados potência de dois (128, 256, 512). Os assets já saem quadrados e normalizados.
`;
}

/**
 * Constrói o mapa de ficheiros do pacote MU Online (para juntar vários assets
 * num único ZIP da biblioteca).
 */
export async function buildMuOnlineFiles(
  asset: AssetExport,
): Promise<Record<string, Uint8Array>> {
  const id = slugify(asset.name);
  const files: Record<string, Uint8Array> = {};
  const base = `Data/Object/Forge3D`;
  const rgba = await decode(asset.image);

  files[`${base}/${id}.OZT`] = withJunkHeader(writeTga(rgba), OZT_HEADER);
  files[`${base}/${id}.OZJ`] = await dataUrlToOzj(asset.image);
  files[`raw/${id}.tga`] = writeTga(rgba);

  for (const [map, dataUrl] of Object.entries(asset.maps ?? {})) {
    if (!dataUrl || map === "albedo") continue;
    files[`${base}/${id}_${map}.OZT`] = await dataUrlToOzt(dataUrl);
  }

  const frames = asset.frames ?? [];
  const frameNames: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    const name = `${id}_${asset.animation?.name ?? "pose"}_${String(i).padStart(2, "0")}.OZT`;
    files[`${base}/frames/${name}`] = await dataUrlToOzt(frames[i]!);
    frameNames.push(`frames/${name}`);
  }

  files[`${base}/${id}.anim.json`] = strToU8(
    JSON.stringify(
      {
        generator: "Forge3D Asset Studio",
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
              cellWidth: asset.frameRects?.[0]?.w ?? 0,
              cellHeight: asset.frameRects?.[0]?.h ?? 0,
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
              rects: asset.frameRects ?? [],
            }
          : null,
        motion3d: asset.motion3d ?? null,
      },
      null,
      2,
    ),
  );

  files["README_MUONLINE.md"] = strToU8(readme(asset, id, frameNames.length));
  return files;
}

/** Pacote MU Online pronto a descarregar. */
export async function buildMuOnlineZip(asset: AssetExport): Promise<Blob> {
  const zipped = zipSync(await buildMuOnlineFiles(asset), { level: 6 });
  return new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
}
