import { browser } from '$app/environment';
import { useFormLoader } from '$lib/utils/useFormLoader';
import { setSessionInterface, fetchInterface, clearInterfaceCache } from '$lib/utils/interface';
import type { UseFormLoaderOptions, UseFormLoaderReturn } from '$lib/types/load';

/**
 * Wraps useFormLoader and, when formData arrives, ensures the interface
 * is present in sessionStorage (prefer from payload, else GET /interface).
 */
export function usePortalFormLoader(options: UseFormLoaderOptions): UseFormLoaderReturn {  
  const loader = useFormLoader(options);

  if (browser) {
    // Avoid “bleeding” buttons across different forms/tabs
    clearInterfaceCache();

    let ran = false;
    const unsub = loader.formData.subscribe(async (fd: any) => {
      if (ran || !fd) return;
      ran = true;

      try {
        const arr = fd?.interface?.interface;
        if (Array.isArray(arr)) {
          setSessionInterface(arr);
        } else {
          // Prefer originalServer from payload if present; null is fine.
          const originalServer = fd?.originalServer ?? null;
          await fetchInterface(originalServer);
        }
      } catch (e) {
        console.warn('fetchInterface failed', e);
      }
    });

    // Optional: if you have a page-unmount hook, call unsub there.
    // In most SPA cases, this subscription dies with the page.
  }

  return loader;
}
