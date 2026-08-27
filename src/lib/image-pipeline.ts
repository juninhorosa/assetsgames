/**
 * Client-side raster pipeline: alpha cut-out, PBR map derivation and
 * sprite-sheet slicing. All of it runs in canvas — no GPU needed server-side.
 */

export const MAP_TYPES = [
  "albedo",
  "height",
  "normal",
  "roughness",
  "metallic",
  "ao",
] as const;
export type MapType = (typeof MAP_TYPES)[number];

export const MAP_LABELS: Record<MapType, string> = {
  albedo: "Albedo",
  height: "Height",
  normal: "Normal",
  roughness: "Roughness",
  metallic: "Metallic",
  ao: "Ambient Occlusion",
};

export interface PbrOptions {
  normalStrength: number; // 0.5 .. 6
  roughnessBase: number; // 0 .. 1
  roughnessContrast: number; // 0 .. 2
  metallicBase: number; // 0 .. 1
  aoStrength: number; // 0 .. 2
  invertHeight: boolean;
}

export const DEFAULT_PBR_OPTIONS: PbrOptions = {
  normalStrength: 2,
  roughnessBase: 0.5,
  roughnessContrast: 1,
  metallicBase: 0,
  aoStrength: 1,
  invertHeight: false,
};

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem"));
    img.src = src;
  });
}

function ctxOf(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return { canvas, ctx };
}

function imageDataOf(img: HTMLImageElement) {
  const { ctx } = ctxOf(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
}

function toDataUrl(data: ImageData): string {
  const { canvas, ctx } = ctxOf(data.width, data.height);
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Flood-fills transparency from the border inward for near-white pixels, then
 * softens the resulting edge so the alpha channel stays clean.
 */
export function removeBackground(img: HTMLImageElement, tolerance = 24): string {
  const data = imageDataOf(img);
  const { width: w, height: h } = data;
  const px = data.data;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];

  const isBg = (i: number) => {
    const r = px[i * 4]!;
    const g = px[i * 4 + 1]!;
    const b = px[i * 4 + 2]!;
    return 255 - Math.min(r, g, b) <= tolerance && Math.max(r, g, b) - Math.min(r, g, b) <= 16;
  };

  for (let x = 0; x < w; x++) {
    stack.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1);
  }

  while (stack.length) {
    const i = stack.pop()!;
    if (i < 0 || i >= w * h || visited[i]) continue;
    visited[i] = 1;
    if (!isBg(i)) continue;
    px[i * 4 + 3] = 0;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }

  // Soften edge: pixels adjacent to transparency get partial alpha.
  const alphaCopy = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) alphaCopy[i] = px[i * 4 + 3]!;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (alphaCopy[i] === 0) continue;
      let transparentNeighbours = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (alphaCopy[i + dy * w + dx] === 0) transparentNeighbours++;
        }
      }
      if (transparentNeighbours > 0) {
        px[i * 4 + 3] = Math.round(255 * (1 - transparentNeighbours / 9));
      }
    }
  }

  return toDataUrl(data);
}

function luminance(px: Uint8ClampedArray, i: number) {
  return (0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!) / 255;
}

