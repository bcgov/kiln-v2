<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  type AppConfig = {
    [appName: string]: {
      customCss?: string;
    };
  };

  function getAppConfig(): AppConfig {
    try {
      const raw = import.meta.env.VITE_APP_CONFIG;
      console.log("raw >",JSON.stringify(raw));
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('[OriginStyleOverride] Invalid APP_CONFIG', e);
      return {};
    }
  }

  function resolveAppNameFromOrigin(): string | null {
    const host = window.location.hostname.toLowerCase();
    return host;
  }

  function resolveCssHref(): string | null {
    const appName = resolveAppNameFromOrigin();
    if (!appName) return null;

    const config = getAppConfig();
    const css = config[appName]?.customCss;
    if (!css) return null;

    return css.startsWith('/')
      ? css
      : `/customStyles/${css}`;
  }

  const LINK_ID = 'origin-style-override';

  onMount(() => {
    if (!browser) return;

    const href = resolveCssHref();
    if (!href) return;

    if (document.getElementById(LINK_ID)) return;

    const link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    link.href = href;

    link.onerror = () => {
      console.warn('[OriginStyleOverride] Failed to load:', href);
    };

    document.head.appendChild(link);
  });

  onDestroy(() => {
    document.getElementById(LINK_ID)?.remove();
  });
</script>
