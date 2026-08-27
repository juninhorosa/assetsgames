import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/docs/connect")({
  head: () => ({
    meta: [
      { title: "Conectar sua IA (MCP e API) — Forge3D Asset Studio" },
      {
        name: "description",
        content:
          "Conecte ChatGPT, Claude, Cursor ou Codex ao Forge3D via MCP com login OAuth, ou use a API REST com chave, para gerar sprites, animações e assets 3D direto do chat.",
      },
      { property: "og:title", content: "Conectar sua IA (MCP e API) — Forge3D Asset Studio" },
      {
        property: "og:description",
        content:
          "Servidor MCP com OAuth e API REST para agentes de IA gerarem assets de jogos na sua conta.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConnectDocs;
});

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
        {code}
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute right-2 top-2"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          toast.success("Copiado");
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <Copy className="size-3.5" />
        <span className="ml-1">{copied ? "Copiado" : "Copiar"}</span>
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-mono text-sm uppercase tracking-widest text-primary">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function ConnectDocs() {
  const origin = typeof window === "undefined" ? "https://assetsgames.lovable.app" : window.location.origin;
  const mcpUrl = `${origin}/mcp`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-8">
        <Link to="/">
          <ArrowLeft className="size-4" />
          <span className="ml-1">Voltar</span>
        </Link>
      </Button>

      <h1 className="text-3xl font-semibold tracking-tight">Conectar sua IA</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        O estúdio expõe duas portas para agentes externos: um <strong>servidor MCP</strong> com login
        OAuth (o agente age como você e salva na sua biblioteca) e uma <strong>API REST</strong> com
        chave, para automações próprias.
      </p>

      <Section title="1 · MCP (recomendado)">
        <p>
          Endpoint MCP (Streamable HTTP):{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{mcpUrl}</code>
        </p>
        <p>
          Na primeira conexão o cliente abre o login do estúdio e uma tela de consentimento. Depois
          disso o agente enxerga somente os seus projetos e assets.
        </p>
        <h3 className="pt-2 font-medium text-foreground">ChatGPT / Claude / Cursor</h3>
        <p>
          Adicione um conector remoto (ou “Custom MCP server”) apontando para a URL acima e conclua o
          login. Em clientes com arquivo de configuração:
        </p>
        <CodeBlock
          code={`{
  "mcpServers": {
    "asset-forge": {
      "type": "http",
      "url": "${mcpUrl}"
    }
  }
}`}
        />
        <h3 className="pt-2 font-medium text-foreground">Ferramentas disponíveis</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <code className="font-mono text-xs">list_capabilities</code> — modos, estilos, vistas,
            conjuntos de direções, ações de animação e variações 3D.
          </li>
          <li>
            <code className="font-mono text-xs">list_projects</code> /{" "}
            <code className="font-mono text-xs">create_project</code> — o Style Profile do projeto
            trava estilo, paleta e sentido de câmera.
          </li>
          <li>
            <code className="font-mono text-xs">generate_asset</code> — sprite, sprite sheet
            animado, textura PBR, ícone de UI ou relevo 3D; com{" "}
            <code className="font-mono text-xs">direction_set</code> gera a mesma ação em 4 direções.
          </li>
          <li>
            <code className="font-mono text-xs">list_assets</code> — inventário com grade, FPS, pivô
            e URL de download temporária.
          </li>
        </ul>
        <h3 className="pt-2 font-medium text-foreground">Exemplo de pedido no chat</h3>
        <CodeBlock
          code={`Use o Asset Forge: crie o projeto "Dungeon Crawler" em pixel art, vista lateral direita,
depois gere o sprite sheet de "walk" de um golem de pedra em 4 direções.`}
        />
      </Section>

      <Section title="2 · API REST">
        <p>
          Para scripts e pipelines de CI. Autenticação pelo header{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">x-forge3d-key</code>.
        </p>
        <CodeBlock
          code={`# descoberta de modos, vistas, ações e estilos
curl ${origin}/api/public/forge3d/capabilities

# geração (até 8 jobs por chamada)
curl -X POST ${origin}/api/public/forge3d/generate \\
  -H "x-forge3d-key: $FORGE3D_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "prompt": "stone golem warrior",
    "mode": "spritesheet",
    "action": "walk",
    "style": "pixel-art",
    "directions": "four"
  }'`}
        />
        <p>
          A resposta traz a imagem (base64 ou URL) mais os metadados de importação: grade
          colunas×linhas, FPS, pivô <em>bottom-center</em> e ordem de leitura dos quadros.
        </p>
      </Section>

      <Section title="Convenções de importação">
        <ul className="list-disc space-y-1 pl-5">
          <li>PNG com fundo branco puro — recorte o alpha no seu lado, ou baixe do estúdio já cortado.</li>
          <li>Sprite sheets: quadros da esquerda para a direita, de cima para baixo.</li>
          <li>Pivô sempre <em>bottom-center</em> (pés do personagem).</li>
          <li>
            Cada exportação inclui <code className="font-mono text-xs">forge3d.manifest.json</code> e{" "}
            <code className="font-mono text-xs">AGENTS.md</code> para outra IA consumir sem erro.
          </li>
        </ul>
      </Section>

      <p className="mt-12 text-sm text-muted-foreground">
        Detalhes do pipeline em{" "}
        <Link to="/docs/architecture" className="text-primary underline">
          arquitetura
        </Link>
        .
      </p>
    </main>
  );
}
