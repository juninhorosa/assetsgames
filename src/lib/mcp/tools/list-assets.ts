import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_assets",
  title: "List assets",
  description:
    "List the assets of one project, with type, prompt, params (action, camera view, grid) and a temporary download URL for the PNG.",
  inputSchema: {
    project_id: z.string().uuid().describe("Project id from list_projects."),
    limit: z.number().int().min(1).max(100).nullable().describe("Max rows, default 30."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("assets")
      .select("id,name,asset_type,prompt,params,storage_path,created_at")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 30);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = await Promise.all(
      (data ?? []).map(async (row) => {
        let url: string | null = null;
        if (row.storage_path) {
          const signed = await supabase.storage
            .from("assets")
            .createSignedUrl(row.storage_path, 3600);
          url = signed.data?.signedUrl ?? null;
        }
        return { ...row, download_url: url };
      }),
    );
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { assets: rows },
    };
  },
});
