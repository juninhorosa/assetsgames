/**
 * Regras de escolha do provedor de emergência (grátis, sem chave).
 *
 * Existe um provedor grátis (Pollinations) que não precisa de chave, e ele é
 * usado como última tentativa quando os provedores pagos falham. O ponto
 * importante: desativar um provedor no painel Admin significa que ele **não
 * pode ser usado de forma alguma** — inclusive como emergência. Antes disso ser
 * explícito, o Pollinations continuava sendo chamado mesmo desligado.
 */

export interface FallbackProvider {
  id: string;
}

export interface FallbackInput {
  providers: FallbackProvider[];
  disabled: string[];
  cooldowns: Record<string, number | undefined>;
  now?: number;
}

/** Provedor grátis disponível para a última tentativa, ou null se proibido. */
export function pickFreeFallback<T extends { id: string }>(
  input: FallbackInput & { freeProviderId?: string },
  find?: (id: string) => T | undefined,
): T | null {
  const freeId = input.freeProviderId ?? "pollinations";
  const now = input.now ?? Date.now();
  if (input.disabled.includes(freeId)) return null;
  const until = input.cooldowns[freeId];
  if (until && until > now) return null;
  if (!input.providers.some((provider) => provider.id === freeId)) return null;
  return find ? (find(freeId) ?? null) : ({ id: freeId } as unknown as T);
}
