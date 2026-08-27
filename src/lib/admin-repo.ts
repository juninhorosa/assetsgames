import { supabase } from "@/integrations/supabase/client";

export interface AdminProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  plan: string;
  trial_started_at: string;
  trial_ends_at: string;
  trial_credits: number;
  created_at: string;
}

export interface AdminRun {
  id: string;
  user_id: string;
  kind: string;
  mode: string | null;
  status: string;
  credits: number;
  source: string;
  created_at: string;
}

/** Verifica o papel via função segura no banco (nunca por dado local). */
export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) return false;
  return Boolean(data);
}

export async function fetchAdminProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,email,plan,trial_started_at,trial_ends_at,trial_credits,created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminProfile[];
}

export async function fetchAdminRuns(): Promise<AdminRun[]> {
  const { data, error } = await supabase
    .from("generation_runs")
    .select("id,user_id,kind,mode,status,credits,source,created_at")
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminRun[];
}

export async function fetchAdminCounts(): Promise<{ projects: number; assets: number }> {
  const [projects, assets] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("assets").select("id", { count: "exact", head: true }),
  ]);
  return { projects: projects.count ?? 0, assets: assets.count ?? 0 };
}

export function trialStatus(p: AdminProfile): { label: string; active: boolean; days: number } {
  if (p.plan === "admin") return { label: "Admin (ilimitado)", active: true, days: Infinity };
  const ends = new Date(p.trial_ends_at).getTime();
  const days = Math.ceil((ends - Date.now()) / 86_400_000);
  if (days > 0) return { label: `Trial · ${days}d restantes`, active: true, days };
  return { label: "Trial expirado", active: false, days: 0 };
}

export interface TrialUpdate {
  plan?: string;
  trial_ends_at?: string;
  trial_credits?: number;
}

/** Ajusta plano/trial de uma conta (permitido apenas a admins pelo RLS). */
export async function updateProfileTrial(userId: string, patch: TrialUpdate): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
}
