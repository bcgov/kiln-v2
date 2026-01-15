<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { getCustomCssForCurrentHost } from '$lib/utils/hostConfig';  

  function resolveCssHref(): string | null {
    const css = getCustomCssForCurrentHost();
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
