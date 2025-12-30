<script lang="ts">
	import RenderFrame from '$lib/RenderFrame.svelte';
	import { InlineLoading, InlineNotification } from 'carbon-components-svelte';
	import { API } from '$lib/utils/api';
	import { useFormLoader } from '$lib/utils/useFormLoader';
	import { usePortalFormLoader } from '$lib/utils/usePortalFormLoader';
	import { FORM_MODE, FORM_DELIVERY_MODE } from '$lib/constants/formMode';
	import PrivateRoute from '$lib/PrivateRoute.svelte';

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	// Preserve your existing endpoints; swap only the loader in portal mode
	const loader = isPortalIntegrated
		? usePortalFormLoader({
				apiEndpoint: API.generatePortalForm,
				expectSaveData: false
			})
		: useFormLoader({
				apiEndpoint: API.generate
			});

	// These are Svelte stores returned by your loader(s)
	let { isLoading, error, formData, saveData, disablePrint, barcodeValue } = loader;
	// pick the correct mode/delivery without changing your non-portal UX
	const activeMode = isPortalIntegrated ? FORM_MODE.portalNew : FORM_MODE.edit;
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
			barcodeValue={$barcodeValue}
		/>
	{/if}
</PrivateRoute>
