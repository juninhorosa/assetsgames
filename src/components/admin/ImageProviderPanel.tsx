import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cpu } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getImageProvider, setImageProvider } from "@/lib/image-provider.functions";

type ProviderId = "lovable" | "openai" | "gemini" | "replicate" | "fal" | "huggingface" | "pollinations";

export function ImageProviderPanel() {
  const qc = useQueryClient();
  const read = useServerFn(getImageProvider);
  const write = useServerFn(setImageProvider);
  const { data } = useQuery({ queryKey: ["image-provider"], queryFn: () => read() });
  const [provider, setProvider] = useState<ProviderId>("lovable");
  const [model, setModel] = useState("");

  useEffect(() => {
    if (!data) return;
    setProvider(data.active as ProviderId);
    setModel(data.model);
  }, [data]);

  const save = useMutation({
    mutationFn: () => write({ data: { provider, model } }),
    onSuccess: async () => {
      toast.success("Provedor de IA atualizado");
      await qc.invalidateQueries({ queryKey: ["image-provider"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = data?.providers.find((p) => p.id === provider);

  return (
    <section className="panel mb-8 p-0">
      <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wide">
        <Cpu className="size-3.5" />
        Provedor de IA para gerar (site todo)
      </h2>
      <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProvider(p.id as ProviderId)}
            className={`rounded-md border px-3 py-2 text-left transition-colors ${
              provider === p.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
            }`}
          >
            <div className="text-sm font-medium">{p.label}</div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
              {p.free ? "grátis" : "pago"} · {p.configured ? "pronto" : `falta chave ${p.secret}`}
              {!p.supportsEdit && " · sem edição"}
            </div>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <Label htmlFor="img-model" className="text-xs">Modelo (opcional)</Label>
          <Input
            id="img-model"
            value={model}
            placeholder={current?.defaultModel}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !current?.configured}>
          {save.isPending ? "salvando…" : "Usar este provedor"}
        </Button>
      </div>
    </section>
  );
}
