import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Frame, Grid3x3, Layers, Package, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge3D — Gerador de Assets 2D para Jogos" },
      {
        name: "description",
        content:
          "Gere sprites, sprite sheets animadas, texturas PBR e ícones de UI com estilo consistente e exporte prontos para Unity, Unreal Engine e Godot.",
      },
      { property: "og:title", content: "Forge3D — Gerador de Assets 2D para Jogos" },
      {
        property: "og:description",
        content:
          "Pipeline completo de produção visual para games: prompt, preview, refinamento e exportação por engine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const MODULES = [
  {
    icon: Grid3x3,
    title: "Sprite Sheets & Animação",
    body: "Grid uniforme de quadros para idle, walk, attack, jump e death, com frame data JSON e player de pré-visualização.",
  },
  {
    icon: Layers,
    title: "Texturas & Materiais PBR",
    body: "Albedo gerado por prompt e derivação de Height, Normal, Roughness, Metallic e AO, com preview 3D do material.",
  },
  {
    icon: Frame,
    title: "UI & Concept Art",
    body: "Ícones, botões e frames com canal alpha limpo, recortados automaticamente do fundo.",
  },
  {
    icon: Sparkles,
    title: "Consistência de Estilo",
    body: "Style Profile por projeto — Pixel Art, Low Poly, Stylized ou PBR Realista — injetado em cada geração.",
  },
  {
    icon: Package,
    title: "Exportação por Engine",
    body: "ZIP com texturas, metadata e scripts de importação: AssetPostprocessor C#, Python do Unreal e .tres do Godot.",
  },
  {
    icon: Wand2,
    title: "Refinamento",
    body: "Reprompt, variações e edição por instrução sobre o asset gerado, sem sair do estúdio.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Boxes className="size-5 text-primary" />
          <span className="font-mono text-sm tracking-tight">FORGE3D ASSET STUDIO</span>
        </div>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/docs/architecture">Arquitetura</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/app">Abrir estúdio</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
            Pipeline de produção visual para games
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
            Gere assets de jogo com estilo consistente e exporte direto para a sua engine.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Do prompt à exportação: sprites, sprite sheets animadas, conjuntos PBR completos e
            elementos de UI com alpha limpo. Um Style Profile por projeto mantém toda a arte
            coerente, e cada asset sai empacotado com metadata e script de importação para Unity,
            Unreal Engine e Godot.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/app">Começar a gerar</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/docs/architecture">Ver especificação técnica</Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto grid max-w-5xl gap-px bg-border px-0 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <article key={m.title} className="bg-background p-6">
                <m.icon className="size-5 text-primary" />
                <h2 className="mt-4 text-sm font-semibold tracking-tight">{m.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
            Fluxo de trabalho
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              ["01", "Style Profile", "Defina estilo, paleta, resolução e nível de detalhe."],
              ["02", "Prompt", "Escolha o modo e descreva o asset."],
              ["03", "Preview & refino", "Acompanhe o render, recorte o alpha, ajuste os mapas."],
              ["04", "Exportação", "Baixe PNG, conjunto PBR ou pacote da engine."],
            ].map(([n, t, d]) => (
              <li key={n} className="panel p-5">
                <span className="font-mono text-xs text-primary">{n}</span>
                <h3 className="mt-3 text-sm font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8 text-xs text-muted-foreground">
        Forge3D Asset Studio — módulo 2D em produção, pipeline 3D documentado em{" "}
        <Link to="/docs/architecture" className="text-primary underline">
          Arquitetura
        </Link>
        .
      </footer>
    </div>
  );
}
