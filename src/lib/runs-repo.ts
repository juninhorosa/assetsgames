import { supabase } from "@/integrations/supabase/client";

/**
 * Histórico de execuções: cada geração (sucesso ou erro) registra origem, custo
 * estimado, duração e parâmetros, alimentando o painel de créditos por projeto.
 */

export type RunSource = "studio" | "batch" | "api" | "mcp";
export type RunStatus = "success" | "error";

export interface RunRow {
  id: string;
  project_id: string | null;
  asset_id: string | null;
  source: RunSource;
  kind: string;
  mode: string | null;
  action: string | null;
  view: string | null;
  model: string | null;
  size: string | null;
  status: RunStatus;
  credits: number;
  duration_ms: number | null;
  prompt: string | null;
  error: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface LogRunInput {
  projectId?: string | null;
  assetId?: string | null;
  source: RunSource;
  kind?: string;
  mode?: string | null;
  action?: string | null;
  view?: string | null;
  model?: string | null;
  size?: string | null;
  status: RunStatus;
  credits: number;
  durationMs?: number | null;
  prompt?: string | null;
  error?: string | null;
  meta?: Record<string, unknown>;
}

/** Registro best-effort: uma falha de log nunca derruba a geração. */
export async function logRun(input: LogRunInput): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    await supabase.from("generation_runs").insert({
      user_id: uid,
      project_id: input.projectId ?? null,
      asset_id: input.assetId ?? null,
      source: input.source,
      kind: input.kind ?? "image",
      mode: input.mode ?? null,
      action: input.action ?? null,
      view: input.view ?? null,
      model: input.model ?? "openai/gpt-image-2",
      size: input.size ?? null,
      status: input.status,
      credits: input.credits,
      duration_ms: input.durationMs ?? null,
      prompt: input.prompt?.slice(0, 2000) ?? null,
      error: input.error?.slice(0, 500) ?? null,
      meta: (input.meta ?? {}) as unknown as never,
    });
  } catch {
    /* telemetria é best-effort */
  }
}

export async function fetchRuns(projectId: string | null, limit = 200): Promise<RunRow[]> {
  let query = supabase
    .from("generation_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as RunRow[];
}

export interface UsageSummary {
  totalCredits: number;
  totalRuns: number;
  failed: number;
  last24hCredits: number;
  byMode: { mode: string; credits: number; runs: number }[];
  bySource: { source: string; credits: number; runs: number }[];
}

export function summarizeRuns(runs: RunRow[]): UsageSummary {
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const modes = new Map<string, { credits: number; runs: number }>();
  const sources = new Map<string, { credits: number; runs: number }>();
  let totalCredits = 0;
  let last24hCredits = 0;
  let failed = 0;

  for (const run of runs) {
    totalCredits += Number(run.credits ?? 0);
    if (new Date(run.created_at).getTime() >= dayAgo) last24hCredits += Number(run.credits ?? 0);
    if (run.status === "error") failed++;

    const modeKey = run.mode ?? "outros";
    const m = modes.get(modeKey) ?? { credits: 0, runs: 0 };
    modes.set(modeKey, { credits: m.credits + Number(run.credits ?? 0), runs: m.runs + 1 });

    const s = sources.get(run.source) ?? { credits: 0, runs: 0 };
    sources.set(run.source, { credits: s.credits + Number(run.credits ?? 0), runs: s.runs + 1 });
  }

  return {
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalRuns: runs.length,
    failed,
    last24hCredits: Math.round(last24hCredits * 100) / 100,
    byMode: [...modes.entries()]
      .map(([mode, v]) => ({ mode, ...v }))
      .sort((a, b) => b.credits - a.credits),
    bySource: [...sources.entries()]
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.credits - a.credits),
  };
}

export async function updateCreditBudget(projectId: string, budget: number) {
  const { error } = await supabase
    .from("projects")
    .update({ credit_budget: budget })
    .eq("id", projectId);
  if (error) throw error;
}
