import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  ANIMATION_ACTIONS,
  DEFAULT_STYLE_PROFILE,
  buildPrompt,
  findDirectionSet,
  type StyleKey,
  type ViewKey,
  type AssetMode,
  type Model3dStyleKey,
} from "@/lib/style-profile";
import { estimateCredits } from "@/lib/pricing";

const MAX_JOBS = 8;

const BodySchema = z.object({
  prompt: z.string().min(3),
  mode: z
    .enum(["sprite", "spritesheet", "texture", "ui", "model3d"])
    .default("sprite"),
  style: z.enum(["pixel-art", "low-poly", "stylized", "pbr-realistic"]).nullable().default(null),
  view: z
    .enum([
      "side-right",
      "side-left",
      "front",
      "back",
      "three-quarter",
      "three-quarter-back",
      "top-down",
      "isometric",
    ])
    .nullable()
    .default(null),
  directionSet: z.enum(["single", "four", "eight"]).default("single"),
  actions: z.array(z.string()).default([]),
  model3dStyle: z
    .enum(["low-poly", "hand-painted", "pbr-realistic", "toon-cel", "clay-sculpt"])
    .nullable()
    .default(null),
  palette: z.string().nullable().default(null),
  detail: z.number().min(1).max(10).nullable().default(null),
  extra: z.string().nullable().default(null),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).default("1024x1024"),
  uiKind: z.string().nullable().default(null),
});

async function generateImage(prompt: string, size: string, key: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-image-2", prompt, size, quality: "low", n: 1 }),
  });
  if (!res.ok) {
    throw Object.assign(new Error(await res.text().catch(() => "Falha na geração")), {
      status: res.status,
    });
  }
  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const first = json.data?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  throw new Error("Resposta sem imagem");
}

/**
 * Endpoint público para agentes/IAs gerarem assets direto.
 * Autenticação por `x-forge3d-key` com as chaves criadas em /app/settings/keys
 * (comparação por hash SHA-256; chaves revogadas são rejeitadas).
 */
export const Route = createFileRoute("/api/public/forge3d/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-forge3d-key") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const { verifyApiKey, trackApiKeyUsage } = await import("@/lib/api-keys.server");
        const legacy = process.env["FORGE3D_API_KEY"];
        const verified = await verifyApiKey(provided);
        const legacyOk = !!legacy && provided === legacy;
        if (!verified && !legacyOk) return new Response("Chave inválida", { status: 401 });


        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("LOVABLE_API_KEY ausente", { status: 500 });

        const parsed = BodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Body inválido", issues: parsed.error.issues }, { status: 400 });
        }
        const b = parsed.data;

        const profile = {
          style: (b.style ?? DEFAULT_STYLE_PROFILE.style) as StyleKey,
          view: (b.view ?? DEFAULT_STYLE_PROFILE.view) as ViewKey,
          palette: b.palette ?? DEFAULT_STYLE_PROFILE.palette,
          resolution: DEFAULT_STYLE_PROFILE.resolution,
          detail: b.detail ?? DEFAULT_STYLE_PROFILE.detail,
          extra: b.extra ?? "",
        };

        const views = findDirectionSet(b.directionSet).views;
        const viewList: (ViewKey | undefined)[] = views.length ? views : [undefined];

        const actions =
          b.mode === "spritesheet"
            ? ANIMATION_ACTIONS.filter((a) =>
                b.actions.length ? b.actions.includes(a.id) : a.id === "idle",
              )
            : [null];

        const jobs = actions.flatMap((action) => viewList.map((view) => ({ action, view })));
        if (jobs.length > MAX_JOBS) {
          return Response.json(
            { error: `Máximo de ${MAX_JOBS} jobs por requisição (pedido: ${jobs.length})` },
            { status: 400 },
          );
        }

        const results: unknown[] = [];
        try {
          for (const { action, view } of jobs) {
            const finalPrompt = buildPrompt(b.prompt, profile, {
              mode: b.mode as AssetMode,
              ...(action ? { animation: action.id, columns: action.columns, rows: action.rows } : {}),
              ...(b.uiKind ? { uiKind: b.uiKind } : {}),
              ...(b.model3dStyle ? { model3dStyle: b.model3dStyle as Model3dStyleKey } : {}),
              ...(view ? { view } : {}),
            });
            const image = await generateImage(finalPrompt, b.size, key);
            results.push({
              mode: b.mode,
              action: action?.id ?? null,
              view: view ?? profile.view,
              prompt: finalPrompt,
              image,
              ...(action
                ? {
                    grid: { columns: action.columns, rows: action.rows },
                    fps: action.fps,
                    pivot: "bottom-center",
                    readOrder: "left-to-right, top-to-bottom",
                  }
                : {}),
            });
          }
        } catch (e) {
          const err = e as Error & { status?: number };
          if (verified && results.length) {
            await trackApiKeyUsage(
              verified.id,
              estimateCredits({ images: results.length, size: b.size, mode: b.mode }),
            );
          }
          return Response.json(
            { error: err.message, partial: results },
            { status: err.status ?? 500 },
          );
        }

        if (verified) {
          await trackApiKeyUsage(
            verified.id,
            estimateCredits({ images: results.length, size: b.size, mode: b.mode }),
          );
        }

        return Response.json({ styleLock: profile, count: results.length, results });

      },
    },
  },
});
