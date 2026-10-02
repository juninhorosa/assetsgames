import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users, Boxes, Activity, ScrollText, Copy, Cpu } from "lucide-react";
import { toast } from "sonner";

import { SpendGuardPanel } from "@/components/admin/SpendGuardPanel";
import { ImageProviderPanel } from "@/components/admin/ImageProviderPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUDIT_ACTION_LABELS,
  describeAudit,
  fetchAuditLog,
  recordAudit,
} from "@/lib/audit-log";
import { useAuth } from "@/hooks/use-auth.tsx";
import { formatCredits } from "@/lib/pricing";
import {
  duplicateGroups,
  fetchAdminCounts,
  fetchAdminDevices,
  fetchAdminProfiles,
  fetchAdminRuns,
  fetchIsAdmin,
  sharedDeviceGroups,
  trialStatus,
  updateProfileTrial,
} from "@/lib/admin-repo";
import type { AdminProfile } from "@/lib/admin-repo";

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

function todayISO(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function AdminPage() {
  const qc = useQueryClient();
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
  const { data: devices = [] } = useQuery({
    queryKey: ["admin-devices"],
    queryFn: fetchAdminDevices,
    enabled,
  });
  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    queryFn: fetchAdminCounts,
    enabled,
  });

  const [from, setFrom] = useState(todayISO(-30));
  const [to, setTo] = useState(todayISO());
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState("");

  const auditFilter = { from, to, action, search };
  const { data: audit = [], isFetching: auditLoading } = useQuery({
    queryKey: ["admin-audit", from, to, action, search],
    queryFn: () => fetchAuditLog(auditFilter),
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

  const dupes = useMemo(() => duplicateGroups(profiles), [profiles]);
  const sharedDevices = useMemo(() => sharedDeviceGroups(devices, profiles), [devices, profiles]);

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
        <Stat
          icon={Users}
          label="Contas"
          value={String(profiles.length)}
          hint={dupes.length ? `${dupes.length} grupo(s) com e-mail repetido` : "sem duplicidades"}
        />
        <Stat icon={Activity} label="Trials ativos" value={String(stats.activeTrials)} />
        <Stat icon={Boxes} label="Projetos / assets" value={`${counts?.projects ?? 0} / ${counts?.assets ?? 0}`} />
        <Stat
          icon={Activity}
          label="Créditos (log)"
          value={formatCredits(stats.credits)}
          hint={`${stats.last24} gerações em 24h · ${stats.failed} com erro`}
        />
      </section>

      <ImageProviderPanel />
      <SpendGuardPanel />

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
              <th className="px-4 py-2">Ajustar</th>
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
                    {p.duplicate_suspect && (
                      <Badge variant="outline" className="mt-1 gap-1 text-[10px]">
                        <Copy className="size-3" />
                        conta repetida
                      </Badge>
                    )}
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
                  <td className="px-4 py-2">
                    <TrialEditor
                      profile={p}
                      onDone={async () => {
                        await qc.invalidateQueries({ queryKey: ["admin-profiles"] });
                        await qc.invalidateQueries({ queryKey: ["admin-audit"] });
                      }}
                    />
                  </td>
                </tr>
              );
            })}
            {profiles.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                  Nenhuma conta encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="panel mb-8 p-0">
        <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wide">
          <Copy className="size-3.5" />
          Contas repetidas
        </h2>
        {dupes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nenhuma repetição detectada. Contas novas com variação do mesmo e-mail (pontos,
            +apelido, gmail/googlemail) entram marcadas e sem créditos de trial.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {dupes.map((g) => (
              <li key={g.key} className="px-4 py-3">
                <div className="font-mono text-[11px] uppercase text-muted-foreground">
                  {g.key} · {g.accounts.length} contas
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.accounts.map((a, i) => (
                    <Badge key={a.id} variant={i === 0 ? "secondary" : "outline"} className="gap-1">
                      {a.email ?? a.id.slice(0, 8)}
                      <span className="text-muted-foreground">
                        {i === 0 ? "original" : "repetida"} ·{" "}
                        {new Date(a.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel mb-8 p-0">
        <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wide">
          <Cpu className="size-3.5" />
          Mesmo hardware (dispositivo)
        </h2>
        {sharedDevices.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nenhuma máquina compartilhada detectada. A assinatura considera GPU/driver, núcleos de
            CPU, memória, ecrã e render de canvas/áudio — a mesma máquina é reconhecida mesmo com
            outro e-mail, navegador limpo ou janela anónima.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {sharedDevices.map((d) => (
              <li key={d.fingerprint} className="px-4 py-3">
                <div className="font-mono text-[11px] uppercase text-muted-foreground">
                  {d.hardware} · {d.accounts.length} contas · visto{" "}
                  {new Date(d.lastSeen).toLocaleString("pt-BR")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.accounts.map((a, i) => (
                    <Badge key={a.id} variant={i === 0 ? "secondary" : "outline"} className="gap-1">
                      {a.email ?? a.id.slice(0, 8)}
                      <span className="text-muted-foreground">
                        {i === 0 ? "original" : "repetida"}
                      </span>
                    </Badge>
                  ))}
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                  id {d.fingerprint.slice(0, 16)}…
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel mb-8 p-0">
        <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wide">
          <ScrollText className="size-3.5" />
          Log de auditoria
        </h2>

        <div className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="font-mono text-[11px] uppercase">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[11px] uppercase">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[11px] uppercase">Ação</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[11px] uppercase">Busca</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e-mail, alvo, detalhe…"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2 font-mono text-[11px]">
          {[
            { label: "Hoje", days: 0 },
            { label: "7 dias", days: -7 },
            { label: "30 dias", days: -30 },
            { label: "90 dias", days: -90 },
          ].map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant="outline"
              onClick={() => {
                setFrom(todayISO(p.days));
                setTo(todayISO());
              }}
            >
              {p.label}
            </Button>
          ))}
          <span className="ml-auto self-center text-muted-foreground">
            {auditLoading ? "carregando…" : `${audit.length} registros`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Horário</th>
                <th className="px-4 py-2">Quem</th>
                <th className="px-4 py-2">Ação</th>
                <th className="px-4 py-2">Alvo</th>
                <th className="px-4 py-2">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t border-border/60 align-top">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px]">
                    {a.actor_email ?? a.actor_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="secondary">
                      {AUDIT_ACTION_LABELS[a.action] ?? a.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                    {a.target_type ? `${a.target_type}:${(a.target_id ?? "").slice(0, 8)}` : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                    {describeAudit(a) || "—"}
                  </td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                    Nenhuma ação registrada no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

function TrialEditor({
  profile,
  onDone,
}: {
  profile: AdminProfile;
  onDone: () => Promise<void> | void;
}) {
  const [days, setDays] = useState("14");
  const [credits, setCredits] = useState(String(profile.trial_credits));
  const [saving, setSaving] = useState(false);

  const extend = async () => {
    const add = Math.max(0, Number(days) || 0);
    const nextCredits = Math.max(0, Number(credits) || 0);
    const base = Math.max(Date.now(), new Date(profile.trial_ends_at).getTime());
    const nextEnds = new Date(base + add * 86_400_000).toISOString();
    setSaving(true);
    try {
      await updateProfileTrial(profile.id, {
        trial_ends_at: nextEnds,
        trial_credits: nextCredits,
      });
      await recordAudit({
        action: "trial.update",
        targetType: "profile",
        targetId: profile.id,
        targetUserId: profile.id,
        details: {
          conta: profile.email ?? profile.id,
          dias_adicionados: add,
          creditos_de: profile.trial_credits,
          creditos_para: nextCredits,
          termina_em: nextEnds.slice(0, 10),
        },
      });
      toast.success("Trial atualizado.");
      await onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-8 w-16"
        value={days}
        onChange={(e) => setDays(e.target.value)}
        aria-label="Dias a adicionar"
      />
      <Input
        className="h-8 w-20"
        value={credits}
        onChange={(e) => setCredits(e.target.value)}
        aria-label="Créditos do trial"
      />
      <Button size="sm" variant="outline" disabled={saving} onClick={extend}>
        {saving ? "…" : "Salvar"}
      </Button>
    </div>
  );
}
