import { loadImage } from "./image-pipeline";

export interface PixelFinishOptions {
  width: number;
  height: number;
  paletteSize: number;
}

function paletteFor(data: Uint8ClampedArray, limit: number): number[][] {
  const counts = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    const key = `${data[i]! >> 3},${data[i + 1]! >> 3},${data[i + 2]! >> 3}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(2, limit))
    .map(([key]) => key.split(",").map((value) => Number(value) * 8 + 4));
}

/** Reduz à grade lógica, limita a paleta e mantém alpha binário. */
export async function finishPixelArt(source: string, options: PixelFinishOptions): Promise<string> {
  const image = await loadImage(source);
  const low = document.createElement("canvas");
  low.width = Math.max(1, Math.round(options.width));
  low.height = Math.max(1, Math.round(options.height));
  const ctx = low.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas indisponível para acabamento pixel");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, low.width, low.height);
  const pixels = ctx.getImageData(0, 0, low.width, low.height);
  const palette = paletteFor(pixels.data, options.paletteSize);
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (pixels.data[i + 3]! < 128) {
      pixels.data[i + 3] = 0;
      continue;
    }
    let best = palette[0] ?? [0, 0, 0];
    let distance = Number.POSITIVE_INFINITY;
    for (const swatch of palette) {
      const d = (pixels.data[i]! - swatch[0]!) ** 2 + (pixels.data[i + 1]! - swatch[1]!) ** 2 + (pixels.data[i + 2]! - swatch[2]!) ** 2;
      if (d < distance) { distance = d; best = swatch; }
    }
    pixels.data[i] = best[0]!;
    pixels.data[i + 1] = best[1]!;
    pixels.data[i + 2] = best[2]!;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return low.toDataURL("image/png");
}