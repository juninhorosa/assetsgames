import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SpritePlayer } from "@/components/studio/SpritePlayer";
import { MaterialPreview3D } from "@/components/studio/MaterialPreview3D";
import { MAP_LABELS, loadImage, sliceSheet, type MapType } from "@/lib/image-pipeline";
import { DEFAULT_STYLE_PROFILE, MODE_LABELS, type StyleProfile } from "@/lib/style-profile";
import {
  ENGINE_LABELS,
  buildEngineZip,
  downloadBlob,
  downloadDataUrl,
  slugify,
  type Engine,
} from "@/lib/engine-export";
import { fetchAsset, fetchProjects, signedUrl } from "@/lib/assets-repo";

export const Route = createFileRoute("/app/asset/$id")({
  component: AssetDetail,
});

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    reader.readAsDataURL(blob);
  });
}

function AssetDetail() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["asset", id],
    queryFn: () => fetchAsset(id),
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  const [image, setImage] = useState<string | null>(null);
  const [maps, setMaps] = useState<Partial<Record<MapType, string>>>({});
  const [frames, setFrames] = useState<string[]>([]);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      if (data.asset.storage_path) {
        const url = await signedUrl(data.asset.storage_path);
        if (url && !cancelled) {
          const dataUrl = await toDataUrl(url);
          if (cancelled) return;
          setImage(dataUrl);
          const anim = data.animations[0];
          if (anim?.frame_data?.columns && anim.frame_data.rows) {
            const img = await loadImage(dataUrl);
            if (!cancelled)
              setFrames(sliceSheet(img, anim.frame_data.columns, anim.frame_data.rows).frames);
          }
        }
      }
      const entries = await Promise.all(
        data.maps.map(async (m) => {
          const url = await signedUrl(m.storage_path);
          return [m.map_type, url ? await toDataUrl(url) : null] as const;
        }),
      );
      if (!cancelled) {
        setMaps(
          Object.fromEntries(entries.filter(([, v]) => v)) as Partial<Record<MapType, string>>,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (isLoading) {
    return <p className="p-6 font-mono text-xs text-muted-foreground">carregando asset…</p>;
  }
  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Não foi possível carregar este asset.</p>
        <Button className="mt-4" variant="secondary" asChild>
          <Link to="/app/library">Voltar para a biblioteca</Link>
        </Button>
      </div>
    );
  }

  const { asset, animations } = data;
  const project = projects.find((p) => p.id === asset.project_id);
  const style: StyleProfile = { ...DEFAULT_STYLE_PROFILE, ...(project?.style_profile ?? {}) };
  const anim = animations[0];

  function exportEngine(engine: Engine | null) {
    if (!image) return;
    const zip = buildEngineZip(
      {
        name: asset.name,
        mode: asset.asset_type,
        style,
        prompt: asset.final_prompt ?? asset.prompt,
        image,
        maps,
        frames,
        frameRects: (anim?.frame_data?.rects ?? []) as never,
        animation:
          anim && anim.frame_data.columns && anim.frame_data.rows
            ? {
                name: anim.name,
                fps: anim.fps,
                columns: anim.frame_data.columns,
                rows: anim.frame_data.rows,
              }
            : undefined,
      },
      engine,
    );
    downloadBlob(zip, `${slugify(asset.name)}-${engine ?? "ai-pack"}.zip`);
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" aria-label="Voltar" asChild>
            <Link to="/app/library">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{asset.name}</h1>
            <p className="font-mono text-[11px] text-muted-foreground">
              {new Date(asset.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {MODE_LABELS[asset.asset_type] ?? asset.asset_type}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => image && downloadDataUrl(image, `${slugify(asset.name)}.png`)}
            disabled={!image}
          >
            <Download className="size-4" />
            PNG
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={!image}>
                <Package className="size-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(ENGINE_LABELS) as Engine[]).map((engine) => (
                <DropdownMenuItem key={engine} onClick={() => exportEngine(engine)}>
                  {ENGINE_LABELS[engine]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => exportEngine(null)}>
                Pacote para IA (manifesto)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="bg-checker flex min-h-[320px] items-center justify-center overflow-hidden rounded-md border border-border">
            {image ? (
              <img
                src={image}
                alt={asset.name}
                className="max-h-[520px] max-w-full object-contain"
                style={style.style === "pixel-art" ? { imageRendering: "pixelated" } : undefined}
              />
            ) : (
              <span className="font-mono text-xs text-muted-foreground">carregando imagem…</span>
            )}
          </div>

          {frames.length > 1 && (
            <section className="space-y-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                Animação — {anim?.name}
              </h2>
              <SpritePlayer
                frames={frames}
                initialFps={anim?.fps ?? 12}
                pixelated={style.style === "pixel-art"}
              />
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
                    onClick={() => downloadDataUrl(url!, `${slugify(asset.name)}-${map}.png`)}
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
        </div>

        <aside className="space-y-4">
          <div className="panel space-y-3 p-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              Metadados
            </h2>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Projeto</dt>
                <dd>{project?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Prompt do usuário</dt>
                <dd className="leading-relaxed">{asset.prompt}</dd>
              </div>
            </dl>
            <Separator />
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                Prompt final
              </span>
              <pre className="max-h-64 overflow-auto rounded border border-border bg-card p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {asset.final_prompt ?? asset.prompt}
              </pre>
            </div>
          </div>
          <Button variant="secondary" className="w-full" asChild>
            <Link to="/app">Gerar variação no estúdio</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
