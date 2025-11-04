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
	import { filterAttributes, buildFieldAria, getFieldLabel } from '$lib/utils/helpers';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';
	import PrintRow from './common/PrintRow.svelte';

	let { item, printing = false } = $props<{ item: Item; printing?: boolean }>();

	let value = $state(
		item?.value ?? item.attributes?.value ?? item.attributes?.defaultValue ?? null
	);
	let error = $state(item.attributes?.error ?? '');
	let readonly = $state(item.is_read_only ?? false);
	let labelText = $state(getFieldLabel(item));
	let helperText = item.help_text ?? '';
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

	function handleInput(e: any) {
		const raw = e?.detail?.value ?? e?.target?.value ?? '';
		if (raw === '') {
			value = null;
		} else {
			const n = Number(raw);
			if (!Number.isNaN(n)) value = n;
		}
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

	const a11y = buildFieldAria({
		uuid: item.uuid,
		labelText,
		helperText,
		isRequired: item.is_required,
		readOnly: readonly
	});
</script>

<div class="field-container number-input-field">
	<PrintRow
		{item}
		{printing}
		{labelText}
		value={value !== null && value !== undefined ? (value === 0 ? value.toString() : value) : ''}
	/>
	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<NumberInput
			{...filterAttributes(item?.attributes)}
			id={item.uuid}
			class={item.class}
			{readonly}
			hideSteppers
			allowEmpty
			value={value ?? ''}
			invalid={!!anyError}
			invalidText={anyError}
			{...a11y.ariaProps}
			onchange={handleInput}
			onblur={handleInput}
			{...extAttrs as any}
		>
			<span slot="label" id={a11y.labelId} class:required={item.is_required}>{@html labelText}</span
			>
		</NumberInput>
		{#if anyError}
			<div id={a11y.errorId} class="bx--form-requirement" role="alert">{anyError}</div>
		{/if}
		{#if helperText}
			<div id={a11y.helperId} class="bx--form__helper-text">{helperText}</div>
		{/if}
	</div>
</div>
