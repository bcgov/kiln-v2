import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { loadFormData } from './load';

export interface UseFormLoaderOptions {
	apiEndpoint: string | (() => Promise<any>);
	parseSaveData?: boolean;
	// New: when using generate endpoints, read result.save_data for form payload
	expectSaveData?: boolean;
	// Optional passthrough flags for loadFormData behavior
	parseErrorBody?: boolean;
	includeOriginalServer?: boolean;
}

export interface UseFormLoaderReturn {
	isLoading: Writable<boolean>;
	error: Writable<string | null>;
	formData: Writable<object>;
	saveData: Writable<object>;
	load: () => Promise<void>;
}

function getCookie(name: string): string | null {
	if (!browser) return null;
	const match = document.cookie.match(
		new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
	);
	return match ? decodeURIComponent(match[1]) : null;
}

export function useFormLoader({
	apiEndpoint,
	expectSaveData = false,
	parseErrorBody = true,
	includeOriginalServer = true
}: UseFormLoaderOptions): UseFormLoaderReturn {
	const isLoading = writable(true);
	const error = writable<string | null>(null);
	const formData = writable<object>({});
	const saveData = writable<object>({});

	async function load() {
		if (!browser) return;

		isLoading.set(true);
		error.set(null);

		try {
			// Collect params from URL once and persist to sessionStorage to mimic old behavior
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
			} else {
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
						params,
						setLoading: (v) => isLoading.set(v),
						includeAuth: true,
						includeOriginalServer,
						// Always ask for raw result here; we map expectSaveData locally
						expectSaveData: false,
						parseErrorBody,
						navigateOnError: false,
						onError: (msg) => error.set(msg)
					}
				);

				// If raw is undefined, an error likely occurred and was set via onError
				if (raw !== undefined) {
					const payload = expectSaveData ? (raw?.save_data ?? raw) : raw;
					formData.set(payload?.form_definition ?? payload?.save_data?.form_definition ?? payload ?? {});
					saveData.set(raw?.data ? { data: raw.data } : payload?.save_data?.data ?? {});
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

	return { isLoading, error, formData, load, saveData };
}
