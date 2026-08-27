import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCapabilities from "./tools/list-capabilities";
import listProjects from "./tools/list-projects";
import listAssets from "./tools/list-assets";
import createProject from "./tools/create-project";
import generateAsset from "./tools/generate-asset";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "asset-forge",
  title: "Asset Forge",
  version: "0.1.0",
  instructions:
    "Game asset generator. Call list_capabilities first to learn valid modes, styles, camera views, direction sets and animation actions. Use create_project (or list_projects) to pick the project whose style profile locks the look, then generate_asset to produce sprites, animated sprite sheets, PBR textures, UI icons or 3D-ready reliefs — with direction_set to get 4 or 8 camera directions of the same subject and action. Every asset is saved to the user's library and returned with grid, fps, pivot and a download URL.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCapabilities, listProjects, createProject, generateAsset, listAssets],
});
