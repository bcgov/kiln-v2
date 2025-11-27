<script lang="ts">
	import { DatePicker, DatePickerInput } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
	import {
		createValueSyncEffect,
		parsers,
		comparators,
		createAttributeSyncEffect,
		publishToGlobalFormState
	} from '$lib/utils/valueSync';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';
	import './fields.css';
	import { filterAttributes, buildFieldAria, getFieldLabel } from '$lib/utils/helpers';
	import { toFlatpickrFormat } from '$lib/utils/dateFormats';
	import PrintRow from './common/PrintRow.svelte';

	const { item, printing = false } = $props<{ item: Item; printing?: boolean }>();
	let value: string | null = $state(
		(item?.value ?? item.attributes?.value ?? item.attributes?.defaultValue ?? null) || null
	);

	let readOnly = $state(item.is_read_only ?? false);
	let labelText = $state(getFieldLabel(item));
	let helperText = item.help_text ?? '';
	let touched = $state(false);

	let extAttrs = $state<Record<string, any>>({});

	function win(): any | undefined {
		return typeof window === 'undefined' ? undefined : (window as any);
	}

	const dateFormat = $derived(
		toFlatpickrFormat(
			(item.attributes?.dateFormat || item.attributes?.displayFormat || item.attributes?.format) as
				| string
				| undefined
		)
	);

	const rules = $derived.by(() =>
		rulesFromAttributes(item.attributes, { is_required: item.is_required, type: 'date' })
	);
	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (item.attributes?.error) return item.attributes.error;
		if (readOnly) return '';
		return (
			validateValue(value ?? '', rules, {
				type: 'date',
				fieldLabel: item.attributes?.labelText ?? item.name
			}).firstError ?? ''
		);
	});

	function oninput() {
		touched = true;
	}
	function onblur() {
		touched = true;
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
		return createValueSyncEffect({
			item,
			getValue: () => value,
			setValue: (newValue) => {
				if (newValue == null || newValue === '') {
					value = null;
				} else {
					value = newValue as string;
				}
			},
			componentName: 'DatePicker',
			parser: parsers.string,
			comparator: comparators.date
		});
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

	const a11y = buildFieldAria({
		uuid: item.uuid,
		labelText,
		helperText,
		isRequired: item.is_required,
		readOnly
	});
</script>

<div class="field-container date-picker-field">
	<PrintRow {item} {printing} {labelText} value={value ?? ''} />

	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<DatePicker
			{...filterAttributes(item.attributes)}
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
				invalid={!!anyError}
				invalidText={anyError}
				{oninput}
				{onblur}
				{...a11y.ariaProps}
				{...extAttrs as any}
				data-kiln-date="true"
				data-kiln-uuid={item.uuid}
			>
				<span slot="labelText" class:required={item.is_required}>{@html labelText}</span>
			</DatePickerInput>
		</DatePicker>
		{#if anyError}
			<div id={a11y.errorId} class="bx--form-requirement" role="alert">{anyError}</div>
		{/if}
		{#if helperText}
			<div id={a11y.helperId} class="bx--form__helper-text">{helperText}</div>
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
