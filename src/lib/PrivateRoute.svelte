<script lang="ts">
	import { InlineLoading, InlineNotification } from 'carbon-components-svelte';
	import { onMount } from 'svelte';
	import { guardRoute } from '$lib/utils/keycloak';

	const isStandaloneMode = import.meta.env.VITE_STANDALONE_MODE === 'true';
	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	let authChecked = $state(false);
	let unauthorized = $state(false);
	let { children } = $props();

	onMount(async () => {
		if (isStandaloneMode || isPortalIntegrated) {
			authChecked = true;
			unauthorized = false;
			return;
		}
		const { authenticated } = await guardRoute('private');
		authChecked = true;
		unauthorized = !authenticated;
	});
</script>

{#if !authChecked}
	<InlineLoading description="Checking access..." status="active" />
{:else if unauthorized}
	<InlineNotification
		kind="error"
		title="Unauthorized"
		subtitle="You do not have access to this page."
	/>
{:else}
	{@render children()}
{/if}
