import { API } from './api';
import { browser } from '$app/environment';

export interface InterfaceElement {
  id?: string;
  label: string;
  action: string;
  payload?: unknown;
  mode?: string[];
}

const KEY = 'interface';

export function setSessionInterface(buttons: InterfaceElement[]) {
  if (!browser) return;
  sessionStorage.setItem(KEY, JSON.stringify({ interface: buttons }));
}

export function getSessionInterface(): InterfaceElement[] | null {
  if (!browser) return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.interface) ? parsed.interface : null;
  } catch {
    return null;
  }
}

export const visibleForMode = (btn: InterfaceElement, mode: string) =>
  !Array.isArray(btn?.mode) || btn.mode.includes(mode);

export async function fetchInterface(originalServer?: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (originalServer) headers['X-Original-Server'] = originalServer;
  const resp = await fetch(API.interface, { method: 'GET', headers });
  if (!resp.ok) throw new Error(`Interface fetch failed: ${resp.status} ${await resp.text()}`);
  const payload = await resp.json();
  const buttons = Array.isArray(payload?.interface?.interface) ? payload.interface.interface : [];
  setSessionInterface(buttons);
  return buttons;
}

export function clearInterfaceCache() {
  if (!browser) return;
  sessionStorage.removeItem(KEY);
}
