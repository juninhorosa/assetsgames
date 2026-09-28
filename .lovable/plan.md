# Geração pixel profissional

## Objetivo
Evoluir a geração atual para um fluxo pixel-art mais consistente, com tilesets encaixáveis e edição quadro a quadro, sem remover os modos, exportadores e integrações existentes.

## O que será construído

1. **Modo Tileset**
   - Adicionar um tipo próprio para pisos, paredes, transições, cantos e objetos de mapa.
   - Permitir escolher tamanho do tile, grade e categoria do conjunto.
   - Gerar com câmera, iluminação, paleta e bordas travadas para encaixe contínuo.
   - Manter a grade e os metadados no salvamento e na exportação.

2. **Consistência pixel-art**
   - Reforçar o perfil pixel com resolução lógica, paleta limitada, contorno e proibição de suavização.
   - Gerar em alta resolução e reduzir com vizinho mais próximo para pixels limpos.
   - Aplicar quantização de paleta e limpeza de transparência antes de montar spritesheets.
   - Preservar escala corporal, linha dos pés, roupas, cores e direção entre ações.

3. **Editor quadro a quadro**
   - Expandir o editor atual com seleção de frame, lápis, borracha, conta-gotas, tamanho do pincel, desfazer/refazer e grade ampliada.
   - Atualizar imediatamente o frame editado e recompor a spritesheet.
   - Manter reordenação, duplicação, remoção, alinhamento e pivô já existentes.

4. **Compatibilidade do fluxo**
   - Integrar o novo modo aos arquivos salvos, biblioteca e exportadores existentes.
   - Expor os parâmetros de tileset e pixel pela API pública e pelo MCP.
   - Preservar Unity, Unreal, Godot e MU Online.

## Validação
- Confirmar geração e pós-processamento pixel sem suavização.
- Confirmar tileset com células uniformes e metadados corretos.
- Editar um frame, recompor a sheet e validar o resultado no estúdio.
- Testar desktop e celular, verificar erros de execução e compilação.

## Detalhes técnicos
- O processamento raster continuará local/servidor com PNG, usando redução nearest-neighbor e paleta determinística.
- O contrato de geração ganhará parâmetros opcionais de tileset sem quebrar chamadas antigas.
- A geração de imagem continuará no modelo configurado atualmente; esta fase melhora prompt, normalização e ferramentas de edição.
