import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Anchor,
  Bot,
  Box,
  Boxes,
  Download,
  FolderPlus,
  ListChecks,
  Loader2,
  Package,
  PlayCircle,
  Save,
  Crop,
  Scissors,

  Sparkles,
  Wand2,
  X,
} from "lucide-react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Model3DAnimator } from "@/components/studio/Model3DAnimator";
import { FrameEditor } from "@/components/studio/FrameEditor";


import {
  ANIMATION_ACTIONS,
  findAction,

  DEFAULT_STYLE_PROFILE,
  MODE_LABELS,
  STYLE_LABELS,
  VIEW_LABELS,
  DIRECTION_SETS,
  findDirectionSet,
  type ViewKey,
  buildPrompt,

  DEFAULT_MODEL3D_STYLE,
  MODEL3D_STYLES,
  findModel3dStyle,
  type Model3dStyleKey,
  type AssetMode,
  type StyleKey,
  type StyleProfile,
  type TilesetKind,
  isPixelStyle,
} from "@/lib/style-profile";
import {
  DEFAULT_ALIGN_OPTIONS,
  DEFAULT_FRAMING_OPTIONS,
  DEFAULT_PBR_OPTIONS,
  MAP_LABELS,
  alignFrames,
  composeSheetFromDataUrls,
  derivePbrMaps,
  loadImage,
  normalizeFraming,
  normalizeFramingBatch,
  removeBackground,

  sliceSheet,
  type FrameRect,
  type MapType,
  type PbrOptions,
  type PivotMode,
} from "@/lib/image-pipeline";

import {
  DEFAULT_RELIEF_OPTIONS,
  animatedGlbBytes,
  buildRelief,
  exportAnimatedGlb,
  exportGlb,
  glbBytes,
  type MeshData,
  type MotionFrame,
  type ReliefOptions,
} from "@/lib/mesh-3d";
import { streamEdit, streamGenerate } from "@/lib/stream-image";
import { finishPixelArt } from "@/lib/pixel-processing";
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
import {
  advanceQueue,
  clearQueue,
  loadQueue,
  saveQueue,
  type QueueJob,
  type QueueState,
} from "@/lib/batch-queue";


export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Estúdio de criação de assets — Forge3D" },
      {
        name: "description",
        content:
          "Gere sprites, sprite sheets animados em várias direções, texturas PBR e relevos 3D com o Style Profile do seu projeto.",
      },
      { property: "og:title", content: "Estúdio de criação de assets — Forge3D" },
      {
        property: "og:description",
        content: "Prompt, preview, refino e exportação por engine no estúdio do Forge3D.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Generator,
});

