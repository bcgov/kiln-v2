<script lang="ts">
	import { API } from '$lib/utils/api';
	import { Button } from 'carbon-components-svelte';
	import { validateAllFields } from '$lib/utils/validation';
	import type { ActionResultPayload } from '$lib/types/interfaces';

	type InterfaceAction = {
		label?: string;
		action_type?: 'endpoint' | string;
		type?: string; // HTTP method
		host?: string;
		path?: string;
		authentication?: 'SECRET' | string | null;
		headers?: Record<string, any>;
		body?: any;
		params?: Record<string, any>;
		order?: number;
		[key: string]: any;
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

	const props = $props<{
		items?: InterfaceButton[];
		disabled?: boolean;
		size?: 'small' | 'default' | 'lg';
		validate?: boolean;
		ariaLabel?: string;
		context?: Record<string, any>;
		mode?: string;
		onActionResult?: (payload: ActionResultPayload) => void;
	}>();

	// Make items reactive so updates from the parent re-render buttons
	let items: InterfaceButton[] = $derived.by(() => props.items ?? []);
	// Snapshotting other props is fine; update similarly if you expect them to change dynamically
	let disabled: boolean = props.disabled ?? false;
	let size: 'small' | 'default' | 'lg' = props.size ?? 'small';
	let validate: boolean = props.validate ?? true;
	let ariaLabel: string = props.ariaLabel ?? 'Form actions';
	let context: Record<string, any> = props.context ?? undefined;

	// Current page mode for filtering ("portalNew" | "portalEdit" | "portalView" | "edit" | "preview" | etc.)
	let mode: string = props.mode ?? 'edit';

	let visibleItems = $derived.by(() => {
		if (!Array.isArray(items)) return [];
		return items.filter((btn: any) => {
			const m = btn?.mode;
			return !Array.isArray(m) || m.includes(mode);
		});
	});

	let pending = $state<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});

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

	function runUserScript(code: string, ctx: Record<string, any>) {
		// Async, scoped execution with the provided context
		// eslint-disable-next-line no-new-func
		const fn = new Function('ctx', `with (ctx) { return (async () => { ${code} })(); }`);
		return fn(ctx);
	}

	function resolveApiPath(apiPath?: string): string | null {
		if (!apiPath || typeof apiPath !== 'string') return null;
		// Expect "API.xyz"
		const m = apiPath.match(/^API\.(\w+)$/);
		if (!m) return null;
		const key = m[1];
		const url = (API as any)?.[key];
		return typeof url === 'string' ? url : null;
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
				props.onActionResult?.({
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
			for (const action of actions) {
				const kind = (action.action_type || '').toLowerCase();

				if (kind === 'javascript') {
					const out = await runUserScript(String(action.script || ''), ctx);
					if (out === false) break;
					continue;
				}

				if (kind === 'endpoint') {
					const urlFromApi = resolveApiPath((action as any).api_path);
					const url = urlFromApi
						? new URL(urlFromApi, window.location.origin)
						: buildUrl(interpolate(action.host, ctx), interpolate(action.path, ctx));

					const params = interpolate(action.params || {}, ctx);
					if (params && typeof params === 'object') {
						for (const [k, v] of Object.entries(params)) {
							if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
						}
					}

					let bodyObj: any = undefined;
					if (typeof (action as any).body === 'string') {
						const bodyExpr = String((action as any).body);
						bodyObj = await runUserScript(`return ({ ${bodyExpr} });`, ctx);
					} else if (typeof (action as any).body === 'object') {
						bodyObj = interpolate((action as any).body || {}, ctx);
					}

					const method = (action.type || 'GET').toUpperCase();
					const headers = Object.assign(
						{ 'Content-Type': 'application/json' },
						interpolate(action.headers || {}, ctx)
					);

					const resp = await fetch(url.toString(), {
						method,
						headers,
						body: method === 'GET' ? undefined : JSON.stringify(bodyObj ?? {}),
						credentials: 'same-origin'
					});

					if (!resp.ok) {
						const statusText = resp.statusText;
						let data: any = null;
						try {
							data = await resp.json();
						} catch {
							/* ignore */
						}
						pending[idx] = 'error';
						props.onActionResult?.({
							index: idx,
							label: btn?.label,
							ok: false,
							error: { status: resp.status, statusText, data }
						});
						return;
					}
				}
			}

			pending[idx] = 'success';
			props.onActionResult?.({ index: idx, label: btn?.label, ok: true });
		} catch (err: any) {
			pending[idx] = 'error';
			props.onActionResult?.({
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
</script>

<div class="interfaces no-print" role="group" aria-label={ariaLabel}>
	{#each visibleItems as btn, i (i)}
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
