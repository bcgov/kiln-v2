<script lang="ts">
	import { TextInput } from 'carbon-components-svelte';
	import type { CurrencyField, Item } from '$lib/types/form';
	import {
		createValueSyncEffect,
		parsers,
		comparators,
		publishToGlobalFormState,
		syncExternalAttributes
	} from '$lib/utils/valueSync';
	import './fields.css';
	import { filterAttributes, buildFieldAria, getFieldLabel } from '$lib/utils/helpers';
	import { preprocessDecimalInput, unmaskNumberString } from '$lib/utils/mask';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';
	import PrintRow from './common/PrintRow.svelte';
	import { MaskInput } from 'maska';

	let {
		item,
		printing = false
	}: {
		item: Omit<Item, 'value' | 'attributes'> & CurrencyField;
		printing?: boolean;
	} = $props();

	let value: string = $state(
		item?.value ?? item.attributes?.value ?? item.attributes?.defaultValue ?? ''
	);
	let unmaskedValue: string = $derived(unmaskNumberString(value));

	let readOnly = $derived(item.is_read_only === true || item.is_read_only === 'true' || false);
	let labelText = $derived(getFieldLabel(item));
	let enableVarSub = $derived(item.attributes?.enableVarSub ?? false);
	let placeholder = $derived(item.attributes?.placeholder ?? '');
	let helperText = $derived(item.help_text ?? item.description ?? '');

	let hideLabel = $derived(item.attributes?.hideLabel ?? false);

	let touched = $state(false);
	let extAttrs = $state<Record<string, any>>({});

	let ref = $state<HTMLInputElement | null>(null);

	let rules = $derived.by(() => ({
		...rulesFromAttributes(item.attributes, { is_required: item.is_required, type: 'number' }),
		isInteger: false
	}));
	let anyError = $derived.by(() => {
		if (!touched) return '';
		if (readOnly) return '';
		return (
			validateValue(unmaskedValue, rules, {
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
				// would fix applying mask on external update,
				// but resets cursor position on normal input
				// if (mask && ref) {
				// 	mask.updateValue(ref);
				// }
			},
			componentName: 'CurrencyInput',
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

	// publish value to a shared global state for saving
	// ... is what it should be, but saving grabs values from the DOM
	$effect(() => {
		publishToGlobalFormState({ item, value: unmaskedValue });
	});

	const a11y = $derived(
		buildFieldAria({
			uuid: item.uuid,
			labelText,
			helperText,
			isRequired: item.is_required,
			readOnly: readOnly
		})
	);

	const maskaOptions = {
		number: {
			locale: 'en-CA',
			fraction: 2
		},
		preProcess: preprocessDecimalInput(2, 2),
		postProcess: (val: string) => {
			return val ? `$${val}` : '';
		}
	};
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

<div class="field-container text-input-field">
	<PrintRow {item} {printing} {labelText} value={value || ''} />

	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<TextInput
			{...filterAttributes(item?.attributes)}
			id={item.uuid}
			data-kiln-uuid={item.uuid}
			class={item.class}
			{placeholder}
			bind:value
			readonly={readOnly}
			invalid={!!anyError}
			invalidText={anyError}
			aria-label={labelText}
			{...a11y.ariaProps}
			{hideLabel}
			{oninput}
			{onblur}
			bind:ref
			{...extAttrs as any}
			inputmode="decimal"
			data-raw-value={unmaskedValue}
		>
			<span
				slot="labelChildren"
				id={a11y.labelId}
				class:required={item.is_required}
				class:moustache={enableVarSub}>{@html labelText}</span
			>
		</TextInput>
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
