import { detailWord, viewLine, type StyleProfile } from "./style-profile";

export type ImageRenderStyle = "cartoon" | "realistic";

export const IMAGE_RENDER_LABELS: Record<ImageRenderStyle, string> = {
  cartoon: "3D Cartoon",
  realistic: "3D Realista",
};

export function buildImageRenderPrompt(
  description: string,
  style: ImageRenderStyle,
  profile: StyleProfile,
  index = 0,
  total = 1,
): string {
  return [
    `Create one complete standalone image of: ${description.trim()}.`,
    style === "cartoon"
      ? "High-quality 3D cartoon render, rounded sculpted volumes, appealing expressive shapes, clean stylized materials, vibrant colors, soft studio lighting and polished animated-film shading. No pixel art, no flat 2D drawing."
      : "Photorealistic 3D render, physically accurate PBR materials, natural proportions, realistic surface detail, soft studio lighting, convincing depth and volume. No cartoon stylization, no pixel art.",
    `Camera: ${viewLine(profile)}.`,
    "Show the complete subject, centered with comfortable safe margins, no cropped parts, no text, no watermark, no contact sheet, no collage. Isolate the subject on a clean plain background.",
    `Color direction: ${profile.palette}. ${detailWord(profile.detail)}.`,
    profile.extra.trim() ? `Art direction: ${profile.extra.trim()}.` : "",
    total > 1 ? `This is independent variation ${index + 1} of ${total}; output exactly one image, not the entire set.` : "",
  ].filter(Boolean).join(" ");
}