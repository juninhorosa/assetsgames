import { supabase } from "@/integrations/supabase/client";

/**
 * Assinatura de hardware do dispositivo.
 *
 * O navegador não expõe número de série de placa-mãe (nenhuma web app tem esse
 * acesso). O que dá para ler de forma estável é a combinação de GPU/driver,
 * núcleos de CPU, memória, ecrã, sistema e renderização gráfica — que na
 * prática identifica a mesma máquina física mesmo com e-mail diferente,
 * navegador reinstalado ou modo anónimo.
 */
export interface DeviceComponents {
  gpuVendor: string;
  gpuRenderer: string;
  cores: number;
  memoryGb: number;
  platform: string;
  screen: string;
  colorDepth: number;
  timezone: string;
  languages: string;
  touchPoints: number;
  canvasHash: string;
  audioHash: string;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn() ?? fallback;
  } catch {
    return fallback;
  }
}

function readGpu(): { vendor: string; renderer: string } {
  return safe(
    () => {
      const canvas = document.createElement("canvas");
      const gl = (canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
      if (!gl) return { vendor: "none", renderer: "none" };
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const vendor = ext
        ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL))
        : String(gl.getParameter(gl.VENDOR));
      const renderer = ext
        ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER));
      return { vendor, renderer };
    },
    { vendor: "unknown", renderer: "unknown" },
  );
}

/** Render de canvas: depende da GPU, drivers e fontes instaladas na máquina. */
function canvasSignature(): string {
  return safe(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "none";
    ctx.textBaseline = "top";
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 120, 30);
    ctx.fillStyle = "#069";
    ctx.fillText("Forge3D::hw-probe", 2, 4);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("Forge3D::hw-probe", 4, 22);
    ctx.beginPath();
    ctx.arc(180, 30, 24, 0, Math.PI * 2, true);
    ctx.fill();
    return canvas.toDataURL();
  }, "none");
}

/** Render de áudio offline: varia por chipset/driver de som da placa. */
async function audioSignature(): Promise<string> {
  try {
    const Ctor =
      (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext })
        .OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
    if (!Ctor) return "none";
    const ctx = new Ctor(1, 4096, 44100);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 10_000;
    const comp = ctx.createDynamicsCompressor();
    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);
    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) sum += Math.abs(data[i]);
    return sum.toFixed(6);
  } catch {
    return "none";
  }
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function collectDeviceComponents(): Promise<DeviceComponents> {
  const gpu = readGpu();
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    gpuVendor: gpu.vendor,
    gpuRenderer: gpu.renderer,
    cores: safe(() => navigator.hardwareConcurrency, 0),
    memoryGb: safe(() => Number(nav.deviceMemory ?? 0), 0),
    platform: safe(() => navigator.platform || navigator.userAgent.slice(0, 40), "unknown"),
    screen: safe(() => `${screen.width}x${screen.height}@${devicePixelRatio}`, "unknown"),
    colorDepth: safe(() => screen.colorDepth, 0),
    timezone: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone, "unknown"),
    languages: safe(() => (navigator.languages ?? []).join(","), ""),
    touchPoints: safe(() => navigator.maxTouchPoints ?? 0, 0),
    canvasHash: await sha256(canvasSignature()),
    audioHash: await audioSignature(),
  };
}

/**
 * Hash estável do hardware. Ignora de propósito o user-agent completo, para o
 * mesmo PC continuar a ser reconhecido depois de atualizar o navegador.
 */
export async function computeDeviceFingerprint(components: DeviceComponents): Promise<string> {
  const stable = [
    components.gpuVendor,
    components.gpuRenderer,
    components.cores,
    components.memoryGb,
    components.platform,
    components.screen,
    components.colorDepth,
    components.canvasHash,
    components.audioHash,
  ].join("|");
  return sha256(stable);
}

/** Registra o dispositivo da sessão atual e devolve se caiu como repetido. */
export async function registerDeviceFingerprint(): Promise<{ duplicate: boolean } | null> {
  if (typeof window === "undefined") return null;
  try {
    const components = await collectDeviceComponents();
    const fingerprint = await computeDeviceFingerprint(components);
    const { data, error } = await supabase.rpc("register_device_fingerprint", {
      _fingerprint: fingerprint,
      _components: components as unknown as Record<string, unknown>,
    });
    if (error) return null;
    const result = (data ?? {}) as { duplicate?: boolean };
    return { duplicate: Boolean(result.duplicate) };
  } catch {
    return null;
  }
}
