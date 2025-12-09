<script lang="ts">
	import RenderFrame from '$lib/RenderFrame.svelte';
	import { InlineLoading, InlineNotification } from 'carbon-components-svelte';
	import { API } from '$lib/utils/api';
	import { useFormLoader } from '$lib/utils/useFormLoader';
	import { FORM_MODE, FORM_DELIVERY_MODE } from '$lib/constants/formMode';

	const { isLoading, error, formData, saveData, disablePrint } = useFormLoader({
		apiEndpoint: API.loadSavedJson,
		expectSaveData: false,
		transformParams: (params) => ({
			...params,
			isPortalIntegrated: false
		})
	});
</script>

{#if $isLoading}
	<InlineLoading description="Loading form..." status="active" />
{:else if $error}
	<InlineNotification kind="error" title="Error" subtitle={$error} />
{:else}
	<RenderFrame
		formData={$formData}
		saveData={$saveData}
		mode={FORM_MODE.view}
		formDelivery={FORM_DELIVERY_MODE.generate}
		disablePrint={$disablePrint}
	/>
{/if}
