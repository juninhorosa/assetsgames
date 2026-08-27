import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchProjects } from "@/lib/assets-repo";
import { fetchRuns, summarizeRuns, updateCreditBudget } from "@/lib/runs-repo";
import { formatCredits } from "@/lib/pricing";
import { EXPORT_PRESETS } from "@/lib/export-presets";

export const Route = createFileRoute("/app/usage")({
  head: () => ({
    meta: [
      { title: "Créditos e histórico — Forge3D" },
      {
        name: "description",
        content:
          "Acompanhe créditos consumidos por projeto, custo estimado por geração e o histórico detalhado de execuções do Forge3D.",
      },
      { property: "og:title", content: "Créditos e histórico — Forge3D" },
      {
        property: "og:description",
        content: "Orçamento por projeto, custo por geração e log completo de execuções.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsagePage,
});

function UsagePage() {
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [projectId, setProjectId] = useState<string | null>(null);
  const active = useMemo(
    () => projects.find((p) => p.id === projectId) ?? projects[0],
    [projects, projectId],
  );
  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const [budget, setBudget] = useState("");
  useEffect(() => {
    setBudget(String(active?.credit_budget ?? 0));
  }, [active?.id, active?.credit_budget]);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["runs", active?.id],
    queryFn: () => fetchRuns(active!.id),
    enabled: !!active,
  });

  const summary = useMemo(() => summarizeRuns(runs), [runs]);
  const limit = Number(active?.credit_budget ?? 0);
  const pct = limit > 0 ? Math.min(100, (summary.totalCredits / limit) * 100) : 0;

  const saveBudget = async () => {
    if (!active) return;
    const value = Math.max(0, Number(budget) || 0);
    try {
      await updateCreditBudget(active.id, value);
      await qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(value > 0 ? "Orçamento atualizado." : "Orçamento removido (sem limite).");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Activity className="size-5 text-primary" />
            Créditos e histórico
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Custo estimado por geração, orçamento do projeto e log de execuções (estúdio, lote, API
            e MCP).
          </p>
        </div>
        {projects.length > 0 && (
          <Select value={active?.id ?? ""} onValueChange={setProjectId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Créditos usados" value={formatCredits(summary.totalCredits)} />
        <Stat label="Últimas 24h" value={formatCredits(summary.last24hCredits)} />
        <Stat label="Execuções" value={String(summary.totalRuns)} />
        <Stat label="Com erro" value={String(summary.failed)} />
      </section>

      <section className="mt-6 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="size-4 text-primary" />
          <h2 className="text-sm font-medium">Orçamento do projeto</h2>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="budget" className="font-mono text-[11px] uppercase">
              Limite em créditos (0 = sem limite)
            </Label>
            <Input
              id="budget"
              type="number"
              min={0}
              step={10}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-1 w-40"
            />
          </div>
          <Button variant="secondary" disabled={!active} onClick={saveBudget}>
            Salvar
          </Button>
        </div>
        {limit > 0 && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={pct >= 100 ? "h-full bg-destructive" : "h-full bg-primary"}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {formatCredits(summary.totalCredits)} de {formatCredits(limit)} ({Math.round(pct)}%)
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Breakdown
          title="Por tipo de asset"
          rows={summary.byMode.map((m) => ({ label: m.mode, credits: m.credits, runs: m.runs }))}
        />
        <Breakdown
          title="Por origem"
          rows={summary.bySource.map((s) => ({
            label: s.source,
            credits: s.credits,
            runs: s.runs,
          }))}
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium">Histórico de execuções</h2>
        {isLoading && <p className="font-mono text-xs text-muted-foreground">carregando…</p>}
        {!isLoading && runs.length === 0 && (
          <p className="font-mono text-xs text-muted-foreground">
            nenhuma execução registrada neste projeto ainda.
          </p>
        )}
        <div className="space-y-2">
          {runs.map((run) => (
            <article
              key={run.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={run.status === "error" ? "destructive" : "secondary"}>
                    {run.status === "error" ? "erro" : run.mode || run.kind}
                  </Badge>
                  <span className="font-mono text-[11px] text-muted-foreground">{run.source}</span>
                  {run.action && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {run.action}
                    </span>
                  )}
                  {run.view && (
                    <span className="font-mono text-[11px] text-muted-foreground">{run.view}</span>
                  )}
                </div>
                <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">
                  {run.error ?? run.prompt ?? "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs">{formatCredits(Number(run.credits ?? 0))}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {new Date(run.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Presets de exportação</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Aplicados automaticamente em cada pacote ZIP: escala, pivô, material e caminhos.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {Object.values(EXPORT_PRESETS).map((preset) => (
            <div key={preset.id} className="rounded-md border border-border/60 p-3">
              <p className="text-sm font-medium">{preset.label}</p>
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
                <li>{preset.unit}</li>
                <li>
                  pivô {preset.pivot} · {preset.pixelsPerUnit} px/un
                </li>
                <li>malha ×{preset.meshScale} · up {preset.upAxis}</li>
                <li className="break-all">{preset.paths.root}</li>
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-mono text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; credits: number; runs: number }[];
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">sem dados</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map((r) => (
            <li key={r.label} className="flex justify-between font-mono text-[11px]">
              <span className="text-muted-foreground">
                {r.label} ({r.runs})
              </span>
              <span className="tabular-nums">{formatCredits(r.credits)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
