<script lang="ts">
	import RenderFrame from '$lib/RenderFrame.svelte';
	import { InlineLoading, InlineNotification } from 'carbon-components-svelte';
	import { API } from '$lib/utils/api';
	import { useFormLoader } from '$lib/utils/useFormLoader';
	import { usePortalFormLoader } from '$lib/utils/usePortalFormLoader';
	import { FORM_MODE, FORM_DELIVERY_MODE } from '$lib/constants/formMode';
	import PrivateRoute from '$lib/PrivateRoute.svelte';

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	// Keep your transformParams behavior. Add/keep isPortalIntegrated if you need it downstream.
	const commonTransform = (params: any) => ({
		...params,
		isPortalIntegrated
	});

	// Preserve your existing endpoint split + transformParams
	const loader = isPortalIntegrated
		? usePortalFormLoader({
				apiEndpoint: API.loadPortalForm,
				transformParams: commonTransform
			})
		: useFormLoader({
				apiEndpoint: API.loadBoundForm,
				transformParams: commonTransform
			});

	let { isLoading, error, formData, saveData, disablePrint } = loader;

	const activeMode = isPortalIntegrated ? FORM_MODE.portalEdit : FORM_MODE.edit;
	const delivery = isPortalIntegrated ? FORM_DELIVERY_MODE.portal : undefined;
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
			mode={activeMode}
			formDelivery={delivery}
			disablePrint={$disablePrint}
		/>
	{/if}
</PrivateRoute>
