<script lang="ts">
	import '$lib/web.css';
	import '$lib/print.css';
	import { Button, Form, Modal, Loading } from 'carbon-components-svelte';
	import FormRenderer from './components/FormRenderer.svelte';
	import ScriptStyleInjection from './components/ScriptStyleInjection.svelte';
	import { FORM_MODE } from './constants/formMode';
	import {
		saveFormData,
		unlockICMFinalFlags,
		createSavedData,
		generatePDF,
		submitForButtonAction
	} from './utils/form';

	import { setReadOnlyFields } from './utils/helpers';
	import { validateAllFields } from './utils/validation';
	import { initExternalUpdateBridge } from '$lib/utils/valueSync';
	// Add Interfaces component
	import Interfaces from './components/Interfaces.svelte';

	let {
		saveData = undefined,
		formData,
		goBack = undefined,
		mode = 'preview',
		formDelivery = undefined
	} = $props();

	// Modal and loading state
	let isLoading = $state(false);
	let modalOpen = $state(false);
	let modalTitle = $state('');
	let modalMessage = $state('');
	let isFormCleared = $state(false);
	let modalErrors = $state<string[]>([]);

	// Consolidated modal handler
	function showModal(
		type: 'success' | 'error' | 'validation',
		message?: string,
		errors?: string[]
	) {
		switch (type) {
			case 'success':
				modalTitle = 'Success ✅';
				modalMessage = message ?? 'Form Saved Successfully.';
				modalErrors = [];
				break;
			case 'error':
				modalTitle = 'Error ❌';
				modalMessage = message ?? 'Error saving form. Please try again.';
				modalErrors = [];
				break;
			case 'validation':
				modalTitle = 'Validation Error ❌';
				modalMessage = message ?? 'Please fix the following errors:';
				modalErrors = errors ?? [];
				break;
		}
		modalOpen = true;
	}

	let mergedFormData = $derived.by(() => {
		if (!formData) return null;

		if (mode === 'view') {
			setReadOnlyFields(formData);
		}
		
		return formData;
	});

	let ministryLogoPath = $derived.by(() => {
		const path = mergedFormData?.ministry_id
			? `/ministries/${mergedFormData.ministry_id}.png`
			: null;
		return path;
	});

	let printing = $state(false);

	function handlePrint() {
		if (!formData) return;
		const pdfId = formData.pdf_template_id;
		if (pdfId) {
			generatePDF(formData, pdfId);
			return;
		}

		// Fallback to HTML print
		handleHTMLPrint();
	}

	function handleHTMLPrint() {
		printing = true;

		setTimeout(() => {
			const originalTitle = document.title;
			// Match legacy behavior: set title to form id for print session
			document.title = formData?.form_id || 'CustomFormName';

			// Prepare footer text: e.g., "CF0609 - Consent to Disclosure"
			const footerText = `${formData?.form_id || ''}${
				formData?.form_id ? ' - ' : ''
			}${formData?.title || formData?.name || ''}`.trim();
			// Expose footer text to @page margin boxes via attribute
			document.documentElement.setAttribute('data-form-id', footerText);
			// Also populate the fixed footer (for browsers without margin boxes)
			const fixedFooterLeft = document.getElementById('print-footer-left');
			if (fixedFooterLeft) fixedFooterLeft.textContent = footerText;

			// Create metadata elements
			const metaDescription = document.createElement('meta');
			metaDescription.name = 'description';
			metaDescription.content = 'Form PDF.';

			const metaAuthor = document.createElement('meta');
			metaAuthor.name = 'author';
			metaAuthor.content = 'KILN';

			const metaLanguage = document.createElement('meta');
			metaLanguage.httpEquiv = 'Content-Language';
			metaLanguage.content = 'en';

			// Append metadata to the <head>
			const head = document.head;
			head.appendChild(metaDescription);
			head.appendChild(metaAuthor);
			head.appendChild(metaLanguage);

			// Force reflow
			document.body.offsetHeight;

			const cleanup = () => {
				printing = false;
				document.title = originalTitle;

				// Remove all metadata elements
				head.removeChild(metaDescription);
				head.removeChild(metaAuthor);
				head.removeChild(metaLanguage);

				// Remove footer attribute
				document.documentElement.removeAttribute('data-form-id');

				window.removeEventListener('afterprint', cleanup);
				window.removeEventListener('focus', cleanup);
			};

			window.addEventListener('afterprint', cleanup);
			window.addEventListener('focus', cleanup);

			// Print after slight delay to ensure styles are applied
			setTimeout(() => {
				window.print();
			}, 150);

			// Reset printing state after print dialog
			setTimeout(() => {
				if (printing) {
					printing = false;
				}
			}, 150);
		}, 150);
	}

	async function handleSave() {
		isLoading = true;
		modalOpen = false;

		try {
			const { isValid, errorList } = validateAllFields();
			if (isValid) {
				const returnMessage = await saveFormData('save');
				if (returnMessage === 'success') {
					showModal('success', 'Form saved successfully');
				} else {
					showModal('error', returnMessage);
				}
			} else {
				showModal('validation', undefined, errorList);
			}
		} catch (error) {
			console.error('Save error:', error);
			showModal('error');
		} finally {
			isLoading = false;
		}
	}

	async function handleSaveAndClose() {
		isLoading = true;
		modalOpen = false;

		try {
			const { isValid, errorList } = validateAllFields();
			if (isValid) {
				const returnMessage = await saveFormData('save_and_close');
				if (returnMessage === 'success') {
					isFormCleared = true;
					window.opener = null;
					window.open('', '_self');
					window.close();
				} else {
					showModal('error', returnMessage);
				}
			} else {
				showModal('validation', undefined, errorList);
			}
		} catch (error) {
			console.error('Save and close error:', error);
			showModal('error');
		} finally {
			isLoading = false;
		}
	}

	async function handleGenerate() {
		isLoading = true;
		modalOpen = false;

		try {
			const returnMessage = await saveFormData('save');
			if (returnMessage === 'success') {
				showModal('success');
			} else {
				showModal('error', returnMessage);
			}
		} catch (error) {
			showModal('error');
		} finally {
			isLoading = false;
		}
	}

	async function onButtonClick(config: any) {
		isLoading = true;
		modalOpen = false;

		try {
			const { isValid, errorList } = validateAllFields();
			if (isValid) {
				const returnMessage = await submitForButtonAction(config);
				if (returnMessage === 'success') {
					showModal('success');
				} else {
					showModal('error', returnMessage);
				}
			} else {
				showModal('validation', undefined, errorList);
			}
		} catch (error) {
			console.log(error, 'this is error');
			showModal('error');
		} finally {
			isLoading = false;
		}
	}

	const handleCancel = async () => {
		window.parent.postMessage(JSON.stringify({ event: 'cancel' }), '*');
	};

	const handleSubmit = async () => {
		window.parent.postMessage(JSON.stringify({ event: 'submit' }), '*');
	};

	$effect(() => {
		if (mode !== FORM_MODE.preview && mode !== FORM_MODE.view && typeof window !== 'undefined') {
			const handleClose = (event: BeforeUnloadEvent) => {
				if (!isFormCleared) {
					event.preventDefault();
					unlockICMFinalFlags();
				}
			};
			window.addEventListener('beforeunload', handleClose);
			return () => window.removeEventListener('beforeunload', handleClose);
		}
	});

	// Expose current form definition and init form state for createSavedData
	$effect(() => {
		if (typeof window !== 'undefined' && mergedFormData) {
			(window as any).__kilnFormDefinition = mergedFormData;
			(window as any).__kilnFormState = (window as any).__kilnFormState || {};
		}
	});

	$effect(() => {
		// Install the external-update bridge
		const cleanup = initExternalUpdateBridge();
		return () => {
			cleanup?.();
		};
	});

	function handleInterfaceResult(e: CustomEvent) {
		const detail = (e as any)?.detail || {};
		if (detail?.validationErrors?.length) {
			showModal('validation', undefined, detail.validationErrors);
			return;
		}
		if (detail?.ok) {
			showModal('success');
		} else {
			const msg =
				detail?.error?.message ||
				detail?.error?.statusText ||
				(detail?.error?.data ? JSON.stringify(detail.error.data) : null) ||
				'Action failed';
			showModal('error', msg);
		}
	}
