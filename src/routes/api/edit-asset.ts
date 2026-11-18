import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/edit-asset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { spendGuardResponse } = await import("@/lib/spend-guard.server");
        const blocked = await spendGuardResponse(1.15);
        if (blocked) return blocked;

        const form = await request.formData();
        const image = form.get("image");
        const prompt = form.get("prompt");
        if (!(image instanceof Blob) || !prompt) {
          return new Response("Imagem e prompt são obrigatórios", { status: 400 });
        }
        const streaming = form.get("stream") !== "false";

        const providers = await import("@/lib/image-providers.server");
        const { resolveKey } = await import("@/lib/provider-credentials.server");

        // 1) Gateway da Lovable (streaming), quando a chave existir.
        const active = await providers.getActiveProvider();
        if (active.info.id === "lovable") {
          const key = await resolveKey("LOVABLE_API_KEY");
          if (key) {
            const upstreamForm = new FormData();
            upstreamForm.append("image", image, "asset.png");
            upstreamForm.append("prompt", String(prompt));
            upstreamForm.append("model", active.model || "openai/gpt-image-2.5-sunburst");
            upstreamForm.append("background", "transparent");
            if (streaming) {
              upstreamForm.append("stream", "true");
              upstreamForm.append("partial_images", "1");
            }

            const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
              method: "POST",
              headers: { Authorization: `Bearer ${key}` },
              body: upstreamForm,
            });

            if (upstream.ok && upstream.body) {
              if (!streaming) {
                return new Response(upstream.body, {
                  headers: { "Content-Type": "application/json" },
                });
              }
              return new Response(upstream.body, {
                headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
              });
            }
            // Chave recusada: cai na fila de provedores em vez de devolver 401.
            await upstream.text().catch(() => "");
          }
        }

        // 2) Fila de provedores (edição com referência ou nova geração).
        try {
          const b64 = await providers.editImageB64(image, String(prompt));
          return streaming
            ? providers.singleImageSse(b64, "edit")
            : Response.json({ data: [{ b64_json: b64 }] });
        } catch (e) {
          const err = e as Error & { status?: number };
          return new Response(err.message, { status: err.status ?? 502 });
        }
      },
    },
  },
});