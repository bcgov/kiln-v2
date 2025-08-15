<script lang="ts">
	import { RadioButtonGroup, RadioButton } from 'carbon-components-svelte';
	import type { Item, FormOption } from '$lib/types/form';
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

	let value = $state(
		item?.value ?? item.attributes?.selected ?? item.attributes?.defaultSelected ?? ''
	);
	let error = $state(item.attributes?.error ?? '');
	let readonly = $state(item.is_read_only ?? false);
	let labelText = requiredLabel(item.attributes?.labelText ?? item.name, item.is_required ?? false);
	let helperText = item.help_text ?? item.description ?? '';
	let options = item.options ?? [];
	let touched = $state(false);

	let selectedLabel = $derived.by(() => {
		const option = options.find((opt: FormOption) => opt.value === value);
		return option?.label || value;
	});

	const rules = $derived.by(() =>
		rulesFromAttributes(item.attributes, { is_required: item.is_required, type: 'string' })
	);
	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (error) return error;
		if (readonly) return '';
		return (
			validateValue(value, rules, {
				type: 'string',
				fieldLabel: item.attributes?.labelText ?? item.name
			}).firstError ?? ''
		);
	});

	function onchange() {
		touched = true;
	}

	$effect(() => {
		return createValueSyncEffect({
			item,
			getValue: () => value,
			setValue: (newValue) => {
				value = newValue;
			},
			componentName: 'RadioButton',
			parser: parsers.string,
			comparator: comparators.string
		});
	});

	$effect(() => {
		publishToGlobalFormState({ item, value });
	});
</script>

<div class="field-container radio-button-field">
	<div
		class="print-row"
		class:visible={printing && item.visible_pdf !== false}
		id={printing && item.visible_pdf !== false ? item.uuid : undefined}
	>
		<div class="print-label">{@html labelText}</div>
		<div class="print-value">
			{#each options as opt}
				<RadioButton value={opt.value} labelText={opt.label} />
			{/each}
		</div>
	</div>

	<div
		class="web-input"
		style={readonly ? 'pointer-events: none;' : ''}
		class:visible={!printing && item.visible_web !== false}
	>
		<RadioButtonGroup
			id={item.uuid}
			class={item.class}
			selected={value}
			name={item.uuid}
			bind:value
			{...item.attributes}
			{onchange}
		>
			<span slot="legendText">{@html labelText}</span>

			{#each options as opt, index}
				<RadioButton value={opt.value} labelText={opt.label} id={`${item.uuid}-option-${index}`} />
			{/each}
		</RadioButtonGroup>
		{#if helperText}
			<div class="helper-text">{helperText}</div>
		{/if}
		{#if anyError}
			<div class="invalid-text">{anyError}</div>
		{/if}
	</div>
</div>
