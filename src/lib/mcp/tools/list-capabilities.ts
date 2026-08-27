import { defineTool } from "@lovable.dev/mcp-js";
import {
  ANIMATION_ACTIONS,
  DIRECTION_SETS,
  MODE_LABELS,
  MODEL3D_STYLES,
  STYLE_LABELS,
  VIEW_LABELS,
  DEFAULT_STYLE_PROFILE,
} from "@/lib/style-profile";

export default defineTool({
  name: "list_capabilities",
  title: "List capabilities",
  description:
    "List every asset mode, art style, camera view, direction set, animation action and 3D style variation this generator supports. Call this first to learn the valid values.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const payload = {
      modes: Object.entries(MODE_LABELS).map(([id, label]) => ({ id, label })),
      styles: Object.entries(STYLE_LABELS).map(([id, label]) => ({ id, label })),
      views: Object.entries(VIEW_LABELS).map(([id, label]) => ({ id, label })),
      directionSets: DIRECTION_SETS,
      actions: ANIMATION_ACTIONS.map((a) => ({
        id: a.id,
        label: a.label,
        columns: a.columns,
        rows: a.rows,
        fps: a.fps,
      })),
      model3dStyles: MODEL3D_STYLES.map((s) => ({ id: s.id, label: s.label, hint: s.hint })),
      defaults: DEFAULT_STYLE_PROFILE,
      conventions: {
        spritePivot: "bottom-center",
        spriteReadOrder: "left-to-right, top-to-bottom",
        background: "pure white, cut out the alpha on your side",
        scaleLock:
          "With frame=true (default) sprite sheets are normalized server-side: one single scale for every cell, the same body height across all actions, and feet on a common ground line. The reply returns cell, body_height and ground_line in px.",
        targetBodyHeight:
          "Pass target_body_height (e.g. 105) to auto-fit the canvas/cell so the character body lands at that pixel height. Scale stays proportional, so idle/walk/attack keep identical body height and ground line.",

      },

    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