/** Derives Height, Normal, Roughness, Metallic and AO from an albedo image. */
export function derivePbrMaps(
  img: HTMLImageElement,
  opts: PbrOptions,
): Record<Exclude<MapType, "albedo">, string> {
  const src = imageDataOf(img);
  const { width: w, height: h } = src;
  const px = src.data;

  const height = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const l = luminance(px, i);
    height[i] = opts.invertHeight ? 1 - l : l;
  }

  // Blurred luminance for AO (cheap box blur)
  const blurred = new Float32Array(w * h);
  const r = Math.max(1, Math.round(Math.min(w, h) / 64));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -r; dx <= r; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += height[yy * w + xx]!;
          count++;
        }
      }
      blurred[y * w + x] = sum / count;
    }
  }

  const mk = () => new ImageData(w, h);
  const heightMap = mk();
  const normalMap = mk();
  const roughMap = mk();
  const metalMap = mk();
  const aoMap = mk();

  const at = (x: number, y: number) =>
    height[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]!;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const hv = height[i]!;

      // Height
      const hb = Math.round(hv * 255);
      heightMap.data[o] = heightMap.data[o + 1] = heightMap.data[o + 2] = hb;
      heightMap.data[o + 3] = 255;

      // Normal (Sobel)
      const dx =
        at(x - 1, y - 1) +
        2 * at(x - 1, y) +
        at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) +
        2 * at(x, y - 1) +
        at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      let nx = dx * opts.normalStrength;
      let ny = dy * opts.normalStrength;
      const nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len;
      ny /= len;
      normalMap.data[o] = Math.round((nx * 0.5 + 0.5) * 255);
      normalMap.data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalMap.data[o + 2] = Math.round((nz / len) * 0.5 * 255 + 127);
      normalMap.data[o + 3] = 255;

      // Roughness: darker/rougher surfaces get higher roughness
      const rough = clamp01(
        opts.roughnessBase + (1 - hv - 0.5) * opts.roughnessContrast * 0.6,
      );
      const rb = Math.round(rough * 255);
      roughMap.data[o] = roughMap.data[o + 1] = roughMap.data[o + 2] = rb;
      roughMap.data[o + 3] = 255;

      // Metallic: base value biased by specular-ish highlights
      const metal = clamp01(opts.metallicBase * (0.4 + hv * 0.9));
      const mb = Math.round(metal * 255);
      metalMap.data[o] = metalMap.data[o + 1] = metalMap.data[o + 2] = mb;
      metalMap.data[o + 3] = 255;

      // AO: local cavity = height below its neighbourhood average
      const cavity = clamp01(1 - (blurred[i]! - hv) * 4 * opts.aoStrength);
      const ab = Math.round(cavity * 255);
      aoMap.data[o] = aoMap.data[o + 1] = aoMap.data[o + 2] = ab;
      aoMap.data[o + 3] = 255;
    }
  }

  return {
    height: toDataUrl(heightMap),
    normal: toDataUrl(normalMap),
    roughness: toDataUrl(roughMap),
    metallic: toDataUrl(metalMap),
    ao: toDataUrl(aoMap),
  };
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export interface FrameRect {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SheetSlice {
  frames: string[];
  rects: FrameRect[];
  cellWidth: number;
  cellHeight: number;
}

/** Cuts a generated grid sheet into individual frames + frame data. */
export function sliceSheet(img: HTMLImageElement, columns: number, rows: number): SheetSlice {
  const cellWidth = Math.floor(img.naturalWidth / columns);
  const cellHeight = Math.floor(img.naturalHeight / rows);
  const frames: string[] = [];
  const rects: FrameRect[] = [];
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = col * cellWidth;
      const y = row * cellHeight;
      const { canvas, ctx } = ctxOf(cellWidth, cellHeight);
      ctx.drawImage(img, x, y, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
      frames.push(canvas.toDataURL("image/png"));
      rects.push({ index, x, y, w: cellWidth, h: cellHeight });
      index++;
    }
  }
  return { frames, rects, cellWidth, cellHeight };
}

/** Nearest-neighbour downscale, used for pixel-art crunch / icon sizes. */
export function resizeNearest(img: HTMLImageElement, size: number): string {
  const { canvas, ctx } = ctxOf(size, size);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toDataURL("image/png");
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  return new Blob([dataUrlToBytes(dataUrl) as BlobPart], { type: "image/png" });
}

// ── Alinhamento de quadros (trim + pivô) ─────────────────────────────

export type PivotMode = "bottom-center" | "center";

export interface AlignOptions {
  pivot: PivotMode;
  padding: number; // px de folga ao redor do maior recorte
  alphaThreshold: number; // 0..255
}

export const DEFAULT_ALIGN_OPTIONS: AlignOptions = {
  pivot: "bottom-center",
  padding: 2,
  alphaThreshold: 8,
};

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function alphaBounds(data: ImageData, threshold: number): Bounds | null {
  const { width: w, height: h, data: px } = data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3]! <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export interface AlignResult extends SheetSlice {
  pivot: { x: number; y: number };
  trimmed: number;
}

/**
 * Recorta a área opaca de cada quadro e recompõe todos numa célula comum,
 * ancorados no mesmo pivô — elimina a "tremida" da animação.
 */
export async function alignFrames(
  frames: string[],
  opts: AlignOptions = DEFAULT_ALIGN_OPTIONS,
): Promise<AlignResult> {
  const images = await Promise.all(frames.map((f) => loadImage(f)));
  const bounds = images.map((img) => alphaBounds(imageDataOf(img), opts.alphaThreshold));

  const valid = bounds.filter((b): b is Bounds => b !== null);
  if (valid.length === 0) {
    throw new Error("Os quadros estão vazios — remova o fundo antes de alinhar");
  }

  const maxW = Math.max(...valid.map((b) => b.w));
  const maxH = Math.max(...valid.map((b) => b.h));
  const cellWidth = maxW + opts.padding * 2;
  const cellHeight = maxH + opts.padding * 2;

  const out: string[] = [];
  const rects: FrameRect[] = [];
  for (let i = 0; i < images.length; i++) {
    const { canvas, ctx } = ctxOf(cellWidth, cellHeight);
    const b = bounds[i];
    if (b) {
      const dx = Math.round((cellWidth - b.w) / 2);
      const dy =
        opts.pivot === "bottom-center"
          ? cellHeight - opts.padding - b.h
          : Math.round((cellHeight - b.h) / 2);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(images[i]!, b.x, b.y, b.w, b.h, dx, dy, b.w, b.h);
    }
    out.push(canvas.toDataURL("image/png"));
    rects.push({ index: i, x: 0, y: 0, w: cellWidth, h: cellHeight });
  }

  return {
    frames: out,
    rects,
    cellWidth,
    cellHeight,
    trimmed: valid.length,
    pivot: {
      x: cellWidth / 2,
      y: opts.pivot === "bottom-center" ? cellHeight - opts.padding : cellHeight / 2,
    },
  };
}

