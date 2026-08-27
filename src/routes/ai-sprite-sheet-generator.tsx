import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Grid3X3, Package, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const BASE_URL = "https://assetsgames.lovable.app";

export const Route = createFileRoute("/ai-sprite-sheet-generator")({
  head: () => ({
    meta: [
      { title: "AI Sprite Sheet Generator for Games — Forge3D" },
      {
        name: "description",
        content:
          "Generate consistent AI sprite sheets with uniform animation grids, per-frame JSON data and ready-to-import exports for Unity, Unreal and Godot.",
      },
      { property: "og:title", content: "AI Sprite Sheet Generator for Games — Forge3D" },
      {
        property: "og:description",
        content:
          "Consistent characters, every action in every direction, exported with frame metadata your engine understands.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/ai-sprite-sheet-generator` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/ai-sprite-sheet-generator` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Forge3D",
          applicationCategory: "GameApplication",
          operatingSystem: "Web",
          description:
            "AI sprite sheet generator that produces uniform animation grids with frame-data JSON and engine-ready export packages.",
          url: `${BASE_URL}/ai-sprite-sheet-generator`,
        }),
      },
    ],
  }),
  component: SpriteSheetLanding,
});

function SpriteSheetLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/" className="font-mono text-sm font-semibold tracking-widest text-primary">
          FORGE3D
        </Link>
        <nav className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/docs/connect">Docs</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/auth">Começar grátis</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-20 px-6 py-12">
        <section className="space-y-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">
            AI sprite sheet generator
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Sprite sheets com grade uniforme, prontas para a sua engine
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Gere personagens e monstros com todas as ações — andar, correr, atacar, morrer — em
            grades de animação uniformes, com JSON de frames e pacotes de importação para Unity,
            Unreal e Godot.
          </p>
          <div className="flex justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/auth">
                Gerar meu primeiro sprite
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/docs/architecture">Ver a arquitetura</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <article className="panel space-y-2 p-5">
            <Grid3X3 className="size-5 text-primary" />
            <h2 className="font-semibold">Grade uniforme garantida</h2>
            <p className="text-sm text-muted-foreground">
              Cada folha respeita colunas × linhas fixas com pivô consistente, para os quadros
              encaixarem na animação sem ajuste manual.
            </p>
          </article>
          <article className="panel space-y-2 p-5">
            <Wand2 className="size-5 text-primary" />
            <h2 className="font-semibold">Estilo travado por projeto</h2>
            <p className="text-sm text-muted-foreground">
              Um Style Profile por projeto trava paleta, traço e direção de câmera — 4 ou 8
              direções — para todo o elenco sair no mesmo estilo.
            </p>
          </article>
          <article className="panel space-y-2 p-5">
            <Package className="size-5 text-primary" />
            <h2 className="font-semibold">Exportação por engine</h2>
            <p className="text-sm text-muted-foreground">
              Pacotes ZIP com metadados e scripts de importação para Unity, Unreal e Godot, além de
              manifesto JSON para integração com outras IAs.
            </p>
          </article>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">
            Do conceito ao sprite sheet em quatro passos
          </h2>
          <ol className="grid gap-4 sm:grid-cols-2">
            <li className="panel p-5">
              <span className="font-mono text-xs text-primary">01</span>
              <p className="mt-1 text-sm">
                Crie um projeto e defina o Style Profile: pixel-art ou pintado, paleta, tamanho e
                ângulo de câmera fixo.
              </p>
            </li>
            <li className="panel p-5">
              <span className="font-mono text-xs text-primary">02</span>
              <p className="mt-1 text-sm">
                Descreva o personagem e escolha as ações do pack: idle, walk, run, attack, hurt,
                death e mais.
              </p>
            </li>
            <li className="panel p-5">
              <span className="font-mono text-xs text-primary">03</span>
              <p className="mt-1 text-sm">
                O Forge3D gera cada ação em todas as direções escolhidas, com grade e FPS
                sincronizados no preview.
              </p>
            </li>
            <li className="panel p-5">
              <span className="font-mono text-xs text-primary">04</span>
              <p className="mt-1 text-sm">
                Baixe o ZIP da engine com frame-data JSON, ou conecte sua IA via API/MCP para gerar
                direto no seu pipeline.
              </p>
            </li>
          </ol>
        </section>

        <section className="panel space-y-4 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Gere sprite sheets consistentes para o seu jogo
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Personagens, monstros e animações completas no mesmo estilo visual — prontos para
            importar.
          </p>
          <Button size="lg" asChild>
            <Link to="/auth">
              Criar conta grátis
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <span className="font-mono tracking-widest">FORGE3D</span>
          <nav className="flex gap-4">
            <Link to="/" className="hover:text-foreground">
              Início
            </Link>
            <Link to="/docs/connect" className="hover:text-foreground">
              API & MCP
            </Link>
            <Link to="/docs/architecture" className="hover:text-foreground">
              Arquitetura
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
