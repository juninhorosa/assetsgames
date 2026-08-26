# Forge3D — Gerador de Assets para Jogos (Fase 1: Pipeline 2D)

Ferramenta web profissional para gerar assets de jogos por prompt, com estilo consistente entre assets, biblioteca por projeto e exportação pronta para Unity, Unreal e Godot.

O pipeline 3D (mesh, retopologia, UV, baking) exige GPU e serviços dedicados, então nesta fase entra como arquitetura documentada + estrutura de dados preparada, não como geração real. A Fase 1 entrega o módulo 2D completo e funcional.

## O que o usuário vai poder fazer

1. Criar conta e entrar (email/senha).
2. Criar um **Projeto** e definir seu **Style Profile**: estilo (Pixel Art, Low Poly, Stylized/Hand-painted, PBR Realista), paleta, resolução alvo, nível de detalhe. Esse perfil é injetado em todo prompt do projeto — é o mecanismo de consistência estética.
3. Gerar assets em quatro modos:
   - **Sprite / Personagem** — sprite único com fundo transparente.
   - **Sprite Sheet + Animação** — grid de quadros (idle, walk, attack, jump, death) com contagem de quadros e tamanho de célula configuráveis; gera `frame data` JSON (nome da animação, índices, FPS, retângulos dos quadros) e player de pré-visualização que anima os quadros no navegador.
   - **Textura PBR (tileable)** — gera Albedo e deriva os mapas restantes: Height (luminância), Normal (Sobel sobre o height), Roughness, Metallic e Ambient Occlusion. Derivação feita em canvas/WebGL no cliente, com controles de intensidade.
   - **UI / Ícones** — botões, frames, ícones com alpha limpo (recorte de fundo pós-geração).
4. Ver o preview em streaming (a imagem aparece progressivamente enquanto gera).
5. Refinar: reprompt, variações, edição por instrução (image edit), remoção de fundo, ajuste dos mapas PBR.
6. Salvar na **biblioteca do projeto** (grid com filtros por tipo/estilo/animação).
7. **Exportar**: PNG com alpha, ZIP do conjunto PBR, ZIP da sprite sheet + `frames.json`, e pacotes de metadata por engine:
   - Unity: `.meta`-style JSON + script `AssetImporter` C# de importação automática.
   - Unreal: JSON de import + instruções/script Python de material PBR.
   - Godot: `.tres` de material/SpriteFrames + `.import` hints.

## Telas

- `/` — landing curta com o gerador em destaque e CTA de entrada.
- `/auth` — login/cadastro.
- `/app` — workspace: painel de projeto/style profile à esquerda, prompt + modo no centro, preview grande à direita.
- `/app/library` — biblioteca de assets do projeto.
- `/app/asset/$id` — detalhe do asset: mapas PBR, quadros da animação, refinamento e exportação.
- `/docs/architecture` — especificação técnica completa (pipeline 2D e 3D, diagramas Mermaid, modelos open-source sugeridos: SDXL + LoRA, ControlNet, IP-Adapter, TripoSR/InstantMesh, Gaussian Splatting, Instant Meshes/quadriflow, xatlas, Blender bpy headless).

## Visual

Editor escuro tipo DCC (Blender/Unreal): fundo grafite quase preto, painéis em camadas, acento âmbar para ações, tipografia técnica compacta, viewport de preview com fundo xadrez para checar transparência. Tudo via tokens semânticos no design system.

## Detalhes técnicos

- **Backend**: Lovable Cloud (auth, Postgres, storage).
  - Tabelas: `profiles`, `projects` (dono, style profile em JSONB), `assets` (projeto, tipo, prompt, params, caminhos de storage, metadata JSONB), `asset_maps` (asset, tipo de mapa, caminho), `animations` (asset, nome, fps, frame data JSONB).
  - RLS: dono-only via `auth.uid()`, com GRANTs explícitos para `authenticated`/`service_role`. Bucket de storage `assets` privado com políticas por dono.
- **Geração**: Lovable AI Gateway, `openai/gpt-image-2` (`quality: "low"`, `stream: true`, `partial_images: 1`), via server route TanStack `src/routes/api/generate-asset.ts` que faz passthrough do SSE; parser com `eventsource-parser` + `flushSync`, frames parciais com blur. Edição por instrução via `src/routes/api/edit-asset.ts` (multipart → `/v1/images/edits`). Melhoria de prompt (style profile + template do modo) em `createServerFn` separado.
- **Sprite sheet**: um único request gera o grid completo (garante coerência entre quadros); o cliente fatia a imagem em canvas conforme colunas/linhas para o player e o `frames.json`.
- **Derivação PBR e alpha**: puro cliente (canvas 2D/WebGL) — sem GPU no servidor.
- **Exportação**: ZIP no cliente (`fflate`) com imagens + metadata + scripts de importação.
- **Preview 3D**: viewport Three.js aplicando os mapas PBR gerados a uma esfera/plano/cubo, para validar o material antes de exportar.
- Sem timeouts artificiais nas chamadas ao gateway; erros do gateway são exibidos com a mensagem real.

## Fora do escopo desta fase

Geração real de mesh 3D, retopologia/LOD automáticos e baking em malha — dependem de serviço GPU externo (Meshy/Tripo3D ou worker próprio com Blender). A arquitetura, contratos de API e o slot na UI ficam prontos para plugar depois.
