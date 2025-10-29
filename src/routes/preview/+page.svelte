<script lang="ts">
	import { TextArea, Form, Button, InlineNotification, InlineLoading } from 'carbon-components-svelte';
	import RenderFrame from '$lib/RenderFrame.svelte';
	import { FORM_DELIVERY_MODE, FORM_MODE } from '$lib/constants/formMode';
	import { API } from '$lib/utils/api';

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';
	console.log("Debug Test Preview!");

	let present = $state(false);
	let jsonContent = $state<object>({});
	let content = $state('');
	let error = $state('');
	let saveData = $state<{ data: any } | undefined>(undefined);
	let isLoading = $state(false);

	$effect(() => {
		const handleMessage = (event: MessageEvent) => {
			const trustedOrigins = [
				import.meta.env.VITE_TEMPLATE_REPO_URL,
				import.meta.env.VITE_KLAMM_URL,
			];

			if (!trustedOrigins.includes(event.origin)) {
				console.warn('Received message from untrusted origin:', event.origin);
				return;
			}

			if (event.data && event.data.type === 'LOAD_JSON') {
				content = event.data.data;
				processJSON(event.data.data);
			}
		};

		window.addEventListener('message', handleMessage);

		return () => {
			window.removeEventListener('message', handleMessage);
		};
	});

	async function processJSON(jsonString: string) {
		error = '';
		isLoading = true;

		if (!jsonString.trim()) {
			error = 'Content cannot be empty. Please enter valid JSON.';
			isLoading = false;
			return;
		}

		try {
			const parsedJSON = JSON.parse(jsonString);
			let formData;

			if (parsedJSON.data && parsedJSON.form_definition) {
				formData = {
					data: parsedJSON.data,
					form_definition: parsedJSON.form_definition,
					metadata: parsedJSON.metadata || null
				};
			} else if (parsedJSON.formversion) {
				formData = {
					data: null,
					form_definition: parsedJSON.formversion,
					metadata: null
				};
			} else {
				formData = {
					data: null,
					form_definition: parsedJSON,
					metadata: null
				};
			}

			// Call the API to bind the data
			const response = await fetch(API.bindPreviewForm, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ formData })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to bind form data');
			}

			const boundData = await response.json();

			// Set the bound form definition and save data
			jsonContent = boundData.form_definition || {};
			saveData = boundData.data ? { data: boundData.data } : undefined;
			present = true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Invalid JSON format or API error. Please correct it.';
		} finally {
			isLoading = false;
		}
	}

	async function handleSubmit(event: Event) {
		console.log("Debug Test Submitted!");
		event.preventDefault();
		await processJSON(content);
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

		{#if isLoading}
			<InlineLoading description="Processing form data..." status="active" />
		{:else}
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

				<Button kind="secondary" type="submit" disabled={isLoading}>Preview</Button>
			</Form>
		{/if}
	</div>
{/if}
