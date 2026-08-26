import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Download,
  FolderPlus,
  Loader2,
  Package,
  Save,
  Scissors,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { PbrControls } from "@/components/studio/PbrControls";
import { SpritePlayer } from "@/components/studio/SpritePlayer";
import { MaterialPreview3D } from "@/components/studio/MaterialPreview3D";
import { Model3DPreview } from "@/components/studio/Model3DPreview";

import {
  ANIMATION_PRESETS,
  DEFAULT_STYLE_PROFILE,
  MODE_LABELS,
  STYLE_LABELS,
  buildPrompt,
  type AssetMode,
  type StyleKey,
  type StyleProfile,
} from "@/lib/style-profile";
import {
  DEFAULT_PBR_OPTIONS,
  MAP_LABELS,
  derivePbrMaps,
  loadImage,
  removeBackground,
  sliceSheet,
  type FrameRect,
  type MapType,
  type PbrOptions,
} from "@/lib/image-pipeline";
import {
  DEFAULT_RELIEF_OPTIONS,
  buildRelief,
  exportGlb,
  type MeshData,
  type ReliefOptions,
} from "@/lib/mesh-3d";
import { streamEdit, streamGenerate } from "@/lib/stream-image";
import {
  ENGINE_LABELS,
  buildEngineZip,
  downloadBlob,
  downloadDataUrl,
  slugify,
  type Engine,
} from "@/lib/engine-export";
import {
  createProject,
  fetchProjects,
  saveAsset,
  updateStyleProfile,
  type ProjectRow,
} from "@/lib/assets-repo";

export const Route = createFileRoute("/app/")({
  component: Generator,
});

const UI_KINDS = ["ícone", "botão", "moldura", "barra de vida", "cursor", "emblema"];
const SIZES = [
  { value: "1024x1024", label: "Quadrado 1024" },
  { value: "1536x1024", label: "Paisagem 1536×1024" },
  { value: "1024x1536", label: "Retrato 1024×1536" },
];

/** True when the image already carries transparency (so cut-out can be skipped). */
function hasAlpha(img: HTMLImageElement): boolean {
  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 250) return true;
  return false;
}

