<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import { validateAllFields } from '$lib/utils/validation';
	import { createEventDispatcher } from 'svelte';
	import { onMount } from 'svelte';

	type InterfaceAction = {
		label?: string;
		action_type?: 'endpoint' | 'builtin' | 'noop' | string;
		type?: string; // HTTP method
		host?: string;
		path?: string;
		authentication?: 'SECRET' | string | null;
		headers?: Record<string, any>;
		body?: any;
		params?: Record<string, any>;
		order?: number;
		[key: string]: any;
		name?: 'save' | 'saveAndClose' | 'unlock';
		condition?: string;
		// default = 'stop' to preserve current behavior
		onFailure?: 'continue' | 'stop';
	};

	type InterfaceButton = {
		label?: string;
		type?: 'button' | string;
		description?: string | null;
		style?: string | null;
		condition?: string | null;
		actions?: InterfaceAction[];
		order?: number;
		[key: string]: any;
	};

	// ICM config
	type IcmConfig = {
		save: { method: string; url: string; headers?: Record<string, string> };
		unlock: { method: string; url: string; headers?: Record<string, string> };
		isIntegrated: boolean;
	};

	type BuiltinResult = { ok: boolean; data?: any; error?: any };

	type InterfaceApi = {
		save?: () => Promise<BuiltinResult>;
		saveAndClose?: () => Promise<BuiltinResult>;
		unlock?: () => Promise<BuiltinResult>;
	};

	const ENV = (window as any).__KILN_ENV__ ?? {
		VITE_IS_ICM_INTEGRATED: import.meta.env.VITE_IS_ICM_INTEGRATED,
		VITE_COMM_API_ICM_SAVE_METHOD: import.meta.env.VITE_COMM_API_ICM_SAVE_METHOD || 'POST',
		VITE_COMM_API_SAVEDATA_ICM_ENDPOINT_URL:
			import.meta.env.VITE_COMM_API_SAVEDATA_ICM_ENDPOINT_URL || '',
		VITE_COMM_API_ICM_UNLOCK_METHOD: import.meta.env.VITE_COMM_API_ICM_UNLOCK_METHOD || 'POST',
		VITE_COMM_API_UNLOCK_ICM_FORM_URL: import.meta.env.VITE_COMM_API_UNLOCK_ICM_FORM_URL || ''
	};

	const props = $props();

	// Make items reactive so updates from the parent re-render buttons
	let items: InterfaceButton[] = $derived.by(() => {
		const incoming = props.items ?? [];
		return incoming.length
			? incoming
			: (props.icm?.isIntegrated ?? false)
				? defaultIcmButtons()
				: [];
	});
	// Snapshotting other props is fine; update similarly if you expect them to change dynamically
	let disabled: boolean = props.disabled ?? false;
	let size: 'small' | 'default' | 'lg' = props.size ?? 'small';
	let validate: boolean = props.validate ?? true;
	let ariaLabel: string = props.ariaLabel ?? 'Form actions';
	let context: Record<string, any> = props.context ?? undefined;

	const envFlag =
		String(ENV.VITE_IS_ICM_INTEGRATED || '')
			.trim()
			.toLowerCase() === 'true';

	// icm props
	let icm: IcmConfig = props.icm ?? {
		isIntegrated: props.icm?.isIntegrated ?? envFlag,
		save: {
			method: 'POST',
			url: ENV.VITE_COMM_API_SAVEDATA_ICM_ENDPOINT_URL
		},
		unlock: {
			method: 'POST',
			url: ENV.VITE_COMM_API_UNLOCK_ICM_FORM_URL
		}
	};

	let api: InterfaceApi = props.api ?? {};

	// Remove callback-prop approach; use Svelte dispatcher
	const dispatch = createEventDispatcher();

	let pending = $state<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});

	// Merge whenever props.items or icm changes
	$effect(() => {
		const fromJson = (props.items ?? []) as InterfaceButton[];

		const merged: InterfaceButton[] = [...fromJson];

		if (icm.isIntegrated) {
			const defaults = defaultIcmButtons();
			const existingLabels = new Set(
				merged.map((b) => (b.label || '').trim().toLowerCase()).filter(Boolean)
			);
			for (const d of defaults) {
				const key = (d.label || '').trim().toLowerCase();
				if (!existingLabels.has(key)) merged.push(d);
			}
		}

		merged.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
		items = merged;
	});

	function mapKind(
		style: string | null | undefined
	):
		| 'primary'
		| 'secondary'
		| 'tertiary'
		| 'danger'
		| 'ghost'
		| 'danger-tertiary'
		| 'danger-ghost'
		| undefined {
		// Map optional style to Carbon Button kind. Defaults to 'tertiary' for header usage.
		const s = (style || '').toLowerCase().trim();
		if (!s) return 'tertiary';
		// Allow direct Carbon kinds if provided
		if (s === 'primary') return 'primary';
		if (s === 'secondary') return 'secondary';
		if (s === 'tertiary') return 'tertiary';
		if (s === 'danger') return 'danger';
		if (s === 'ghost') return 'ghost';
		if (s === 'danger-tertiary' || s === 'danger--tertiary') return 'danger-tertiary';
		if (s === 'danger-ghost' || s === 'danger--ghost') return 'danger-ghost';
		// Loose mapping fallbacks
		if (s.includes('danger') && s.includes('ghost')) return 'danger-ghost';
		if (s.includes('danger') && s.includes('tertiary')) return 'danger-tertiary';
		if (s.includes('danger')) return 'danger';
		if (s.includes('ghost')) return 'ghost';
		if (s.includes('secondary')) return 'secondary';
		if (s.includes('primary')) return 'primary';
		return 'tertiary';
	}

	function getToken(): string | undefined {
		try {
			// Try globals then localStorage as a fallback
			const w = (window as any) || {};
			return w.__kilnAuth?.token || localStorage.getItem('token') || undefined;
		} catch {
			return undefined;
		}
	}

	function baseContext(): Record<string, any> {
		// Fill common context keys used in placeholders (e.g., @@token@@)
		const w = (window as any) || {};
		return {
			token: getToken(),
			attachmentId: w.__kilnContext?.attachmentId,
			formId: w.__kilnFormDefinition?.form_id,
			formVersion: w.__kilnFormDefinition?.version,
			formName: w.__kilnFormDefinition?.name,
			...context
		};
	}

	function interpolate(value: any, ctx: Record<string, any>): any {
		if (value == null) return value;
		if (typeof value === 'string') {
			return value.replace(/@@(\w+)@@/g, (_m, k) => ctx[k] ?? '');
		}
		if (Array.isArray(value)) return value.map((v) => interpolate(v, ctx));
		if (typeof value === 'object') {
			const out: Record<string, any> = {};
			for (const k of Object.keys(value)) out[k] = interpolate(value[k], ctx);
			return out;
		}
		return value;
	}

	function buildUrl(host?: string, path?: string): URL {
		const safeHost = host || '';
		const safePath = path || '';
		try {
			// new URL will resolve path if host is absolute
			return new URL(safePath, safeHost);
		} catch {
			// Fallback to treat as relative to current origin
			return new URL(safePath || '/', window.location.origin);
		}
	}

	// icm buttons
	function defaultIcmButtons(): InterfaceButton[] {
		return [
			{
				label: 'Save',
				type: 'button',
				style: 'primary',
				condition: '{ return true }',
				actions: [{ action_type: 'builtin', name: 'save', order: 1 }],
				order: 9000 // large default so JSON can place before if desired
			},
			{
				label: 'Save & Close',
				type: 'button',
				style: 'secondary',
				condition: '{ return true }',
				actions: [
					{ action_type: 'builtin', name: 'save', order: 1 },
					{ action_type: 'builtin', name: 'unlock', order: 2 },
					{ action_type: 'builtin', name: 'saveAndClose', order: 3 }
				],
				order: 9010
			}
		];
	}

	function runCondition(code: string | undefined, ctx: any): boolean {
		if (!code || !code.trim()) return true;
		try {
			// Strings are stored like "{ return something }" – strip outer braces if present
			const src = code.trim().replace(/^\{\s*|\s*\}$/g, '');
			// eslint-disable-next-line no-new-func
			const fn = new Function('ctx', src);
			return !!fn(ctx);
		} catch {
			return false; // on parse error, treat as false (skip)
		}
	}

	async function executeAction(action: InterfaceAction, ctx: Record<string, any>) {
		const method = (action.type || 'GET').toUpperCase();
		const url = buildUrl(interpolate(action.host, ctx), interpolate(action.path, ctx));

		const params = interpolate(action.params || {}, ctx);
		if (params && typeof params === 'object') {
			for (const [k, v] of Object.entries(params)) {
				if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
			}
		}

		const headers: Record<string, string> = {
			...(interpolate(action.headers || {}, ctx) || {})
		};

		// Add Authorization if requested and not already provided
		if (action.authentication === 'SECRET' && !('Authorization' in headers)) {
			const token = ctx.token || getToken();
			if (token) headers['Authorization'] = `Bearer ${token}`;
		}

		let body: string | undefined;
		if (method !== 'GET' && method !== 'HEAD') {
			const payload = interpolate(action.body || {}, ctx);
			headers['Content-Type'] = headers['Content-Type'] || 'application/json';
			body = Object.keys(payload || {}).length > 0 ? JSON.stringify(payload) : undefined;
		}

		const res = await fetch(url.toString(), {
			method,
			headers,
			body
		});

		let data: any = null;
		const text = await res.text();
		try {
			data = text ? JSON.parse(text) : null;
		} catch {
			data = text;
		}

		return { ok: res.ok, status: res.status, statusText: res.statusText, data };
	}

	async function handleClick(idx: number, btn: InterfaceButton) {
		if (disabled || pending[idx] === 'loading') return;

		// Optional validation phase
		if (validate) {
			const { isValid, errorList } = validateAllFields();
			if (!isValid) {
				dispatch('action-result', {
					index: idx,
					label: btn?.label,
					ok: false,
					validationErrors: errorList
				});
				return;
			}
		}

		pending[idx] = 'loading';
		const ctx = baseContext();

		try {
			const actions = [...(btn.actions || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

			let lastResult: any = null;
			const errors: any[] = []; // collect when onFailure === 'continue'

			for (const action of actions) {
				// NEW: per-action condition
				if (!runCondition(action.condition, ctx)) {
					continue; // skip silently if condition is false
				}

				const type = (action.action_type || '').toLowerCase();
				let result: any = { ok: true };

				if (type === 'builtin') {
					const name = action.name as keyof InterfaceApi;
					if (name && typeof api?.[name] === 'function') {
						result = await api[name]!();
					} else {
						result = { ok: false, error: { message: `Unknown builtin: ${String(action.name)}` } };
					}
				} else if (type === 'noop' && action.label === '__KILN_CLOSE_WINDOW__') {
					window.close();
					continue;
				} else if (type === 'endpoint') {
					result = await executeAction(action, ctx);
				} else {
					// ignore unknown kinds
					continue;
				}

				lastResult = result;

				if (!result.ok) {
					const behavior = action.onFailure ?? 'stop'; // default preserves current behavior
					if (behavior === 'continue') {
						errors.push({
							action: action.label ?? '(unnamed)',
							error: result.error ?? {
								status: result.status,
								statusText: result.statusText,
								data: result.data
							}
						});
						// keep going
						continue;
					}

					// stop (existing behavior)
					pending[idx] = 'error';
					dispatch('action-result', {
						index: idx,
						label: btn?.label,
						ok: false,
						error: result.error ?? {
							status: result.status,
							statusText: result.statusText,
							data: result.data
						}
					});
					return;
				}
			}

			// If we got here, all actions either succeeded or failed with onFailure='continue'
			const ok = errors.length === 0;
			pending[idx] = ok ? 'success' : 'error';
			dispatch('action-result', {
				index: idx,
				label: btn?.label,
				ok,
				lastResult,
				// surface accumulated errors if any continued failures happened
				continuedErrors: errors.length ? errors : undefined
			});
		} catch (err: any) {
			pending[idx] = 'error';
			dispatch('action-result', {
				index: idx,
				label: btn?.label,
				ok: false,
				error: { message: err?.message || 'Unknown error' }
			});
		} finally {
			// brief success state, then reset
			setTimeout(() => {
				pending[idx] = 'idle';
			}, 800);
		}
	}

	let hasUnsavedWork = false;
	// Toggle this from your form editor when users change fields, or infer from context
	// For MVP we conservatively warn whenever icm.isIntegrated is true
	hasUnsavedWork = icm.isIntegrated;

	// Build + send an "unlock" while the page is closing
	function unlockWithBeacon(ctx?: any): void {
		try {
			// Use provided ctx or reuse the app's baseContext()
			const payloadObj = ctx ?? baseContext();
			const payload = JSON.stringify(payloadObj);

			// Works with absolute or relative URLs
			const url = new URL(icm.unlock.url, location.origin).toString();
			const method = icm.unlock.method ?? 'POST';

			// Prefer sendBeacon for page-teardown reliability
			if (typeof navigator.sendBeacon === 'function') {
				const blob = new Blob([payload], { type: 'application/json' });
				navigator.sendBeacon(url, blob);
				return;
			}

			// Fallback: fetch with keepalive so the browser tries to finish it while unloading
			// (Some browsers still may cancel, but this maximizes chances.)
			fetch(url, {
				method,
				body: payload,
				headers: { 'Content-Type': 'application/json' },
				keepalive: true
			}).catch(() => {
				/* ignore */
			});
		} catch {
			// swallow — we’re in teardown paths
		}
	}

	onMount(() => {
		const before = (e: BeforeUnloadEvent) => {
			// Show native warning only when it matters
			if (!icm.isIntegrated || !hasUnsavedWork) return;
			e.preventDefault();
			e.returnValue = ''; // triggers the browser’s built-in prompt
		};

		const pagehide = (e: PageTransitionEvent) => {
			// If going into bfcache, do not unlock (tab may come back without reload)
			if (!icm.isIntegrated) return;
			if (e && typeof e === 'object' && (e as any).persisted) return;
			unlockWithBeacon(baseContext());
		};

		const vis = () => {
			if (document.visibilityState === 'hidden' && icm.isIntegrated) {
				unlockWithBeacon(baseContext());
			}
		};

		window.addEventListener('beforeunload', before);
		// pagehide is better than unload for mobile Safari; still keep beforeunload for warning
		window.addEventListener('pagehide', pagehide as any);
		document.addEventListener('visibilitychange', vis);

		return () => {
			window.removeEventListener('beforeunload', before);
			window.removeEventListener('pagehide', pagehide as any);
			document.removeEventListener('visibilitychange', vis);
		};
	});
</script>

<div class="interfaces no-print" role="group" aria-label={ariaLabel}>
	{#each items as btn, i (i)}
		<Button
			kind={mapKind(btn?.style)}
			{size}
			disabled={disabled || pending[i] === 'loading'}
			aria-busy={pending[i] === 'loading'}
			onclick={() => handleClick(i, btn)}
		>
			{btn?.label || 'Button'}
		</Button>
	{/each}
</div>

<style>
	.interfaces {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		justify-content: flex-end;
	}
	@media (max-width: 640px) {
		.interfaces {
			justify-content: stretch;
		}
		.interfaces :global(button) {
			flex: 1 1 auto;
		}
	}
</style>
