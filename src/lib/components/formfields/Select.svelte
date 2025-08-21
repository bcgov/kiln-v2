<script lang="ts">
	import { Select, SelectItem } from 'carbon-components-svelte';
	import type { FormOption, Item } from '$lib/types/form';
	import {
		createValueSyncEffect,
		parsers,
		comparators,
		publishToGlobalFormState,
		syncExternalAttributes
	} from '$lib/utils/valueSync';
	import './fields.css';
	import { filterAttributes } from '$lib/utils/helpers';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
	}>();

	let selected = $state(
		item?.value ?? item.attributes?.selected ?? item.attributes?.defaultSelected ?? ''
	);
	let error = $state(item.attributes?.error ?? '');
	let readOnly = $state(item.is_read_only ?? false);
	let labelText = $state(item.attributes?.labelText ?? '');
	let helperText = item.help_text ?? item.description ?? '';
	let options = item.options ?? [];
	let touched = $state(false);

	let extAttrs = $state<Record<string, any>>({});

	let selectedLabel = $derived.by(() => {
		const option = options.find((opt: FormOption) => opt.value === selected);
		return option?.label || selected;
	});

	const rules = $derived.by(() =>
		rulesFromAttributes(item.attributes, { is_required: item.is_required, type: 'string' })
	);
	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (error) return error;
		if (readOnly) return '';
		return (
			validateValue(selected, rules, {
				type: 'string',
				fieldLabel: item.attributes?.labelText ?? item.name
			}).firstError ?? ''
		);
	});

	function onchange() {
		touched = true;
	}
	function onblur() {
		touched = true;
	}

	$effect(() => {
		return createValueSyncEffect({
			item,
			getValue: () => selected,
			setValue: (newValue) => {
				selected = newValue;
			},
			componentName: 'Select',
			parser: parsers.string,
			comparator: comparators.string
		});
	});

	$effect(() => {
		return syncExternalAttributes({
			item,
			get: () => extAttrs,
			set: (next) => {
				extAttrs = next;
			}
		});
	});

	$effect(() => {
		publishToGlobalFormState({ item, value: selected });
	});
</script>

<div class="field-container select-field">
	<div
		class="print-row"
		class:visible={printing && item.visible_pdf !== false}
		id={printing && item.visible_pdf !== false ? item.uuid : undefined}
	>
		<div class="print-label" class:required={item.is_required}>{@html labelText}</div>
		<div class="print-value">{selectedLabel || ''}</div>
	</div>

	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<Select
			{...filterAttributes(item?.attributes)}
			{...extAttrs as any}
			id={item.uuid}
			class={item.class}
			{helperText}
			bind:selected
			disabled={readOnly}
			invalid={!!anyError}
			invalidText={anyError}
			{onchange}
			{onblur}
		>
			<span slot="labelText" class:required={item.is_required}>{@html labelText}</span>
			<SelectItem value="" text="Please select an option" />
			{#each options as opt}
				<SelectItem value={opt.value} text={opt.label} />
			{/each}
		</Select>
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