const UI_KINDS = ["ícone", "botão", "moldura", "barra de vida", "cursor", "emblema"];
const TILESET_KINDS: { value: TilesetKind; label: string }[] = [
  { value: "terrain", label: "Terreno completo" },
  { value: "autotile", label: "Autotile / transições" },
  { value: "walls", label: "Paredes e cantos" },
  { value: "objects", label: "Objetos de mapa" },
];
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

  // Garante que exista sempre um projeto padrão (salvar/biblioteca dependem dele)
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (loadingProjects || bootstrapped.current) return;
    if (projects.length > 0) {
      bootstrapped.current = true;
      return;
    }
    bootstrapped.current = true;
    createProject({ name: "Projeto 1", style_profile: DEFAULT_STYLE_PROFILE })
      .then(async (created) => {
        await qc.invalidateQueries({ queryKey: ["projects"] });
        setProjectId(created.id);
      })
      .catch(() => {
        bootstrapped.current = false;
      });
  }, [loadingProjects, projects.length, qc]);


  const [profile, setProfile] = useState<StyleProfile>(DEFAULT_STYLE_PROFILE);
  useEffect(() => {
    if (project) setProfile({ ...DEFAULT_STYLE_PROFILE, ...project.style_profile });
  }, [project?.id]);

  const [mode, setMode] = useState<AssetMode>("sprite");
  const [prompt, setPrompt] = useState("");
  const [animation, setAnimation] = useState<string>("walk");

  function selectAction(id: string) {
    setAnimation(id);
    const action = findAction(id);
    if (action) {
      setColumns(action.columns);
      setRows(action.rows);
      setFps(action.fps);
    }
  }

  const [columns, setColumns] = useState(4);
  const [rows, setRows] = useState(2);
  const [uiKind, setUiKind] = useState<string>(UI_KINDS[0]!);
  const [tileSize, setTileSize] = useState(32);
  const [tileColumns, setTileColumns] = useState(4);
  const [tileRows, setTileRows] = useState(4);
  const [tilesetKind, setTilesetKind] = useState<TilesetKind>("terrain");
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
  const [fps, setFps] = useState(12);
  const [packActions, setPackActions] = useState<string[]>(["idle", "walk", "run", "attack"]);
  const [packProgress, setPackProgress] = useState<{ done: number; total: number } | null>(null);

  const [relief, setRelief] = useState<MeshData | null>(null);
  const [reliefOpts, setReliefOpts] = useState<ReliefOptions>(DEFAULT_RELIEF_OPTIONS);
  const [motion3d, setMotion3d] = useState<MotionFrame[] | null>(null);

  const [model3dStyle, setModel3dStyle] = useState<Model3dStyleKey>(DEFAULT_MODEL3D_STYLE);
  const [directionSet, setDirectionSet] = useState<string>("single");

  // Consistência: referência visual travada do personagem
  const [lockCharacter, setLockCharacter] = useState(true);
  const [reference, setReference] = useState<string | null>(null);

  // Pivô / trim
  const [pivotMode, setPivotMode] = useState<PivotMode>("bottom-center");
  const [pivot, setPivot] = useState<{ x: number; y: number } | null>(null);

  // Fila de lote retomável
  const [pendingQueue, setPendingQueue] = useState<QueueState | null>(null);
  const cancelRef = useRef(false);
  useEffect(() => {
    setPendingQueue(loadQueue());
  }, []);




  const params = { mode, animation, columns, rows, uiKind, model3dStyle, tileSize, tileColumns, tileRows, tilesetKind };
  const finalPrompt = useMemo(() => buildPrompt(prompt, profile, params), [prompt, profile, mode, animation, columns, rows, uiKind, model3dStyle, tileSize, tileColumns, tileRows, tilesetKind]);

  async function applyPixelFinish(source: string, targetMode: AssetMode, cols = columns, rws = rows) {
    if (!isPixelStyle(profile.style) && targetMode !== "tileset") return source;
    const logical = Math.max(16, profile.pixelGrid ?? 64);
    return finishPixelArt(source, {
      width: targetMode === "tileset" ? tileColumns * tileSize : targetMode === "spritesheet" ? cols * logical : logical,
      height: targetMode === "tileset" ? tileRows * tileSize : targetMode === "spritesheet" ? rws * logical : logical,
      paletteSize: profile.paletteSize ?? 24,
    });
  }

  /** Preset de malha coerente com a variação de estilo, mantendo sentido e silhueta. */
  function selectModel3dStyle(id: Model3dStyleKey) {
    setModel3dStyle(id);
    const variant = findModel3dStyle(id);
    setReliefOpts((prev) => ({ ...prev, ...variant.relief }));
  }

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
    setMotion3d(null);
    setPivot(null);
  }

  const CONSISTENCY_RULE =
    "Mantenha exatamente o mesmo personagem da imagem de referência: mesmas cores, roupas, " +
    "acessórios, proporções e paleta. Altere apenas a pose, a ação e o ângulo de câmera pedidos. " +
    "Fundo branco liso.";

  /**
   * Geração unificada. Com referência travada, usa edição guiada pela imagem do
   * personagem (consistência entre ações e direções); sem referência, gera do zero.
   */
  async function runGeneration(promptText: string, ref: string | null): Promise<string> {
    let out = "";
    const onFrame = (dataUrl: string, final: boolean) => {
      out = dataUrl;
      setImage(dataUrl);
      setIsFinal(final);
    };
    if (ref) {
      const blob = await (await fetch(ref)).blob();
      await streamEdit(blob, `${promptText}\n\n${CONSISTENCY_RULE}`, onFrame);
    } else {
      await streamGenerate({ prompt: promptText, size }, onFrame);
    }
    if (!out) throw new Error("A geração não retornou nenhuma imagem");
    return out;
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
      const generated = await runGeneration(finalPrompt, null);
      const out = await applyPixelFinish(generated, mode);
      setImage(out);
      setIsFinal(true);
      if (mode === "spritesheet" || mode === "tileset") {
        const img = await loadImage(out);
        const cols = mode === "tileset" ? tileColumns : columns;
        const rws = mode === "tileset" ? tileRows : rows;
        const sliced = sliceSheet(img, cols, rws);
        setFrames(sliced.frames);
        setRects(sliced.rects);
        setCell({ w: sliced.cellWidth, h: sliced.cellHeight });
      }
      if (lockCharacter && mode !== "tileset") setReference(out);
      if (!name.trim()) setName(prompt.trim().slice(0, 48));
      toast.success("Asset gerado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /**
   * Executa (ou retoma) uma fila de lote. O cursor só avança depois do asset
   * estar salvo, então fechar a aba no meio não perde o que já foi gerado.
   */
  async function runQueue(initial: QueueState) {
    cancelRef.current = false;
    let state = initial;
    saveQueue(state);
    setPendingQueue(state);
    let ref = state.reference ?? (lockCharacter ? reference : null);

    try {
      for (let i = state.cursor; i < state.jobs.length; i++) {
        if (cancelRef.current) {
          toast.info("Lote pausado — use “Retomar lote” quando quiser continuar");
          setPendingQueue({ ...state });
          return;
        }
        const job = state.jobs[i]!;
        setBusy(`${job.label} (${i + 1}/${state.jobs.length})`);
        setPackProgress({ done: i, total: state.jobs.length });
        setIsFinal(false);
        setImage(null);
        resetDerived();

        const generated = await runGeneration(job.finalPrompt, ref);
        const out = await applyPixelFinish(generated, job.mode, job.columns, job.rows);
        setImage(out);
        setIsFinal(true);
        if (!ref && lockCharacter) {
          ref = out;
          setReference(out);
          state = { ...state, reference: out };
        }

        if (job.kind === "spritesheet") {
          const cols = job.columns ?? 4;
          const rws = job.rows ?? 2;
          const img = await loadImage(out);
          const sliced = sliceSheet(img, cols, rws);
          setAnimation(job.action ?? animation);
          setColumns(cols);
          setRows(rws);
          setFps(job.fps ?? 12);
          setFrames(sliced.frames);
          setRects(sliced.rects);
          setCell({ w: sliced.cellWidth, h: sliced.cellHeight });

          await saveAsset({
            projectId: state.projectId,
            name: job.assetName,
            mode: "spritesheet",
            prompt: job.prompt,
            finalPrompt: job.finalPrompt,
            params: {
              mode: "spritesheet",
              animation: job.action,
              columns: cols,
              rows: rws,
              size: job.size,
              view: job.view ?? state.profile.view,
            },
            image: out,
            maps: {},
            frames: sliced.frames,
            animation: {
              name: job.view ? `${job.action}_${job.view}` : (job.action ?? "clip"),
              fps: job.fps ?? 12,
              columns: cols,
              rows: rws,
              cellWidth: sliced.cellWidth,
              cellHeight: sliced.cellHeight,
              rects: sliced.rects,
            },
          });
        } else {
          await saveAsset({
            projectId: state.projectId,
            name: job.assetName,
            mode: job.mode,
            prompt: job.prompt,
            finalPrompt: job.finalPrompt,
            params: { ...params, size: job.size, view: job.view ?? state.profile.view },
            image: out,
            maps: {},
            frames: [],
          });
        }

        state = advanceQueue(state, i + 1);
        setPackProgress({ done: i + 1, total: state.jobs.length });
      }

      clearQueue();
      setPendingQueue(null);
      await qc.invalidateQueries({ queryKey: ["assets", state.projectId] });
      toast.success(`${state.jobs.length} assets salvos na biblioteca`);
    } catch (e) {
      saveQueue(state);
      setPendingQueue({ ...state });
      toast.error(`${(e as Error).message} — o lote ficou salvo, use “Retomar lote”.`);
    } finally {
      setBusy(null);
      setPackProgress(null);
    }
  }

  /** Uma sheet por ação × direção selecionada, tudo salvo na biblioteca. */
  async function generatePack() {
    if (!prompt.trim()) {
      toast.error("Descreva o personagem antes de gerar o pack");
      return;
    }
    if (!project) {
      toast.error("Crie um projeto primeiro");
      return;
    }
    if (packActions.length === 0) {
      toast.error("Selecione pelo menos uma ação");
      return;
    }

    const actions = ANIMATION_ACTIONS.filter((a) => packActions.includes(a.id));
    const set = findDirectionSet(directionSet);
    const views: (ViewKey | undefined)[] = set.views.length ? set.views : [undefined];
    const baseName = name.trim() || prompt.trim().slice(0, 32);

    const jobs: QueueJob[] = actions.flatMap((action) =>
      views.map((view) => {
        const viewLabel = view ? VIEW_LABELS[view] : null;
        return {
          id: `${action.id}-${view ?? "base"}`,
          kind: "spritesheet" as const,
          label: `Gerando ${action.label}${viewLabel ? ` · ${viewLabel}` : ""}`,
          prompt,
          finalPrompt: buildPrompt(prompt, profile, {
            mode: "spritesheet",
            animation: action.id,
            columns: action.columns,
            rows: action.rows,
            view,
          }),
          mode: "spritesheet" as AssetMode,
          size,
          assetName: `${baseName} — ${action.label}${viewLabel ? ` — ${viewLabel}` : ""}`,
          view,
          action: action.id,
          columns: action.columns,
          rows: action.rows,
          fps: action.fps,
        };
      }),
    );

    await runQueue({
      projectId: project.id,
      baseName,
      createdAt: new Date().toISOString(),
      cursor: 0,
      jobs,
      profile,
      reference: lockCharacter ? (reference ?? undefined) : undefined,
    });
  }

  /** Gera o asset estático (sprite/model3d) em cada direção do conjunto e salva. */
  async function generateDirections() {
    if (!prompt.trim()) {
      toast.error("Descreva o asset antes de gerar as direções");
      return;
    }
    if (!project) {
      toast.error("Crie um projeto primeiro");
      return;
    }
    const set = findDirectionSet(directionSet);
    if (!set.views.length) {
      toast.error("Escolha um conjunto de direções");
      return;
    }
    const baseName = name.trim() || prompt.trim().slice(0, 32);

    const jobs: QueueJob[] = set.views.map((view) => ({
      id: `dir-${view}`,
      kind: "static" as const,
      label: `Gerando ${VIEW_LABELS[view]}`,
      prompt,
      finalPrompt: buildPrompt(prompt, profile, { ...params, view }),
      mode,
      size,
      assetName: `${baseName} — ${VIEW_LABELS[view]}`,
      view,
    }));

    await runQueue({
      projectId: project.id,
      baseName,
      createdAt: new Date().toISOString(),
      cursor: 0,
      jobs,
      profile,
      reference: lockCharacter ? (reference ?? undefined) : undefined,
    });
  }

  /** Trim + pivô comum em todos os quadros, e recomposição da sheet. */
  async function alignSequence() {
    if (frames.length === 0) return;
    setBusy("Alinhando quadros");
    try {
      const aligned = await alignFrames(frames, { ...DEFAULT_ALIGN_OPTIONS, pivot: pivotMode });
      setFrames(aligned.frames);
      setPivot(aligned.pivot);
      const sheet = await composeSheetFromDataUrls(aligned.frames, columns);
      setImage(sheet.dataUrl);
      setIsFinal(true);
      setRects(sheet.rects);
      setColumns(sheet.columns);
      setRows(sheet.rows);
      setCell({ w: sheet.cellWidth, h: sheet.cellHeight });
      toast.success(`${aligned.frames.length} quadros alinhados no pivô`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** Aplica a sequência editada (ordem/remoções) recompondo a sheet. */
  async function applyFrameEdits(next: string[]) {
    setFrames(next);
    try {
      const sheet = await composeSheetFromDataUrls(next, columns);
      setImage(sheet.dataUrl);
      setIsFinal(true);
      setRects(sheet.rects);
      setColumns(sheet.columns);
      setRows(sheet.rows);
      setCell({ w: sheet.cellWidth, h: sheet.cellHeight });
    } catch (e) {
      toast.error((e as Error).message);
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

  /** Normaliza o enquadramento: mesma escala, mesma margem e mesmo tamanho de saída. */
  async function normalizeFrame() {
    if (!image) return;
    setBusy("Enquadrando asset");
    try {
      const opts = { ...DEFAULT_FRAMING_OPTIONS, pivot: pivotMode };
      if (frames.length > 0) {
        const raw = await Promise.all(
          frames.map(async (f) => {
            const img = await loadImage(f);
            return hasAlpha(img) ? f : removeBackground(img);
          }),
        );
        const framed = await normalizeFramingBatch(raw, opts);
        setFrames(framed);
        const sheet = await composeSheetFromDataUrls(framed, columns);
        setImage(sheet.dataUrl);
        setIsFinal(true);
        setRects(sheet.rects);
        setColumns(sheet.columns);
        setRows(sheet.rows);
        setCell({ w: sheet.cellWidth, h: sheet.cellHeight });
        toast.success(`${framed.length} quadros enquadrados em ${opts.canvas}px`);
      } else {
        const img = await loadImage(image);
        const source = hasAlpha(img) ? img : await loadImage(removeBackground(img));
        setImage(normalizeFraming(source, opts));
        setIsFinal(true);
        toast.success(`Enquadrado em ${opts.canvas}×${opts.canvas}px`);
      }
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
      const sliceColumns = mode === "tileset" ? tileColumns : columns;
      const sliceRows = mode === "tileset" ? tileRows : rows;
      const result = sliceSheet(img, sliceColumns, sliceRows);
      setFrames(result.frames);
      setRects(result.rects);
      setCell({ w: result.cellWidth, h: result.cellHeight });
      toast.success(`${result.frames.length} ${mode === "tileset" ? "tiles" : "quadros"} extraídos`);
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
          (mode === "spritesheet" || mode === "tileset") && frames.length
            ? {
                name: mode === "tileset" ? tilesetKind : animation,
                fps: mode === "tileset" ? 1 : fps,
                columns: mode === "tileset" ? tileColumns : columns,
                rows: mode === "tileset" ? tileRows : rows,
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

  /** Stop-motion 3D: uma malha de relevo por quadro da animação. */
  async function buildMotion3d() {
    if (!frames.length) {
      toast.error("Fatie os quadros da sheet primeiro");
      return;
    }
    setBusy("Gerando movimento 3D");
    try {
      const built: MotionFrame[] = [];
      for (let i = 0; i < frames.length; i++) {
        const raw = await loadImage(frames[i]!);
        const source = hasAlpha(raw) ? frames[i]! : removeBackground(raw);
        const img = source === frames[i] ? raw : await loadImage(source);
        built.push({ mesh: buildRelief(img, reliefOpts), albedo: source });
        setBusy(`Gerando movimento 3D (${i + 1}/${frames.length})`);
      }
      setMotion3d(built);
      toast.success(`${built.length} quadros 3D prontos`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function downloadMotionGlb() {
    if (!motion3d) return;
    const id = slugify(name || "asset");
    setBusy("Exportando GLB animado");
    try {
      const blob = await exportAnimatedGlb(motion3d, `${id}_${animation}`, fps);
      downloadBlob(blob, `${id}_${animation}_animated.glb`);
      toast.success("GLB animado exportado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** Coleta as malhas GLB (estática, sequência e clip animado) para o pacote. */
  async function collectModels(id: string) {
    const models: Record<string, Uint8Array> = {};
    if (relief && image) models[`models/${id}.glb`] = await glbBytes(relief, image, id);
    if (motion3d) {
      for (let i = 0; i < motion3d.length; i++) {
        const frame = motion3d[i]!;
        const label = String(i).padStart(2, "0");
        models[`models/frames/${id}_${label}.glb`] = await glbBytes(
          frame.mesh,
          frame.albedo,
          `${id}_${label}`,
        );
      }
      models[`models/${id}_animated.glb`] = await animatedGlbBytes(
        motion3d,
        `${id}_${animation}`,
        fps,
      );
    }
    return models;
  }

  async function buildExportPayload(id: string) {
    return {
      name: name.trim() || "asset",
      mode,
      style: profile,
      prompt: finalPrompt,
      image: image!,
      maps,
      frames,
      frameRects: rects,
      animation:
        mode === "spritesheet" && frames.length
          ? {
              name: animation,
              label: findAction(animation)?.label,
              fps,
              columns,
              rows,
            }
          : undefined,
      models: await collectModels(id),
      motion3d: motion3d
        ? {
            fps,
            frameCount: motion3d.length,
            depth: reliefOpts.depth,
            segments: reliefOpts.segments,
            style: findModel3dStyle(model3dStyle).label,
          }
        : undefined,
      tileset:
        mode === "tileset"
          ? { tileSize, columns: tileColumns, rows: tileRows, kind: tilesetKind }
          : undefined,
    };
  }

  async function exportEngine(engine: Engine | null) {
    if (!image) return;
    const id = slugify(name || "asset");
    setBusy("Empacotando");
    try {
      const zip = buildEngineZip(await buildExportPayload(id), engine);
      downloadBlob(zip, `${id}-${engine ?? "ai-pack"}.zip`);
      toast.success(engine ? `Pacote ${engine} pronto` : "Pacote para IA pronto");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function exportMuOnline() {
    if (!image) return;
    const id = slugify(name || "asset");
    setBusy("Convertendo para OZT");
    try {
      const { buildMuOnlineZip } = await import("@/lib/muonline-export");
      const zip = await buildMuOnlineZip(await buildExportPayload(id));
      downloadBlob(zip, `${id}-muonline.zip`);
      toast.success("Pacote MU Online (OZT/OZJ) pronto");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] min-w-0 grid-cols-[minmax(0,1fr)] flex-1 gap-px overflow-x-hidden bg-border xl:grid-cols-[300px_minmax(420px,1fr)_320px]">
      <h1 className="sr-only">Estúdio de criação de assets</h1>
      {/* ── Projeto & estilo ─────────────────────────────── */}
      <aside className="order-2 space-y-6 bg-sidebar p-4 xl:order-1">
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
            <Label>Sentido / vista (travado no projeto)</Label>
            <Select
              value={profile.view ?? "side-right"}
              onValueChange={(v) => setProfile({ ...profile, view: v as ViewKey })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VIEW_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Todos os assets do projeto são gerados neste mesmo ângulo e direção.
            </p>
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
      <main className="studio-grid order-1 space-y-5 bg-background p-4 sm:p-6 xl:order-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Workspace · criação guiada</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Crie seu próximo asset</h1>
            <p className="mt-1 text-sm text-muted-foreground">Defina o tipo, descreva o visual e acompanhe o resultado em tempo real.</p>
          </div>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase text-primary">Estilo travado</span>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as AssetMode)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 overflow-hidden sm:grid-cols-3 2xl:grid-cols-5">
            {Object.entries(MODE_LABELS).map(([k, label]) => (
              <TabsTrigger key={k} value={k} className="min-w-0 whitespace-normal px-2 py-2 text-center text-[11px] leading-tight">
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
                <Label>Ação do personagem</Label>
                <Select value={animation} onValueChange={selectAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANIMATION_ACTIONS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
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
          {mode === "tileset" && (
            <>
              <div className="space-y-2">
                <Label>Conjunto</Label>
                <Select value={tilesetKind} onValueChange={(value) => setTilesetKind(value as TilesetKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TILESET_KINDS.map((kind) => <SelectItem key={kind.value} value={kind.value}>{kind.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tile</Label>
                <Select value={String(tileSize)} onValueChange={(value) => setTileSize(Number(value))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[16, 32, 48, 64].map((value) => <SelectItem key={value} value={String(value)}>{value}×{value}px</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grade {tileColumns}×{tileRows}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={String(tileColumns)} onValueChange={(value) => setTileColumns(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[3, 4, 6, 8].map((value) => <SelectItem key={value} value={String(value)}>{value} col.</SelectItem>)}</SelectContent></Select>
                  <Select value={String(tileRows)} onValueChange={(value) => setTileRows(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[3, 4, 6, 8].map((value) => <SelectItem key={value} value={String(value)}>{value} lin.</SelectItem>)}</SelectContent></Select>
                </div>
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

        {pendingQueue && busy === null && (
          <section className="flex flex-wrap items-center gap-3 rounded-md border border-primary/40 bg-primary/5 p-3">
            <div className="flex-1 text-xs">
              <p className="font-medium">
                Lote pendente — {pendingQueue.cursor}/{pendingQueue.jobs.length} concluídos
              </p>
              <p className="text-muted-foreground">
                {pendingQueue.baseName} · iniciado em{" "}
                {new Date(pendingQueue.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <Button size="sm" onClick={() => runQueue(pendingQueue)}>
              <PlayCircle className="size-4" />
              Retomar lote
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearQueue();
                setPendingQueue(null);
              }}
            >
              <X className="size-4" />
              Descartar
            </Button>
          </section>
        )}

        {busy !== null && packProgress && (
          <Button
            variant="ghost"
            className="w-full text-xs"
            onClick={() => {
              cancelRef.current = true;
            }}
          >
            Pausar lote depois do quadro atual
          </Button>
        )}

        <section className="space-y-3 rounded-md border border-border bg-card/40 p-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Consistência do personagem
          </h2>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox
              checked={lockCharacter}
              onCheckedChange={(v) => setLockCharacter(v === true)}
            />
            <span className="flex-1">
              Travar aparência pela primeira imagem
              <span className="block text-[11px] text-muted-foreground">
                As demais ações e direções são geradas a partir dela, mantendo cores, roupas e
                proporções idênticas.
              </span>
            </span>
          </label>
          {reference && (
            <div className="flex items-center gap-3">
              <span className="bg-checker size-14 shrink-0 overflow-hidden rounded border border-border">
                <img
                  src={reference}
                  alt="Referência do personagem"
                  className="size-full object-contain"
                />
              </span>
              <div className="flex-1 text-[11px] text-muted-foreground">Referência ativa</div>
              <Button size="sm" variant="ghost" onClick={() => setReference(null)}>
                Limpar
              </Button>
            </div>
          )}
          {!reference && image && (
            <Button size="sm" variant="secondary" onClick={() => setReference(image)}>
              Usar imagem atual como referência
            </Button>
          )}
        </section>


        <section className="space-y-3 rounded-md border border-border bg-card/40 p-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Direções de câmera
          </h2>
          <Select value={directionSet} onValueChange={setDirectionSet}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTION_SETS.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            O mesmo personagem e as mesmas ações vistos de cada direção — estilo, paleta e
            proporções continuam travados pelo Style Profile.
          </p>
          {mode !== "spritesheet" && mode !== "tileset" && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={generateDirections}
              disabled={busy !== null || findDirectionSet(directionSet).views.length === 0}
            >
              {packProgress ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Boxes className="size-4" />
              )}
              {packProgress
                ? `Gerando ${packProgress.done}/${packProgress.total}`
                : `Gerar em ${findDirectionSet(directionSet).views.length || 0} direções`}
            </Button>
          )}
        </section>


        {mode === "spritesheet" && (
          <section className="space-y-3 rounded-md border border-border bg-card/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                Pack de animações
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
                  onClick={() => setPackActions(ANIMATION_ACTIONS.map((a) => a.id))}
                >
                  todas
                </button>
                <button
                  type="button"
                  className="font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
                  onClick={() => setPackActions([])}
                >
                  limpar
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Uma sheet por ação, com grade e FPS próprios, fatiada e salva na biblioteca — mesmo
              personagem e mesmo Style Profile em todas.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ANIMATION_ACTIONS.map((a) => {
                const checked = packActions.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center gap-2 rounded border border-border/60 px-2 py-1.5 text-sm hover:border-primary/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        setPackActions((prev) =>
                          v ? [...prev, a.id] : prev.filter((id) => id !== a.id),
                        )
                      }
                    />
                    <span className="flex-1">{a.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {a.columns * a.rows}f · {a.fps}fps
                    </span>
                  </label>
                );
              })}
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={generatePack}
              disabled={busy !== null || packActions.length === 0}
            >
              {packProgress ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ListChecks className="size-4" />
              )}
              {packProgress
                ? `Gerando pack ${packProgress.done}/${packProgress.total}`
                : `Gerar pack (${packActions.length} ações × ${findDirectionSet(directionSet).views.length || 1} direções)`}
            </Button>
          </section>
        )}



        <div className="bg-checker neon-shadow relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-lg border border-primary/25">
          {image ? (
            <img
              src={image}
              alt={name || "Asset gerado"}
              className={`max-h-[520px] w-auto max-w-full transition-[filter] duration-300 ${
                isFinal ? "blur-0" : "blur-2xl"
              }`}
              style={isPixelStyle(profile.style) ? { imageRendering: "pixelated" } : undefined}
            />
          ) : (
            <div className="max-w-xs px-6 text-center">
              <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary"><Sparkles className="size-6" /></span>
              <p className="font-display text-base font-medium text-foreground">Sua criação aparece aqui</p>
              <p className="mt-1 text-sm text-muted-foreground">O resultado ganha detalhes enquanto é renderizado.</p>
            </div>
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
               {mode === "tileset" ? `Prévia dos tiles — ${tileColumns}×${tileRows}` : `Player de animação — ${findAction(animation)?.label ?? animation}`}
            </h2>
              <SpritePlayer
              frames={frames}
                initialFps={mode === "tileset" ? 1 : fps}
                pixelated={isPixelStyle(profile.style) || mode === "tileset"}
            />
          </section>
        )}

        {frames.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
               Editor de {mode === "tileset" ? "tiles" : "quadros"} — {frames.length} itens
              </h2>
              {pivot && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  pivô {pivot.x.toFixed(0)},{pivot.y.toFixed(0)} · célula {cell.w}×{cell.h}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Edite pixels, reordene, duplique ou remova itens — a sheet é recomposta automaticamente.
            </p>
            <FrameEditor
              frames={frames}
              pixelated={isPixelStyle(profile.style) || mode === "tileset"}
              onChange={applyFrameEdits}
            />
          </section>
        )}


        {motion3d && (
          <section className="space-y-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              Movimento 3D — {findAction(animation)?.label ?? animation}
            </h2>
            <Model3DAnimator frames={motion3d} initialFps={fps} />
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
      <aside className="order-3 space-y-6 bg-sidebar p-4 xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto">
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
          <Button
            variant="secondary"
            className="w-full"
            onClick={normalizeFrame}
            disabled={!image || busy !== null}
          >
            <Crop className="size-4" />
            Enquadrar (tamanho único)
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Recorta o alpha e reescala o sujeito para ocupar sempre a mesma fração de uma tela de{" "}
            {DEFAULT_FRAMING_OPTIONS.canvas}×{DEFAULT_FRAMING_OPTIONS.canvas}px, no mesmo pivô — todos
            os assets saem com o mesmo tamanho e margem.
          </p>

          {(mode === "spritesheet" || mode === "tileset") && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={slice}
              disabled={!image || busy !== null}
            >
              Fatiar {mode === "tileset" ? `${tileColumns}×${tileRows} tiles` : `${columns}×${rows} quadros`}
            </Button>
          )}
          {frames.length > 0 && (
            <div className="space-y-2 rounded-md border border-border bg-card/40 p-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                Pivô e trim
              </p>
              <Select value={pivotMode} onValueChange={(v) => setPivotMode(v as PivotMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-center">Base central (pés no chão)</SelectItem>
                  <SelectItem value="center">Centro da célula</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                className="w-full"
                onClick={alignSequence}
                disabled={busy !== null}
              >
                <Anchor className="size-4" />
                Alinhar quadros no pivô
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Recorta o alpha de cada quadro e alinha tudo numa célula comum, eliminando a
                tremida da animação nas engines.
              </p>
            </div>
          )}

          {(mode === "model3d" || mode === "spritesheet") && (
            <>
              <div className="space-y-2">
                <Label>Variação de estilo 3D</Label>
                <Select
                  value={model3dStyle}
                  onValueChange={(v) => selectModel3dStyle(v as Model3dStyleKey)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL3D_STYLES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label} — {s.hint}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Muda só superfície e shading. Sentido ({VIEW_LABELS[profile.view ?? "side-right"]}),
                  volume e silhueta ficam travados.
                </p>
              </div>
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
                    {[48, 72, 96, 128, 144, 192, 256].map((n) => (
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
              {mode === "spritesheet" && (
                <>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={buildMotion3d}
                    disabled={!frames.length || busy !== null}
                  >
                    <Boxes className="size-4" />
                    Gerar movimento 3D ({frames.length || 0} quadros)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={downloadMotionGlb}
                    disabled={!motion3d || busy !== null}
                  >
                    <Download className="size-4" />
                    Baixar .glb animado
                  </Button>
                </>
              )}
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
              <DropdownMenuItem onClick={() => exportMuOnline()}>
                MU Online (OZT/OZJ)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportEngine(null)}>
                <Bot className="size-4" />
                Pacote para IA (manifesto)
              </DropdownMenuItem>
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
