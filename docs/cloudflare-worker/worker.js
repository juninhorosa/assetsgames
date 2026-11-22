/**
 * Gerador de imagens — Cloudflare Worker + Workers AI (FLUX.1 schnell).
 *
 * Binding obrigatório (Workers & Pages → seu Worker → Settings → Bindings):
 *   Workers AI  →  nome do binding: AI
 *
 * Variável de ambiente (Settings → Variables):
 *   API_KEY = DSA0DSA0D1SA1005   (troque por uma chave sua, se quiser)
 */

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return json({ success: true });
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        success: true,
        status: "online",
        service: "AI Image Generator",
        model: MODEL,
        aiBinding: Boolean(env.AI),
        timestamp: new Date().toISOString(),
      });
    }
    if (request.method !== "POST" || (url.pathname !== "/" && url.pathname !== "")) {
      return json({ success: false, error: "Route not found" }, 404);
    }

    // Autenticação: só barra a requisição se a variável API_KEY existir.
    if (env.API_KEY) {
      const header = request.headers.get("authorization") || "";
      const token =
        header.replace(/^Bearer\s+/i, "").trim() ||
        (request.headers.get("x-api-key") || "").trim();
      if (token !== env.API_KEY) {
        return json({ success: false, error: "Chave de API inválida." }, 401);
      }
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "Envie um JSON com o campo prompt." }, 400);
    }

    const prompt = String(body.prompt ?? body.text ?? "").trim();
    if (!prompt) return json({ success: false, error: "O campo prompt é obrigatório." }, 400);

    if (!env.AI) {
      // Causa do "Server configuration error": falta o binding de Workers AI.
      return json(
        {
          success: false,
          error:
            "Binding de Workers AI ausente. Adicione o binding de Workers AI com o nome AI nas configurações do Worker.",
        },
        500,
      );
    }

    const steps = Math.min(8, Math.max(1, Number(body.num_steps) || 4));

    try {
      const result = await env.AI.run(MODEL, {
        prompt: prompt.slice(0, 2048),
        num_steps: steps,
      });
      const image = result?.image;
      if (!image) {
        return json({ success: false, error: "O modelo não devolveu imagem." }, 502);
      }
      return json({
        success: true,
        model: MODEL,
        image, // base64 puro
        data: [{ b64_json: image }],
      });
    } catch (error) {
      return json(
        { success: false, error: `Falha ao gerar a imagem: ${error?.message ?? error}` },
        502,
      );
    }
  },
};
