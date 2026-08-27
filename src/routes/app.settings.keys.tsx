import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, RefreshCw, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCredits } from "@/lib/pricing";
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
} from "@/lib/api-keys.functions";

export const Route = createFileRoute("/app/settings/keys")({
  head: () => ({
    meta: [
      { title: "Chaves de API — Forge3D" },
      {
        name: "description",
        content:
          "Crie, rotacione e revogue chaves de API do Forge3D, com contagem de requisições e créditos consumidos por chave.",
      },
      { property: "og:title", content: "Chaves de API — Forge3D" },
      {
        property: "og:description",
        content: "Gerencie o acesso de agentes e integrações à sua conta Forge3D.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KeysPage,
});

function KeysPage() {
  const qc = useQueryClient();
  const list = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const rotate = useServerFn(rotateApiKey);
  const revoke = useServerFn(revokeApiKey);
  const remove = useServerFn(deleteApiKey);

  const [name, setName] = useState("");
  /** Segredo revelado uma única vez, logo após criar ou rotacionar. */
  const [revealed, setRevealed] = useState<{ key: string; label: string } | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => list(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["api-keys"] });

  const createMut = useMutation({
    mutationFn: (n: string) => create({ data: { name: n } }),
    onSuccess: (res) => {
      setRevealed({ key: res.key, label: name || "nova chave" });
      setName("");
      invalidate();
      toast.success("Chave criada — copie agora, ela não será mostrada de novo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotateMut = useMutation({
    mutationFn: (id: string) => rotate({ data: { id } }),
    onSuccess: (res) => {
      setRevealed({ key: res.key, label: "chave rotacionada" });
      invalidate();
      toast.success("Chave rotacionada. A anterior foi revogada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Chave revogada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Chave excluída.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Copiado.");
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <KeyRound className="size-5 text-primary" />
          Chaves de API
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use no header <code className="font-mono text-xs">x-forge3d-key</code> das chamadas REST e
          do servidor MCP. Guardamos apenas o hash — o segredo aparece uma única vez.
        </p>
      </header>

      <section className="rounded-lg border border-border p-4">
        <Label htmlFor="key-name" className="font-mono text-[11px] uppercase">
          Nova chave
        </Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            id="key-name"
            value={name}
            placeholder="ex.: pipeline-unity, agente-claude"
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Button
            disabled={!name.trim() || createMut.isPending}
            onClick={() => createMut.mutate(name.trim())}
          >
            Gerar chave
          </Button>
        </div>
      </section>

      {revealed && (
        <section className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="font-mono text-[11px] uppercase text-primary">
            Segredo de {revealed.label}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-background px-2 py-1 font-mono text-xs">
              {revealed.key}
            </code>
            <Button size="sm" variant="secondary" onClick={() => copy(revealed.key)}>
              <Copy className="size-4" /> Copiar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
              Já guardei
            </Button>
          </div>
        </section>
      )}

      <section className="mt-6 space-y-3">
        {isLoading && (
          <p className="font-mono text-xs text-muted-foreground">carregando chaves…</p>
        )}
        {!isLoading && keys.length === 0 && (
          <p className="font-mono text-xs text-muted-foreground">
            nenhuma chave ainda — gere a primeira acima.
          </p>
        )}
        {keys.map((k) => {
          const revoked = !!k.revoked_at;
          return (
            <article
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{k.name}</span>
                  <Badge variant={revoked ? "outline" : "secondary"}>
                    {revoked ? "revogada" : "ativa"}
                  </Badge>
                </div>
                <code className="mt-1 block font-mono text-[11px] text-muted-foreground">
                  {k.prefix}••••••••
                </code>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {k.request_count ?? 0} requisições · {formatCredits(Number(k.credits_used ?? 0))}{" "}
                  · último uso{" "}
                  {k.last_used_at ? new Date(k.last_used_at).toLocaleString("pt-BR") : "nunca"}
                </p>
              </div>

              <div className="flex items-center gap-1">
                {!revoked && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={rotateMut.isPending}
                      onClick={() => rotateMut.mutate(k.id)}
                    >
                      <RefreshCw className="size-4" /> Rotacionar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={revokeMut.isPending}
                      onClick={() => revokeMut.mutate(k.id)}
                    >
                      <ShieldOff className="size-4" /> Revogar
                    </Button>
                  </>
                )}
                {revoked && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir chave"
                    disabled={removeMut.isPending}
                    onClick={() => removeMut.mutate(k.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
