import type { CustomProviderConfig } from "./custom-provider-config";
import { usesJsonEditing } from "./custom-provider-config";
import { imageModelError } from "./image-model-check";
import { assertPublicHttpUrl } from "./custom-providers.server";
import { assertPublicImageUrl, publicFetch } from "./custom-provider-network.server";

export class CustomProviderRequestError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function responsePath(data: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (Array.isArray(value) && /^\d+$/.test(key)) return value[Number(key)];
    if (value && typeof value === "object") return (value as Record<string, unknown>)[key];
    return undefined;
  }, data);
}

export function imageFromCustomResponse(data: unknown, path: string): string {
  const candidates = [
    path,
    "data.0.b64_json",
    "data.0.url",
    "images.0.url",
    "image",
    "output.0",
    "url",
  ];
  for (const candidate of [...new Set(candidates)]) {
    const value = responsePath(data, candidate);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  throw new CustomProviderRequestError("A API respondeu sem imagem no caminho configurado.");
}

export function customRequestBody(
  config: CustomProviderConfig,
  prompt: string,
  size: string,
  model: string,
  image?: Blob,
): Record<string, unknown> {
  const [width = 1024, height = 1024] = size.split("x").map(Number);
  const body: Record<string, unknown> = { [config.promptField]: prompt };
  if (config.modelField && model) body[config.modelField] = model;
  if (config.widthField) body[config.widthField] = width;
  if (config.heightField) body[config.heightField] = height;
  if (config.sizeField) body[config.sizeField] = size;
  if (config.kind === "openai" && !image)
    Object.assign(body, { quality: "low", background: "transparent", n: 1 });
  return body;
}

async function downloadImage(value: string): Promise<string> {
  if (value.startsWith("data:")) return value.split(",")[1] ?? "";
  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && !value.startsWith("http"))
    return value.replace(/\s/g, "");
  if (!/^https?:\/\//i.test(value))
    throw new CustomProviderRequestError(
      "A resposta não contém base64 nem uma URL de imagem válida.",
    );
  const response = await publicFetch(assertPublicImageUrl(value), {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new CustomProviderRequestError(`Falha ao baixar a imagem (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new CustomProviderRequestError("A imagem excede o limite de 25 MB.");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function runCustomProvider(
  config: CustomProviderConfig,
  prompt: string,
  size: string,
  model: string,
  image?: Blob,
): Promise<string> {
  const { customProviderSecret } = await import("./custom-providers.server");
  const modelProblem = imageModelError(config);
  if (modelProblem && !image) throw new CustomProviderRequestError(modelProblem, 400);
  const key = await customProviderSecret(config.id);
  if (!key) throw new CustomProviderRequestError("Chave de API não configurada.", 500);
  const editing = Boolean(image && config.editEnabled);
  const endpoint = editing ? config.editEndpoint : config.endpoint;
  const url =
    config.kind === "openai"
      ? new URL(endpoint.replace(/^\//, ""), `${config.baseUrl.replace(/\/+$/, "")}/`)
      : new URL(endpoint);
  assertPublicHttpUrl(url.toString());

  let body: BodyInit;
  const headers: Record<string, string> = {
    [config.authHeader]: `${config.authPrefix} ${key}`.trim(),
    Accept: "application/json",
  };
  if (image && config.kind === "openai" && editing && !usesJsonEditing(config)) {
    const form = new FormData();
    form.append(config.editImageField, image, "asset.png");
    form.append(config.promptField, prompt);
    if (config.modelField && model) form.append(config.modelField, model);
    body = form;
  } else {
    const payload = customRequestBody(config, prompt, size, model, image);
    if (image && editing) {
      const bytes = new Uint8Array(await image.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      payload[config.editImageField] = `data:image/png;base64,${btoa(binary)}`;
    }
    body = JSON.stringify(payload);
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await publicFetch(url, {
      method: config.method,
      headers,
      body,
      signal: AbortSignal.timeout(180_000),
    });
  } catch (error) {
    throw new CustomProviderRequestError(
      `Falha de conexão com a API: ${(error as Error).message.slice(0, 160)}`,
    );
  }
  if (!response.ok) {
    const text = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    throw new CustomProviderRequestError(
      `API respondeu ${response.status}${text ? `: ${text}` : ""}`,
      response.status,
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("image/")) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES)
      throw new CustomProviderRequestError("A imagem excede o limite de 25 MB.");
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }
  const data: unknown = await response.json().catch(() => {
    throw new CustomProviderRequestError("A API não retornou JSON nem uma imagem.");
  });
  return downloadImage(imageFromCustomResponse(data, config.imagePath));
}
