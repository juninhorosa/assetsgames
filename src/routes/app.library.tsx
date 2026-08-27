import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODE_LABELS } from "@/lib/style-profile";
import { deleteAsset, fetchAssets, fetchProjects, signedUrl } from "@/lib/assets-repo";

export const Route = createFileRoute("/app/library")({
  head: () => ({
    meta: [
      { title: "Biblioteca de assets — Forge3D" },
      {
        name: "description",
        content:
          "Consulte, baixe e organize todos os sprites, sprite sheets, texturas PBR e modelos gerados no seu projeto.",
      },
      { property: "og:title", content: "Biblioteca de assets — Forge3D" },
      {
        property: "og:description",
        content: "Seu acervo de assets de jogo com grade, FPS e exportação por engine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Library,
});

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

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets", active?.id],
    queryFn: () => fetchAssets(active!.id),
    enabled: !!active,
  });

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

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Biblioteca de assets</h1>
          <p className="text-sm text-muted-foreground">
            Todos os assets gerados no projeto selecionado.
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

      {isLoading && <p className="font-mono text-xs text-muted-foreground">carregando…</p>}

      {!isLoading && assets.length === 0 && (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum asset salvo ainda neste projeto.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/app">Ir para o gerador</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {assets.map((asset) => (
          <article key={asset.id} className="panel overflow-hidden">
            <Link to="/app/asset/$id" params={{ id: asset.id }}>
              <div className="bg-checker flex aspect-square items-center justify-center">
                {thumbs[asset.id] ? (
                  <img
                    src={thumbs[asset.id]!}
                    alt={asset.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="font-mono text-[10px] text-muted-foreground">sem preview</span>
                )}
              </div>
            </Link>
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
              <Badge variant="secondary" className="font-mono text-[10px]">
                {MODE_LABELS[asset.asset_type] ?? asset.asset_type}
              </Badge>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
