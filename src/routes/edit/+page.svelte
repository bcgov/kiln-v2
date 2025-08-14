<script lang="ts">
	import RenderFrame from '$lib/RenderFrame.svelte';
	import { InlineLoading, InlineNotification } from 'carbon-components-svelte';
	import { API } from '$lib/utils/api';
	import { useFormLoader } from '$lib/utils/useFormLoader';
	import { FORM_MODE, FORM_DELIVERY_MODE } from '$lib/constants/formMode';
	import PrivateRoute from '$lib/PrivateRoute.svelte';

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	const { isLoading, error, formData, saveData } = useFormLoader({
		apiEndpoint: isPortalIntegrated ? API.loadPortalForm : API.loadICMData
	});
</script>

<PrivateRoute>
	{#if $isLoading}
		<InlineLoading description="Loading form..." status="active" />
	{:else if $error}
		<InlineNotification kind="error" title="Error" subtitle={$error} />
	{:else}
		<RenderFrame
			formData={$formData}
			saveData={$saveData}
			mode={FORM_MODE.edit}
			formDelivery={isPortalIntegrated ? FORM_DELIVERY_MODE.portal : undefined}
		/>
	{/if}
</PrivateRoute>
