<script lang="ts">
	import { DatePicker, DatePickerInput } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
	import {
		createValueSyncEffect,
		parsers,
		comparators,
		publishToGlobalFormState
	} from '$lib/utils/valueSync';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';
	import './fields.css';
	import { requiredLabel } from '$lib/utils/helpers';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
	}>();

	let value = $state(item?.value ?? item.attributes?.value ?? item.attributes?.defaultValue ?? '');
	let readOnly = $state(item.is_read_only ?? false);
	let labelText = requiredLabel(item.attributes?.labelText ?? item.name, item.is_required);
	let helperText = item.help_text ?? item.description ?? '';
	let touched = $state(false);

	const rules = $derived.by(() =>
		rulesFromAttributes(item.attributes, { is_required: item.is_required, type: 'date' })
	);
	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (item.attributes?.error) return item.attributes.error;
		if (readOnly) return '';
		return (
			validateValue(value, rules, {
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

	$effect(() => {
		return createValueSyncEffect({
			item,
			getValue: () => value,
			setValue: (newValue) => {
				value = newValue;
			},
			componentName: 'DatePicker',
			parser: parsers.string,
			comparator: comparators.string
		});
	});

	$effect(() => {
		publishToGlobalFormState({ item, value });
	});
</script>

<div class="field-container date-picker-field">
	<div
		class="print-row"
		class:visible={printing && item.visible_pdf !== false}
		id={printing && item.visible_pdf !== false ? item.uuid : undefined}
	>
		<div class="print-label">{@html labelText}</div>
		<div class="print-value">{value || ''}</div>
	</div>

	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<DatePicker
			class={item.class}
			datePickerType="single"
			bind:value
			disabled={readOnly}
			{...item.attributes}
		>
			<DatePickerInput
				id={item.uuid}
				{helperText}
				disabled={readOnly}
				invalid={!!anyError}
				invalidText={anyError}
				{...item.attributes}
				{oninput}
				{onblur}
			>
				<span slot="labelText">{@html labelText}</span>
			</DatePickerInput>
		</DatePicker>
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
