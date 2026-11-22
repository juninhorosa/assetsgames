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
    label: "",
    kind: "openai",
    enabled: true,
    baseUrl: "https://tokenharbor.ai/v1",
    endpoint: "/images/generations",
    method: "POST",
    model: "",
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
    editImageField: "image",
  };
}
