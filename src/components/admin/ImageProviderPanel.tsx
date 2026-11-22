import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Cpu, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getImageProvider, setImageProvider } from "@/lib/image-provider.functions";

type ProviderId = string;
type Mode = ProviderId | "auto";

export function ImageProviderPanel() {
  const qc = useQueryClient();
  const read = useServerFn(getImageProvider);
  const write = useServerFn(setImageProvider);
  const { data } = useQuery({
    queryKey: ["image-provider"],
    queryFn: () => read(),
    refetchInterval: 30000,
  });
  const [mode, setMode] = useState<Mode>("lovable");
  const [model, setModel] = useState("");
  const [order, setOrder] = useState<ProviderId[]>([]);
  const [disabled, setDisabled] = useState<ProviderId[]>([]);

  useEffect(() => {
    if (!data) return;
    setMode(data.active as Mode);
    setModel(data.model);
    setOrder(data.order as ProviderId[]);
    setDisabled(data.disabled as ProviderId[]);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      write({ data: { provider: mode, model: mode === "auto" ? "" : model, order, disabled } }),
    onSuccess: async () => {
      toast.success("Provedores de IA atualizados");
      await qc.invalidateQueries({ queryKey: ["image-provider"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const byId = (id: string) => data?.providers.find((p) => p.id === id);
  const move = (i: number, d: number) => {
    const next = [...order];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
  };
  const current = mode === "auto" ? null : byId(mode);
  const ativos = order.filter((id) => !disabled.includes(id));
  const prontos = ativos.filter((id) => byId(id)?.configured);

  return (
    <section className="panel mb-8 p-0">
      <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wide">
        <Cpu className="size-3.5" />
        Provedores de IA (site todo)
      </h2>

      <div className="space-y-2 p-4">
        <div
          className={`rounded-md border px-3 py-2 text-[11px] ${prontos.length ? "border-border text-muted-foreground" : "border-destructive/50 bg-destructive/10 text-destructive"}`}
        >
          {prontos.length ? (
            <>
              {prontos.length} de {order.length} provedores ativos:{" "}
              <span className="font-mono">
                {prontos.map((id) => byId(id)?.label ?? id).join(", ")}
              </span>
              . A geração usa o primeiro da lista, na ordem abaixo.
            </>
          ) : (
            <>
              Nenhum provedor ativo com chave. A geração continua a funcionar no modo grátis
              (Pollinations, sem chave), mas se quiser usar um provedor pago ligue o switch dele
              abaixo e cole a chave em <span className="font-mono">Chaves de API para geração</span>
              , ou cadastre sua própria API na seção{" "}
              <span className="font-mono">Provedores personalizados</span>.
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMode("auto")}
          className={`w-full rounded-md border px-3 py-2 text-left ${mode === "auto" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-3.5" /> Automático (recomendado)
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Usa o primeiro da lista que estiver disponível. Se um ficar sem crédito ou falhar, pula
            para o próximo e o deixa em pausa por 10 minutos.
          </p>
        </button>

        <ul className="space-y-1.5">
          {order.map((id, i) => {
            const p = byId(id);
            if (!p) return null;
            const on = !disabled.includes(id);
            const status = !p.configured
              ? `falta chave ${p.secret}`
              : p.cooldown
                ? `em pausa: ${p.cooldown}`
                : "pronto";
            return (
              <li
                key={id}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 ${mode === id ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <span className="w-5 font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {p.free ? "grátis" : "pago"} · {status}
                    {!p.supportsEdit && " · sem edição"}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => move(i, -1)}
                  aria-label="Subir"
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => move(i, 1)}
                  aria-label="Descer"
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Switch
                  checked={on}
                  onCheckedChange={(v) =>
                    setDisabled(v ? disabled.filter((d) => d !== id) : [...disabled, id])
                  }
                  aria-label={`Ativar ${p.label}`}
                />
                <Button
                  size="sm"
                  variant={mode === id ? "default" : "outline"}
                  disabled={!p.configured}
                  onClick={() => setMode(id)}
                >
                  Só este
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-border px-4 py-3">
        {current && (
          <div className="min-w-0 flex-1">
            <Label htmlFor="img-model" className="text-xs">
              Modelo (opcional)
            </Label>
            <Input
              id="img-model"
              value={model}
              placeholder={current.defaultModel}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
        )}
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending ? "salvando…" : "Salvar"}
        </Button>
      </div>
    </section>
  );
}
