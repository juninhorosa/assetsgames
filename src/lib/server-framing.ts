/**
 * Enquadramento normalizado no servidor (Worker) — mesma lógica do Studio,
 * mas em JS puro (sem canvas/DOM), para os caminhos MCP e API pública.
 * Remove o fundo branco, recorta o alpha e reescala o sujeito para ocupar
 * sempre a mesma fração de uma tela quadrada fixa, ancorado no mesmo pivô.
 */
import { decode, encode } from "fast-png";

export interface ServerFramingOptions {
  /** Lado da tela quadrada de saída (px). */
  canvas: number;
  /** Fração da tela que a silhueta deve ocupar (0..1). */
  fill: number;
  pivot: "bottom-center" | "center";
  /** Tolerância do branco de fundo (0..255). */
  tolerance: number;
}

export const DEFAULT_SERVER_FRAMING: ServerFramingOptions = {
  canvas: 512,
  fill: 0.86,
  pivot: "bottom-center",
  tolerance: 24,
};

interface Rgba {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA8
}

function toRgba8(png: ReturnType<typeof decode>): Rgba {
  const { width, height, channels, depth } = png;
  const src = png.data as ArrayLike<number>;
  const shift = depth === 16 ? 8 : 0;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    let r: number;
    let g: number;
    let b: number;
    let a = 255;
    if (channels === 1) {
      r = g = b = Number(src[s]) >> shift;
    } else if (channels === 2) {
      r = g = b = Number(src[s]) >> shift;
      a = Number(src[s + 1]) >> shift;
    } else if (channels === 3) {
      r = Number(src[s]) >> shift;
      g = Number(src[s + 1]) >> shift;
      b = Number(src[s + 2]) >> shift;
    } else {
      r = Number(src[s]) >> shift;
      g = Number(src[s + 1]) >> shift;
      b = Number(src[s + 2]) >> shift;
      a = Number(src[s + 3]) >> shift;
    }
    const d = i * 4;
    out[d] = r;
    out[d + 1] = g;
    out[d + 2] = b;
    out[d + 3] = a;
  }
  return { width, height, data: out };
}

/** Flood-fill de transparência a partir das bordas, só em pixels quase brancos. */
function keyOutWhite(img: Rgba, tolerance: number): void {
  const { width: w, height: h, data } = img;
  const limit = 255 - tolerance;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i]) return;
    const p = i * 4;
    if (data[p]! < limit || data[p + 1]! < limit || data[p + 2]! < limit) return;
    seen[i] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    data[(y * w + x) * 4 + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function alphaBounds(img: Rgba, threshold = 8): Bounds | null {
  const { width: w, height: h, data } = img;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Amostragem bilinear de uma região da origem para um destino w×h. */
function resample(img: Rgba, src: Bounds, dw: number, dh: number): Rgba {
  const out = new Uint8ClampedArray(dw * dh * 4);
  const { width: sw, data } = img;
  for (let y = 0; y < dh; y++) {
    const sy = src.y + ((y + 0.5) * src.h) / dh - 0.5;
    const y0 = Math.max(src.y, Math.floor(sy));
    const y1 = Math.min(src.y + src.h - 1, y0 + 1);
    const fy = Math.min(1, Math.max(0, sy - y0));
    for (let x = 0; x < dw; x++) {
      const sx = src.x + ((x + 0.5) * src.w) / dw - 0.5;
      const x0 = Math.max(src.x, Math.floor(sx));
      const x1 = Math.min(src.x + src.w - 1, x0 + 1);
      const fx = Math.min(1, Math.max(0, sx - x0));
      const d = (y * dw + x) * 4;
      for (let c = 0; c < 4; c++) {
        const p00 = data[(y0 * sw + x0) * 4 + c]!;
        const p10 = data[(y0 * sw + x1) * 4 + c]!;
        const p01 = data[(y1 * sw + x0) * 4 + c]!;
        const p11 = data[(y1 * sw + x1) * 4 + c]!;
        const top = p00 + (p10 - p00) * fx;
        const bottom = p01 + (p11 - p01) * fx;
        out[d + c] = Math.round(top + (bottom - top) * fy);
      }
    }
  }
  return { width: dw, height: dh, data: out };
}

/**
 * Recebe um PNG (bytes), devolve um PNG quadrado com fundo transparente,
 * sujeito centrado, escala fixa e o mesmo pivô — todos os assets saem
 * exatamente no mesmo tamanho e enquadramento.
 */
export function frameAssetPng(
  bytes: Uint8Array,
  opts: ServerFramingOptions = DEFAULT_SERVER_FRAMING,
): Uint8Array {
  const img = toRgba8(decode(bytes));
  keyOutWhite(img, opts.tolerance);
  const bounds = alphaBounds(img);
  const size = Math.max(64, Math.round(opts.canvas));
  const canvas = new Uint8ClampedArray(size * size * 4);
  if (bounds) {
    const target = size * Math.min(0.98, Math.max(0.4, opts.fill));
    const scale = Math.min(target / bounds.w, target / bounds.h);
    const dw = Math.max(1, Math.round(bounds.w * scale));
    const dh = Math.max(1, Math.round(bounds.h * scale));
    const margin = Math.round((size - target) / 2);
    const dx = Math.round((size - dw) / 2);
    const dy = opts.pivot === "bottom-center" ? size - margin - dh : Math.round((size - dh) / 2);
    const scaled = resample(img, bounds, dw, dh);
    for (let y = 0; y < dh; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= size) continue;
      for (let x = 0; x < dw; x++) {
        const tx = dx + x;
        if (tx < 0 || tx >= size) continue;
        const s = (y * dw + x) * 4;
        const d = (ty * size + tx) * 4;
        canvas[d] = scaled.data[s]!;
        canvas[d + 1] = scaled.data[s + 1]!;
        canvas[d + 2] = scaled.data[s + 2]!;
        canvas[d + 3] = scaled.data[s + 3]!;
      }
    }
  }
  return encode({ width: size, height: size, data: canvas, channels: 4, depth: 8 });
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Enquadra apenas os modos de sujeito isolado; texturas/sheets ficam intactas. */
export function shouldFrameMode(mode: string): boolean {
  return mode === "sprite" || mode === "ui" || mode === "model3d";
}