/** Recompõe uma sheet a partir de quadros individuais (após editar/reordenar). */
export function composeSheet(
  frameImages: HTMLImageElement[],
  columns: number,
): { dataUrl: string; rects: FrameRect[]; columns: number; rows: number; cellWidth: number; cellHeight: number } {
  const cols = Math.max(1, Math.min(columns, frameImages.length));
  const rows = Math.ceil(frameImages.length / cols);
  const cellWidth = Math.max(...frameImages.map((i) => i.naturalWidth));
  const cellHeight = Math.max(...frameImages.map((i) => i.naturalHeight));
  const { canvas, ctx } = ctxOf(cols * cellWidth, rows * cellHeight);
  ctx.imageSmoothingEnabled = false;
  const rects: FrameRect[] = [];
  frameImages.forEach((img, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * cellWidth;
    const y = row * cellHeight;
    ctx.drawImage(img, x, y, cellWidth, cellHeight);
    rects.push({ index, x, y, w: cellWidth, h: cellHeight });
  });
  return { dataUrl: canvas.toDataURL("image/png"), rects, columns: cols, rows, cellWidth, cellHeight };
}

/** Conveniência: recompõe a sheet a partir de data URLs. */
export async function composeSheetFromDataUrls(frames: string[], columns: number) {
  const imgs = await Promise.all(frames.map((f) => loadImage(f)));
  return composeSheet(imgs, columns);
}

// ── Enquadramento normalizado (mesma escala / mesmo tamanho) ──────────

export interface FramingOptions {
  /** Lado da tela quadrada de saída (px). */
  canvas: number;
  /** Fração da tela que a silhueta deve ocupar (0..1). */
  fill: number;
  /** Âncora vertical do sujeito. */
  pivot: PivotMode;
  alphaThreshold: number;
}

export const DEFAULT_FRAMING_OPTIONS: FramingOptions = {
  canvas: 512,
  fill: 0.86,
  pivot: "bottom-center",
  alphaThreshold: 8,
};

/**
 * Recorta o alpha, reescala o sujeito para ocupar sempre a mesma fração
 * de uma tela quadrada fixa e ancora no mesmo pivô.
 * Garante que todos os assets saiam com o mesmo tamanho e enquadramento.
 */
export function normalizeFraming(
  img: HTMLImageElement,
  opts: FramingOptions = DEFAULT_FRAMING_OPTIONS,
): string {
  const bounds = alphaBounds(imageDataOf(img), opts.alphaThreshold);
  const size = opts.canvas;
  const { canvas, ctx } = ctxOf(size, size);
  if (!bounds) return canvas.toDataURL("image/png");

  const target = size * opts.fill;
  const scale = Math.min(target / bounds.w, target / bounds.h);
  const w = Math.max(1, Math.round(bounds.w * scale));
  const h = Math.max(1, Math.round(bounds.h * scale));
  const margin = Math.round((size - target) / 2);
  const dx = Math.round((size - w) / 2);
  const dy = opts.pivot === "bottom-center" ? size - margin - h : Math.round((size - h) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h, dx, dy, w, h);
  return canvas.toDataURL("image/png");
}

/** Aplica o enquadramento normalizado a vários quadros/direções. */
export async function normalizeFramingBatch(
  frames: string[],
  opts: FramingOptions = DEFAULT_FRAMING_OPTIONS,
): Promise<string[]> {
  const imgs = await Promise.all(frames.map((f) => loadImage(f)));
  const bounds = imgs.map((i) => alphaBounds(imageDataOf(i), opts.alphaThreshold));
  const valid = bounds.filter((b): b is Bounds => b !== null);
  if (!valid.length) throw new Error("Os quadros estão vazios — remova o fundo antes de enquadrar");

  // Escala única para toda a sequência: a maior silhueta define o zoom.
  const size = opts.canvas;
  const target = size * opts.fill;
  const maxW = Math.max(...valid.map((b) => b.w));
  const maxH = Math.max(...valid.map((b) => b.h));
  const scale = Math.min(target / maxW, target / maxH);
  const margin = Math.round((size - target) / 2);

  return imgs.map((img, i) => {
    const { canvas, ctx } = ctxOf(size, size);
    const b = bounds[i];
    if (b) {
      const w = Math.max(1, Math.round(b.w * scale));
      const h = Math.max(1, Math.round(b.h * scale));
      const dx = Math.round((size - w) / 2);
      const dy = opts.pivot === "bottom-center" ? size - margin - h : Math.round((size - h) / 2);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, b.x, b.y, b.w, b.h, dx, dy, w, h);
    }
    return canvas.toDataURL("image/png");
  });
}
