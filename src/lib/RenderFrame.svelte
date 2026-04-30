<script lang="ts">
	import '$lib/web.css';
	import '$lib/print.css';
	import { Button, Form, Modal, Loading } from 'carbon-components-svelte';
	import FormRenderer from './components/FormRenderer.svelte';
	import ScriptStyleInjection from './components/ScriptStyleInjection.svelte';
	import PrintFooter from './components/PrintFooter.svelte';
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
	import { getSessionInterface } from '$lib/utils/interface';
	import type { ActionResultPayload } from '$lib/types/interfaces';
	import { bindDataToForm } from './utils/databinder';
	import { formatWithAppTokens } from '$lib/utils/dateFormats';
	import OriginStyleOverride from './components/OriginStyleOverride.svelte';

	let {
		saveData = undefined,
		formData,
		goBack = undefined,
		mode = 'preview',
		formDelivery = undefined,
		disablePrint = false
	} = $props();

	// Modal and loading state
	let isLoading = $state(false);
	let modalOpen = $state(false);
	let modalTitle = $state('');
	let modalMessage = $state('');
	let isFormCleared = $state(false);
	let modalErrors = $state<string[]>([]);

	let modalMode = $state<'info' | 'confirm'>('info');
	let modalPrimaryText = $state('OK');
	let modalSecondaryText = $state<string | null>(null);
	let modalResolver = $state<((result: boolean) => void) | null>(null);

	let barcode = $derived<{ content: string } | undefined>(formData?.barcode);
	let securityClassification = $derived<string | undefined>(formData?.security_classification);

	function resetModalRuntime() {
		modalMode = 'info';
		modalPrimaryText = 'OK';
		modalSecondaryText = null;
		modalResolver = null;
	}

	function resolveModal(result: boolean) {
		if (modalMode === 'confirm' && modalResolver) {
			modalResolver(result);
		}
		modalOpen = false;
		resetModalRuntime();
	}

	let interfaceItems = $derived.by(() => {
		// Prefer interface embedded in the payload (array or { interface: [] })
		const fd =
			(mergedFormData as any)?.interface?.interface ??
			(mergedFormData as any)?.interface ??
			(formData as any)?.interface?.interface ??
			(formData as any)?.interface;

		if (Array.isArray(fd) && fd.length > 0) return fd;

		// Fallback: sessionStorage (set earlier by the loader/wrapper)
		const ss = getSessionInterface();
		return Array.isArray(ss) ? ss : [];
	});

	let interfaceContext = $derived.by(() => {
		const search =
			typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
		const params = search ? Object.fromEntries(search.entries()) : {};

		return {
			// modal control
			setModalTitle,
			setModalMessage,
			setModalOpen,

			// renderer abilities
			validateAllFields,
			handlePrint,
			handleCancel,
			handleSubmit,
			// utils imported above:
			createSavedData,
			submitForButtonAction, // in case scripts choose to call it

			// confirmation modal helper
			confirmModal,
			handleValidation,

			// route/query params
			params
		};
	});

	function setModalTitle(t: string) {
		modalTitle = t;
	}
	function setModalMessage(m: string) {
		modalMessage = m;
	}
	function setModalOpen(open: boolean) {
		modalOpen = !!open;
	}

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

	async function confirmModal(message?: string): Promise<boolean> {
		const defaultMessage = `
		Do you want to submit this form?

		If you answer "No", you will be able to return to this form later and enter more responses.
		If you answer "Yes", the form will no longer be editable.
		`.trim();

		return await new Promise<boolean>((resolve) => {
			modalMode = 'confirm';
			modalTitle = 'Confirmation';
			modalMessage = (message || defaultMessage).trim();
			modalErrors = [];
			modalPrimaryText = 'Yes';
			modalSecondaryText = 'No';

			modalResolver = (result: boolean) => {
				resolve(result);
			};

			modalOpen = true;
		});
	}

	let mergedFormData = $derived.by(() => {
		if (!formData) return null;

		if (mode === 'view' || mode === 'portalView') {
			setReadOnlyFields(formData);
		}

		return bindDataToForm({
			data: saveData,
			form_definition: formData?.formversion ? formData.formversion : formData
		}).mappedFormDef;
	});

	let ministryLogoPath = $derived.by(() => {
		const base =
			typeof window !== 'undefined' && window.location.href.includes('klamm')
				? '/ministries'
				: './ministries';

		const path = mergedFormData?.ministry_id ? `${base}/${mergedFormData.ministry_id}.png` : null;
		return path;
	});

	let printing = $state(false);

	// Reference to PrintFooter component for calling setFooterText/clearFooterText
	let printFooter: PrintFooter;

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

	function insertPageBreak(el: Element): void {
		const pageBreak = document.createElement('div');
		pageBreak.className = 'page-break';
		el.parentNode?.insertBefore(pageBreak, el);
		// Add page-start marker to first el after page break
		// Used for non-first page top margin adjustment via top padding
		// Only way this can be done since first page margin is smaller than other pages
		el.classList.add('page-start');
	}

	function paginateContentForPrint(): () => void {
		const letterContent = document.querySelector(
			'.letter-content, [id^="letter-content-"]'
		) as HTMLElement;
		
		const formContent = document.querySelector(
			'.content-wrapper .form'
		) as HTMLElement;
		
		const isLetter = !!letterContent;
		const contentRoot = (letterContent || formContent) as HTMLElement;

		if (!contentRoot) {
			return () => {};
		}

		// Clean up any existing page breaks
		document.querySelectorAll('.page-break').forEach((el) => el.remove());

		// Paper and margin constants
		const DPI = 96;
		const MM_TO_PX = DPI / 25.4; // 1mm ≈ 3.78px
		const INCH_TO_PX = DPI; // 1in = 96px

		// Letter paper dimensions
		const LETTER_WIDTH_INCHES = 8.5;
		const LETTER_HEIGHT_INCHES = 11;
		const LETTER_WIDTH_PX = LETTER_WIDTH_INCHES * INCH_TO_PX; // 816px
		const LETTER_HEIGHT_PX = LETTER_HEIGHT_INCHES * INCH_TO_PX; // 1056px

		function getPrintMarginPx(varName: string): number {
			const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();

			if (!value) return 0;

			// Supports mm, px
			if (value.endsWith('mm')) {
				return parseFloat(value) * MM_TO_PX;
			}

			if (value.endsWith('px')) {
				return parseFloat(value);
			}

			return 0;
		}

		const PAGE_MARGIN_TOP_PX = getPrintMarginPx('--page-margin-top');
		const PAGE_MARGIN_BOTTOM_PX = getPrintMarginPx('--page-margin-bottom');
		const PAGE_MARGIN_LEFT_PX = getPrintMarginPx('--page-margin-left');
		const PAGE_MARGIN_RIGHT_PX = getPrintMarginPx('--page-margin-right');

		const PAGE_MARGIN_TOP_FIRST_PX = PAGE_MARGIN_TOP_PX;

		// Detect footer height
		const printFooter = document.querySelector('.print-footer') as HTMLElement;
		let fakeFooterHeight: number;

		if (printFooter) {
			if (printFooter.parentElement != null) {
				printFooter.parentElement.style.display = 'block';
				printFooter.parentElement.style.visibility = 'visible';
				printFooter.parentElement.style.position = 'static';
				printFooter.parentElement.offsetHeight;

				fakeFooterHeight = Math.ceil(printFooter.parentElement.getBoundingClientRect().height);

				printFooter.parentElement.style.display = '';
				printFooter.parentElement.style.visibility = '';
				printFooter.parentElement.style.position = '';
			} else {
				printFooter.style.display = 'block';
				printFooter.style.visibility = 'visible';
				printFooter.style.position = 'absolute';
				printFooter.offsetHeight; // Force reflow

				fakeFooterHeight = Math.ceil(printFooter.getBoundingClientRect().height);

				// Restore original styles
				printFooter.style.display = '';
				printFooter.style.visibility = '';
				printFooter.style.position = '';
			}

			// No extra padding - use actual measured height
		} else {
			// Default fake footer height if not found (25mm as configured in CSS)
			fakeFooterHeight = 25 * MM_TO_PX;
		}

		// Detect header height
		const headerSection = document.querySelector('.header-section') as HTMLElement;
		let headerHeight = 0;

		if (headerSection) {
			// Measure actual header height
			const headerRect = headerSection.getBoundingClientRect();
			headerHeight = Math.ceil(headerRect.height) + 5; //height being measured is the web header (print header is 5px taller)

			// No extra spacing - use actual measured height
		} else {
			// Fallback header height estimate
			headerHeight = 85;
		}

		// Calculate available content height
		// Base content height = Letter height - top margin - bottom margin - footer space
		const baseContentHeight = Math.ceil(
			LETTER_HEIGHT_PX - PAGE_MARGIN_TOP_PX - PAGE_MARGIN_BOTTOM_PX - fakeFooterHeight
		);

		// First page:
		// Replace normal top margin with first-page top margin,
		// then subtract header
		const firstPageContentHeight = Math.ceil(
			baseContentHeight + (PAGE_MARGIN_TOP_PX - PAGE_MARGIN_TOP_FIRST_PX) - headerHeight
		);

		const subsequentPageContentHeight = baseContentHeight;

		// No safety margin - maximize content per page
		const SAFETY_MARGIN_PX = 0;

		const originalStyles = {
			display: contentRoot.style.display,
			visibility: contentRoot.style.visibility,
			position: contentRoot.style.position,
			width: contentRoot.style.width,
			opacity: contentRoot.style.opacity,
			pointerEvents: contentRoot.style.pointerEvents
		};

		// Make content visible for measurement:
		const contentWidth = LETTER_WIDTH_PX - PAGE_MARGIN_LEFT_PX - PAGE_MARGIN_RIGHT_PX;
		contentRoot.style.display = 'block';
		contentRoot.style.opacity = '0';
		contentRoot.style.pointerEvents = 'none';
		contentRoot.style.position = 'absolute';
		contentRoot.style.width = `${contentWidth}px`;
		contentRoot.offsetHeight; // Force reflow

		const breakableTags = [
			'p',
			'li',
			'table',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'div.paragraph',
			'div.text-block',
			'div.header-row',
			'blockquote',
			'pre',
			'div'
		];
		const breakableSelector = breakableTags.join(', ');

		const formBreakableSelector = [
			'fieldset', '.container-group', '.container-repeatable',
			'.group-item-child-container', '.group-item-container',
			'.container-fields-grid > .group-item-child-container', 'table',
			'.print-row.visible', '.field-container.text-info-field.visible'
		].join(', ');

		let breakableElements: Element[];

		if (isLetter) {
			breakableElements = Array.from(contentRoot.querySelectorAll(breakableSelector));
		} else {
			const allMatches = Array.from(contentRoot.querySelectorAll(formBreakableSelector)).filter(
				(el) => {
					const label = ((el as Element).id || (el as Element).className || '').toLowerCase();
					return isActuallyVisible(el) && !el.closest('.print-footer') && !label.includes('footer');
				}
			);
			// Keep only outermost matches (no nested duplicates)
			breakableElements = allMatches.filter((el) => {
				const parentMatch = el.parentElement?.closest(formBreakableSelector);
				return !parentMatch || !contentRoot.contains(parentMatch);
			});
		}

		// Helpers for finding children container/elements
		function unwrapContainers(children: Element[]): Element[] {
			let current = children;
			while (
				current.length === 1 &&
				current[0] instanceof Element &&
				current[0].matches('.group-item-child-container')
			) {
				const next = getBreakableChildren(current[0]);
				if (next.length === 0) break;
				current = next;
			}
			return current;
		}
		function isActuallyVisible(el: Element): boolean {
			const htmlEl = el as HTMLElement;
			const style = window.getComputedStyle(htmlEl);
			const rect = htmlEl.getBoundingClientRect();

			if (style.display === 'none') return false;
			if (style.visibility === 'hidden') return false;
			if (htmlEl.hidden) return false;

			const hasBox = rect.width > 0 || rect.height > 0;
			const hasVisibleChild = Array.from(el.children).some((child) => {
				const childRect = child.getBoundingClientRect();
				const childStyle = window.getComputedStyle(child as HTMLElement);
				return (
				childStyle.display !== 'none' &&
				childStyle.visibility !== 'hidden' &&
				(childRect.width > 0 || childRect.height > 0)
				);
			});

			return hasBox || hasVisibleChild;
		}

		function getBreakableChildren(el: Element): Element[] {
			const children = Array.from(el.children).filter(
				(child): child is Element => child instanceof Element && isActuallyVisible(child)
			);

			const groupContainers = children.filter((child) =>
				child.matches('.group-item-child-container, .group-item-container')
			);
			if (groupContainers.length > 0) return unwrapContainers(groupContainers);

			const grid = children.find((child) => child.matches('.container-fields-grid'));
			if (grid) {
				const gridChildren = Array.from(grid.children).filter(
					(child): child is Element => child instanceof Element && isActuallyVisible(child)
				);

				const gridContainers = gridChildren.filter((child) =>
					child.matches('.group-item-child-container')
				);
				if (gridContainers.length > 0) return unwrapContainers(gridContainers);

				const gridSections = gridChildren.filter((child) =>
					child.matches('fieldset, .container-group, .container-repeatable, table')
				);
				if (gridSections.length > 0) return unwrapContainers(gridSections);

				const gridRows = gridChildren.flatMap((child) => {
					if (child.matches('.group-item-child-field')) {
						return Array.from(
							child.querySelectorAll(':scope .print-row.visible, :scope .field-container.text-info-field.visible')
						).filter((n): n is Element => n instanceof Element);
					}
					return [];
				});
				if (gridRows.length > 0) return gridRows;
			}

			const sections = children.filter((child) =>
				child.matches('fieldset, .container-group, .container-repeatable, table')
			);
			if (sections.length > 0) return unwrapContainers(sections);

			return children.filter((child) =>
				child.matches('.print-row.visible, .field-container.text-info-field.visible')
			);
		}

		function getGroupChildren(el: Element): Element[] {
			const ownedFields = Array.from(
				el.querySelectorAll('.group-item-child-field')
			).filter((child): child is Element => {
				if (!(child instanceof Element)) return false;
				const owner = child.parentElement?.closest(
					'.group-item-container, .group-item-child-container'
				);
				return owner === el;
			});
			if (ownedFields.length > 0) return ownedFields;

			const ownedRows = Array.from(
				el.querySelectorAll('.print-row.visible, .field-container.text-info-field.visible')
			).filter((child): child is Element => {
				if (!(child instanceof Element)) return false;
				const owner = child.parentElement?.closest(
					'.group-item-container, .group-item-child-container'
				);
				return owner === el;
			});
			if (ownedRows.length > 0) return ownedRows;

			return getBreakableChildren(el);
		}

		function getRepeaterChildren(el: Element): Element[] {
			const children = Array.from(el.children).filter(
				(child): child is Element => child instanceof Element && isActuallyVisible(child)
			);

			const fieldBlocks = children.filter((child) => child.matches('.group-item-child-field'));
			if (fieldBlocks.length > 0) return fieldBlocks;

			const grid = children.find((child) => child.matches('.container-fields-grid'));
			if (grid) {
				const gridChildren = Array.from(grid.children).filter(
					(child): child is Element => child instanceof Element
				);

				const gridFields = gridChildren.filter((child) => child.matches('.group-item-child-field'));
				if (gridFields.length > 0) return gridFields;

				const gridContainers = gridChildren.filter((child) =>
					child.matches('.group-item-child-container, .group-item-container')
				);
				if (gridContainers.length > 0) return gridContainers;
			}

			return getBreakableChildren(el);
		}

		// Overhead calculations
		function getContainerOverhead(el: Element, children: Element[]): number {
			if (children.length === 0) return 0;
			const parentRect = el.getBoundingClientRect();
			const firstRect = children[0].getBoundingClientRect();
			const lastRect = children[children.length - 1].getBoundingClientRect();
			const rawOverhead =
				Math.max(0, Math.round(firstRect.top - parentRect.top)) +
				Math.max(0, Math.round(parentRect.bottom - lastRect.bottom));
			return Math.min(rawOverhead, 80);
		}

		function getGroupOverhead(el: Element, children: Element[]): number {
			if (children.length === 0) return 0;
			const parentHeight = Math.ceil(el.getBoundingClientRect().height);
			const childHeightSum = children.reduce(
				(sum, child) => sum + Math.ceil(child.getBoundingClientRect().height), 0
			);
			return Math.min(Math.max(0, parentHeight - childHeightSum), 40);
		}

		let accumulatedHeight = 0;
		let maxHeightForPage = Math.ceil(firstPageContentHeight - SAFETY_MARGIN_PX);

		function paginateNode(el: Element): void {
			// Skip elements inside the footer (they shouldn't trigger page breaks)
			if (el.closest('.print-footer')) {
				return;
			}

			const rect = el.getBoundingClientRect();
			const elHeight = Math.ceil(rect.height);

			// Include margins in height calculation
			const computedStyle = window.getComputedStyle(el);
			const marginTop = parseFloat(computedStyle.marginTop) || 0;
			const marginBottom = parseFloat(computedStyle.marginBottom) || 0;
			const totalElementHeight = elHeight + marginTop + marginBottom;
			// Skip empty/hidden elements
			if (totalElementHeight <= 0) {
				return;
			}

			if (!isLetter && !isActuallyVisible(el)) {
				return;
			}

			// Skip element with breakable child elements (letter mode only)
			if (isLetter && el.childElementCount > 0) {
				for (const child of el.children) {
					if (breakableTags.includes(child.tagName.toLowerCase())) {
						return;
					}
				}
			}

			const pageBuffer = isLetter ? 0 : 4;
			let remainingSpace = maxHeightForPage - accumulatedHeight - pageBuffer;

			// Repeater handling (form mode only)
			if (!isLetter && el.matches('.container-repeatable')) {
				const children = getRepeaterChildren(el);
				if (children.length > 0) {
					const allGrouped = children.every((child) =>
						child.matches('.group-item-container, .group-item-child-container, fieldset, .container-group')
					);
					const overhead = !allGrouped ? getContainerOverhead(el, children) : 0;

					if (!el.hasAttribute('data-pagination-overhead-applied')) {
						if (accumulatedHeight > 0 && accumulatedHeight + overhead > maxHeightForPage - pageBuffer) {
							insertPageBreak(el);
							maxHeightForPage = Math.ceil(subsequentPageContentHeight - SAFETY_MARGIN_PX);
							accumulatedHeight = 0;
						}
						accumulatedHeight += overhead;
						remainingSpace = maxHeightForPage - accumulatedHeight - pageBuffer;
						el.setAttribute('data-pagination-overhead-applied', 'true');
					}

					children.forEach((child) => paginateNode(child));
					return;
				}
			}

			// Check if adding this element would exceed the page height
			if (accumulatedHeight + totalElementHeight > maxHeightForPage) {
				// Only insert page break if we have content on current page
				// (prevents empty first page)
				if (accumulatedHeight > 0) {

					// Grouped container handling (form mode only)
					if (!isLetter && el.matches('.group-item-container, .group-item-child-container')) {
						const children = getGroupChildren(el);
						if (children.length > 0 && !(children.length === 1 && children[0] === el)) {
							const isInsideRepeater = !!el.closest('.container-repeatable');
							const hasRepeatableChild = children.some((c) => c.matches('.container-repeatable'));
							const elHeight = Math.ceil(el.getBoundingClientRect().height);
							const splitIsWorthIt = remainingSpace >= elHeight * 0.4;

							if (!splitIsWorthIt && !hasRepeatableChild) {
								insertPageBreak(el);
								maxHeightForPage = Math.ceil(subsequentPageContentHeight - SAFETY_MARGIN_PX);
								accumulatedHeight = 0;
							}

							const overhead = getGroupOverhead(el, children);
							if (!isInsideRepeater && overhead > 0 && !el.hasAttribute('data-grouped-overhead-applied')) {
								const firstChildH = Math.ceil(children[0].getBoundingClientRect().height);
								const spaceAfterOverhead = maxHeightForPage - (accumulatedHeight + overhead) - pageBuffer;
								const overheadOrphansContent = firstChildH > 0
									&& spaceAfterOverhead < firstChildH
									&& firstChildH <= (maxHeightForPage - pageBuffer);

								if (accumulatedHeight + overhead > maxHeightForPage - pageBuffer || overheadOrphansContent) {
									insertPageBreak(el);
									maxHeightForPage = Math.ceil(subsequentPageContentHeight - SAFETY_MARGIN_PX);
									accumulatedHeight = 0;
								}
								accumulatedHeight += overhead;
								el.setAttribute('data-grouped-overhead-applied', 'true');
							}

							children.forEach((child) => paginateNode(child));
							return;
						}
					}

					// Group item field handling (form mode only)
					if (!isLetter && el.matches('.group-item-child-field')) {
						insertPageBreak(el);
						maxHeightForPage = Math.ceil(subsequentPageContentHeight - SAFETY_MARGIN_PX);
						accumulatedHeight = Math.min(totalElementHeight, maxHeightForPage - pageBuffer);
						return;
					}

					// try splitting via children (form mode only)
					if (!isLetter) {
						const children = getBreakableChildren(el);
						if (children.length > 0) {
							const firstChildHeight = Math.ceil(children[0].getBoundingClientRect().height);
							const isInsideRepeater = !!el.closest('.container-repeatable');
							const firstChildTallerThanPage = firstChildHeight > (maxHeightForPage - pageBuffer);
							const splitIsWorthIt = firstChildTallerThanPage || (remainingSpace >= firstChildHeight * 0.3);

							if (!isInsideRepeater && firstChildHeight > remainingSpace && !splitIsWorthIt) {
								insertPageBreak(el);
								maxHeightForPage = Math.ceil(subsequentPageContentHeight - SAFETY_MARGIN_PX);
								accumulatedHeight = 0;
								remainingSpace = maxHeightForPage - pageBuffer;
							}
							children.forEach((child) => paginateNode(child));
							return;
						}
					}

					insertPageBreak(el);
					// Subsequent pages have more space (no header)
					maxHeightForPage = Math.ceil(subsequentPageContentHeight - SAFETY_MARGIN_PX);
					accumulatedHeight = totalElementHeight;
				} else {
					// Element is taller than page - just add it
					accumulatedHeight = totalElementHeight;
				}
			} else {
				accumulatedHeight += totalElementHeight;
			}
		}

		breakableElements.forEach((el) => paginateNode(el));

		// Return original styles:
		contentRoot.style.display = originalStyles.display;
		contentRoot.style.visibility = originalStyles.visibility;
		contentRoot.style.position = originalStyles.position;
		contentRoot.style.width = originalStyles.width;
		contentRoot.style.opacity = originalStyles.opacity;
contentRoot.style.pointerEvents = originalStyles.pointerEvents;

		return () => {
			// Remove inserted page break elements
			document.querySelectorAll('.page-break').forEach((el) => el.remove());

			// Remove page-start markers
			document.querySelectorAll('.page-start').forEach((el) => {
				el.classList.remove('page-start');
			});

			// Remove group wrapper overhead
			document.querySelectorAll('[data-grouped-overhead-applied]').forEach((el) => {
				el.removeAttribute('data-grouped-overhead-applied');
			});

			// Remove repeater wrapper overhead
			document.querySelectorAll('[data-pagination-overhead-applied]').forEach((el) => {
				el.removeAttribute('data-pagination-overhead-applied');
			});
		};
	}

	function handleHTMLPrint() {
		const isPuppeteer = navigator.userAgent.includes('HeadlessChrome');
		printing = true;

		setTimeout(() => {
			const originalTitle = document.title;
			// Match legacy behavior: set title to form id for print session
			document.title = formData?.form_id || 'CustomFormName';

			// Force reflow to ensure elements are measured correctly
			document.body.offsetHeight;

			// Prepare and set footer text via PrintFooter component
			const footerText = buildPrintFooterText();
			printFooter?.setFooterText(footerText);

			// Paginate content to prevent footer overlap
			const cleanupPagination = paginateContentForPrint();

			// Add print metadata to document head
			const metaTags = createPrintMetadata();
			metaTags.forEach((tag) => document.head.appendChild(tag));

			// Force reflow
			document.body.offsetHeight;

			if (!isPuppeteer) {
				const cleanup = () => {
					printing = false;
					document.title = originalTitle;

					// Remove metadata elements
					metaTags.forEach((tag) => document.head.removeChild(tag));

					// Clear footer via PrintFooter component
					printFooter?.clearFooterText();

					// Remove inserted page breaks
					cleanupPagination();

					window.removeEventListener('afterprint', cleanup);
					window.removeEventListener('focus', cleanup);
				};

				window.addEventListener('afterprint', cleanup);
				window.addEventListener('focus', cleanup);

				// Print after slight delay to ensure styles are applied
				setTimeout(() => {
					window.print();
				}, 150);
			}

			// Reset printing state after print dialog
			setTimeout(() => {
				if (!isPuppeteer && printing) {
					printing = false;
				}
			}, 150);
		}, 150);
	}

	function buildPrintFooterText(): string {
		const formId = formData?.form_id || '';
		const title = formData?.title || formData?.name || '';
		const formattedVersionDate = formatWithAppTokens(
			formData?.version_date,
			formData?.version_date_format,
			'YYYY-MM-DD'
		);

		const parts = [formId, formId && title ? ' - ' : '', title];
		if (formattedVersionDate) {
			parts.push(` (${formattedVersionDate})`);
		}

		return parts.join('').trim();
	}

	function createPrintMetadata(): HTMLMetaElement[] {
		const metaDescription = document.createElement('meta');
		metaDescription.name = 'description';
		metaDescription.content = 'Form PDF.';

		const metaAuthor = document.createElement('meta');
		metaAuthor.name = 'author';
		metaAuthor.content = 'KILN';

		const metaLanguage = document.createElement('meta');
		metaLanguage.httpEquiv = 'Content-Language';
		metaLanguage.content = 'en';

		return [metaDescription, metaAuthor, metaLanguage];
	}

	async function handleSave() {
		isLoading = true;
		modalOpen = false;
		try {
			const { isValid, errorList } = handleValidation();
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
			const { isValid, errorList } = handleValidation();
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

	//this function validates all fields and set the error message at field level
	function handleValidation(): { isValid: boolean; errorList: string[] } {
		try {
			const { isValid, errorList, errors } = validateAllFields();
			if (!isValid) {
				try {
					window.dispatchEvent(
						new CustomEvent('kiln2:validate-all', {
							detail: { errors }
						})
					);
				} catch (e) {
					console.log('validation-all event error:', e);
				}

				requestAnimationFrame(() => {
					const selectors = (id: string) =>
						[
							`[data-attr-id="${id}"]`,
							`[data-field-id="${id}"]`,
							`#${CSS && CSS.escape ? CSS.escape(id) : id}`,
							`[name="${CSS && CSS.escape ? CSS.escape(id) : id}"]`
						].join(',');

					Object.keys(errors || {}).forEach((id) => {
						const root = document.querySelector<HTMLElement>(selectors(id));
						if (!root) return;

						const focusable = root.matches?.('fieldset')
							? root.querySelector('.custom-buttons-only button') || root
							: root.matches?.('input,select,textarea')
								? root
								: root.querySelector('input,select,textarea') || root;

						try {
							focusable.dispatchEvent(new Event('focus', { bubbles: true }));
						} catch (e) {
							console.log('focus dispatch error:', e);
						}

						try {
							focusable.dispatchEvent(new Event('blur', { bubbles: true }));
						} catch (e) {
							console.log('blur dispatch error:', e);
						}
					});
				});
			}
			return { isValid, errorList };
		} catch (error) {
			console.error('Save error:', error);
			return {
				isValid: false,
				errorList: ['Unexpected validation error']
			};
		}
	}

	async function handleGenerate() {
		isLoading = true;
		modalOpen = false;

		try {
			const returnMessage = await saveFormData('generate');
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

	const clickButtonByText = (text: string) => {
		const targetText = text.trim().toLowerCase();

		const targetButton = Array.from(document.querySelectorAll('button')).find(
			(b) => b.innerText.trim().toLowerCase() === targetText
		);

		targetButton?.click();
	};

	$effect(() => {
		if (
			mode !== FORM_MODE.preview &&
			mode !== FORM_MODE.view &&
			mode !== FORM_MODE.portalEdit &&
			mode !== FORM_MODE.portalView &&
			typeof window !== 'undefined'
		) {
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

	function handleInterfaceResult(payload: ActionResultPayload) {
		const { ok, error, label, validationErrors } = payload;

		if (!ok) {
			if (validationErrors?.length) {
				setModalTitle('Please fix the highlighted fields');
				setModalMessage(`${validationErrors.length} issues were found.`);
				setModalOpen(true);
				return;
			}
			//Soft abort (ie. clicking No on Confirmation Modal)
			if (!error) {
				return;
			}
			setModalTitle(label || 'Action failed');
			setModalMessage(typeof error === 'string' ? error : JSON.stringify(error ?? {}, null, 2));
			setModalOpen(true);
			return;
		}

		// Success path
		// setModalTitle(label || 'Success');
		// setModalMessage('Done.');
		// setModalOpen(true);
	}
</script>

<!-- Inject dynamic styles and scripts -->
<ScriptStyleInjection
	styles={formData?.styles || formData?.data?.styles}
	scripts={formData?.scripts || formData?.data?.scripts}
	{mode}
/>

<OriginStyleOverride />

{#if isLoading}
	<Loading />
{/if}

<Modal
	bind:open={modalOpen}
	modalHeading={modalTitle}
	primaryButtonText={modalPrimaryText}
	secondaryButtonText={modalSecondaryText || undefined}
	on:click:button--primary={() => resolveModal(true)}
	on:click:button--secondary={() => resolveModal(false)}
	on:close={() => resolveModal(false)}
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
		<div class="header-section" id="formHeaderDiv">
			<div class="header-image">
				<div class="header-image-only">
					{#if ministryLogoPath}
						<img src={ministryLogoPath} width="232px" alt="ministry logo" />
					{/if}
				</div>

				<div class="header-buttons-only no-print">
					<Interfaces
						{mode}
						items={interfaceItems}
						context={interfaceContext}
						disabled={typeof goBack === 'function'}
						onActionResult={handleInterfaceResult}
					/>
					{#if mode === FORM_MODE.edit}
						<Button kind="tertiary" class="no-print" onclick={handleSave}>Save</Button>
						<Button kind="tertiary" class="no-print" onclick={handleSaveAndClose}>
							Save And Close
						</Button>
					{/if}

					{#if formDelivery === 'generate' || mode === FORM_MODE.generate}
						<Button kind="tertiary" class="no-print" id="generate" onclick={handleGenerate}
							>Generate</Button
						>
					{/if}

					{#if (mode === FORM_MODE.edit || mode === FORM_MODE.preview) && formDelivery === 'portal' && (!interfaceItems || interfaceItems.length === 0)}
						<div class="header-buttons-only no-print">
							<!-- Replace inline mapping with reusable Interfaces component -->
							<Button onclick={handleCancel} kind="tertiary" id="generate">Cancel</Button>
							<Button onclick={handleSubmit} kind="tertiary" id="generate">Submit</Button>
						</div>
					{/if}

					{#if goBack}
						<Button kind="tertiary" class="no-print" onclick={goBack}>Back</Button>
					{/if}

					{#if interfaceItems.length === 0}
						<Button
							disabled={disablePrint}
							kind="tertiary"
							id="print"
							class="no-print"
							onclick={handlePrint}>Print</Button
						>
					{/if}
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

	<div class="header-form-id no-print" id="formIdDiv">
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
	<PrintFooter bind:this={printFooter} {barcode} {securityClassification} />
</div>
