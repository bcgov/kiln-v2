<script lang="ts">
	import { TextInput } from 'carbon-components-svelte';
	import type { Item, NumberField } from '$lib/types/form';
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
	import { preprocessDecimalInput, unmaskNumberString } from '$lib/utils/mask';
	import PrintRow from './common/PrintRow.svelte';
	import { MaskInput } from 'maska';

	let {
		item,
		printing = false
	}: {
		item: Omit<Item, 'value' | 'attributes'> & NumberField;
		printing?: boolean;
	} = $props();

	let value: string = $state(
		item?.value ?? item.attributes?.value ?? item.attributes?.defaultValue ?? ''
	);
	let unmaskedValue: string = $derived(unmaskNumberString(value));
	let error = $state(item.attributes?.error ?? ''); // this seems unused or broken
	let readonly = $derived(item.is_read_only === true || item.is_read_only === 'true' || false);
	let labelText = $derived(getFieldLabel(item));
	let helperText = item.help_text ?? '';
	let hideLabel = item.attributes?.hideLabel ?? false;
	let enableVarSub = $derived(item.attributes?.enableVarSub ?? false);
	let fractionDigits = $derived.by(() => {
		return item.attributes?.step
			? (item.attributes?.step.toString().split('.')[1]?.length ?? 0)
			: 0;
	});

	let touched = $state(false);
	let ref = $state<HTMLInputElement | null>(null);

	let extAttrs = $state<Record<string, any>>({});

	let printValue = $derived.by(() => {
		return value?.toString() || '';
	});

	let rules = $derived.by(() => {
		const r = rulesFromAttributes(item.attributes, {
			is_required: item.is_required,
			type: 'number'
		});
		// If maskType indicates integer, enforce integer rule
		if (item?.attributes?.maskType === 'integer') r.isInteger = true;
		return r;
	});
	let anyError = $derived.by(() => {
		if (!touched) return '';
		if (error) return error; // would force display an error that can never change
		if (readonly) return '';
		return (
			validateValue(unmaskedValue, rules, {
				type: 'number',
				fieldLabel: item.attributes?.labelText ?? item.name
			}).firstError ?? ''
		);
	});

	function handleInput() {
		touched = true;
	}

	function handleKeyDown(e: KeyboardEvent) {
		const maskType = item?.attributes?.maskType;
		if (maskType === 'integer') {
			// block decimal separator characters
			if (e.key === '.' || e.key === ',') {
				e.preventDefault();
			}
		}
	}

	$effect(() => {
		return createValueSyncEffect({
			item,
			getValue: () => value,
			setValue: (newValue) => {
				value = newValue;
			},
			componentName: 'NumberInput',
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
		publishToGlobalFormState({ item, value });
	});

	const a11y = $derived.by(() =>
		buildFieldAria({
			uuid: item.uuid,
			labelText,
			helperText,
			isRequired: item.is_required,
			readOnly: readonly
		})
	);

	const maskaOptions = $derived.by(() => ({
		// If we want comma separators
		// number: {
		// 	locale: 'en-CA',
		// 	fraction: fractionDigits
		// },
		preProcess: preprocessDecimalInput(fractionDigits)
	}));
	$effect(() => {
		if (!ref) {
			return;
		}
		const mask = new MaskInput(ref, maskaOptions);
		return () => {
			mask?.destroy();
		};
	});
</script>

<div class="field-container number-input-field">
	<PrintRow {item} {printing} {labelText} value={printValue} />
	<div
		class="web-input"
		class:visible={!printing && item.visible_web !== false}
		class:moustache={enableVarSub}
	>
		<TextInput
			{...filterAttributes(item?.attributes)}
			{...a11y.ariaProps}
			{...extAttrs as any}
			id={item.uuid}
			class={item.class}
			bind:value
			bind:ref
			{readonly}
			{hideLabel}
			hideSteppers
			allowEmpty
			invalid={!!anyError}
			invalidText={anyError}
			inputmode={item?.attributes?.maskType === 'decimal' ? 'decimal' : 'numeric'}
			onchange={handleInput}
			onblur={handleInput}
			on:keydown={handleKeyDown}
			data-raw-value={unmaskedValue}
		>
			<span slot="labelChildren" id={a11y.labelId} class:required={item.is_required}
				>{@html labelText}</span
			>
		</TextInput>
		{#if anyError}
			<div id={a11y.errorId} class="bx--form-requirement" role="alert">{anyError}</div>
		{/if}
		{#if helperText}
			<div id={a11y.helperId} class="bx--form__helper-text">{helperText}</div>
		{/if}
	</div>
</div>

<style>
	:global {
		.bx--number {
			input[type='number'],
			input[type='text'] {
				font-family: var(--default-font-family), sans-serif;
				font-size: var(--cds-body-short-01-font-size, 0.875rem);
				font-weight: var(--cds-body-short-01-font-weight, 400);
				line-height: var(--cds-body-short-01-line-height, 1.25rem);
				letter-spacing: 1px;
			}
		}
	}
</style>
