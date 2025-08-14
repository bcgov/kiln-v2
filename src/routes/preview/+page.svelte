<script lang="ts">
	import { TextArea, Form, Button, InlineNotification } from 'carbon-components-svelte';
	import RenderFrame from '$lib/RenderFrame.svelte';
	import { FORM_DELIVERY_MODE, FORM_MODE } from '$lib/constants/formMode';

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	let present = $state(false);
	let jsonContent = $state<object>({});
	let content = $state('');
	let error = $state('');
	let saveData = $state<{ data: any } | undefined>(undefined);

	function handleSubmit(event: Event) {
		event.preventDefault();
		error = '';

		if (!content.trim()) {
			error = 'Content cannot be empty. Please enter valid JSON.';
			return;
		}

		try {
			const parsedJSON = JSON.parse(content);

			// If both data and form_definition exist, treat as form_with_data
			if (parsedJSON.data && parsedJSON.form_definition) {
				saveData = { data: parsedJSON.data };
				jsonContent = parsedJSON.form_definition;
			} else if (parsedJSON.formversion) {
				// If formversion exists, treat as example-form.json
				jsonContent = parsedJSON.formversion;
				saveData = undefined;
			} else {
				// fallback: treat as plain form definition
				jsonContent = parsedJSON;
				saveData = undefined;
			}
			present = true;
		} catch (e) {
			error = 'Invalid JSON format. Please correct it.';
		}
	}

	function handleGoBack() {
		present = false;
	}
</script>

{#if present}
	<RenderFrame
		formData={jsonContent}
		{saveData}
		mode={FORM_MODE.preview}
		formDelivery={isPortalIntegrated ? FORM_DELIVERY_MODE.portal : undefined}
		goBack={handleGoBack}
	/>
{:else}
	<div style="margin: 20px;">
		<h3 style="margin-bottom: 20px;">Preview Your JSON</h3>

		{#if error}
			<InlineNotification
				kind="error"
				title="Error"
				subtitle={error}
				style="margin-bottom: 1rem;"
			/>
		{/if}

		<Form onsubmit={handleSubmit}>
			<TextArea
				bind:value={content}
				style="margin-bottom: 10px; padding: 10px; font-size: 16px;"
				cols={50}
				helperText="Please enter your json for the form definition"
				id="jsonData"
				invalid={!!error}
				invalidText={error}
				labelText="Form Template JSON"
				placeholder="Enter your form json"
				rows={15}
			/>
			<br />

			<Button kind="secondary" type="submit">Preview</Button>
		</Form>
	</div>
{/if}
