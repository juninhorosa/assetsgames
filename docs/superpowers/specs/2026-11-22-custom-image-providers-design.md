# Provedores de imagem personalizados

Data: 2026-11-22

## Objetivo

Permitir que o administrador cadastre vários provedores de geração de imagem, incluindo TokenHarbor e outros gateways, sem alterar o código ou fazer um novo deploy. A configuração vale para o Studio, geração em lote, API pública e MCP.

## Escopo

- Cadastro, edição, ativação, desativação e exclusão de vários provedores.
- Dois modos de configuração: OpenAI compatível e avançado.
- Integração com a lista e a ordem de fallback existentes.
- Persistência segura no Supabase.
- Chaves mascaradas no navegador e usadas exclusivamente no servidor.
- Manutenção dos provedores atualmente disponíveis.

Não inclui alteração do sistema de créditos, cobrança ou interface do Studio.

## Configuração OpenAI compatível

Cada provedor possui:

- nome de exibição;
- URL base HTTPS, por exemplo `https://tokenharbor.ai/v1`;
- chave de API;
- modelo padrão;
- estado ativo/inativo;
- posição na ordem de fallback.

A geração usa `POST {baseUrl}/images/generations`, com `Authorization: Bearer {apiKey}` e JSON contendo modelo, prompt, tamanho, quantidade e qualidade. A resposta aceita `data.0.b64_json` ou `data.0.url`.

A edição usa `POST {baseUrl}/images/edits` somente quando esse endpoint for configurado. Se o provedor não oferecer edição, o seletor usa outro provedor compatível, preservando o comportamento de fallback.

O TokenHarbor deixa de exigir um formato específico de chave. Sua configuração inicial usa a URL `https://tokenharbor.ai/v1` e a chave existente `HARBOR_API_KEY`, quando disponível. O modelo é escolhido pelo administrador; o sistema não pressupõe que todos os modelos de texto também geram imagens.

## Configuração avançada

O modo avançado atende APIs JSON com outro formato, sem permitir execução de código.

Campos:

- método HTTP: `POST` ou `PUT`;
- URL completa do endpoint HTTPS;
- cabeçalho de autenticação e prefixo, com Bearer como padrão;
- nome do campo de prompt;
- nome do campo de modelo;
- nomes opcionais dos campos de largura e altura;
- caminho da imagem na resposta;
- configuração opcional de endpoint de edição.

Exemplos de caminhos de resposta:

- `data.0.b64_json`: conteúdo base64;
- `data.0.url`: URL da imagem;
- `images.0.url`: URL da imagem;
- `image`: conteúdo base64 ou data URL.

O campo de modelo pode ficar vazio para APIs que não recebem modelo. Largura e altura também podem ser omitidas. Valores de resposta `data:` são decodificados; URLs HTTP(S) são baixadas pelo servidor. Uma resposta sem imagem gera erro legível e aciona o próximo provedor.

Não há templates JavaScript, expressões executáveis ou corpos HTTP arbitrários nesta etapa.

## Arquitetura

### Repositório de configurações

Um módulo `.server.ts` centraliza leitura e escrita das configurações. O Supabase contém uma tabela para os metadados dos provedores e suas chaves, acessível apenas pelo service role do servidor. O navegador recebe somente os metadados, a chave mascarada e o indicador de configuração.

Uma migration cria a tabela, índices e RLS. Não são criadas policies de leitura ou escrita para usuários autenticados: todo acesso ocorre nas funções de servidor após a verificação de administrador.

### Catálogo unificado

O catálogo de geração combina os provedores nativos e os personalizados ativos. Cada entrada usa a mesma interface interna, incluindo identificador, nome, modelo, suporte a edição e estado de configuração.

A ordem e os provedores desativados continuam em `platform_limits`. Os identificadores personalizados têm prefixo próprio, evitando colisão com os provedores nativos.

### Execução

A geração segue a ordem configurada pelo administrador. Cada provedor tem tratamento próprio de autenticação, request e resposta. Falhas de autenticação, crédito, formato ou rede passam ao próximo candidato, respeitando o cooldown existente. O Pollinations continua como último recurso gratuito.

As rotas de geração, edição, API pública e MCP continuam chamando o mesmo serviço central; não haverá uma implementação separada para cada entrada.

## Painel Admin

Uma nova seção permite adicionar e editar provedores. O administrador escolhe o modo OpenAI ou avançado e preenche somente os campos relevantes. A chave já salva não é exibida novamente; deixar o campo vazio preserva a chave atual.

O painel de provedores de IA mostra os personalizados na mesma lista dos nativos, permitindo reordenar, ativar/desativar e escolher um único provedor. Avisos antigos que dizem que a chave Harbor não gera imagens serão removidos.

## Segurança

- Apenas administradores podem listar, criar, alterar ou excluir configurações.
- Chaves nunca retornam ao navegador em texto aberto.
- Somente URLs HTTPS são aceitas; localhost pode ser permitido apenas no desenvolvimento local, nunca em produção.
- URLs de provedores e de imagens são validadas contra loopback, redes privadas, link-local e metadados de nuvem, inclusive após redirecionamentos.
- Nomes, URLs, modelos e campos JSON têm limites de tamanho e validação no servidor.
- Requests possuem timeout e limite de bytes de imagem.
- Não há suporte a URLs `file:`, `ftp:` ou outros esquemas.

## Tratamento de erros

Erros distinguem chave ausente/recusada, endpoint inválido, resposta inesperada e ausência de imagem. O erro final informa quais provedores falharam sem revelar chaves. Configurações inválidas não interrompem os provedores nativos.

## Validação

- Testes unitários do formato OpenAI e dos caminhos avançados de resposta.
- Testes de request para confirmar autenticação, modelo, prompt e dimensões.
- Testes de resposta base64, data URL e URL remota.
- Testes de validação e bloqueio de destinos internos.
- Verificação de que chaves não aparecem nas respostas das funções Admin.
- TypeScript, lint e build completos.
- Teste real com TokenHarbor somente quando uma chave válida e um modelo de imagem estiverem disponíveis; sem esses dados, o teste será feito com servidor HTTP simulado e essa limitação será registrada.

## Entrega

1. Aplicar a migration no Supabase conectado ao Lovable.
2. Publicar a implementação no branch conectado, sem reescrever o histórico.
3. Configurar pelo Admin um provedor TokenHarbor ou equivalente.
4. Verificar geração e fallback no Studio.
