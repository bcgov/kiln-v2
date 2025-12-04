import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { loadFormData } from './load';
import type { UseFormLoaderOptions, UsePDFLoaderReturn } from '$lib/types/load';

function getCookie(name: string): string | null {
	if (!browser) return null;
	const match = document.cookie.match(
		new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
	);
	return match ? decodeURIComponent(match[1]) : null;
}

export function usePdfLoader({
    apiEndpoint,
    transformParams,
    parseErrorBody = true,
	includeOriginalServer = true,
}: UseFormLoaderOptions): UsePDFLoaderReturn {
    const isLoading = writable(true);
    const error = writable<string | null>(null);
    const pdfBlob = writable<Blob | null>(null);

    async function load() {
        if (!browser) return;

        isLoading.set(true);
        error.set(null);

        try {
            // identical param flow to useFormLoader
            const { search, pathname } = window.location;
            let params: Record<string, string> = {};

            if (search) {
                params = Object.fromEntries(new URLSearchParams(search).entries());
                sessionStorage.setItem("formParams", JSON.stringify(params));
                window.history.replaceState({}, document.title, pathname);
            } else {
                const stored = sessionStorage.getItem("formParams");
                if (stored) params = JSON.parse(stored);
            }

            const finalParams = transformParams ? transformParams(params) : params;

            let raw: any = undefined;

            //CASE 1: apiEndpoint is a direct function (same as useFormLoader) ───
            if (typeof apiEndpoint === "function") {
                const result = await apiEndpoint();

                raw = result;

            } else {

                await loadFormData(
                    {
                        setJsonContent: (data) => { raw = data; },
                        navigate: () => {},
                        getCookie
                    },
                    {
                        endpoint: apiEndpoint,
                        params: finalParams,
                        setLoading: (v) => isLoading.set(v),
                        includeAuth: true,
                        includeOriginalServer,
                        expectSaveData: false,
                        parseErrorBody,
                        navigateOnError: false,
                        onError: (msg) => error.set(msg)
                    }
                );
            }

            if (!raw) {
                error.set("No data returned from server.");
                return;
            }

            // ---- PDF HANDLING ----
            if (raw.pdf_base64) {
                const binary = atob(raw.pdf_base64);
                const array = Uint8Array.from(binary, c => c.charCodeAt(0));
                pdfBlob.set(new Blob([array], { type: "application/pdf" }));
            } else {
                error.set("PDF was not included in the response.");
            }

            // Merge params back into sessionStorage (identical to useFormLoader)
            if (raw.params && typeof raw.params === "object") {
                const existing = sessionStorage.getItem("formParams");
                const merged = {
                    ...(existing ? JSON.parse(existing) : {}),
                    ...raw.params
                };
                sessionStorage.setItem("formParams", JSON.stringify(merged));
            }

        } catch (e) {
            console.error("[usePdfLoader] Error:", e);
            error.set(e instanceof Error ? e.message : String(e));
        } finally {
            isLoading.set(false);
        }
    }

    load();
    return { isLoading, error, load, pdfBlob };
}
