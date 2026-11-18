import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, ExternalLink, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteProviderKey,
  listProviderKeys,
  saveProviderKey,
} from "@/lib/provider-keys.functions";
import type { ProviderKeyRow } from "@/lib/provider-keys.functions";

/**
 * Chaves de API usadas na geração (Studio, lote, API pública e MCP).
 * O valor digitado vai direto para o servidor e nunca volta ao navegador —
 * só fica visível o resumo mascarado e de onde a chave está a ser lida.
 */
export function ProviderKeysPanel() {
  const qc = useQueryClient();
  const read = useServerFn(listProviderKeys);
  const { data = [], isLoading } = useQuery({
    queryKey: ["provider-keys"],
    queryFn: () => read(),
    refetchInterval: 30_000,
  });

  return (
    <section className="panel mb-8 p-0">
      <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wide">
        <KeyRound className="size-3.5" />
        Chaves de API para geração
      </h2>

      <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
        Cole aqui a chave de cada provedor. O que for salvo no painel tem prioridade sobre as
        variáveis de ambiente do projeto e passa a valer para todo o site. Se apagar, o site volta a
        usar a chave do ambiente (quando existir).
      </p>

      {isLoading && (
        <p className="px-4 py-6 font-mono text-xs text-muted-foreground">carregando chaves...</p>
      )}

      <ul className="divide-y divide-border/60">
        {data.map((row) => (
          <KeyRow
            key={row.secret}
            row={row}
            onChanged={async () => {
              await qc.invalidateQueries({ queryKey: ["provider-keys"] });
              await qc.invalidateQueries({ queryKey: ["image-provider"] });
              await qc.invalidateQueries({ queryKey: ["admin-audit"] });
            }}
          />
        ))}
      </ul>
    </section>
  );
}

function KeyRow({ row, onChanged }: { row: ProviderKeyRow; onChanged: () => Promise<void> }) {
  const save = useServerFn(saveProviderKey);
  const remove = useServerFn(deleteProviderKey);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);

  const status =
    row.source === "panel" ? "painel" : row.source === "env" ? "variável de ambiente" : "sem chave";
  const ready = row.source !== "none";

  const saveMut = useMutation({
    mutationFn: () => save({ data: { secret: row.secret, apiKey: value.trim() } }),
    onSuccess: async () => {
      setValue("");
      setShow(false);
      toast.success(`Chave de ${row.providerLabel} salva.`);
      await onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: () => remove({ data: { secret: row.secret } }),
    onSuccess: async () => {
      toast.success(`Chave de ${row.providerLabel} removida do painel.`);
      await onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{row.providerLabel}</span>
            <Badge variant={ready ? "secondary" : "outline"}>
              {ready ? `pronta · ${status}` : "falta chave"}
            </Badge>
            {row.free && (
              <Badge variant="outline" className="text-[10px]">
                grátis
              </Badge>
            )}
          </div>
          <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
            {row.secret}
            {row.masked ? ` · ${row.masked}` : " · não definida"}
            {row.updatedAt
              ? ` · atualizada em ${new Date(row.updatedAt).toLocaleString("pt-BR")}`
              : ""}
          </div>
        </div>
        {row.docsUrl ? (
          <a
            href={row.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary underline"
          >
            obter chave <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor={`key-${row.secret}`} className="font-mono text-[11px] uppercase">
            {row.source === "panel" ? "Substituir chave" : "Nova chave"}
          </Label>
          <div className="mt-1 flex gap-1">
            <Input
              id={`key-${row.secret}`}
              type={show ? "text" : "password"}
              value={value}
              autoComplete="off"
              spellCheck={false}
              placeholder={`cole ${row.secret}`}
              onChange={(e) => setValue(e.target.value)}
              className="font-mono text-xs"
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={show ? "Ocultar chave" : "Mostrar chave"}
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
        </div>
        <Button
          size="sm"
          disabled={value.trim().length < 8 || saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          {saveMut.isPending ? "salvando..." : "Salvar"}
        </Button>
        {row.source === "panel" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={removeMut.isPending}
            onClick={() => removeMut.mutate()}
          >
            <Trash2 className="size-4" /> Remover
          </Button>
        )}
      </div>

      {row.source === "env" && (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          chave vinda do ambiente do projeto — ao salvar uma aqui, o painel passa a ter prioridade.
        </p>
      )}
    </li>
  );
}