function Generator() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const [projectId, setProjectId] = useState<string | null>(null);
  const project: ProjectRow | undefined = useMemo(
    () => projects.find((p) => p.id === projectId) ?? projects[0],
    [projects, projectId],
  );
  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const [profile, setProfile] = useState<StyleProfile>(DEFAULT_STYLE_PROFILE);
  useEffect(() => {
    if (project) setProfile({ ...DEFAULT_STYLE_PROFILE, ...project.style_profile });
  }, [project?.id]);

  const [mode, setMode] = useState<AssetMode>("sprite");
  const [prompt, setPrompt] = useState("");
  const [animation, setAnimation] = useState<string>("walk");
  const [columns, setColumns] = useState(4);
  const [rows, setRows] = useState(2);
  const [uiKind, setUiKind] = useState<string>(UI_KINDS[0]!);
  const [size, setSize] = useState<string>(SIZES[0]!.value);

  const [image, setImage] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [editInstruction, setEditInstruction] = useState("");

  const [pbr, setPbr] = useState<PbrOptions>(DEFAULT_PBR_OPTIONS);
  const [maps, setMaps] = useState<Partial<Record<MapType, string>>>({});
  const [frames, setFrames] = useState<string[]>([]);
  const [rects, setRects] = useState<FrameRect[]>([]);
  const [cell, setCell] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [fps] = useState(12);
  const [relief, setRelief] = useState<MeshData | null>(null);
  const [reliefOpts, setReliefOpts] = useState<ReliefOptions>(DEFAULT_RELIEF_OPTIONS);

  const params = { mode, animation, columns, rows, uiKind };
  const finalPrompt = useMemo(() => buildPrompt(prompt, profile, params), [prompt, profile, mode, animation, columns, rows, uiKind]);

  const newProject = useMutation({
    mutationFn: async () => {
      const count = projects.length + 1;
      return createProject({
        name: `Projeto ${count}`,
        style_profile: DEFAULT_STYLE_PROFILE,
      });
    },
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ["projects"] });
      setProjectId(created.id);
      toast.success("Projeto criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveStyle = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("Crie um projeto primeiro");
      await updateStyleProfile(project.id, profile);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Style Profile salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetDerived() {
    setMaps({});
    setFrames([]);
    setRects([]);
    setRelief(null);
  }

  async function generate() {
    if (!prompt.trim()) {
      toast.error("Descreva o asset que deseja gerar");
      return;
    }
    setBusy("Gerando");
    setIsFinal(false);
    setImage(null);
    resetDerived();
    try {
      await streamGenerate({ prompt: finalPrompt, size }, (dataUrl, final) => {
        setImage(dataUrl);
        setIsFinal(final);
      });
      if (!name.trim()) setName(prompt.trim().slice(0, 48));
      toast.success("Asset gerado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function applyEdit() {
    if (!image || !editInstruction.trim()) return;
    setBusy("Refinando");
    setIsFinal(false);
    try {
      const blob = await (await fetch(image)).blob();
      await streamEdit(blob, editInstruction, (dataUrl, final) => {
        setImage(dataUrl);
        setIsFinal(final);
      });
      resetDerived();
      setEditInstruction("");
      toast.success("Refinamento aplicado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function cutout() {
    if (!image) return;
    setBusy("Recortando alpha");
    try {
      const img = await loadImage(image);
      setImage(removeBackground(img));
      toast.success("Fundo removido");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function derive() {
    if (!image) return;
    setBusy("Derivando mapas PBR");
    try {
      const img = await loadImage(image);
      setMaps(derivePbrMaps(img, pbr));
      toast.success("Conjunto PBR pronto");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function slice() {
    if (!image) return;
    setBusy("Fatiando sheet");
    try {
      const img = await loadImage(image);
      const result = sliceSheet(img, columns, rows);
      setFrames(result.frames);
      setRects(result.rects);
      setCell({ w: result.cellWidth, h: result.cellHeight });
      toast.success(`${result.frames.length} quadros extraídos`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** 2.5D reliefization: silhueta (alpha) + luminância (altura) -> malha. */
  async function buildMesh() {
    if (!image) return;
    setBusy("Construindo malha 3D");
    try {
      const raw = await loadImage(image);
      // A malha precisa de alpha; recorta o fundo branco caso ainda esteja opaco.
      const source = raw.width && !hasAlpha(raw) ? removeBackground(raw) : image;
      const img = source === image ? raw : await loadImage(source);
      if (source !== image) setImage(source);
      setRelief(buildRelief(img, reliefOpts));
      toast.success("Malha 3D gerada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function downloadGlb() {
    if (!relief || !image) return;
    setBusy("Exportando GLB");
    try {
      const blob = await exportGlb(relief, image, slugify(name || "asset"));
      downloadBlob(blob, `${slugify(name || "asset")}.glb`);
      toast.success("GLB exportado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const persist = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("Crie um projeto primeiro");
      if (!image) throw new Error("Gere um asset primeiro");
      return saveAsset({
        projectId: project.id,
        name: name.trim() || "asset sem nome",
        mode,
        prompt,
        finalPrompt,
        params: { ...params, size },
        image,
        maps,
        frames,
        animation:
          mode === "spritesheet" && frames.length
            ? {
                name: animation,
                fps,
                columns,
                rows,
                cellWidth: cell.w,
                cellHeight: cell.h,
                rects,
              }
            : undefined,
      });
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["assets", project?.id] });
      toast.success("Asset salvo na biblioteca");
      navigate({ to: "/app/asset/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportEngine(engine: Engine) {
    if (!image) return;
    const zip = buildEngineZip(
      {
        name: name.trim() || "asset",
        mode,
        style: profile,
        prompt: finalPrompt,
        image,
        maps,
        frames,
        frameRects: rects,
        animation:
          mode === "spritesheet" && frames.length
            ? { name: animation, fps, columns, rows }
            : undefined,
      },
      engine,
    );
    downloadBlob(zip, `${slugify(name || "asset")}-${engine}.zip`);
  }

  return (
    <div className="grid flex-1 gap-px bg-border lg:grid-cols-[320px_1fr_340px]">
      {/* ── Projeto & estilo ─────────────────────────────── */}
      <aside className="space-y-6 bg-background p-4">
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Projeto
          </h2>
          <div className="flex gap-2">
            <Select value={project?.id ?? ""} onValueChange={setProjectId}>
              <SelectTrigger className="flex-1">
                <SelectValue
                  placeholder={loadingProjects ? "carregando..." : "nenhum projeto"}
                />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="secondary"
              aria-label="Novo projeto"
              onClick={() => newProject.mutate()}
              disabled={newProject.isPending}
            >
              <FolderPlus className="size-4" />
            </Button>
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Style Profile
          </h2>
          <div className="space-y-2">
            <Label>Estilo visual</Label>
            <Select
              value={profile.style}
              onValueChange={(v) => setProfile({ ...profile, style: v as StyleKey })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STYLE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Paleta</Label>
            <Input
              value={profile.palette}
              onChange={(e) => setProfile({ ...profile, palette: e.target.value })}
              placeholder="ex: tons frios com acentos magenta"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Nível de detalhe</Label>
              <span className="font-mono text-[11px] text-primary">{profile.detail}/10</span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[profile.detail]}
              onValueChange={([v]) => setProfile({ ...profile, detail: v ?? profile.detail })}
            />
          </div>
          <div className="space-y-2">
            <Label>Resolução alvo (px)</Label>
            <Select
              value={String(profile.resolution)}
              onValueChange={(v) => setProfile({ ...profile, resolution: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[32, 64, 128, 256, 512, 1024, 2048].map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Diretrizes extras</Label>
            <Textarea
              rows={3}
              value={profile.extra}
              onChange={(e) => setProfile({ ...profile, extra: e.target.value })}
              placeholder="ex: contorno escuro, iluminação superior, sem texto"
            />
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => saveStyle.mutate()}
            disabled={saveStyle.isPending || !project}
          >
            Salvar Style Profile
          </Button>
        </section>
      </aside>

      {/* ── Prompt & preview ─────────────────────────────── */}
      <main className="space-y-5 bg-background p-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as AssetMode)}>
          <TabsList className="w-full">
            {Object.entries(MODE_LABELS).map(([k, label]) => (
              <TabsTrigger key={k} value={k} className="flex-1 text-xs">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="prompt">Descrição do asset</Label>
          <Textarea
            id="prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="ex: cavaleiro élfico com armadura de folhas e lança curta"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {mode === "spritesheet" && (
            <>
              <div className="space-y-2">
                <Label>Animação</Label>
                <Select value={animation} onValueChange={setAnimation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANIMATION_PRESETS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Colunas: {columns}</Label>
                <Slider
                  min={2}
                  max={8}
                  step={1}
                  value={[columns]}
                  onValueChange={([v]) => setColumns(v ?? columns)}
                />
              </div>
              <div className="space-y-2">
                <Label>Linhas: {rows}</Label>
                <Slider min={1} max={6} step={1} value={[rows]} onValueChange={([v]) => setRows(v ?? rows)} />
              </div>
            </>
          )}
          {mode === "ui" && (
            <div className="space-y-2">
              <Label>Tipo de elemento</Label>
              <Select value={uiKind} onValueChange={setUiKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UI_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Formato</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button className="w-full" onClick={generate} disabled={busy !== null}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ?? "Gerar asset"}
        </Button>

        <div className="bg-checker flex min-h-[360px] items-center justify-center overflow-hidden rounded-md border border-border">
          {image ? (
            <img
              src={image}
              alt={name || "Asset gerado"}
              className={`max-h-[520px] w-auto max-w-full transition-[filter] duration-300 ${
                isFinal ? "blur-0" : "blur-2xl"
              }`}
              style={profile.style === "pixel-art" ? { imageRendering: "pixelated" } : undefined}
            />
          ) : (
            <p className="px-6 text-center text-sm text-muted-foreground">
              O preview aparece aqui e vai se refinando conforme o modelo renderiza.
            </p>
          )}
        </div>

        {image && (
          <div className="space-y-2">
            <Label htmlFor="edit">Refinar por instrução</Label>
            <div className="flex gap-2">
              <Input
                id="edit"
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                placeholder="ex: deixe a armadura mais dourada e o fundo totalmente branco"
              />
              <Button variant="secondary" onClick={applyEdit} disabled={busy !== null}>
                <Wand2 className="size-4" />
                Aplicar
              </Button>
            </div>
          </div>
        )}

        {frames.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              Player de animação — {animation}
            </h2>
            <SpritePlayer
              frames={frames}
              initialFps={fps}
              pixelated={profile.style === "pixel-art"}
            />
          </section>
        )}

        {relief && image && (
          <section className="space-y-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              Modelo 3D
            </h2>
            <Model3DPreview mesh={relief} albedo={image} />
          </section>
        )}

        {Object.keys(maps).length > 0 && (
          <section className="space-y-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              Material PBR
            </h2>
            <MaterialPreview3D maps={maps} />
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(maps).map(([map, url]) => (
                <button
                  key={map}
                  onClick={() => downloadDataUrl(url!, `${slugify(name || "asset")}-${map}.png`)}
                  className="space-y-1 text-left"
                >
                  <span className="bg-checker block overflow-hidden rounded border border-border">
                    <img src={url} alt={MAP_LABELS[map as MapType]} className="w-full" />
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {MAP_LABELS[map as MapType]}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Pós-processamento & exportação ───────────────── */}
      <aside className="space-y-6 bg-background p-4">
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Pós-processamento
          </h2>
          <Button
            variant="secondary"
            className="w-full"
            onClick={cutout}
            disabled={!image || busy !== null}
          >
            <Scissors className="size-4" />
            Remover fundo (alpha)
          </Button>
          {mode === "spritesheet" && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={slice}
              disabled={!image || busy !== null}
            >
              Fatiar {columns}×{rows} quadros
            </Button>
          )}
          {mode === "model3d" && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Profundidade</Label>
                  <span className="font-mono text-[11px] text-primary">
                    {reliefOpts.depth.toFixed(2)}
                  </span>
                </div>
                <Slider
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={[reliefOpts.depth]}
                  onValueChange={([v]) =>
                    setReliefOpts({ ...reliefOpts, depth: v ?? reliefOpts.depth })
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Suavização</Label>
                  <span className="font-mono text-[11px] text-primary">
                    {reliefOpts.smooth.toFixed(2)}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.1}
                  value={[reliefOpts.smooth]}
                  onValueChange={([v]) =>
                    setReliefOpts({ ...reliefOpts, smooth: v ?? reliefOpts.smooth })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Resolução da malha</Label>
                <Select
                  value={String(reliefOpts.segments)}
                  onValueChange={(v) => setReliefOpts({ ...reliefOpts, segments: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[48, 96, 128, 192, 256].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}×{n} quads
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={buildMesh}
                disabled={!image || busy !== null}
              >
                <Box className="size-4" />
                Gerar malha 3D
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={downloadGlb}
                disabled={!relief || busy !== null}
              >
                <Download className="size-4" />
                Baixar .glb
              </Button>
            </>
          )}
          {mode === "texture" && (
            <>
              <PbrControls options={pbr} onChange={setPbr} />
              <Button
                variant="secondary"
                className="w-full"
                onClick={derive}
                disabled={!image || busy !== null}
              >
                Derivar mapas PBR
              </Button>
            </>
          )}
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Biblioteca & exportação
          </h2>
          <div className="space-y-2">
            <Label htmlFor="asset-name">Nome do asset</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="elf_knight_walk"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => persist.mutate()}
            disabled={!image || persist.isPending}
          >
            <Save className="size-4" />
            Salvar no projeto
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => image && downloadDataUrl(image, `${slugify(name || "asset")}.png`)}
            disabled={!image}
          >
            <Download className="size-4" />
            Baixar PNG
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full" disabled={!image}>
                <Package className="size-4" />
                Exportar para engine
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(ENGINE_LABELS) as Engine[]).map((engine) => (
                <DropdownMenuItem key={engine} onClick={() => exportEngine(engine)}>
                  {ENGINE_LABELS[engine]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Prompt final enviado
          </h2>
          <pre className="max-h-64 overflow-auto rounded-md border border-border bg-card p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {finalPrompt}
          </pre>
        </section>
      </aside>
    </div>
  );
}
