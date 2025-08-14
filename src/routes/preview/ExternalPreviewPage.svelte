<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { API } from '../../lib/utils/api';
	import Echo from 'laravel-echo';
	import Pusher from 'pusher-js';
	import {
		getConnectionStatusColor,
		isPusherConnector,
		getSocketId,
		type ConnectionStatus
	} from '../../lib/types/websocket';
	import { InlineLoading, InlineNotification, Button, Link } from 'carbon-components-svelte';
	import type { FormData, ApiDataResponse, ApiDataItem } from '../../lib/types/form';
	import RenderFrame from '../../lib/RenderFrame.svelte';
	import { FORM_MODE } from '$lib/constants/formMode';

	let { id } = $props();

	// --- State ---
	let formData = $state<FormData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let connectionStatus = $state<ConnectionStatus>('connecting');
	let echoInstance = $state<any>(null);
	let subscription = $state<any>(null);

	// --- Params ---
	let formVersionID = $state<string | null>(null);
	let isDraft = $state(false);

	// --- Derived values ---
	let channelName = $derived(() => {
		if (!id) return null;
		return isDraft ? `draft-form-version.${id}` : `form-version.${id}`;
	});

	let isConnectedAndReady = $derived(() => {
		return echoInstance && connectionStatus === 'connected' && id;
	});

	// --- Helpers ---
	function getReverbWsHost() {
		const prod = import.meta.env.VITE_REVERB_PROD_HOST;
		const dev = import.meta.env.VITE_REVERB_DEV_HOST;
		const test = import.meta.env.VITE_REVERB_TEST_HOST;
		const defaultHost = import.meta.env.VITE_REVERB_HOST || 'localhost';
		if (typeof window !== 'undefined') {
			const host = window.location.hostname;
			if (dev && host.endsWith(dev)) return dev;
			if (test && host.endsWith(test)) return test;
			if (prod && host === prod) return prod;
		}
		return defaultHost;
	}

	function transformApiResponse(apiData: ApiDataResponse): FormData {
		return {
			form_template: apiData.form_template,
			form_version: apiData.form_version,
			metadata: {},
			data: apiData.data ?? {},
			form_definition: apiData.form_definition ?? {}
		};
	}

	function setupChannelEventBindings(channel: any, onUpdate: () => void) {
		try {
			if (typeof channel.bind === 'function') {
				channel.bind('pusher:subscription_error', (error: any) => {
					console.error('Subscription error:', error);
				});
				if (typeof channel.bind_global === 'function') {
					channel.bind_global((eventName: string) => {
						if (
							eventName === 'App\\Events\\FormVersionUpdateEvent' ||
							eventName === 'FormVersionUpdateEvent'
						) {
							onUpdate();
						}
					});
				}
				channel.bind('App\\Events\\FormVersionUpdateEvent', onUpdate);
			}
			if (typeof channel.listen === 'function') {
				channel.listen('FormVersionUpdateEvent', onUpdate);
				channel.listen('App\\Events\\FormVersionUpdateEvent', onUpdate);
			}
		} catch (error) {
			console.error('Error setting up channel listeners:', error);
		}
	}

	function setupConnectionHandlers(echo: any) {
		if (!isPusherConnector(echo.connector)) return;
		const pusherConnection = echo.connector.pusher?.connection;
		pusherConnection.bind('connected', () => {
			const socketId = getSocketId(echo);
			if (socketId) {
				connectionStatus = 'connected';
			} else {
				setTimeout(() => {
					if (getSocketId(echo)) {
						connectionStatus = 'connected';
					}
				}, 1000);
			}
		});
		pusherConnection.bind('disconnected', () => (connectionStatus = 'disconnected'));
		pusherConnection.bind('error', (err: any) => {
			console.error('WebSocket error:', err);
			connectionStatus = 'error';
		});
		pusherConnection.bind('unavailable', () => {
			console.warn('WebSocket unavailable');
			connectionStatus = 'error';
		});
	}

	async function initializeEcho() {
		try {
			connectionStatus = 'connecting';
			const scheme = import.meta.env.VITE_REVERB_SCHEME || 'http';
			const host = getReverbWsHost();
			const portEnv = import.meta.env.VITE_REVERB_PORT;
			const isSecure = scheme === 'https';
			const port = portEnv ? Number(portEnv) : undefined;
			echoInstance = new Echo({
				broadcaster: 'reverb',
				key: import.meta.env.VITE_REVERB_APP_KEY,
				wsHost: host,
				wsPort: !isSecure ? port : undefined,
				wssPort: isSecure ? port : undefined,
				forceTLS: isSecure,
				enabledTransports: ['ws', 'wss'],
				disableStats: true
			});
			setupConnectionHandlers(echoInstance);
		} catch (error) {
			console.error('Failed to initialize Echo:', error);
			connectionStatus = 'error';
			echoInstance = null;
		}
	}

	async function fetchFormData(isRealTimeUpdate = false) {
		try {
			if (!isRealTimeUpdate) loading = true;
			const urlParams = new URLSearchParams(window.location.search);
			isDraft = urlParams.get('draft') === 'true';
			formVersionID = id;
			const url = `${API.getFormById}${formVersionID}/data?${isDraft ? 'draft=true' : ''}`.replace(
				/&$/,
				''
			);
			const response = await fetch(url);
			if (!response.ok)
				throw new Error(`Failed to fetch form data: ${response.status} ${response.statusText}`);
			const apiData = await response.json();

			if (isRealTimeUpdate) {
				// For real-time updates, always update the formData completely
				// This ensures reactivity triggers properly
				const newFormData = transformApiResponse(apiData);
				console.log('Real-time update received:', newFormData);
				formData = newFormData;
			} else {
				formData = transformApiResponse(apiData);
				error = null;
			}
		} catch (err) {
			console.error(`Error fetching form data${isRealTimeUpdate ? ' (real-time)' : ''}:`, err);
			if (!isRealTimeUpdate)
				error = err instanceof Error ? err.message : 'An unknown error occurred';
		} finally {
			if (!isRealTimeUpdate) loading = false;
		}
	}

	function goBack() {
		const url = `${API.getFormKlammURL}${formVersionID}`;
		window.location.href = url;
	}

	// --- Effects ---
	// Set up websocket subscription when connection is ready
	$effect(() => {
		const channel = channelName();
		if (isConnectedAndReady() && channel) {
			console.log('Setting up websocket subscription for:', channel);
			// Subscribe to channel
			const ch = echoInstance.channel(channel);
			setupChannelEventBindings(ch, () => {
				console.log('Websocket update triggered');
				fetchFormData(true);
			});
			subscription = ch;

			// Cleanup function
			return () => {
				console.log('Cleaning up websocket subscription for:', channel);
				if (echoInstance && channel && subscription) {
					try {
						echoInstance.leave(channel);
					} catch (error) {
						console.error('Error leaving channel:', error);
					}
					subscription = null;
				}
			};
		}
	});

	// --- Lifecycle ---
	onMount(() => {
		if (!id) {
			error = 'No form ID provided. Please include an "id" query parameter.';
			loading = false;
			return;
		}
		fetchFormData();
		initializeEcho();
	});

	onDestroy(() => {
		if (echoInstance && id && subscription) {
			try {
				const channelName = isDraft ? `draft-form-version.${id}` : `form-version.${id}`;
				echoInstance.leave(channelName);
			} catch (error) {
				console.error('Error leaving channel:', error);
			}
			subscription = null;
		}
		echoInstance = null;
	});
