import { createFileRoute } from "@tanstack/react-router";

interface RosterRequest {
  theme?: string;
  count?: number;
  kind?: string;
  style?: string;
}

export interface RosterEntry {
  name: string;
  description: string;
}

/**
 * Expande um tema ("monstros de caverna") em N conceitos distintos,
 * usados como prompts base do gerador em lote.
 */
export const Route = createFileRoute("/api/roster")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as RosterRequest;
        const theme = (body.theme ?? "").trim();
        const count = Math.max(1, Math.min(100, Math.round(body.count ?? 10)));
        const kind = body.kind === "character" ? "playable characters / NPCs" : "monsters/enemies";
        if (!theme) return new Response("Missing theme", { status: 400 });

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You are a game art director. You output ONLY compact JSON, no markdown fences, no commentary.",
              },
              {
                role: "user",
                content: [
                  `Design a roster of exactly ${count} distinct ${kind} for a game with the theme: "${theme}".`,
                  body.style ? `Overall art style: ${body.style}.` : "",
                  "Each entry must be visually distinct from the others (different silhouette, body plan, size class, colour accent, gear).",
                  'Return JSON of the form {"entries":[{"name":"short name","description":"one dense English sentence describing the full body appearance for an image generator"}]}.',
                  `The entries array must have exactly ${count} items.`,
                ]
                  .filter(Boolean)
                  .join(" "),
              },
            ],
          }),
        });

        if (!upstream.ok) {
          return new Response(await upstream.text(), { status: upstream.status });
        }

        const json = (await upstream.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const raw = json.choices?.[0]?.message?.content ?? "";
        const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

        let entries: RosterEntry[] = [];
        try {
          const parsed = JSON.parse(cleaned) as { entries?: RosterEntry[] } | RosterEntry[];
          entries = Array.isArray(parsed) ? parsed : (parsed.entries ?? []);
        } catch {
          return new Response("Roster parse failed", { status: 502 });
        }

        entries = entries
          .filter((e) => e && typeof e.description === "string" && e.description.trim())
          .slice(0, count)
          .map((e, i) => ({
            name: (e.name ?? `#${i + 1}`).toString().slice(0, 60),
            description: e.description.trim(),
          }));

        if (entries.length === 0) return new Response("Empty roster", { status: 502 });

        return new Response(JSON.stringify({ entries }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
