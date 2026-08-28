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
  email_key: string | null;
  duplicate_suspect: boolean;
  duplicate_of: string | null;
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
    .select(
      "id,display_name,email,plan,trial_started_at,trial_ends_at,trial_credits,created_at,email_key,duplicate_suspect,duplicate_of",
    )
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

export interface AdminDevice {
  id: string;
  user_id: string;
  fingerprint: string;
  components: Record<string, unknown> | null;
  first_seen_at: string;
  last_seen_at: string;
}

/** Dispositivos registrados (assinatura de hardware) — visível apenas a admins. */
export async function fetchAdminDevices(): Promise<AdminDevice[]> {
  const { data, error } = await supabase
    .from("device_fingerprints")
    .select("id,user_id,fingerprint,components,first_seen_at,last_seen_at")
    .order("last_seen_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminDevice[];
}

export interface SharedDevice {
  fingerprint: string;
  hardware: string;
  accounts: AdminProfile[];
  lastSeen: string;
}

/** Agrupa contas distintas que usaram exatamente o mesmo hardware. */
export function sharedDeviceGroups(
  devices: AdminDevice[],
  profiles: AdminProfile[],
): SharedDevice[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const map = new Map<string, { users: Set<string>; lastSeen: string; hardware: string }>();
  for (const d of devices) {
    const c = (d.components ?? {}) as Record<string, unknown>;
    const hardware = [c["gpuRenderer"], c["platform"], c["cores"] ? `${c["cores"]} cores` : null]
      .filter(Boolean)
      .join(" · ");
    const entry = map.get(d.fingerprint) ?? {
      users: new Set<string>(),
      lastSeen: d.last_seen_at,
      hardware: hardware || "hardware desconhecido",
    };
    entry.users.add(d.user_id);
    if (d.last_seen_at > entry.lastSeen) entry.lastSeen = d.last_seen_at;
    map.set(d.fingerprint, entry);
  }
  return [...map.entries()]
    .filter(([, v]) => v.users.size > 1)
    .map(([fingerprint, v]) => ({
      fingerprint,
      hardware: v.hardware,
      lastSeen: v.lastSeen,
      accounts: [...v.users]
        .map((id) => byId.get(id))
        .filter((p): p is AdminProfile => Boolean(p))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
    .sort((a, b) => b.accounts.length - a.accounts.length);
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

/** Agrupa contas que compartilham a mesma raiz de e-mail (pontos, +apelido, gmail/googlemail). */
export function duplicateGroups(profiles: AdminProfile[]): { key: string; accounts: AdminProfile[] }[] {
  const map = new Map<string, AdminProfile[]>();
  for (const p of profiles) {
    const key = p.email_key ?? p.email ?? p.id;
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  return [...map.entries()]
    .filter(([, accounts]) => accounts.length > 1)
    .map(([key, accounts]) => ({
      key,
      accounts: accounts.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
    .sort((a, b) => b.accounts.length - a.accounts.length);
}
