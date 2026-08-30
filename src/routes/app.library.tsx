import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  Download,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODE_LABELS, type AssetMode } from "@/lib/style-profile";
import { deleteAsset, fetchAssets, fetchProjects, signedUrl } from "@/lib/assets-repo";
import { downloadBlob, ENGINE_LABELS, type Engine } from "@/lib/engine-export";
import { buildLibraryZip } from "@/lib/library-export";

export const Route = createFileRoute("/app/library")({
  head: () => ({
    meta: [
      { title: "Biblioteca de assets — Forge3D" },
      {
        name: "description",
        content:
          "Consulte, filtre, selecione e exporte em lote todos os sprites, sprite sheets, texturas PBR e modelos gerados no seu projeto.",
      },
      { property: "og:title", content: "Biblioteca de assets — Forge3D" },
      {
        property: "og:description",
        content: "Seu acervo de assets de jogo com busca, filtros e exportação em lote por engine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Library,
});

type SortKey = "recent" | "oldest" | "name";
type ExportTarget = Engine | "ai" | "muonline";

function Library() {
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

  const [search, setSearch] = useState("");
  const [type, setType] = useState<AssetMode | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<ExportTarget>("unity");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets", active?.id],
    queryFn: () => fetchAssets(active!.id),
    enabled: !!active,
  });

  useEffect(() => {
    setSelected([]);
  }, [active?.id]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assets) map.set(a.asset_type, (map.get(a.asset_type) ?? 0) + 1);
    return map;
  }, [assets]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = assets.filter((a) => {
      if (type !== "all" && a.asset_type !== type) return false;
      if (!q) return true;
      return `${a.name} ${a.prompt}`.toLowerCase().includes(q);
    });
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sort === "oldest" ? da - db : db - da;
    });
  }, [assets, search, type, sort]);

  const { data: thumbs = {} } = useQuery({
    queryKey: ["thumbs", active?.id, assets.map((a) => a.id).join(",")],
    enabled: assets.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        assets.map(async (a) => [a.id, a.storage_path ? await signedUrl(a.storage_path) : null]),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
  });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const allVisibleSelected = visible.length > 0 && visible.every((a) => selected.includes(a.id));

  const selectedRows = useMemo(
    () => assets.filter((a) => selected.includes(a.id)),
    [assets, selected],
  );

  async function exportSelection() {
    if (!active || selectedRows.length === 0) return;
    setBusy("export");
    try {
      const { blob, included, skipped } = await buildLibraryZip(
        selectedRows,
        active.style_profile,
        target === "ai" ? null : target,
        (p) => setBusy(`empacotando ${p.done + 1}/${p.total}`),
      );
      if (included === 0) throw new Error("Nenhum asset selecionado tinha imagem armazenada");
      downloadBlob(
        blob,
        `${active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${target}-pack.zip`,
      );
      toast.success(
        `${included} asset(s) exportado(s)${skipped.length ? ` · ${skipped.length} ignorado(s)` : ""}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function deleteSelection() {
    if (selectedRows.length === 0) return;
    setBusy("delete");
    try {
      for (const row of selectedRows) await deleteAsset(row.id);
      await qc.invalidateQueries({ queryKey: ["assets", active?.id] });
      toast.success(`${selectedRows.length} asset(s) excluído(s)`);
      setSelected([]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex-1 space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Biblioteca de assets</h1>
          <p className="text-sm text-muted-foreground">
            {assets.length} asset(s) no projeto · busque, filtre e exporte em lote.
          </p>
        </div>
        <Select value={active?.id ?? ""} onValueChange={setProjectId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecione um projeto" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Barra de organização */}
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou prompt…"
            className="pl-8"
            aria-label="Buscar assets"
          />
        </div>

        <Select value={type} onValueChange={(v) => setType(v as AssetMode | "all")}>
          <SelectTrigger className="w-44" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos ({assets.length})</SelectItem>
            {(Object.keys(MODE_LABELS) as AssetMode[]).map((m) => (
              <SelectItem key={m} value={m}>
                {MODE_LABELS[m]} ({counts.get(m) ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-40" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="hidden h-8 sm:block" />

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant={view === "grid" ? "secondary" : "ghost"}
            aria-label="Ver em grade"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={view === "list" ? "secondary" : "ghost"}
            aria-label="Ver em lista"
            onClick={() => setView("list")}
          >
            <List className="size-4" />
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setSelected(allVisibleSelected ? [] : Array.from(new Set(visible.map((a) => a.id))))
          }
        >
          {allVisibleSelected ? (
            <Square className="size-4" />
          ) : (
            <CheckSquare className="size-4" />
          )}
          {allVisibleSelected ? "Limpar seleção" : "Selecionar tudo"}
        </Button>
      </div>

      {/* Ações em lote */}
      {selected.length > 0 && (
        <div className="panel flex flex-wrap items-center gap-2 border-primary/40 p-3">
          <Badge className="font-mono text-[10px]">{selected.length} selecionado(s)</Badge>
          <Select value={target} onValueChange={(v) => setTarget(v as ExportTarget)}>
            <SelectTrigger className="w-52" aria-label="Destino da exportação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["unity", "unreal", "godot"] as Engine[]).map((e) => (
                <SelectItem key={e} value={e}>
                  {ENGINE_LABELS[e]}
                </SelectItem>
              ))}
              <SelectItem value="muonline">MU Online (OZT/OZJ)</SelectItem>
              <SelectItem value="ai">Pacote para IA (tudo)</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={exportSelection} disabled={!!busy}>
            {busy && busy !== "delete" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Package className="size-4" />
            )}
            {busy && busy !== "delete" && busy !== "export" ? busy : "Exportar ZIP"}
          </Button>
          <Button size="sm" variant="destructive" onClick={deleteSelection} disabled={!!busy}>
            <Trash2 className="size-4" />
            Excluir
          </Button>
        </div>
      )}

      {isLoading && <p className="font-mono text-xs text-muted-foreground">carregando…</p>}

      {!isLoading && assets.length === 0 && (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum asset salvo ainda neste projeto.</p>
          <Button className="mt-4" asChild>
            <Link to="/app">Ir para o gerador</Link>
          </Button>
        </div>
      )}

      {!isLoading && assets.length > 0 && visible.length === 0 && (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum asset corresponde à busca ou ao filtro atual.
          </p>
        </div>
      )}

      {view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((asset) => (
            <article
              key={asset.id}
              className={`panel overflow-hidden ${selected.includes(asset.id) ? "ring-1 ring-primary" : ""}`}
            >
              <div className="relative">
                <Link to="/app/asset/$id" params={{ id: asset.id }}>
                  <div className="bg-checker flex aspect-square items-center justify-center">
                    {thumbs[asset.id] ? (
                      <img
                        src={thumbs[asset.id]!}
                        alt={asset.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        sem preview
                      </span>
                    )}
                  </div>
                </Link>
                <div className="absolute left-2 top-2 rounded bg-background/85 p-1">
                  <Checkbox
                    checked={selected.includes(asset.id)}
                    onCheckedChange={() => toggle(asset.id)}
                    aria-label={`Selecionar ${asset.name}`}
                  />
                </div>
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/app/asset/$id"
                    params={{ id: asset.id }}
                    className="line-clamp-1 text-sm font-medium hover:text-primary"
                  >
                    {asset.name}
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Excluir ${asset.name}`}
                    onClick={async () => {
                      try {
                        await deleteAsset(asset.id);
                        await qc.invalidateQueries({ queryKey: ["assets", active?.id] });
                        toast.success("Asset excluído");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {MODE_LABELS[asset.asset_type] ?? asset.asset_type}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(asset.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel divide-y divide-border">
          {visible.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center gap-3 p-3 hover:bg-secondary/40"
            >
              <Checkbox
                checked={selected.includes(asset.id)}
                onCheckedChange={() => toggle(asset.id)}
                aria-label={`Selecionar ${asset.name}`}
              />
              <div className="bg-checker flex size-12 shrink-0 items-center justify-center rounded">
                {thumbs[asset.id] ? (
                  <img
                    src={thumbs[asset.id]!}
                    alt={asset.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : null}
              </div>
              <Link
                to="/app/asset/$id"
                params={{ id: asset.id }}
                className="line-clamp-1 flex-1 text-sm font-medium hover:text-primary"
              >
                {asset.name}
              </Link>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {MODE_LABELS[asset.asset_type] ?? asset.asset_type}
              </Badge>
              <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
                {new Date(asset.created_at).toLocaleDateString("pt-BR")}
              </span>
              <Button size="icon" variant="ghost" asChild aria-label={`Abrir ${asset.name}`}>
                <Link to="/app/asset/$id" params={{ id: asset.id }}>
                  <Download className="size-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
