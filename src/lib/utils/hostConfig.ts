import { browser } from '$app/environment';
import { getOriginalServerHeader } from '$lib/utils/helpers';

export type HostConfig = {
  [host: string]: {
    customCss?: string;
  };
};

function parseHostConfig(): HostConfig {
  try {
    const raw = import.meta.env.VITE_APP_CONFIG;
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('[hostConfig] Invalid VITE_APP_CONFIG', e);
    return {};
  }
}

/**
 * Resolve the effective host for config lookup.
 * Uses X-Original-Server when present (gateway / proxy),
 * otherwise falls back to window.location.hostname.
 */
export function resolveHost(): string | null {
  if (!browser) return null;

  const originalServer = getOriginalServerHeader()?.['X-Original-Server'];
  const host = originalServer ?? window.location.hostname;
  return host?.toLowerCase() ?? null;
}

/**
 * Return the config entry for the current host.
 */
export function getHostConfigForCurrentHost(): HostConfig[string] | null {
  const host = resolveHost();
  if (!host) return null;

  const config = parseHostConfig();
  return config[host] ?? null;
}

/**
 * helper for consumers that only need CSS.
 */
export function getCustomCssForCurrentHost(): string | null {
  const hostConfig = getHostConfigForCurrentHost();
  return hostConfig?.customCss ?? null;
}
