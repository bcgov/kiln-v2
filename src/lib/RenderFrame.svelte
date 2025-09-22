<script lang="ts">
	import '$lib/web.css';
	import '$lib/print.css';
	import { Button, Form, Modal, Loading } from 'carbon-components-svelte';
	import FormRenderer from './components/FormRenderer.svelte';
	import ScriptStyleInjection from './components/ScriptStyleInjection.svelte';
	import { FORM_MODE } from './constants/formMode';
	import {
		saveDataToICMApi,
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
	import { onMount, onDestroy, tick } from 'svelte';

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

	// htmlprint helpers
	let printing = $state(false);
	let _letterRenderScheduled = false;
	let _letterRenderRunning = false;
	let _toggleBtnRef: HTMLElement | null = null;

	function scheduleLetterRender() {
		if (_letterRenderScheduled || _letterRenderRunning) return;
		_letterRenderScheduled = true;
		// run after the current microtask so multiple mutations coalesce
		queueMicrotask(() => {
			_letterRenderScheduled = false;
			renderAllLetterTemplates();
		});
	}

	function getToggleBtn(): HTMLElement | null {
		// keep using the same element if it still exists
		if (_toggleBtnRef?.isConnected) return _toggleBtnRef;

		// prefer an explicitly tagged button
		_toggleBtnRef =
			document.querySelector<HTMLElement>(
				'button[data-letter-toggle], [role="button"][data-letter-toggle]'
			) ||
			// fallback: first button whose label includes "show"
			Array.from(document.querySelectorAll<HTMLElement>('button,[role="button"]')).find((b) =>
				(b.textContent || b.getAttribute('aria-label') || '').toLowerCase().includes('show')
			) ||
			null;

		// tag it so future queries are unambiguous
		if (_toggleBtnRef) _toggleBtnRef.setAttribute('data-letter-toggle', '1');
		return _toggleBtnRef;
	}

	function setButtonLabel(btn: HTMLElement, text: 'Show Letter' | 'Show Form') {
		btn.textContent = text;
		btn.setAttribute('aria-label', text);
	}

	function normalizeToggleButtonLabel() {
		const btn = getToggleBtn();
		if (!btn) return;
		const isLetterOnly = document.documentElement.classList.contains('letter-only');
		const desired = isLetterOnly ? 'Show Form' : 'Show Letter';
		setButtonLabel(btn, desired);
	}

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

	function renderAllLetterTemplates() {
		// prevent self-trigger loops
		if (_letterRenderRunning) return;
		_letterRenderRunning = true;
		try {
			const letters = Array.from(document.querySelectorAll<HTMLElement>('.letter-content'));
			if (letters.length === 0) return;

			const map = collectFieldValues();
			aliasValues(map);

			for (const letter of letters) {
				if (!letter.dataset.originalHtml) {
					letter.dataset.originalHtml = letter.innerHTML;
				}
				const original = letter.dataset.originalHtml!;
				const replaced = original.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawKey) => {
					const key = String(rawKey).trim();
					return (
						map[key] ??
						map[key.replace(/\s+/g, '_')] ??
						map[key.replace(/[^\w]+/g, '_').toLowerCase()] ??
						''
					);
				});
				if (replaced !== letter.innerHTML) {
					letter.innerHTML = replaced;
				}
			}
		} finally {
			_letterRenderRunning = false;
		}
	}

	// scroll all scrollables to the top for print, then restore afterward
	function captureScrollAndJumpToTop() {
		// document + any in-page scrollers you use
		const scrollables: HTMLElement[] = [
			(document.scrollingElement || document.documentElement) as HTMLElement,
			...Array.from(document.querySelectorAll<HTMLElement>('.scrollable-content, .content-wrapper'))
		];

		const prevWindow = { x: window.scrollX, y: window.scrollY };
		const prev = scrollables.map((el) => ({ el, top: el.scrollTop, left: el.scrollLeft }));

		// jump everything to the top so the snapshot starts at page 1
		window.scrollTo(0, 0);
		scrollables.forEach((s) => {
			s.scrollTop = 0;
			s.scrollLeft = 0;
		});

		return () => {
			window.scrollTo(prevWindow.x, prevWindow.y);
			prev.forEach(({ el, top, left }) => {
				el.scrollTop = top;
				el.scrollLeft = left;
			});
		};
	}

	function hoistLetterForPrintIfNeeded() {
		const html = document.documentElement;
		if (!html.classList.contains('letter-only')) {
			return () => {};
		}

		const letter = getLetterEl();
		if (!letter) return () => {};

		const section = getLetterSection();
		if (!section || !section.parentElement) return () => {};

		const scrollable =
			document.querySelector('.scrollable-content .content-wrapper') ||
			document.querySelector('.scrollable-content') ||
			document.body;

		// anchor so we can restore after printing
		const placeholder = document.createComment('letter-restore-anchor');
		section.parentElement.insertBefore(placeholder, section);

		// hoist the letter section so it starts on page 1
		if (scrollable.firstChild) {
			scrollable.insertBefore(section, scrollable.firstChild);
		} else {
			scrollable.appendChild(section);
		}
		section.classList.add('print-hoisted');

		return () => {
			try {
				if (placeholder.parentNode) {
					placeholder.parentNode.insertBefore(section, placeholder);
					placeholder.remove();
				}
			} finally {
				section.classList.remove('print-hoisted');
			}
		};
	}

	async function handleHTMLPrint() {
		// snapshot state to restore to
		const wasLetterOnly = document.documentElement.classList.contains('letter-only');
		const prevPrinting = printing;

		printing = true;

		// commit the printable DOM
		await tick();

		// map {{…}} into value in the print DOM
		renderAllLetterTemplates();
		// one more pass after styles/layout settle
		requestAnimationFrame(() => renderAllLetterTemplates());

		// on letter only, hoist the letter section to the top so it starts on page 1
		let restoreLetterPosition = () => {};
		if (wasLetterOnly) {
			restoreLetterPosition = hoistLetterForPrintIfNeeded();
		}

		let restoreScroll = () => {};
		restoreScroll = captureScrollAndJumpToTop();

		//temporary document metadata
		const originalTitle = document.title;
		const head = document.head;
		const metaDescription = document.createElement('meta');
		const metaAuthor = document.createElement('meta');
		const metaLanguage = document.createElement('meta');

		metaDescription.name = 'description';
		metaDescription.content = 'Form PDF.';
		metaAuthor.name = 'author';
		metaAuthor.content = 'KILN';
		metaLanguage.httpEquiv = 'Content-Language';
		metaLanguage.content = 'en';

		head.appendChild(metaDescription);
		head.appendChild(metaAuthor);
		head.appendChild(metaLanguage);

		const footerText =
			`${formData?.form_id || ''}${formData?.form_id ? ' - ' : ''}${formData?.title || formData?.name || ''}`.trim();
		document.title = formData?.form_id || originalTitle;
		document.documentElement.setAttribute('data-form-id', footerText);

		// cleanup that fully restores the web view
		const cleanup = () => {
			try {
				restoreLetterPosition();
			} catch {}
			printing = prevPrinting;
			metaDescription.remove();
			metaAuthor.remove();
			metaLanguage.remove();
			document.documentElement.removeAttribute('data-form-id');
			document.title = originalTitle;
			normalizeToggleButtonLabel();
			queueMicrotask(normalizeToggleButtonLabel);
			requestAnimationFrame(() => normalizeToggleButtonLabel());
			// make sure no {{…}} remains
			queueMicrotask(renderAllLetterTemplates);
			restoreScroll();
		};

		// fallbacks
		const onAfter = () => {
			window.removeEventListener('afterprint', onAfter);
			document.removeEventListener('visibilitychange', onVis);
			cleanup();
		};
		const onVis = () => {
			// Some browsers don’t fire afterprint reliably; when the tab re-activates, restore.
			if (document.visibilityState === 'visible') onAfter();
		};
		window.addEventListener('afterprint', onAfter, { once: true });
		document.addEventListener('visibilitychange', onVis, { once: true });

		// open the dialog after two frames so layout is definitely settled
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				window.print();
			});
		});
	}

	async function handleSave() {
		isLoading = true;
		modalOpen = false;

		try {
			const { isValid, errorList } = validateAllFields();
			if (isValid) {
				const savedData = createSavedData();
				const returnMessage = await saveDataToICMApi(savedData);
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

	async function handleSaveAndClose() {
		isLoading = true;
		modalOpen = false;

		try {
			const { isValid, errorList } = validateAllFields();
			if (isValid) {
				const savedData = createSavedData();
				console.log('Saved Data:', savedData, 'this is saved data');
				const returnMessage = await saveDataToICMApi(savedData);
				if (returnMessage === 'success') {
					const unlockMessage = await unlockICMFinalFlags();
					if (unlockMessage === 'success') {
						isFormCleared = true;
						window.opener = null;
						window.open('', '_self');
						window.close();
					} else {
						showModal('error', 'Error clearing locked flags. Please try again.');
					}
				} else {
					showModal('error', returnMessage);
				}
			} else {
				showModal('validation', undefined, errorList);
			}
		} catch (error) {
			showModal('error');
		} finally {
			isLoading = false;
		}
	}

	async function handleGenerate() {
		isLoading = true;
		modalOpen = false;

		try {
			const savedData = createSavedData();
			const returnMessage = await saveDataToICMApi(savedData);
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

	// helpers
	function getLetterEl(): HTMLElement | null {
		return document.querySelector('.letter-content');
	}
	function getLetterSection(): HTMLElement | null {
		const letter = getLetterEl();
		console.log('letter---', letter);
		if (!letter) return null;
		// climb to a reasonable section/container boundary
		return (letter.closest('[data-uuid]') ||
			letter.closest('section') ||
			letter.closest('[role="region"]') ||
			letter.parentElement) as HTMLElement | null;
	}

	function installLetterToggleDelegation() {
		// ensure we tag & normalize once on mount
		queueMicrotask(() => {
			const btn = getToggleBtn();
			if (btn) normalizeToggleButtonLabel();
		});

		document.addEventListener('click', (ev) => {
			const btn = (ev.target as HTMLElement)?.closest(
				'button, [role="button"]'
			) as HTMLElement | null;
			if (!btn) return;

			const label = (btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
			const isToggle = label.includes('show letter') || label.includes('show form');
			if (!isToggle) return;

			// lock onto this button from now on
			_toggleBtnRef = btn;
			btn.setAttribute('data-letter-toggle', '1');

			const html = document.documentElement;
			const isLetterOnly = html.classList.contains('letter-only');

			if (isLetterOnly) {
				html.classList.remove('letter-only');
				setButtonLabel(btn, 'Show Letter');
			} else {
				html.classList.add('letter-only');
				setButtonLabel(btn, 'Show Form');
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}
		});
	}

	function bindPrintHooks() {
		const prevBefore = window.onbeforeprint as ((this: Window, ev: Event) => any) | null;
		const prevAfter = window.onafterprint as ((this: Window, ev: Event) => any) | null;

		const makeEvt = (type: 'beforeprint' | 'afterprint') =>
			typeof Event === 'function'
				? new Event(type)
				: (() => {
						const e = document.createEvent('Event');
						e.initEvent(type, false, false);
						return e;
					})();

		// rehydrate letter before print
		window.onbeforeprint = (ev?: Event) => {
			if (prevBefore) prevBefore.call(window, ev ?? makeEvt('beforeprint'));
			scheduleLetterRender();
			// re-run once the browser applies print CSS
			setTimeout(renderAllLetterTemplates, 0);
		};

		window.onafterprint = (ev?: Event) => {
			if (prevAfter) prevAfter.call(window, ev ?? makeEvt('afterprint'));
		};
	}

	onMount(() => {
		document.documentElement.classList.remove('letter-only');
		installLetterToggleDelegation();
		bindPrintHooks();
		queueMicrotask(renderAllLetterTemplates);
	});

	function collectFieldValues(): Record<string, string> {
		const values: Record<string, string> = {};
		const fields = document.querySelectorAll<
			HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		>('input[id],[name], textarea[id],[name], select[id],[name]');
		fields.forEach((el) => {
			const key = (el.getAttribute('name') || el.id || '').trim();
			if (!key) return;
			// read value or checked state for checkboxes
			let v = (el as any).value ?? '';
			if ((el as HTMLInputElement).type === 'checkbox') {
				v = (el as HTMLInputElement).checked ? '☑' : '☐';
			}
			values[key] = v;
		});
		return values;
	}

	function aliasValues(map: Record<string, string>) {
		// return the first non-empty value among the given keys
		const pick = (...keys: string[]) => {
			for (const k of keys) {
				const v = map[k];
				if (v !== undefined && v !== null && v !== '') return v;
			}
			return undefined;
		};

		map['sr_number'] ??=
			pick('service_request', 'service_request_no', 'service_request_number', 'sr') ?? '';
		map['case_number'] ??= pick('case', 'case_no', 'case_number') ?? '';
		map['mis_number'] ??= pick('mis', 'mis_no', 'mis_number') ?? '';

		map['client_fullname'] ??=
			pick('full_name', 'fullname', 'client_name', 'client_full_name') ?? '';
		map['client_street_address'] ??= pick('street_address', 'address', 'client_street') ?? '';
		map['client_city'] ??= pick('city', 'client_city_town', 'city_town') ?? '';
		map['client_province'] ??= pick('province', 'client_province') ?? '';
		map['client_postal_code'] ??= pick('postal_code', 'client_postal_code', 'zip') ?? '';
	}

	function installBindingRuntime() {
		// track whether we already normalized once after letter appears
		let letterWasSeen = false;

		const mo = new MutationObserver(() => {
			const letter = document.querySelector('.letter-content') as HTMLElement | null;
			if (letter) {
				if (!letterWasSeen) {
					letterWasSeen = true;
					ensureInitialToggleState();
				}
				scheduleLetterRender();
			}
		});
		mo.observe(document.body, { childList: true, subtree: true });

		const onAnyInput = () => scheduleLetterRender();
		document.addEventListener('input', onAnyInput, true);
		document.addEventListener('change', onAnyInput, true);

		return () => {
			mo.disconnect();
			document.removeEventListener('input', onAnyInput, true);
			document.removeEventListener('change', onAnyInput, true);
		};
	}

	function ensureInitialToggleState() {
		const letter = getLetterEl();
		if (letter) letter.hidden = true;
		document.documentElement.classList.remove('letter-mode');

		// normalize the toggle button text to “Show Letter”
		const btn = Array.from(document.querySelectorAll<HTMLElement>('button,[role="button"]')).find(
			(b) => (b.textContent || b.getAttribute('aria-label') || '').toLowerCase().includes('show')
		);
		if (btn) btn.textContent = 'Show Letter';
	}

	let cleanupBindings: (() => void) | null = null;
	onMount(() => {
		cleanupBindings = installBindingRuntime();
	});
	onDestroy(() => cleanupBindings?.());
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
					<!-- Temp removal while reviewing interface implementation -->
					<!-- {#if mode === FORM_MODE.edit}
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
							<!-- Replace inline mapping with reusable Interfaces component 
							<Button onclick={handleCancel} kind="tertiary" id="generate">Cancel</Button>
							<Button onclick={handleSubmit} kind="tertiary" id="generate">Submit</Button>
						</div>
				{/if}  -->

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

<style>
	/* show letter on screen by default */
	:global(#letter-content),
	:global(.letter-content) {
		display: block !important;
	}

	/* letter-only web view: hide form sections that don't contain the letter */
	:global(html.letter-only .form .form-renderer:not(:has(.letter-content))) {
		display: none !important;
	}
	:global(.letter-content[hidden]) {
		display: block !important;
	}

	@media print {
		:global(html:not(.letter-only) .form),
		:global(html:not(.letter-only) .form .form-renderer) {
			display: block !important;
			visibility: visible !important;
		}

		:global(html.letter-only .scrollable-content > :not(:has(.letter-content))) {
			display: none !important;
		}

		:global(html.letter-only .scrollable-content),
		:global(html.letter-only .content-wrapper),
		:global(html.letter-only .form) {
			margin: 0 !important;
			padding: 0 !important;
		}

		:global(html.letter-only .form .form-renderer:has(.letter-content)) {
			break-before: auto !important; 
			page-break-before: auto !important; 
			margin-top: 0 !important;
		}

		:global(.print-hoisted) {
			margin-top: 0 !important;
			break-before: avoid !important; 
			page-break-before: avoid !important; 
		}

		/* ensure the whole doc flows from the top; no sticky/fixed in print */
		:global(.fixed),
		:global(header),
		:global(footer) {
			position: static !important;
			inset: auto !important;
			transform: none !important;
		}

		/* let the scroller expand so the UA can paginate the full content */
		:global(.scrollable-content) {
			overflow: visible !important;
			height: auto !important;
		}
	}
</style>
