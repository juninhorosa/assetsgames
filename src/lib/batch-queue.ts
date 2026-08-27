/**
 * Fila de geração em lote persistida em localStorage.
 *
 * Cada job descreve uma geração (sheet de ação ou asset estático numa direção).
 * O cursor avança só depois do asset ser salvo na biblioteca, então fechar a
 * aba no meio do lote não perde o trabalho já feito: ao voltar, o estúdio
 * oferece retomar exatamente do próximo job pendente.
 */

import type { AssetMode, StyleProfile, ViewKey } from "./style-profile";

const STORAGE_KEY = "forge3d.batch-queue.v1";

export interface QueueJob {
  id: string;
  label: string;
  kind: "spritesheet" | "static";
  prompt: string;
  finalPrompt: string;
  mode: AssetMode;
  size: string;
  assetName: string;
  view?: ViewKey | undefined;
  action?: string | undefined;
  columns?: number | undefined;
  rows?: number | undefined;
  fps?: number | undefined;
}

export interface QueueState {
  projectId: string;
  baseName: string;
  createdAt: string;
  cursor: number;
  jobs: QueueJob[];
  profile: StyleProfile;
  /** Imagem de referência (data URL) usada para travar a aparência do personagem. */
  reference?: string | undefined;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadQueue(): QueueState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QueueState;
    if (!parsed?.jobs?.length || parsed.cursor >= parsed.jobs.length) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveQueue(state: QueueState) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Referência em base64 costuma estourar a cota: guarda a fila sem ela.
    try {
      const { reference: _reference, ...light } = state;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
    } catch {
      /* o lote continua apenas em memória nesta sessão */
    }
  }
}


export function advanceQueue(state: QueueState, cursor: number): QueueState {
  const next = { ...state, cursor };
  if (cursor >= state.jobs.length) {
    clearQueue();
  } else {
    saveQueue(next);
  }
  return next;
}

export function clearQueue() {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function queueProgress(state: QueueState) {
  return { done: state.cursor, total: state.jobs.length };
}
