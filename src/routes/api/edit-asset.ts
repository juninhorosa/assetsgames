import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/edit-asset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { spendGuardResponse } = await import("@/lib/spend-guard.server");
        const blocked = await spendGuardResponse(1.15);
        if (blocked) return blocked;

        const form = await request.formData();
        if (!form.get("image") || !form.get("prompt")) {
          return new Response("Imagem e prompt são obrigatórios", { status: 400 });
        }

        const providers = await import("@/lib/image-providers.server");
        const active = await providers.getActiveProvider();
        if (active.info.id !== "lovable") {
          try {
            const b64 = await providers.editImageB64(form.get("image") as Blob, String(form.get("prompt")));
            return form.get("stream") === "false"
              ? Response.json({ data: [{ b64_json: b64 }] })
              : providers.singleImageSse(b64, "edit");
          } catch (e) {
            const err = e as Error & { status?: number };
            return new Response(err.message, { status: err.status ?? 502 });
          }
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("LOVABLE_API_KEY ausente", { status: 500 });
        form.set("model", "openai/gpt-image-2.5-sunburst");
        form.set("background", "transparent");
        const streaming = form.get("stream") !== "false";
        if (streaming) {
          form.set("stream", "true");
          form.set("partial_images", "1");
        } else {
          form.delete("stream");
          form.delete("partial_images");
        }

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: form,
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "Erro na edição");
          return new Response(text, { status: upstream.status });
        }

        if (!streaming) {
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
