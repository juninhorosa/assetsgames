/**
 * Travão global de consumo de IA.
 *
 * Toda geração (Studio, lote, API pública e MCP) passa por aqui antes de tocar
 * no gateway. Se o interruptor global estiver desligado, ou se o consumo do dia
 * / do mês já tiver atingido o limite definido no painel Admin, a requisição é
 * recusada ANTES de gastar créditos.
 */

export interface SpendGuardStatus {
  allowed: boolean;
  reason: string;
  ai_enabled: boolean;
  public_api_enabled: boolean;
  daily_used: number;
  monthly_used: number;
  daily_cap: number;
  monthly_cap: number;
}

const FALLBACK: SpendGuardStatus = {
  allowed: false,
  reason: "guard_unavailable",
  ai_enabled: false,
  public_api_enabled: false,
  daily_used: 0,
  monthly_used: 0,
  daily_cap: 0,
  monthly_cap: 0,
};

export function guardMessage(status: SpendGuardStatus): string {
  switch (status.reason) {
    case "ai_disabled":
      return "Gerações desligadas pelo administrador.";
    case "daily_cap":
      return `Limite diário de créditos atingido (${status.daily_used}/${status.daily_cap}). Tente novamente amanhã.`;
    case "monthly_cap":
      return `Limite mensal de créditos atingido (${status.monthly_used}/${status.monthly_cap}).`;
    case "guard_unavailable":
      return "Não foi possível validar o limite de consumo. Geração bloqueada por segurança.";
    default:
      return "Geração bloqueada pelo limite de consumo.";
  }
}

/** Consulta o travão. `credits` é o custo estimado da geração pedida. */
export async function checkSpendGuard(credits: number): Promise<SpendGuardStatus> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("spend_guard_check", {
      _credits: credits,
    });
    if (error || !data) return FALLBACK;
    return data as unknown as SpendGuardStatus;
  } catch {
    return FALLBACK;
  }
}

/** Bloqueia com 429 quando o travão recusa; devolve null quando pode seguir. */
export async function spendGuardResponse(
  credits: number,
  options: { publicApi?: boolean } = {},
): Promise<Response | null> {
  const status = await checkSpendGuard(credits);
  if (options.publicApi && status.public_api_enabled === false) {
    return new Response(
      JSON.stringify({ error: "API pública desligada pelo administrador." }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
  if (status.allowed) return null;
  return new Response(JSON.stringify({ error: guardMessage(status) }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
}
