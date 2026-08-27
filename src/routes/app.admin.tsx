import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Users, Boxes, Activity } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth.tsx";
import { formatCredits } from "@/lib/pricing";
import {
  fetchAdminCounts,
  fetchAdminProfiles,
  fetchAdminRuns,
  fetchIsAdmin,
  trialStatus,
} from "@/lib/admin-repo";

export const Route = createFileRoute("/app/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Forge3D" },
      {
        name: "description",
        content:
          "Painel de administração do Forge3D: contas, status de trial, projetos, assets e histórico de gerações.",
      },
      { property: "og:title", content: "Administração — Forge3D" },
      {
        property: "og:description",
        content: "Status de acessos, trials e uso da plataforma Forge3D.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading: checking } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () => fetchIsAdmin(user!.id),
    enabled: !!user,
  });

  const enabled = isAdmin === true;
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: fetchAdminProfiles,
    enabled,
  });
  const { data: runs = [] } = useQuery({
    queryKey: ["admin-runs"],
    queryFn: fetchAdminRuns,
    enabled,
  });
  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    queryFn: fetchAdminCounts,
    enabled,
  });

  const stats = useMemo(() => {
    const now = Date.now();
    const credits = runs.reduce((sum, r) => sum + Number(r.credits || 0), 0);
    const last24 = runs.filter((r) => now - new Date(r.created_at).getTime() < 86_400_000).length;
    const failed = runs.filter((r) => r.status !== "success").length;
    const activeTrials = profiles.filter((p) => trialStatus(p).active && p.plan !== "admin").length;
    return { credits, last24, failed, activeTrials };
  }, [runs, profiles]);

  if (checking) {
    return (
      <main className="p-6 font-mono text-xs text-muted-foreground">verificando permissão…</main>
    );
  }

  if (!enabled) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldCheck className="mx-auto mb-4 size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold tracking-tight">Área restrita</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta página é apenas para administradores.
        </p>
        <Link to="/app" className="mt-6 inline-block text-sm text-primary underline">
          Voltar ao estúdio
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ShieldCheck className="size-5 text-primary" />
          Administração
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status de acessos, trials e consumo da plataforma.
        </p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Contas" value={String(profiles.length)} />
        <Stat icon={Activity} label="Trials ativos" value={String(stats.activeTrials)} />
        <Stat icon={Boxes} label="Projetos / assets" value={`${counts?.projects ?? 0} / ${counts?.assets ?? 0}`} />
        <Stat
          icon={Activity}
          label="Créditos (log)"
          value={formatCredits(stats.credits)}
          hint={`${stats.last24} gerações em 24h · ${stats.failed} com erro`}
        />
      </section>

      <section className="panel mb-8 overflow-x-auto p-0">
        <h2 className="border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wide">
          Contas e trial
        </h2>
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Conta</th>
              <th className="px-4 py-2">Plano</th>
              <th className="px-4 py-2">Trial</th>
              <th className="px-4 py-2">Criada em</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const t = trialStatus(p);
              return (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="px-4 py-2">
                    <div>{p.display_name ?? "—"}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {p.email ?? p.id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={p.plan === "admin" ? "default" : "secondary"}>{p.plan}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <span className={t.active ? "" : "text-muted-foreground"}>{t.label}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              );
            })}
            {profiles.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={4}>
                  Nenhuma conta encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto p-0">
        <h2 className="border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wide">
          Últimas gerações
        </h2>
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Quando</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Origem</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Créditos</th>
            </tr>
          </thead>
          <tbody>
            {runs.slice(0, 60).map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-2">{r.mode ?? r.kind}</td>
                <td className="px-4 py-2 font-mono text-[11px]">{r.source}</td>
                <td className="px-4 py-2">
                  <Badge variant={r.status === "success" ? "secondary" : "destructive"}>
                    {r.status}
                  </Badge>
                </td>
                <td className="px-4 py-2 font-mono text-[11px]">{formatCredits(r.credits)}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                  Nenhuma geração registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 font-mono text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
