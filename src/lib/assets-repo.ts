import { supabase } from "@/integrations/supabase/client";
import { dataUrlToBlob, type FrameRect, type MapType } from "./image-pipeline";
import type { AssetMode, StyleProfile } from "./style-profile";

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  style_profile: StyleProfile;
  created_at: string;
}

export interface AssetRow {
  id: string;
  project_id: string;
  name: string;
  asset_type: AssetMode;
  prompt: string;
  final_prompt: string | null;
  params: Record<string, unknown>;
  storage_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MapRow {
  id: string;
  asset_id: string;
  map_type: MapType;
  storage_path: string;
}

export interface AnimationRow {
  id: string;
  asset_id: string;
  name: string;
  fps: number;
  frame_data: {
    columns?: number;
    rows?: number;
    cellWidth?: number;
    cellHeight?: number;
    rects?: FrameRect[];
  };
}

export async function signedUrl(path: string, seconds = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from("assets").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export async function fetchProjects(): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProjectRow[];
}

export async function createProject(input: {
  name: string;
  description?: string;
  style_profile: StyleProfile;
}): Promise<ProjectRow> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sessão expirada");
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input, user_id: uid })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ProjectRow;
}

export async function updateStyleProfile(projectId: string, profile: StyleProfile) {
  const { error } = await supabase
    .from("projects")
    .update({ style_profile: profile })
    .eq("id", projectId);
  if (error) throw error;
}

export async function deleteProject(projectId: string) {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

export async function fetchAssets(projectId: string): Promise<AssetRow[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AssetRow[];
}

export async function fetchAsset(id: string) {
  const [{ data: asset, error }, maps, anims] = await Promise.all([
    supabase.from("assets").select("*").eq("id", id).maybeSingle(),
    supabase.from("asset_maps").select("*").eq("asset_id", id),
    supabase.from("animations").select("*").eq("asset_id", id),
  ]);
  if (error) throw error;
  if (!asset) throw new Error("Asset não encontrado");
  return {
    asset: asset as unknown as AssetRow,
    maps: (maps.data ?? []) as unknown as MapRow[],
    animations: (anims.data ?? []) as unknown as AnimationRow[],
  };
}

export async function deleteAsset(id: string) {
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) throw error;
}

export interface SaveAssetInput {
  projectId: string;
  name: string;
  mode: AssetMode;
  prompt: string;
  finalPrompt: string;
  params: Record<string, unknown>;
  image: string;
  maps?: Partial<Record<MapType, string>>;
  frames?: string[];
  animation?: {
    name: string;
    fps: number;
    columns: number;
    rows: number;
    cellWidth: number;
    cellHeight: number;
    rects: FrameRect[];
  };
}

export async function saveAsset(input: SaveAssetInput): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sessão expirada");

  const { data: asset, error } = await supabase
    .from("assets")
    .insert({
      project_id: input.projectId,
      user_id: uid,
      name: input.name,
      asset_type: input.mode,
      prompt: input.prompt,
      final_prompt: input.finalPrompt,
      params: input.params,
      metadata: { frameCount: input.frames?.length ?? 0 },
    })
    .select()
    .single();
  if (error) throw error;
  const assetId = (asset as { id: string }).id;
  const base = `${uid}/${input.projectId}/${assetId}`;

  const upload = async (path: string, dataUrl: string) => {
    const { error: upErr } = await supabase.storage
      .from("assets")
      .upload(path, dataUrlToBlob(dataUrl), { contentType: "image/png", upsert: true });
    if (upErr) throw upErr;
  };

  const mainPath = `${base}/source.png`;
  await upload(mainPath, input.image);

  const mapRows: { asset_id: string; user_id: string; map_type: string; storage_path: string }[] =
    [];
  for (const [map, dataUrl] of Object.entries(input.maps ?? {})) {
    if (!dataUrl) continue;
    const path = `${base}/${map}.png`;
    await upload(path, dataUrl);
    mapRows.push({ asset_id: assetId, user_id: uid, map_type: map, storage_path: path });
  }
  if (mapRows.length) {
    const { error: mapErr } = await supabase.from("asset_maps").insert(mapRows);
    if (mapErr) throw mapErr;
  }

  const { error: pathErr } = await supabase
    .from("assets")
    .update({ storage_path: mainPath })
    .eq("id", assetId);
  if (pathErr) throw pathErr;

  if (input.animation) {
    const { name, fps, ...frame_data } = input.animation;
    const { error: animErr } = await supabase
      .from("animations")
      .insert({ asset_id: assetId, user_id: uid, name, fps, frame_data });
    if (animErr) throw animErr;
  }

  return assetId;
}
