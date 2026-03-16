<script lang="ts">
	import { NumberInput, TextInput } from 'carbon-components-svelte';
	import type { Item, NumberField } from '$lib/types/form';
	import {
		createValueSyncEffect,
		parsers,
		comparators,
		publishToGlobalFormState,
		syncExternalAttributes
	} from '$lib/utils/valueSync';
	import './fields.css';
	import {
		filterAttributes,
		buildFieldAria,
		getFieldLabel,
		computeIsRequired,
		computeIsReadOnly
	} from '$lib/utils/helpers';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';
	import { preprocessDecimalInput, unmaskNumberString } from '$lib/utils/mask';
	import PrintRow from './common/PrintRow.svelte';
	import { MaskInput } from 'maska';

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

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
	const unmaskedValue: string = $derived(unmaskNumberString(value));
	let error = $state(item.attributes?.error ?? ''); // this seems unused or broken

	// Compute effective required/read-only from enum values
	const isRequired = $derived.by(() => computeIsRequired(item.is_required, isPortalIntegrated));
	const isReadOnly = $derived.by(() => computeIsReadOnly(item.is_read_only, isPortalIntegrated));

	// Use computed isReadOnly for local state
	let readonly = $state(computeIsReadOnly(item.is_read_only, isPortalIntegrated));
	const labelText = $derived(getFieldLabel(item));
	const helperText = item.help_text ?? '';
	const hideLabel = item.attributes?.hideLabel ?? false;
	const enableVarSub = $derived(item.attributes?.enableVarSub ?? false);
	const maskType = $derived(item.attributes?.maskType ?? 'integer');
	let fractionDigits = $derived.by(() => {
		return item.attributes?.step
			? (item.attributes?.step.toString().split('.')[1]?.length ?? 0)
			: 0;
	});

	// carbon's NumberInput has UX issues with decimal values, even with allowDecimal
	// keep using it for integer for form script compatability
	const FieldComponent = $derived(maskType === 'decimal' ? TextInput : NumberInput);

	let touched = $state(false);
	let ref = $state<HTMLInputElement | null>(null);

	let extAttrs = $state<Record<string, any>>({});

	let printValue = $derived.by(() => {
		return value?.toString() || '';
	});

	const rules = $derived.by(() => {
		const r = rulesFromAttributes(item.attributes, {
			is_required: isRequired,
			type: 'number'
		});
		// If maskType indicates integer, enforce integer rule
		if (maskType === 'integer') r.isInteger = true;
		return r;
	});

	const anyError = $derived.by(() => {
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
			isRequired,
			readOnly: isReadOnly
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
	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<FieldComponent
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
			inputmode={maskType === 'decimal' ? 'decimal' : 'numeric'}
			onchange={handleInput}
			onblur={handleInput}
			onkeydown={handleKeyDown}
			data-raw-value={unmaskedValue}
		>
			<span
				slot="labelChildren"
				id={a11y.labelId}
				class:required={isRequired}
				class:moustache={enableVarSub}>{@html labelText}</span
			>
		</FieldComponent>
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
