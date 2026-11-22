import type { CustomProviderConfig } from "./custom-provider-config";

/** Modelos de texto conhecidos que nunca produzem imagem. */
const TEXT_ONLY =
  /deepseek|glm|qwen(?!.*(?:image|flux))|llama|mistral|gemma|phi|kimi|gpt-oss|whisper|embed|nemotron|moondream|cohere|granite|mixtral|codestral|devstral|command-r|text-embedding|davinci|turbo-instruct/i;

const IMAGE_HINT =
  /flux|diffusion|sdxl|stable|dall-e|gpt-image|ideogram|seedream|imagen|kling-image|wan.*(?:t2i|image)|kontext|krea|playground-v|midjourney|recraft|photon|recraft|runway.*image/i;

/**
 * O Runcrate e outros gateways expõem modelos de texto e de imagem no mesmo
 * catálogo. Enviar um modelo de texto para /images/generations retorna 400 e
 * consome uma tentativa. Aqui o modelo é classificado antes da requisição.
 */
export function modelLooksLikeImageModel(model: string): boolean {
  const value = model.trim();
  if (!value) return false;
  if (IMAGE_HINT.test(value)) return true;
  return !TEXT_ONLY.test(value);
}

/** Mensagem acionável quando o Admin escolhe um modelo que só gera texto. */
export function imageModelError(config: CustomProviderConfig): string | null {
  if (config.kind !== "openai") return null;
  if (!config.model) return "Informe um modelo de imagem, como black-forest-labs/FLUX.1-dev.";
  if (modelLooksLikeImageModel(config.model)) return null;
  return (
    `O modelo "${config.model}" não gera imagens (é um modelo de texto). ` +
    "Use um modelo de imagem como black-forest-labs/FLUX.1-dev, black-forest-labs/FLUX.1-schnell, " +
    "stabilityai/stable-diffusion-3-5-large ou ideogram/ideogram-3.0."
  );
}
