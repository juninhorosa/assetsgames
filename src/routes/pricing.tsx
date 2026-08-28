import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth.tsx";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription } from "@/hooks/use-subscription";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Planos e preços — Forge3D" },
      {
        name: "description",
        content:
          "Escolha um plano Forge3D: gerações mensais de sprites, sprite sheets e texturas PBR com exportação para Unity, Unreal e Godot.",
      },
      { property: "og:title", content: "Planos e preços — Forge3D" },
      {
        property: "og:description",
        content: "Assinaturas mensais ou anuais para gerar assets de jogos em escala.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

type Cycle = "monthly" | "yearly";

const PLANS = [
  {
    id: "apprentice_plan",
    name: "Aprendiz",
    tagline: "Para começar a produzir assets a sério.",
    monthly: { priceId: "apprentice_monthly", amount: 12 },
    yearly: { priceId: "apprentice_yearly", amount: 108 },
    features: [
      "2.000 gerações por mês",
      "Imagens até 320×320",
      "Rotação de câmara e 8 direções",
      "Edição por inpainting",
      "Animações e mapas PBR",
    ],
  },
  {
    id: "artisan_plan",
    name: "Artesão",
    tagline: "Para produção contínua e lotes maiores.",
    highlight: true,
    monthly: { priceId: "artisan_monthly", amount: 24 },
    yearly: { priceId: "artisan_yearly", amount: 216 },
    features: [
      "5.000 gerações por mês",
      "Imagens até 512×512",
      "Fila prioritária, 10 jobs em paralelo",
      "Tudo do plano Aprendiz",
      "Suporte prioritário",
    ],
  },
  {
    id: "architect_plan",
    name: "Arquiteto",
    tagline: "Para estúdios e pipelines completos.",
    monthly: { priceId: "architect_monthly", amount: 50 },
    yearly: { priceId: "architect_yearly", amount: 500 },
    features: [
      "10.000 gerações por mês",
      "Prioridade máxima, 20 jobs em paralelo",
      "Tudo do plano Artesão",
      "Acesso antecipado a novas features",
      "Voto na prioridade do roadmap",
    ],
  },
] as const;

function PricingPage() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const { user } = useAuth();
  const { openCheckout, loading } = usePaddleCheckout();
  const { plan: currentPlan, isActive } = useSubscription();

  const subscribe = async (priceId: string) => {
    if (!user) {
      toast.info("Entre na conta para assinar.");
      return;
    }
    try {
      await openCheckout({
        priceId,
        ...(user.email ? { customerEmail: user.email } : {}),
        customData: { userId: user.id },
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <PaymentTestModeBanner />
      <main className="mx-auto w-full max-w-6xl px-4 py-12">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Planos Forge3D</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Comece grátis com o trial de 50 créditos. Assine quando precisar de volume,
            resolução maior e fila prioritária.
          </p>

          <div className="mt-6 inline-flex items-center gap-1 rounded-md border border-border p-1 font-mono text-[11px] uppercase">
            <Button
              size="sm"
              variant={cycle === "monthly" ? "secondary" : "ghost"}
              onClick={() => setCycle("monthly")}
            >
              Mensal
            </Button>
            <Button
              size="sm"
              variant={cycle === "yearly" ? "secondary" : "ghost"}
              onClick={() => setCycle("yearly")}
            >
              Anual · 2 meses grátis
            </Button>
          </div>
        </header>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          {PLANS.map((p) => {
            const price = cycle === "monthly" ? p.monthly : p.yearly;
            const isCurrent = isActive && currentPlan === p.id;
            return (
              <div
                key={p.id}
                className={`panel flex flex-col p-6 ${
                  "highlight" in p && p.highlight ? "ring-1 ring-primary" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight">{p.name}</h2>
                  {"highlight" in p && p.highlight && (
                    <Badge className="gap-1">
                      <Sparkles className="size-3" />
                      popular
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>

                <div className="mt-5 flex items-end gap-1">
                  <span className="text-3xl font-semibold tracking-tight">${price.amount}</span>
                  <span className="pb-1 font-mono text-[11px] uppercase text-muted-foreground">
                    /{cycle === "monthly" ? "mês" : "ano"}
                  </span>
                </div>

                <ul className="mt-5 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-6"
                  variant={"highlight" in p && p.highlight ? "default" : "outline"}
                  disabled={loading || isCurrent}
                  onClick={() => subscribe(price.priceId)}
                >
                  {isCurrent ? "Plano atual" : loading ? "Abrindo…" : "Assinar"}
                </Button>
              </div>
            );
          })}
        </section>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/app" className="text-primary underline">
            Voltar ao estúdio
          </Link>
        </p>
      </main>
    </>
  );
}
