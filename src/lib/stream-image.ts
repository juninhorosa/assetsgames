import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type ImageEventPayload =
  | { type: string; b64_json: string; partial_image_index?: number }
  | { type: "error"; error: { message: string; code?: string } };

const IMAGE_EVENTS = new Set([
  "image_generation.partial_image",
  "image_generation.completed",
  "image_edit.partial_image",
  "image_edit.completed",
]);

async function readStream(
  res: Response,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<{ sawAnyEvent: boolean; sawCompleted: boolean; error?: string | undefined }> {
  let sawAnyEvent = false;
  let sawCompleted = false;
  let streamError: string | undefined;

  const parser = createParser({
    onEvent(event) {
      let payload: ImageEventPayload | undefined;
      try {
        payload = JSON.parse(event.data) as ImageEventPayload;
      } catch {
        /* keep generic message */
      }
      if (event.event === "error" || payload?.type === "error") {
        sawAnyEvent = true;
        streamError =
          (payload as { error?: { message?: string } } | undefined)?.error?.message ??
          "A geração da imagem falhou";
        return;
      }
      if (!event.event || !IMAGE_EVENTS.has(event.event)) return;
      if (!payload || !("b64_json" in payload)) return;
      sawAnyEvent = true;
      const isFinal = event.event.endsWith(".completed");
      flushSync(() => {
        onFrame(`data:image/png;base64,${payload.b64_json}`, isFinal);
      });
      if (isFinal) sawCompleted = true;
    },
  });

  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return { sawAnyEvent, sawCompleted, error: streamError };
}

/** Streams an image generation from the app's own server route. */
export async function streamGenerate(
  body: Record<string, unknown>,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<void> {
  const res = await fetch("/api/generate-asset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error(await res.text().catch(() => `Falha na geração (${res.status})`));
  }
  const { sawAnyEvent, sawCompleted, error } = await readStream(res, onFrame);
  if (error) throw new Error(error);
  if (!sawAnyEvent) {
    // Zero events = transport hiccup -> replay once, non-streamed.
    const replay = await fetch("/api/generate-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, stream: false }),
    });
    if (!replay.ok) {
      throw new Error(await replay.text().catch(() => `Falha na geração (${replay.status})`));
    }
    const json = (await replay.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("A geração não retornou nenhuma imagem");
    onFrame(`data:image/png;base64,${b64}`, true);
    return;
  }
  if (!sawCompleted) throw new Error("O stream terminou sem concluir a imagem");
}

/** Streams an instruction-based edit of an existing image. */
export async function streamEdit(
  file: Blob,
  prompt: string,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<void> {
  const build = () => {
    const fd = new FormData();
    fd.append("image", file, "asset.png");
    fd.append("prompt", prompt);
    return fd;
  };

  const res = await fetch("/api/edit-asset", { method: "POST", body: build() });
  if (!res.ok || !res.body) {
    throw new Error(await res.text().catch(() => `Falha na edição (${res.status})`));
  }
  const { sawAnyEvent, sawCompleted, error } = await readStream(res, onFrame);
  if (error) throw new Error(error);
  if (!sawAnyEvent) {
    const fd = build();
    fd.append("stream", "false");
    const replay = await fetch("/api/edit-asset", { method: "POST", body: fd });
    if (!replay.ok) {
      throw new Error(await replay.text().catch(() => `Falha na edição (${replay.status})`));
    }
    const json = (await replay.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("A edição não retornou nenhuma imagem");
    onFrame(`data:image/png;base64,${b64}`, true);
    return;
  }
  if (!sawCompleted) throw new Error("O stream terminou sem concluir a imagem");
}
