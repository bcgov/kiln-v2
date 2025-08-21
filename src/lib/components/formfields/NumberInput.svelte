<script lang="ts">
	import { NumberInput } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
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

	let { item, printing = false } = $props<{ item: Item; printing?: boolean }>();

	let value = $state(item?.value ?? item.attributes?.value ?? item.attributes?.defaultValue ?? 0);
	let error = $state(item.attributes?.error ?? '');
	let readonly = $state(item.is_read_only ?? false);
	let labelText = $state(item.attributes?.labelText ?? '');
	let helperText = item.help_text ?? item.description ?? '';
	let touched = $state(false);

	let extAttrs = $state<Record<string, any>>({});

	const rules = $derived.by(() =>
		rulesFromAttributes(item.attributes, { is_required: item.is_required, type: 'number' })
	);
	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (error) return error;
		if (readonly) return '';
		return (
			validateValue(value, rules, {
				type: 'number',
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
			componentName: 'NumberInput',
			parser: parsers.number,
			comparator: comparators.number
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
		publishToGlobalFormState({ item, value });
	});
</script>

<div class="field-container number-input-field">
	<div
		class="print-row"
		class:visible={printing && item.visible_pdf !== false}
		id={printing && item.visible_pdf !== false ? item.uuid : undefined}
	>
		<div class="print-label">{@html labelText}</div>
		<div class="print-value">{value ?? ''}</div>
	</div>

	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<NumberInput
			{...filterAttributes(item?.attributes)}
			{...extAttrs as any}
			id={item.uuid}
			class={item.class}
			{helperText}
			bind:value
			{readonly}
			invalid={!!anyError}
			invalidText={anyError}
			required={item.is_required}
			{oninput}
			{onblur}
		>
			<span slot="label">{@html labelText}</span>
		</NumberInput>
	</div>
</div>
