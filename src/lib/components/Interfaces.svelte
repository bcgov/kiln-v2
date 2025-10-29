<script lang="ts">
	import { API } from '$lib/utils/api';
	import { Button } from 'carbon-components-svelte';
	import { validateAllFields } from '$lib/utils/validation';
	import type { ActionResultPayload } from '$lib/types/interfaces';

	type InterfaceAction = {
		label?: string;
		action_type?: 'javascript' | 'endpoint' | string;
		type?: string; // HTTP method
		host?: string;
		path?: string;
		authentication?: 'SECRET' | string | null;
		headers?: Record<string, any>;
		body?: any;
		params?: Record<string, any>;
		order?: number;
		[key: string]: any;
		continueOnFail?: boolean;
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
		mode?: string[]; // e.g. ["portalEdit"]
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

	function buildActionContext() {
		// session params (legacy v1 behavior)
		let sessionParams: Record<string, any> = {};
		try {
			const raw = sessionStorage.getItem('formParams');
			if (raw) sessionParams = JSON.parse(raw);
		} catch {
			/* ignore */
		}

		// baseContext has token + form meta + any props.context passed from RenderFrame
		const ctx = {
			...baseContext(),
			...(context || {})
		};

		// Merge params: prefer explicit context.params from RenderFrame, then session
		const ctxParams = {
			...(context?.params || {}),
			...sessionParams
		};

		return { ...ctx, params: ctxParams };
	}

	function runUserScript(code: string, ctx: Record<string, any>) {
		// Async, scoped execution with the provided context
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

	function getOriginalServerHeader(): Record<string, string> {
		try {
			// 1) URL ?originalServer=...
			if (typeof window !== 'undefined') {
				const params = new URLSearchParams(window.location.search);
				const fromQs = params.get('originalServer');
				if (fromQs && fromQs.trim()) return { 'X-Original-Server': fromQs.trim() };

				// 2) local/session storage
				const fromStore =
					localStorage.getItem('originalServer') || sessionStorage.getItem('originalServer');
				if (fromStore && fromStore.trim()) return { 'X-Original-Server': fromStore.trim() };

				// 3) global set by host page (optional)
				const g = (window as any).__kilnOriginalServer;
				if (g && typeof g === 'string' && g.trim()) return { 'X-Original-Server': g.trim() };
			}
		} catch {
			// ignore
		}
		return {};
	}

	async function executeEndpointAction(action: any) {
		try {
			const ctx = buildActionContext();

			// Resolve endpoint
			const apiResolved = resolveApiPath(action.api_path);
			let endpoint = apiResolved;
			if (!endpoint) {
				const url = buildUrl(interpolate(action.host, ctx), interpolate(action.path, ctx));
				endpoint = url.toString();
			}

			// Compute body
			const bodyFromAction =
				typeof action.body === 'string'
					? await runUserScript(`return ({ ${String(action.body)} });`, ctx)
					: interpolate(action.body || {}, ctx) || {};

			// Headers
			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
				...getOriginalServerHeader()
			};

			// Let Comm Layer read overrides from payload body
			const payload = {
				...bodyFromAction,
				...(action.path ? { path: action.path } : {}),
				...(action.headers ? { headers: action.headers } : {}),
				...(action.type ? { type: action.type } : {})
			};

			const method = (action.type || 'POST').toUpperCase();
			const fetchInit: RequestInit = { method, headers };

			if (method === 'GET') {
				const qs = new URLSearchParams(payload as any).toString();
				const resp = await fetch(`${endpoint}?${qs}`, fetchInit);
				if (!resp.ok) return await handleApiError(resp);
				return true;
			} else {
				fetchInit.body = JSON.stringify(payload);
				const resp = await fetch(endpoint, fetchInit);
				if (!resp.ok) return await handleApiError(resp);
				return true;
			}
		} catch (err) {
			console.error('API action failed:', err);
			return false;
		}
	}

	async function handleApiError(resp: Response) {
		let message = 'An API action failed.';
		try {
			const ct = (resp.headers.get('content-type') || '').toLowerCase();
			if (ct.includes('json')) {
				const j = await resp.json();
				if (typeof j?.error === 'string' && j.error.trim()) message = j.error;
			} else {
				const t = await resp.text();
				if (t.trim()) message = t;
			}
		} catch {
			/* ignore */
		}
		return false;
	}

	async function executeJavascriptAction(script?: string, ctx?: Record<string, any>) {
		if (!script) return true;
		try {
			// runUserScript already scopes `with(ctx)` and supports async
			const result = await runUserScript(script, ctx || {});
			return result !== false;
		} catch (err) {
			console.error('JavaScript action failed:', err);
			return false;
		}
	}

	// Master sequencer: stops on first failure unless continueOnFail = true
	async function runActionsInSequence(actions: InterfaceAction[]) {
		const ctx = buildActionContext();
		for (const action of actions) {
			const kind = (action.action_type || '').toLowerCase();
			const ok =
				kind === 'javascript'
					? await executeJavascriptAction(action.script, ctx)
					: await executeEndpointAction(action);

			if (!ok && !action.continueOnFail) return false; // stop the chain
		}
		return true;
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

		try {
			const actions = [...(btn.actions || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
			const ok = await runActionsInSequence(actions);

			pending[idx] = ok ? 'success' : 'error';
			props.onActionResult?.({ index: idx, label: btn?.label, ok });
		} catch (err: any) {
			pending[idx] = 'error';
			props.onActionResult?.({
				index: idx,
				label: btn?.label,
				ok: false,
				error: { message: err?.message || 'Unknown error' }
			});
		} finally {
			// brief success/error state, then reset
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
