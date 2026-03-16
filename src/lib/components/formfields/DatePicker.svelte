<script lang="ts">
	import { DatePicker, DatePickerInput } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
	import { createAttributeSyncEffect, publishToGlobalFormState } from '$lib/utils/valueSync';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';
	import './fields.css';
	import {
		filterAttributes,
		buildFieldAria,
		getFieldLabel,
		computeIsRequired,
		computeIsReadOnly
	} from '$lib/utils/helpers';
	import { toFlatpickrFormat } from '$lib/utils/dateFormats';
	import PrintRow from './common/PrintRow.svelte';

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	const { item, printing = false } = $props<{ item: Item; printing?: boolean }>();
	let value: string | null = $state(
		(item?.value ?? item.attributes?.value ?? item.attributes?.defaultValue ?? null) || null
	);

	// Compute effective required/read-only from enum values
	const isRequired = $derived.by(() => computeIsRequired(item.is_required, isPortalIntegrated));
	const isReadOnly = $derived.by(() => computeIsReadOnly(item.is_read_only, isPortalIntegrated));

	// Use computed isReadOnly for local state
	let readOnly = $state(computeIsReadOnly(item.is_read_only, isPortalIntegrated));
	let labelText = $state(getFieldLabel(item));
	const hideLabel = item.attributes?.hideLabel ?? false;
	const enableVarSub = $state(item.attributes?.enableVarSub ?? false);
	let helperText = item.help_text ?? '';
	let touched = $state(false);	
	let formatError = $state('');

	let extAttrs = $state<Record<string, any>>({});

	function win(): any | undefined {
		return typeof window === 'undefined' ? undefined : (window as any);
	}

	function isStrictDateMatch(input: string, format: string) {
		const w= win();
		if (!w.flatpickr) return false;

		const parsed = w.flatpickr.parseDate(input, format);
		if (!parsed) return false;

		const reformatted = w.flatpickr.formatDate(parsed, format);

		return reformatted === input;
	}	
		
	const dateFormat = $derived(
		toFlatpickrFormat(
			(item.attributes?.dateFormat || item.attributes?.displayFormat || item.attributes?.format) as
				| string
				| undefined			
		)
	);

	const rules = $derived(
		rulesFromAttributes(item.attributes, { is_required: isRequired, type: 'date' })
	);
	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (formatError) return formatError;
		if (item.attributes?.error) return item.attributes.error;
		if (readOnly) return '';
		return (
			validateValue(value ?? '', rules, {
				type: 'date',
				fieldLabel: item.attributes?.labelText ?? item.name
			}).firstError ?? ''
		);
	});
	

	function oninput(event: Event) {
		touched = true;

		const el = event.currentTarget as HTMLInputElement;
		const input = el.value;

		if (!input) {
			formatError = '';
			return;
		}

		if (isStrictDateMatch(input, dateFormat)) {
			formatError = '';
		} else {
			formatError = `Date does not  match the format `;
		}
	}
	
	function onblur(event: FocusEvent) {
		touched=true;
		const el = event.currentTarget as HTMLInputElement;

		if (formatError) {
			el.value = '';
			value = '';
		}
	}

	function onpaste(event: ClipboardEvent) {
		const text = event.clipboardData?.getData("text")?.trim();
		if (!text) return;

		if (!isStrictDateMatch(text, dateFormat)) {
			event.preventDefault();
			formatError = `Date does not  match the format`;
			touched = true;
		}
	}

	// On pre, seed __kilnFormState with initial date (from bindings/repeaterData) once
	$effect.pre(() => {
		const w = win();
		if (!w) return;

		const state: Record<string, any> = (w.__kilnFormState = w.__kilnFormState || {});
		const key = item.uuid;
		const v = value ?? '';

		if (v !== '' && state[key] === undefined) {
			state[key] = v;
		}
	});

	$effect(() => {
		const element = document.getElementById(item.uuid);
		if (!element) return;

		const handleExternalUpdate = (event: Event) => {
			const ce = event as CustomEvent;
			if (!ce.detail?.attr) return;
			const newValue = (ce.detail.value as string) || null;
			if ((newValue ?? '') !== (value ?? '')) {
				value = newValue;
			}
		};

		element.addEventListener('external-update', handleExternalUpdate);
		return () => {
			element.removeEventListener('external-update', handleExternalUpdate);
		};
	});

	$effect(() => {
		return createAttributeSyncEffect({
			item,
			onAttr: (name, val) => {
				if (name === 'class' || name === 'style') return;
				if (extAttrs[name] !== val && val !== undefined) {
					extAttrs = { ...extAttrs, [name]: val };
				}
			}
		});
	});

	// try using custom publisher
	$effect(() => {
		publishToGlobalFormState({ item, value: value ?? '' });
	});

	// Custom publisher to __kilnFormState that does NOT clobber with empty unless user really cleared it
	$effect(() => {
		const w = win();
		if (!w) return;

		const state: Record<string, any> = (w.__kilnFormState = w.__kilnFormState || {});
		const key = item.uuid;
		const v = value ?? '';

		// If we already have a non-empty value in formState and the component is currently blank and the user hasn't interacted, don't wipe it out.
		if (!touched && v === '' && typeof state[key] === 'string' && state[key] !== '') {
			return;
		}

		// Otherwise, reflect the current value into formState
		state[key] = v;
	});

	const a11y = $derived.by(() =>
		buildFieldAria({
			uuid: item.uuid,
			labelText,
			helperText,
			isRequired,
			readOnly: isReadOnly
		})
	);

	// Filter out 'id' from attributes for the outer DatePicker wrapper to prevent
	// duplicate IDs when inside a repeater (the wrapper div should not have an ID)
	const datePickerWrapperAttrs = $derived.by(() => {
		const attrs = filterAttributes(item.attributes);
		if (attrs && typeof attrs === 'object') {
			const { id, ...rest } = attrs;
			return rest;
		}
		return attrs;
	});
</script>

<div class="field-container date-picker-field">
	<PrintRow {item} {printing} {labelText} value={value ?? ''} />

	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<DatePicker
			{...datePickerWrapperAttrs}
			{...extAttrs as any}
			class={item.class}
			datePickerType="single"
			{dateFormat}
			bind:value
		>
			<DatePickerInput
				{...filterAttributes(item.attributes)}
				id={item.uuid}
				disabled={readOnly}
				{hideLabel}
				invalid={!!anyError}
				invalidText={anyError}
				on:input={oninput}
				on:blur={onblur}
				on:paste={onpaste}
				{...a11y.ariaProps}
				{...extAttrs as any}
				data-kiln-date="true"
				data-kiln-uuid={item.uuid}
			>
				<span slot="labelChildren" class:required={isRequired} class:moustache={enableVarSub}
					>{@html labelText}</span
				>
			</DatePickerInput>
		</DatePicker>
		{#if anyError}
			<div
				id={a11y.errorId}
				class="bx--form-requirement"
				class:moustache={enableVarSub}
				role="alert"
			>
				{anyError}
			</div>
		{/if}
		{#if helperText}
			<div id={a11y.helperId} class="bx--form__helper-text" class:moustache={enableVarSub}>
				{helperText}
			</div>
		{/if}
	</div>
</div>

<style>
	:global(
			input:disabled,
			textarea:disabled,
			select:disabled,
			button:disabled,
			checkbox:disabled,
			textinput:disabled
		) {
		background-color: white !important;
		color: black !important;
		cursor: text !important;
	}
	:global(input:disabled::placeholder, textarea:disabled::placeholder) {
		color: black !important;
		opacity: 1 !important;
	}
</style>
