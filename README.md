# Asset Forge

> Você é um engenheiro de software sênior e especialista em computação gráfica, desenvolvimento de jogos (GameDev) e Inteligência Artificial. Sua missão é projetar e implementar a arquitetura completa de uma ferramenta/plataforma profissional de **Gerador de Assets 3D e 2D para Jogos**.

> A ferramenta deve cobrir todo o pipeline de produção visual para games, desde a geração conceitual até a exportação otimizada para engines (Unity, Unreal Engine e Godot).

> Crie um guia de especificação técnica e implementação detalhando os seguintes módulos:

> **1. Pipeline Módulo 2D**

> * **Geração de Sprite Sheets & Animação:** Algoritmos/modelos para geração de spritesheets em grid com consistência de estilo, mapas de quadros (frame data) e suporte a animações temporais (idle, walk, attack).

> * **Texturas e Materiais PBR:** Pipeline para criação de mapas PBR (Albedo, Normal Map, Roughness, Metallic, Ambient Occlusion, Height Map) a partir de prompts ou imagens 2D.

> * **UI e Concept Art:** Geração de elementos de interface de usuário (ícones, frames, botões vetorizados/rasterizados com canal alpha limpo).

> 

> 

> **2. Pipeline Módulo 3D**

> * **Geração Mesh (Image-to-3D / Text-to-3D):** Integração de pipelines de reconstrução 3D (ex: NeRF/Gaussian Splatting para mesh, Tripo3D, Meshy ou modelos de difusão 3D) gerando topologia limpa.

> * **Retopologia e UV Unwrapping Automatizados:** Algoritmos para conversão de high-poly para low-poly/mid-poly otimizado para jogos, geração de mapas UV sem sobreposição e suporte a LODs (Level of Detail).

> * **Baking e Texturização 3D:** Aplicação automática de materiais PBR na malha gerada com projeção UV correta.

> 

> 

> **3. Consistência de Estilo e Controle de Arte**

> * Implementação de mecanismos de controle (LoRA, ControlNet, IP-Adapter) para garantir coerência estética rigorosa entre múltiplos assets do mesmo projeto (ex: Pixel Art, Low Poly, Stylized/Hand-painted, PBR Realista).

> 

> 

> **4. Exportação e Integração com Game Engines**

> * Formatos suportados: FBX, OBJ, glTF/GLB (com animações e materiais embutidos), PNG/TGA (2D com alpha transparente).

> * Geração de arquivos de metadata e scripts de importação automática (JSON, `.blend`, ou plugins nativos para Unity/Unreal).

> 

> 

> **5. Interface do Usuário (UI/UX) e Arquitetura do Sistema**

> * Esboço da arquitetura técnica (Backend em Python/PyTorch, API REST/WebSockets, Frontend Web ou Desktop em Node/Electron/React ou C#/C++).

> * Fluxo de trabalho do usuário: Prompting -> Preview 2D/3D interativo (Canvas WebGL/Three.js) -> Ajustes finos (Refinement/Inpainting) -> Exportação.

> 

> 

> Forneça a resposta em formato estruturado, incluindo diagramas explicativos (em texto/Mermaid se aplicável), trechos de código de exemplo para componentes-chave e sugestões de frameworks/modelos open-source para cada etapa.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://assetsgames.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5d5dd4e9-c799-4381-80a9-06ef9d5fd1be).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
