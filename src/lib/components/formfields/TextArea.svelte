<script lang="ts">
	import { TextArea } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
	import {
		createValueSyncEffect,
		parsers,
		comparators,
		publishToGlobalFormState
	} from '$lib/utils/valueSync';
	import './fields.css';
	import { requiredLabel } from '$lib/utils/helpers';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
	}>();

	let value = $state(item?.value ?? item.attributes?.value ?? item.attributes?.defaultValue ?? '');
	let error = $state(item.attributes?.error ?? '');
	let readOnly = $state(item.is_read_only ?? false);
	let labelText = requiredLabel(item.attributes?.labelText ?? item.name, item.is_required ?? false);
	let placeholder = item.attributes?.placeholder ?? '';
	let helperText = item.help_text ?? item.description ?? '';
	let maxlength = item.attributes?.maxCount ?? undefined;
	let touched = $state(false);

	const rules = $derived.by(() =>
		rulesFromAttributes(item.attributes, { is_required: item.is_required, type: 'string' })
	);
	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (error) return error;
		if (readOnly) return '';
		return (
			validateValue(value, rules, {
				type: 'string',
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
			componentName: 'TextArea',
			parser: parsers.string,
			comparator: comparators.string
		});
	});

	$effect(() => {
		publishToGlobalFormState({ item, value });
	});
</script>

<div class="field-container text-area-field">
	<div
		class="print-row"
		class:visible={printing && item.visible_pdf !== false}
		id={printing && item.visible_pdf !== false ? item.uuid : undefined}
	>
		<div class="print-label">{@html labelText}</div>
		<div class="print-value">{value || ''}</div>
	</div>

	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<TextArea
			class={item.class}
			{placeholder}
			{helperText}
			bind:value
			readonly={readOnly}
			invalid={!!anyError}
			invalidText={anyError}
			{maxlength}
			{...item.attributes}
			{oninput}
			{onblur}
		>
			<span slot="labelText">{@html labelText}</span>
		</TextArea>
	</div>
</div>
