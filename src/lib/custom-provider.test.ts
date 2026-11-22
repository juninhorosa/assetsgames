import assert from "node:assert/strict";
import test from "node:test";
import {
  imageFromCustomResponse,
  customRequestBody,
} from "../lib/custom-provider-runner.server.ts";
import { defaultCustomProvider } from "../lib/custom-provider-config.ts";

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

test("resposta sem imagem falha claramente", () => {
  assert.throws(() => imageFromCustomResponse({ erro: "sem imagem" }, "data.0.url"), /sem imagem/);
});
