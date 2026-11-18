import { createFileRoute } from "@tanstack/react-router";

interface Body {
  prompt: string;
  size?: string;
  quality?: string;
  stream?: boolean;
}

export const Route = createFileRoute("/api/generate-asset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prompt, size = "1024x1024", quality = "low", stream = true } =
          (await request.json()) as Body;

        if (!prompt || typeof prompt !== "string") {
          return new Response("Prompt inválido", { status: 400 });
        }

        const { spendGuardResponse } = await import("@/lib/spend-guard.server");
        const { estimateCredits } = await import("@/lib/pricing");
        const blocked = await spendGuardResponse(
          estimateCredits({ images: 1, size, mode: "sprite" }),
        );
        if (blocked) return blocked;

        const providers = await import("@/lib/image-providers.server");
        const { resolveKey } = await import("@/lib/provider-credentials.server");

        // 1) Caminho rápido: gateway da Lovable com streaming parcial de frames.
        const active = await providers.getActiveProvider();
        if (active.info.id === "lovable") {
          const key = await resolveKey("LOVABLE_API_KEY");
          if (key) {
            const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
              method: "POST",
              headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: active.model || "openai/gpt-image-2.5-sunburst",
                prompt,
                size,
                quality,
                n: 1,
                background: "transparent",
                ...(stream ? { stream: true, partial_images: 1 } : {}),
              }),
            });

            if (upstream.ok && upstream.body) {
              if (!stream) {
                return new Response(upstream.body, {
                  headers: { "Content-Type": "application/json" },
                });
              }
              return new Response(upstream.body, {
                headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
              });
            }
            // Chave recusada / sem crédito: segue para a fila de provedores
            // (Pollinations é grátis e não precisa de chave) em vez de
            // devolver um 401 cru ao Studio.
            await upstream.text().catch(() => "");
          }
        }

        // 2) Fila de provedores com fallback (inclui Pollinations grátis).
        try {
          const b64 = await providers.generateImageB64(prompt, size);
          return stream
            ? providers.singleImageSse(b64, "generation")
            : Response.json({ data: [{ b64_json: b64 }] });
        } catch (e) {
          const err = e as Error & { status?: number };
          return new Response(err.message, { status: err.status ?? 502 });
        }
      },
    },
  },
});