</script>

{#if loading}
	<div>
		<InlineLoading description="Loading form..." status="active" />
		<div>
			Klamm Connection: <span style="color: {getConnectionStatusColor(connectionStatus)}"
				>{connectionStatus}</span
			>
		</div>
	</div>
{:else if error}
	<div>
		<InlineNotification kind="error" title="Error" subtitle={error} />
		<Button onclick={goBack}>Go Back</Button>
	</div>
{:else if !formData}
	<div>
		<InlineNotification
			kind="error"
			title="No Data"
			subtitle="No form data was returned from the API."
		/>
		<Button onclick={goBack}>Go Back</Button>
	</div>
{:else}
	<div class="preview-container">
		<button
			class="info-button info-button--normal cds--btn cds--layout--size-small cds--btn--ghost no-print"
			type="button"
			title="Connection Status: {connectionStatus}"
		>
			<span style="color: {getConnectionStatusColor(connectionStatus)};">●</span>
			{connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
		</button>

		{#if isDraft}
			<div class="draft-banner no-print">
				🚧 DRAFT VERSION - This form is still being edited and may not reflect the current version.
				<Link href={`/preview/${id}`} target="_blank" rel="noopener noreferrer">
					View the current version
				</Link>
			</div>
		{/if}
		<div class={`content-padding ${isDraft ? 'content-padding--draft' : ''}`}>
			<RenderFrame
				formData={formData?.form_template?.formversion}
				mode={FORM_MODE.preview}
				{goBack}
			/>
		</div>
	</div>
{/if}

<style>
	.info-button {
		position: fixed;
		top: 10px;
		right: 10px;
		z-index: 10000;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 8px 12px;
		border: 1px solid transparent;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(4px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		font-size: 12px;
		font-weight: 500;
		line-height: 1;
		cursor: default;
		transition: all 0.2s ease;
	}

	.info-button:hover {
		background: rgba(255, 255, 255, 1);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.draft-banner {
		position: sticky;
		width: 100%;
		z-index: 9999;
		top: 0;
		background: #fffbe6;
		color: #8a3ffc;
		margin-bottom: 1rem;
		border-radius: 4px;
		font-weight: bold;
	}

	.content-padding--draft {
		border: 2px #f1c21b;
	}

	@media print {
		.no-print {
			display: none !important;
		}
	}
</style>