</script>

<!-- Inject dynamic styles and scripts -->
<ScriptStyleInjection styles={formData?.styles} scripts={formData?.scripts} {mode} />

{#if isLoading}
	<Loading />
{/if}

<Modal
	bind:open={modalOpen}
	modalHeading={modalTitle}
	primaryButtonText="OK"
	on:click:button--primary={() => (modalOpen = false)}
	on:close={() => (modalOpen = false)}
>
	{#if modalErrors.length > 0}
		<p style="white-space: pre-line;">{modalMessage}</p>
		<ul>
			{#each modalErrors as err, i (i)}
				<li>{err}</li>
			{/each}
		</ul>
	{:else}
		<p>{modalMessage}</p>
	{/if}
</Modal>

<div class="full-frame">
	<div class="fixed">
		<div class="header-section">
			<div class="header-image">
				<div class="header-image-only">
					{#if ministryLogoPath}
						<img src={ministryLogoPath} width="232px" alt="ministry logo" />
					{/if}
				</div>

				<div class="header-buttons-only no-print">
					<Interfaces
						items={mergedFormData?.interface || formData?.interface || []}
						disabled={typeof goBack === 'function'}
						on:action-result={handleInterfaceResult}
					/>
					{#if mode === FORM_MODE.edit}
						<Button kind="tertiary" class="no-print" onclick={handleSave}>Save</Button>
						<Button kind="tertiary" class="no-print" onclick={handleSaveAndClose}>
							Save And Close
						</Button>
					{/if}

					{#if formDelivery === 'generate'}
						<Button kind="tertiary" class="no-print" onclick={handleGenerate}>Generate</Button>
					{/if}

					{#if (mode === FORM_MODE.edit || mode === FORM_MODE.preview) && formDelivery === 'portal'}
						<div class="header-buttons-only no-print">
							<!-- Replace inline mapping with reusable Interfaces component -->
							<Button onclick={handleCancel} kind="tertiary" id="generate">Cancel</Button>
							<Button onclick={handleSubmit} kind="tertiary" id="generate">Submit</Button>
						</div>
					{/if}

					{#if goBack}
						<Button kind="tertiary" class="no-print" onclick={goBack}>Back</Button>
					{/if}

					<Button kind="tertiary" class="no-print" onclick={handlePrint}>Print</Button>
				</div>

				<div class="form-title hidden-on-screen">
					<div class="header-form-id-print">{formData?.form_id || ''}</div>
					<div class="header-title-print">
						{formData?.title || formData?.name || ''}
						{#if goBack}<span>(Preview)</span>{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="header-form-id no-print">
		<div class="form-id-section">
			{formData?.form_id || ''}
		</div>
	</div>

	<div class="scrollable-content">
		<div class="header-section">
			<div class="header-title-buttons">
				<div class="header-title-only no-print">
					{formData?.title || formData?.name || ''}
					{#if goBack}<span>(Preview)</span>{/if}
				</div>
			</div>
		</div>

		<div class="content-wrapper">
			{#if formData}
				<Form
					class="form"
					on:submit={(e) => {
						e.preventDefault();
					}}
				>
					<FormRenderer formData={mergedFormData} {mode} {printing} />
				</Form>
			{:else}
				<p>No form data available</p>
			{/if}
		</div>
	</div>

	<div id="footer" style="display: none;">
		Form ID: {formData?.form_id || 'Form-12345'}
	</div>
	<div class="paged-page" data-footer-text=""></div>
</div>
