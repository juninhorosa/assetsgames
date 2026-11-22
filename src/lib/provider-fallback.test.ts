import assert from "node:assert/strict";
import test from "node:test";

/**
 * Reproduz o relato: Pollinations desativado no painel, mas ainda escolhido
 * como último recurso. A regra deve ser: provedor desligado nunca é usado,
 * nem como fallback de emergência.
 */
test("fallback não usa provedor desativado", async () => {
  const { pickFreeFallback } = await import("./provider-fallback.ts");
  const providers = [{ id: "lovable" }, { id: "pollinations" }];
  const fallback = pickFreeFallback({
    providers,
    disabled: ["pollinations"],
    cooldowns: {},
  });
  assert.equal(fallback, null, "Pollinations desativado não pode ser o fallback");
});

test("fallback usa Pollinations quando está ativo", async () => {
  const { pickFreeFallback } = await import("./provider-fallback.ts");
  const fallback = pickFreeFallback({
    providers: [{ id: "lovable" }, { id: "pollinations" }],
    disabled: [],
    cooldowns: {},
  });
  assert.equal(fallback?.id, "pollinations");
});

test("fallback respeita pausa por falha", async () => {
  const { pickFreeFallback } = await import("./provider-fallback.ts");
  const fallback = pickFreeFallback({
    providers: [{ id: "pollinations" }],
    disabled: [],
    cooldowns: { pollinations: Date.now() + 60_000 },
  });
  assert.equal(fallback, null);
});
