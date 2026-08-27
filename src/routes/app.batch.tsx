import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ListChecks, Play, Square, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ANIMATION_ACTIONS,
  DEFAULT_STYLE_PROFILE,
  VIEW_LABELS,
  buildPrompt,
  type StyleProfile,
} from "@/lib/style-profile";
import { loadImage, sliceSheet } from "@/lib/image-pipeline";
import { streamGenerate } from "@/lib/stream-image";
import { fetchProjects, saveAsset } from "@/lib/assets-repo";

export const Route = createFileRoute("/app/batch")({
  head: () => ({
    meta: [
      { title: "Geração em lote — Forge3D Asset Studio" },
      {
        name: "description",
        content:
          "Gere elencos completos de monstros e personagens com todos os movimentos, sempre no mesmo sentido e estilo.",
      },
      { property: "og:title", content: "Geração em lote — Forge3D Asset Studio" },
      {
        property: "og:description",
        content: "Bestiário e elenco em lote com animações completas e estilo travado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BatchPage,
});

interface RosterEntry {
  name: string;
  description: string;
}
type UnitStatus = "pending" | "running" | "done" | "error";
interface UnitState {
  status: UnitStatus;
  detail: string;
}

function BatchPage() {
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [projectId, setProjectId] = useState<string | null>(null);
  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? projects[0],
    [projects, projectId],
  );
  const profile: StyleProfile = { ...DEFAULT_STYLE_PROFILE, ...(project?.style_profile ?? {}) };

  const [kind, setKind] = useState<"monster" | "character">("monster");
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(10);
  const [actions, setActions] = useState<string[]>(["idle", "walk", "attack", "death"]);
  const [withBase, setWithBase] = useState(true);

  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [states, setStates] = useState<Record<number, UnitState>>({});
  const [rosterBusy, setRosterBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const stopRef = useRef(false);

  const selected = ANIMATION_ACTIONS.filter((a) => actions.includes(a.id));
  const imagesPerUnit = selected.length + (withBase ? 1 : 0);
  const doneCount = Object.values(states).filter((s) => s.status === "done").length;

  async function generateRoster() {
    if (!theme.trim()) {
      toast.error("Descreva o tema do elenco");
      return;
    }
    setRosterBusy(true);
    try {
      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          count,
          kind,
          style: `${profile.style}, ${profile.palette}`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { entries: RosterEntry[] };
      setRoster(data.entries);
      setStates({});
      toast.success(`${data.entries.length} conceitos criados`);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao criar o elenco");
    } finally {
      setRosterBusy(false);
    }
  }

  function setUnit(i: number, state: UnitState) {
    setStates((prev) => ({ ...prev, [i]: state }));
  }

  async function runBatch() {
    if (!project) {
      toast.error("Crie um projeto no Gerador primeiro");
      return;
    }
    if (roster.length === 0) {
      toast.error("Gere o elenco antes");
      return;
    }
    stopRef.current = false;
    setRunning(true);
    try {
      for (let i = 0; i < roster.length; i++) {
        if (stopRef.current) break;
        const unit = roster[i]!;
        const subject = `${unit.name} — ${unit.description}`;

        try {
          if (withBase) {
            setUnit(i, { status: "running", detail: "sprite base" });
            const basePrompt = buildPrompt(subject, profile, { mode: "sprite" });
            let base = "";
            await streamGenerate({ prompt: basePrompt, size: "1024x1024" }, (url) => {
              base = url;
              setPreview(url);
            });
            if (!base) throw new Error("sprite base falhou");
            await saveAsset({
              projectId: project.id,
              name: `${unit.name} — base`,
              mode: "sprite",
              prompt: subject,
              finalPrompt: basePrompt,
              params: { mode: "sprite", view: profile.view, size: "1024x1024" },
              image: base,
              maps: {},
            });
          }

          for (const action of selected) {
            if (stopRef.current) break;
            setUnit(i, { status: "running", detail: action.label });
            const sheetPrompt = buildPrompt(subject, profile, {
              mode: "spritesheet",
              animation: action.id,
              columns: action.columns,
              rows: action.rows,
            });
            let sheet = "";
            await streamGenerate({ prompt: sheetPrompt, size: "1024x1024" }, (url) => {
              sheet = url;
              setPreview(url);
            });
            if (!sheet) throw new Error(`${action.label} falhou`);

            const img = await loadImage(sheet);
            const sliced = sliceSheet(img, action.columns, action.rows);
            await saveAsset({
              projectId: project.id,
              name: `${unit.name} — ${action.label}`,
              mode: "spritesheet",
              prompt: subject,
              finalPrompt: sheetPrompt,
              params: {
                mode: "spritesheet",
                animation: action.id,
                columns: action.columns,
                rows: action.rows,
                view: profile.view,
                size: "1024x1024",
              },
              image: sheet,
              maps: {},
              frames: sliced.frames,
              animation: {
                name: action.id,
                fps: action.fps,
                columns: action.columns,
                rows: action.rows,
                cellWidth: sliced.cellWidth,
                cellHeight: sliced.cellHeight,
                rects: sliced.rects,
              },
            });
          }
          setUnit(i, { status: "done", detail: `${imagesPerUnit} assets` });
        } catch (e) {
          setUnit(i, { status: "error", detail: (e as Error).message });
        }
      }
      await qc.invalidateQueries({ queryKey: ["assets", project.id] });
      toast.success(stopRef.current ? "Lote interrompido" : "Lote concluído");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid flex-1 gap-6 p-4 lg:grid-cols-[380px_1fr]">
      {/* ── Configuração ─────────────────────────────── */}
      <aside className="space-y-5">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 font-mono text-sm uppercase tracking-[0.2em] text-primary">
            <Users className="size-4" /> Elenco em lote
          </h1>
          <p className="text-xs text-muted-foreground">
            Gera dezenas de criaturas ou personagens completos — sprite base + todos os movimentos —
            usando o Style Profile e o sentido travado do projeto.
          </p>
        </header>

        <div className="space-y-2">
          <Label>Projeto</Label>
          <Select value={project?.id ?? ""} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="font-mono text-[10px] text-muted-foreground">
            sentido travado: {VIEW_LABELS[profile.view ?? "side-right"]}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as "monster" | "character")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monster">Monstros / inimigos</SelectItem>
              <SelectItem value="character">Personagens / NPCs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme">Tema do elenco</Label>
          <Textarea
            id="theme"
            rows={3}
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="ex: monstros de caverna vulcânica, de ratos mutantes a golens de obsidiana"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Quantidade</Label>
            <span className="font-mono text-[11px] text-primary">{count}</span>
          </div>
          <Slider
            min={1}
            max={100}
            step={1}
            value={[count]}
            onValueChange={([v]) => setCount(v ?? count)}
          />
        </div>

        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <Label>Movimentos por unidade</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className="font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
                onClick={() => setActions(ANIMATION_ACTIONS.map((a) => a.id))}
              >
                todos
              </button>
              <button
                type="button"
                className="font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
                onClick={() => setActions([])}
              >
                limpar
              </button>
            </div>
          </div>
          <div className="grid gap-1.5">
            {ANIMATION_ACTIONS.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={actions.includes(a.id)}
                  onCheckedChange={(v) =>
                    setActions((prev) => (v ? [...prev, a.id] : prev.filter((x) => x !== a.id)))
                  }
                />
                <span className="flex-1">{a.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {a.columns * a.rows}f · {a.fps}fps
                </span>
              </label>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 border-t border-border pt-2 text-sm">
            <Checkbox checked={withBase} onCheckedChange={(v) => setWithBase(Boolean(v))} />
            <span>Incluir sprite base (retrato / referência)</span>
          </label>
        </div>

        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={generateRoster}
            disabled={rosterBusy || running}
          >
            {rosterBusy ? <Loader2 className="size-4 animate-spin" /> : <ListChecks className="size-4" />}
            {rosterBusy ? "Criando conceitos…" : `Criar elenco de ${count}`}
          </Button>
          {running ? (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                stopRef.current = true;
                toast.message("Parando após o asset atual…");
              }}
            >
              <Square className="size-4" /> Parar lote
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={runBatch}
              disabled={roster.length === 0 || imagesPerUnit === 0}
            >
              <Play className="size-4" /> Gerar {roster.length * imagesPerUnit} assets
            </Button>
          )}
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            {imagesPerUnit} imagens por unidade · lotes grandes levam bastante tempo e consomem
            créditos de IA; pode parar a qualquer momento e retomar depois.
          </p>
        </div>
      </aside>

      {/* ── Fila + preview ───────────────────────────── */}
      <main className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Fila {roster.length > 0 ? `— ${doneCount}/${roster.length}` : ""}
          </h2>
          {running && (
            <span className="flex items-center gap-2 font-mono text-[11px] text-primary">
              <Loader2 className="size-3 animate-spin" /> gerando…
            </span>
          )}
        </div>

        {preview && (
          <div className="bg-checker flex items-center justify-center overflow-hidden rounded-md border border-border">
            <img src={preview} alt="Asset em geração" className="max-h-[320px] w-auto" />
          </div>
        )}

        {roster.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Descreva o tema e clique em “Criar elenco” — a IA monta a lista de conceitos distintos e
            você dispara a produção completa.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {roster.map((unit, i) => {
              const st = states[i];
              return (
                <li key={`${unit.name}-${i}`} className="flex items-start gap-3 p-3">
                  <span className="mt-0.5 shrink-0">
                    {st?.status === "done" ? (
                      <Check className="size-4 text-primary" />
                    ) : st?.status === "error" ? (
                      <X className="size-4 text-destructive" />
                    ) : st?.status === "running" ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : (
                      <span className="block size-4 rounded-full border border-border" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {i + 1}. {unit.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{unit.description}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {st?.detail ?? "na fila"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
