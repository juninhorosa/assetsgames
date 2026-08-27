import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveProfile } from "../generate";

export default defineTool({
  name: "create_project",
  title: "Create project",
  description:
    "Create a project with a locked style profile. Every asset generated into it reuses that style, palette and camera view so the whole game stays visually consistent.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Project name."),
    description: z.string().nullable().describe("Optional short description."),
    style: z
      .enum(["pixel-art", "low-poly", "stylized", "pbr-realistic"])
      .nullable()
      .describe("Art style, default stylized."),
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
      .describe("Locked camera view, default side-right."),
    palette: z.string().nullable().describe("Color palette description."),
    detail: z.number().int().min(1).max(10).nullable().describe("Detail level 1-10."),
    extra: z.string().nullable().describe("Extra art-direction notes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const profile = resolveProfile(input);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: input.name,
        description: input.description,
        style_profile: profile as unknown as never,
        user_id: ctx.getUserId(),
      })
      .select("id,name,style_profile")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { project: data },
    };
  },
});
