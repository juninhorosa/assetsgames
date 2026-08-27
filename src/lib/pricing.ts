/**
 * Estimativa de custo em créditos por geração.
 *
 * Os valores são derivados do custo relativo das chamadas de imagem no gateway
 * (tamanho do canvas × número de imagens). Servem para orçamento por projeto e
 * para mostrar o custo antes de disparar um lote — não substituem a fatura real.
 */

export const CREDITS_PER_IMAGE = 1;

/** Multiplicador por resolução pedida. */
export const SIZE_COST: Record<string, number> = {
  "1024x1024": 1,
  "1024x1536": 1.5,
  "1536x1024": 1.5,
};

/** Multiplicador por tipo de asset (sheets e PBR pedem mais detalhe). */
export const MODE_COST: Record<string, number> = {
  sprite: 1,
  spritesheet: 1.4,
  texture: 1.2,
  ui: 1,
  model3d: 1.3,
};

export interface CostInput {
  /** Quantidade de imagens que serão geradas. */
  images: number;
  size: string;
  mode: string;
  /** Edição com referência (image-to-image) custa um pouco mais. */
  reference?: boolean;
}

/** Custo estimado em créditos, arredondado a 2 casas. */
export function estimateCredits(input: CostInput): number {
  const size = SIZE_COST[input.size] ?? 1;
  const mode = MODE_COST[input.mode] ?? 1;
  const ref = input.reference ? 1.15 : 1;
  const total = CREDITS_PER_IMAGE * size * mode * ref * Math.max(0, input.images);
  return Math.round(total * 100) / 100;
}

export function formatCredits(value: number): string {
  return `${(Math.round(value * 100) / 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })} cr`;
}
