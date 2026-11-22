import assert from "node:assert/strict";
import test from "node:test";
import {
  imageFromCustomResponse,
  customRequestBody,
} from "../lib/custom-provider-runner.server.ts";
import { defaultCustomProvider } from "../lib/custom-provider-config.ts";
import { customProviderFromRow } from "./custom-providers.server.ts";
import { runCustomProvider } from "./custom-provider-runner.server.ts";

const base = {
  ...defaultCustomProvider(),
  id: crypto.randomUUID(),
  label: "Teste",
  createdAt: null,
  updatedAt: null,
};

test("OpenAI envia prompt, modelo e tamanho", () => {
  const body = customRequestBody(base, "cavaleiro", "1536x1024", "gpt-image-1");
  assert.equal(body["prompt"], "cavaleiro");
  assert.equal(body["model"], "gpt-image-1");
  assert.equal(body["size"], "1536x1024");
  assert.equal(body["background"], "transparent");
});

test("avançado usa campos configurados", () => {
  const body = customRequestBody(
    {
      ...base,
      kind: "advanced",
      promptField: "texto",
      modelField: "",
      widthField: "largura",
      heightField: "altura",
      sizeField: "",
    },
    "sprite",
    "1024x1536",
    "modelo",
  );
  assert.deepEqual(body, { texto: "sprite", largura: 1024, altura: 1536 });
});

test("lê base64 OpenAI e fallback de URL", () => {
  assert.equal(
    imageFromCustomResponse({ data: [{ b64_json: "aGVsbG8=" }] }, "data.0.b64_json"),
    "aGVsbG8=",
  );
  assert.equal(
    imageFromCustomResponse(
      { images: [{ url: "https://cdn.example.com/a.png" }] },
      "resultado.link",
    ),
    "https://cdn.example.com/a.png",
  );
});

test("lê caminho avançado", () => {
  assert.equal(
    imageFromCustomResponse(
      { resultado: { links: [{ imagem: "abc123" }] } },
      "resultado.links.0.imagem",
    ),
    "abc123",
  );
});

test("lê colunas snake_case salvas no Supabase", () => {
  const config = customProviderFromRow({
    id: crypto.randomUUID(),
    label: "runcrate",
    kind: "openai",
    enabled: true,
    base_url: "https://api.runcrate.ai/v1",
    endpoint: "/images/generations",
    method: "POST",
    model: "black-forest-labs/FLUX.1-dev",
    auth_header: "Authorization",
    auth_prefix: "Bearer",
    prompt_field: "prompt",
    model_field: "model",
    width_field: "",
    height_field: "",
    size_field: "size",
    image_path: "data.0.b64_json",
    edit_enabled: false,
    edit_endpoint: "/images/edits",
    edit_image_field: "image",
    created_at: null,
    updated_at: null,
  });
  const body = customRequestBody(config, "sprite", "1024x1024", config.model);
  assert.equal(body["model"], "black-forest-labs/FLUX.1-dev");
  assert.equal(config.baseUrl, "https://api.runcrate.ai/v1");
});

test("gera e edita no formato Runcrate com resposta base64", async (t) => {
  process.env["SUPABASE_URL"] = "https://test.supabase.co";
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-key";
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("test.supabase.co")) {
      return Response.json({ api_key: "test-api-key" });
    }
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return Response.json(
      { data: [{ b64_json: "aW1hZ2Vt" }] },
      { headers: { "Content-Type": "application/json" } },
    );
  };
  const config = {
    ...base,
    editEnabled: true,
    editEndpoint: "/images/generations",
    editImageField: "input_image",
    model: "black-forest-labs/FLUX.1-dev",
  };
  assert.equal(await runCustomProvider(config, "sprite", "1024x1024", config.model), "aW1hZ2Vt");
  assert.equal(
    await runCustomProvider(
      config,
      "mantenha o personagem",
      "1024x1024",
      "black-forest-labs/FLUX.1-kontext-dev",
      new Blob(["imagem"]),
    ),
    "aW1hZ2Vt",
  );
  assert.equal(requests[0]?.url, "https://api.runcrate.ai/v1/images/generations");
  assert.equal(requests[0]?.body["model"], "black-forest-labs/FLUX.1-dev");
  assert.equal(requests[1]?.url, "https://api.runcrate.ai/v1/images/generations");
  assert.ok(requests[1]?.body["input_image"]);
  assert.equal(requests[1]?.body["model"], "black-forest-labs/FLUX.1-kontext-dev");
});

test("aceita imagem PNG direta no modo avançado", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (input) => {
    if (String(input).includes("test.supabase.co")) {
      return Response.json({ api_key: "test-api-key" });
    }
    return new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { "Content-Type": "image/png" },
    });
  };
  const config = {
    ...base,
    kind: "advanced" as const,
    endpoint: "https://api.runcrate.ai/v1/images/generations",
  };
  assert.equal(await runCustomProvider(config, "tileset", "1024x1024", config.model), "iVBORw==");
});

test("resposta sem imagem falha claramente", () => {
  assert.throws(() => imageFromCustomResponse({ erro: "sem imagem" }, "data.0.url"), /sem imagem/);
});
