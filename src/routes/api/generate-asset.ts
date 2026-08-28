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

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("LOVABLE_API_KEY ausente", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-image-2",
            prompt,
            size,
            quality,
            n: 1,
            ...(stream ? { stream: true, partial_images: 1 } : {}),
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "Erro na geração");
          return new Response(text, { status: upstream.status });
        }

        if (!stream) {
          return new Response(upstream.body, {
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
