import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { loadFormData } from './load';
import type { UseFormLoaderOptions, UseFormLoaderReturn } from '$lib/types/load';

function getCookie(name: string): string | null {
	if (!browser) return null;
	const match = document.cookie.match(
		new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
	);
	return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Compose a small loader with stores for form payload and loading/error state.
 * Reads URL params once (persisting to sessionStorage) and uses loadFormData for I/O.
 */
export function useFormLoader({
	apiEndpoint,
	expectSaveData = false,
	parseErrorBody = true,
	includeAuth,
	includeOriginalServer = true,
	transformParams
}: UseFormLoaderOptions): UseFormLoaderReturn {
	const isLoading = writable(true);
	const error = writable<string | null>(null);
	const formData = writable<object>({});
	const saveData = writable<object>({});
	const disablePrint = writable(true);

	async function load() {
		if (!browser) return;

		isLoading.set(true);
		error.set(null);

		try {
			// Collect params from URL once and persist to sessionStorage
			const { search, pathname } = window.location;
			let params: Record<string, string> = {};

			if (search) {
				params = Object.fromEntries(new URLSearchParams(search).entries());
				sessionStorage.setItem('formParams', JSON.stringify(params));
				window.history.replaceState({}, document.title, pathname);
			} else {
				const stored = sessionStorage.getItem('formParams');
				if (stored) {
					params = JSON.parse(stored);
				}
			}

			if (typeof apiEndpoint === 'function') {
				// Direct function invocation
				const result = await apiEndpoint();
				// Normalize to stores
				const payload = expectSaveData ? (result?.save_data ?? result) : result;
				formData.set(payload?.form_definition ?? payload ?? {});
				saveData.set(result?.data ? { data: result.data } : {});
				if (payload?.form_definition || payload?.save_data?.form_definition) {
					disablePrint.set(false);
				}
			} else {				
				const finalParams = transformParams ? transformParams(params) : params;
				console.log('(Form Loader) endpoint:', apiEndpoint);
				console.log('(Form Loader) params:', finalParams);

				// Delegate fetch and error handling to loadFormData
				let raw: any = undefined;
				await loadFormData(
					{
						setJsonContent: (data) => {
							raw = data;
						},
						navigate: () => {
							/* no-op: navigation handled by pages, we surface errors via store */
						},
						getCookie
					},
					{
						endpoint: apiEndpoint,
						params: finalParams,
						setLoading: (v) => isLoading.set(v),
						includeAuth: includeAuth ?? true,
						includeOriginalServer,
						// Always ask for raw result here; we map expectSaveData locally
						expectSaveData: false,
						parseErrorBody,
						navigateOnError: false,
						onError: (msg) => error.set(msg)
					}
				);
				console.log('(Form Loader) raw result:', raw);
				// If raw is undefined, an error likely occurred and was set via onError
				if (raw !== undefined) {
					const payload = expectSaveData ? (raw?.save_data ?? raw) : raw;
					formData.set(payload?.form_definition ?? payload?.save_data?.form_definition ?? payload ?? {});
					saveData.set(raw?.data ? { data: raw.data } : payload?.save_data?.data ?? {});
					if (payload?.form_definition || payload?.save_data?.form_definition) {
						disablePrint.set(false);
					}

					// Merge params from loaded JSON into sessionStorage (for generate flow)
					// The Communication-Layer stores params like attachmentId in formJson.params
					if (raw?.params && typeof raw.params === "object") {
						const existingParams = sessionStorage.getItem("formParams");
						const merged = {
							...(existingParams ? JSON.parse(existingParams) : {}),
							...raw.params
						};
						sessionStorage.setItem("formParams", JSON.stringify(merged));
					}
				}
			}
		} catch (e) {
			console.error('[useFormLoader] Error:', e);
			error.set(e instanceof Error ? e.message : String(e));
		} finally {
			isLoading.set(false);
		}
	}

	// Auto-load on initialization
	load();

	return { isLoading, error, formData, load, saveData, disablePrint };
}
