# Worker de imagens (Cloudflare + Workers AI)

Este Worker gera imagens com o modelo FLUX.1 schnell e devolve JSON com a imagem em base64.

## Problemas do código anterior

O código original usava o modelo de **texto** `@cf/meta/llama-3.1-8b-instruct`, que só devolve texto — nunca uma imagem. Além disso, qualquer falha virava uma resposta genérica, por isso a API respondia `500 Server configuration error` sem indicar a causa.

## Binding obrigatório

Em **Workers & Pages → seu Worker → Settings → Bindings → Add → Workers AI**, use o nome **`AI`**.

O nome precisa ser exatamente `AI`, porque o código chama `env.AI.run(...)`.

Se você usa `wrangler.toml`:

```toml
name = "imagem"
main = "worker.js"
compatibility_date = "2026-11-01"

[ai]
binding = "AI"
```

## Variável de ambiente

Em **Settings → Variables**, crie:

- Nome: `API_KEY`
- Valor: sua chave (por exemplo, `DSA0DSA0D1SA1005`)

Se essa variável não existir, o Worker continua funcionando, mas sem exigir chave. Para produção, mantenha a variável definida e use uma chave longa e aleatória.

## Deploy

```sh
npx wrangler deploy
```

## Teste

```sh
curl -X POST https://imagem.juninhorosa11-4b3.workers.dev/ \
  -H "Authorization: Bearer DSA0DSA0D1SA1005" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a red cube","num_steps":4}'
```

Resposta esperada:

```json
{
  "success": true,
  "model": "@cf/black-forest-labs/flux-1-schnell",
  "image": "iVBORw0KGgo...",
  "data": [{ "b64_json": "iVBORw0KGgo..." }]
}
```

## Diagnóstico

`GET /health` agora informa se o binding de Workers AI existe:

```json
{ "success": true, "status": "online", "aiBinding": true }
```

Se `aiBinding` vier `false`, o binding está com o nome errado ou não foi criado.

## Configuração no Forge3D

Depois do deploy, cadastre em **Admin → Provedores personalizados**:

- Modo: **Avançado**
- URL do endpoint: `https://imagem.juninhorosa11-4b3.workers.dev/`
- Método: `POST`
- Campo do prompt: `prompt`
- Campo do modelo: *(vazio)*
- Campo largura/altura: *(vazio)*
- Imagem na resposta: `image`
- Cabeçalho de autenticação: `Authorization`
- Prefixo da chave: `Bearer`
- Chave: `DSA0DSA0D1SA1005`
