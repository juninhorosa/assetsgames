/**
 * Contrato compartilhado dos provedores de imagem cadastrados no Admin.
 * Não importa módulos de servidor: este arquivo também entra no bundle web.
 */

export type CustomProviderKind = "openai" | "advanced";
export type CustomProviderMethod = "POST" | "PUT";

export interface CustomProviderConfig {
  id: string;
  label: string;
  kind: CustomProviderKind;
  enabled: boolean;
  baseUrl: string;
  endpoint: string;
  method: CustomProviderMethod;
  model: string;
  authHeader: string;
  authPrefix: string;
  promptField: string;
  modelField: string;
  widthField: string;
  heightField: string;
  sizeField: string;
  imagePath: string;
  editEnabled: boolean;
  editEndpoint: string;
  editImageField: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CustomProviderInput {
  id?: string | undefined;
  label: string;
  kind: CustomProviderKind;
  enabled: boolean;
  baseUrl: string;
  endpoint: string;
  method: CustomProviderMethod;
  model: string;
  authHeader: string;
  authPrefix: string;
  promptField: string;
  modelField: string;
  widthField: string;
  heightField: string;
  sizeField: string;
  imagePath: string;
  editEnabled: boolean;
  editEndpoint: string;
  editImageField: string;
  apiKey?: string | undefined;
}

export const CUSTOM_PROVIDER_PREFIX = "custom:";

export function customProviderId(id: string): string {
  return `${CUSTOM_PROVIDER_PREFIX}${id}`;
}

export function defaultCustomProvider(): CustomProviderInput {
  return {
    label: "Runcrate",
    kind: "openai",
    enabled: true,
    baseUrl: "https://api.runcrate.ai/v1",
    endpoint: "/images/generations",
    method: "POST",
    model: "black-forest-labs/FLUX.1-dev",
    authHeader: "Authorization",
    authPrefix: "Bearer",
    promptField: "prompt",
    modelField: "model",
    widthField: "",
    heightField: "",
    sizeField: "size",
    imagePath: "data.0.b64_json",
    editEnabled: false,
    editEndpoint: "/images/edits",
    editImageField: "input_image",
  };
}

/**
 * Provedores que editam no mesmo endpoint de geração (ex.: Runcrate) recebem
 * JSON com a imagem em base64. O formato clássico do OpenAI usa multipart em
 * /images/edits. A regra vem da configuração já salva, sem precisar de coluna
 * nova no banco.
 */
export function usesJsonEditing(config: {
  editEnabled: boolean;
  editEndpoint: string;
  imagePath: string;
}): boolean {
  if (!config.editEnabled) return false;
  return /\/images\/generations\/?$/.test(config.editEndpoint.trim());
}
