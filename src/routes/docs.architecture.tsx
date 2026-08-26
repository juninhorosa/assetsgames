import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/docs/architecture")({
  head: () => ({
    meta: [
      { title: "Arquitetura do Pipeline — Forge3D Asset Studio" },
      {
        name: "description",
        content:
          "Especificação técnica do gerador de assets: pipeline 2D implementado, roadmap 3D (image-to-3D, retopologia, UV, LOD) e stack open-source recomendada.",
      },
      { property: "og:title", content: "Arquitetura do Pipeline — Forge3D Asset Studio" },
      {
        property: "og:description",
        content:
          "Diagramas, decisões de engenharia e modelos open-source para cada etapa do pipeline de assets de jogos.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Architecture,
});

const DIAGRAM = `┌──────────────── CLIENTE (React / TanStack Start) ─────────────────┐
│  Style Profile ── Prompt Builder ── Streaming Preview (SSE)       │
│        │                                   │                     │
│        ▼                                   ▼                     │
│  Raster Pipeline (Canvas 2D)        Player 2D / Preview 3D (three)│
│  · alpha cut-out                    · sprite sheet frames         │
│  · Height/Normal (Sobel)            · MeshStandardMaterial        │
│  · Roughness/Metallic/AO                                          │
│        │                                                          │
│        ▼                                                          │
│  Exporter (fflate) → ZIP por engine                               │
└───────────┬───────────────────────────────────┬──────────────────┘
            │ server routes                     │ supabase-js
            ▼                                   ▼
┌───────────────────────────┐      ┌────────────────────────────────┐
│ /api/generate-asset (SSE) │      │ Lovable Cloud                  │
│ /api/edit-asset  (multipart)│    │ · Postgres + RLS por usuário   │
│      │                    │      │   projects/assets/asset_maps/  │
│      ▼                    │      │   animations/profiles          │
│ Lovable AI Gateway        │      │ · Storage privado "assets"     │
│ openai/gpt-image-2        │      │ · Auth e-mail + Google         │
└───────────────────────────┘      └────────────────────────────────┘`;

const PIPE_2D = `prompt do usuário
   └─▶ buildPrompt(styleProfile, modo, params)      // consistência
        └─▶ /api/generate-asset  → gateway (stream: true, partial_images: 1)
             └─▶ frames parciais (blur) → frame final (nítido)
                  ├─ sprite/ui: removeBackground(tolerance) → PNG com alpha
                  ├─ spritesheet: sliceSheet(cols, rows) → frames + frame_data JSON
                  └─ texture: derivePbrMaps() → albedo/height/normal/rough/metal/ao
                       └─▶ ZIP: texturas + metadata + script de importação`;

const UNITY_SNIPPET = `// Editor/Forge3DAssetPostprocessor.cs  (gerado no ZIP do Unity)
using UnityEditor;
using UnityEngine;

public class Forge3DAssetPostprocessor : AssetPostprocessor {
  void OnPreprocessTexture() {
    if (!assetPath.Contains("Forge3D")) return;
    var importer = (TextureImporter)assetImporter;

    if (assetPath.Contains("_normal")) {
      importer.textureType = TextureImporterType.NormalMap;
    } else if (assetPath.Contains("_sprite") || assetPath.Contains("_sheet")) {
      importer.textureType = TextureImporterType.Sprite;
      importer.spriteImportMode = SpriteImportMode.Multiple; // fatiado via frame_data.json
      importer.filterMode = FilterMode.Point;                // pixel art
      importer.mipmapEnabled = false;
    }
    importer.alphaIsTransparency = true;
  }
}`;

const NORMAL_SNIPPET = `// Derivação de Normal a partir do Height (Sobel) — image-pipeline.ts
const dx = (hL - hR) * strength;
const dy = (hU - hD) * strength;
const len = Math.hypot(dx, dy, 1);
out[i]     = ((dx / len) * 0.5 + 0.5) * 255; // R
out[i + 1] = ((dy / len) * 0.5 + 0.5) * 255; // G
out[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;  // B (tangent space, OpenGL)`;

const ROADMAP_3D = `Etapa                    Modelo / Ferramenta open-source        Onde roda
─────────────────────────────────────────────────────────────────────────
Concept multi-view       Stable Diffusion XL + IP-Adapter        GPU worker
Image → mesh             TRELLIS · InstantMesh · Hunyuan3D-2     GPU worker
Text → mesh              Shap-E · Point-E (rascunho rápido)      GPU worker
Retopologia              Instant Meshes · QuadriFlow             CPU worker
UV unwrap                xatlas · Blender (bpy headless)         CPU worker
Bake de mapas            Blender Cycles bake · Materialize       CPU/GPU worker
Texturização 3D          Paint3D · TEXTure (SD + projeção UV)    GPU worker
LOD / decimação          meshoptimizer · Blender decimate        CPU worker
Rig automático           Rignet · Mixamo (serviço)               GPU worker
Export final             glTF 2.0 / FBX / USD via bpy            CPU worker
Estilo consistente       LoRA/DreamBooth por projeto             GPU (treino)`;

const FLOW_3D = `App (Lovable) ──job──▶ Fila (tabela jobs + Realtime)
                          │
                          ▼
                 Worker GPU externo (RunPod / Modal / Replicate)
                 · container com PyTorch + TRELLIS + bpy
                 · lê job, escreve progresso, sobe artefatos
                          │
                          ▼
                 Storage "assets" (glb/fbx/usdz + mapas)
                          │
                          ▼
                 App recebe evento Realtime → preview three.js → export`;

function Block({ title, children }: { title: string; children: string }) {
  return (
    <section className="space-y-2">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{title}</h3>
      <pre className="overflow-auto rounded-md border border-border bg-card p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {children}
      </pre>
    </section>
  );
}

function Architecture() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button size="icon" variant="ghost" aria-label="Voltar" asChild>
          <Link to="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <span className="font-mono text-xs tracking-tight">ESPECIFICAÇÃO TÉCNICA</span>
        <Button size="sm" className="ml-auto" asChild>
          <Link to="/app">Abrir estúdio</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-4xl space-y-12 px-6 py-12">
        <section className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Arquitetura do gerador de assets para jogos
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O produto é dividido em duas camadas. A <strong>Fase 1 (2D)</strong> está implementada
            e roda inteiramente nesta aplicação: geração por difusão via gateway, pós-processamento
            raster no cliente e exportação com scripts de importação por engine. A{" "}
            <strong>Fase 2 (3D)</strong> depende de GPU dedicada e é descrita aqui como contrato de
            integração com workers externos.
          </p>
        </section>

        <Block title="Visão geral do sistema">{DIAGRAM}</Block>
        <Block title="Pipeline 2D — implementado">{PIPE_2D}</Block>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Decisões de engenharia (2D)</h2>
          <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Consistência por Style Profile.</strong> Estilo,
              paleta, resolução e nível de detalhe ficam no registro do projeto e são concatenados
              a cada prompt, com negativos por modo (sem fundo, sem texto, sem mockup).
            </li>
            <li>
              <strong className="text-foreground">Streaming obrigatório.</strong> A rota de servidor
              repassa o corpo SSE do gateway sem bufferizar; o cliente aplica blur nos quadros
              parciais e remove no evento final, evitando spinner morto em gerações longas.
            </li>
            <li>
              <strong className="text-foreground">Pós-processamento no cliente.</strong> Canvas 2D
              evita custo de GPU no servidor: recorte de alpha por amostragem de borda, Height por
              luminância, Normal por Sobel em tangent space, Roughness por inversão com contraste,
              Metallic por saturação/brilho e AO por oclusão local.
            </li>
            <li>
              <strong className="text-foreground">Exportação determinística.</strong> Um único
              descritor de asset gera o pacote de cada engine, então metadata e texturas nunca
              divergem entre alvos.
            </li>
          </ul>
        </section>

        <Block title="Derivação de Normal Map">{NORMAL_SNIPPET}</Block>
        <Block title="Importação automática no Unity">{UNITY_SNIPPET}</Block>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Contratos de exportação</h2>
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Unity:</strong> texturas + `frame_data.json` +
              `AssetPostprocessor` C# que marca sprite/normal, ativa alpha e força Point filter em
              pixel art.
            </li>
            <li>
              <strong className="text-foreground">Unreal Engine:</strong> script Python de Editor
              Utility que importa via `AssetImportTask`, aplica `TC_Normalmap` /
              `TC_Masks`, cria o Material Instance e conecta os mapas por nome de parâmetro.
            </li>
            <li>
              <strong className="text-foreground">Godot 4:</strong> `.tres` de
              `StandardMaterial3D` (ou `SpriteFrames` para animação) mais `.import` com filtro
              nearest e mipmaps desligados quando o estilo é pixel art.
            </li>
          </ul>
        </section>

        <Block title="Fase 2 — pipeline 3D (roadmap)">{ROADMAP_3D}</Block>
        <Block title="Orquestração dos jobs 3D">{FLOW_3D}</Block>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Modelo de dados</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            `profiles` (identidade), `projects` (Style Profile em JSONB), `assets` (prompt, prompt
            final, parâmetros, caminho no storage), `asset_maps` (um registro por mapa PBR) e
            `animations` (fps e frame data do sheet). Todas as tabelas têm RLS por
            `auth.uid()`, e o bucket `assets` é privado com acesso por URL assinada.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Limites conhecidos</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Mapas PBR são derivados do albedo, não medidos — bom para prototipagem rápida.</li>
            <li>
              Sprite sheets usam grid uniforme; packing por bounding box exige uma etapa extra de
              atlas.
            </li>
            <li>Coerência de personagem entre poses melhora com LoRA por projeto (Fase 2).</li>
            <li>Geração 3D real precisa de worker GPU externo; o app orquestra e consome.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
