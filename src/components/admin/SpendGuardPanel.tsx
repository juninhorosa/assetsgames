import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatCredits } from "@/lib/pricing";
import { getSpendLimits, updateSpendLimits } from "@/lib/spend-guard.functions";

/**
 * Travão global de consumo: enquanto o limite diário/mensal não for atingido as
 * gerações passam; a partir dele todo o site (Studio, lote, API e MCP) recusa
 * novas gerações, garantindo que o gasto não sobe além do definido aqui.
 */
export function SpendGuardPanel() {
  const qc = useQueryClient();
  const read = useServerFn(getSpendLimits);
  const write = useServerFn(updateSpendLimits);

  const { data } = useQuery({ queryKey: ["spend-limits"], queryFn: () => read({}) });

  const [ai, setAi] = useState(true);
  const [api, setApi] = useState(true);
  const [daily, setDaily] = useState("20");
  const [monthly, setMonthly] = useState("200");

  useEffect(() => {
    if (!data) return;
    setAi(data.ai_enabled);
    setApi(data.public_api_enabled);
    setDaily(String(data.daily_credit_cap));
    setMonthly(String(data.monthly_credit_cap));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      write({
        data: {
          ai_enabled: ai,
          public_api_enabled: api,
          daily_credit_cap: Number(daily) || 0,
          monthly_credit_cap: Number(monthly) || 0,
        },
      }),
    onSuccess: async () => {
      toast.success("Limites de consumo atualizados");
      await qc.invalidateQueries({ queryKey: ["spend-limits"] });
      await qc.invalidateQueries({ queryKey: ["admin-audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dailyPct = data && data.daily_credit_cap > 0 ? (data.daily_used / data.daily_credit_cap) * 100 : 0;
  const monthlyPct =
    data && data.monthly_credit_cap > 0 ? (data.monthly_used / data.monthly_credit_cap) * 100 : 0;

  return (
    <section className="panel mb-8 p-0">
      <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wide">
        <Gauge className="size-3.5" />
        Travão de consumo (global)
      </h2>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
            <div>
              <Label className="text-sm">Gerações ligadas</Label>
              <p className="text-[11px] text-muted-foreground">
                Desligado = ninguém gera nada (custo zero).
              </p>
            </div>
            <Switch checked={ai} onCheckedChange={setAi} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
            <div>
              <Label className="text-sm">API pública / MCP</Label>
              <p className="text-[11px] text-muted-foreground">
                Bloqueia IAs externas sem afetar o estúdio.
              </p>
            </div>
            <Switch checked={api} onCheckedChange={setApi} />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="daily-cap" className="text-xs">
              Limite diário (créditos)
            </Label>
            <Input
              id="daily-cap"
              inputMode="decimal"
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
            />
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              hoje: {formatCredits(data?.daily_used ?? 0)} · {Math.round(dailyPct)}% do limite
            </p>
          </div>
          <div>
            <Label htmlFor="monthly-cap" className="text-xs">
              Limite mensal (créditos)
            </Label>
            <Input
              id="monthly-cap"
              inputMode="decimal"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
            />
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              mês: {formatCredits(data?.monthly_used ?? 0)} · {Math.round(monthlyPct)}% do limite
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          0 = sem limite. Ao atingir o limite, todas as gerações são recusadas antes de gastar
          créditos.
        </p>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "salvando…" : "Salvar limites"}
        </Button>
      </div>
    </section>
  );
}
