<script lang="ts">
	import { TextInput } from 'carbon-components-svelte';
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
	import { normalizeDash, filterInputByMaskType, applyMaskaWithTokens } from '$lib/utils/mask';
	import { validateValue, rulesFromAttributes, validateMaskedValue } from '$lib/utils/validation';
	import PrintRow from './common/PrintRow.svelte';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
	}>();

	let value = $state(item?.value ?? item.attributes?.value ?? item.attributes?.defaultValue ?? '');
	let error = $state(item.attributes?.error ?? '');
	let readOnly = $state(item.is_read_only ?? false);
	let labelText = $state(getFieldLabel(item));
	let enableVarSub = $state(item.attributes?.enableVarSub ?? false);
	let placeholder = item.attributes?.placeholder ?? '';
	let helperText = item.help_text ?? item.description ?? '';

	//maska patterns:
	// 	{
	//   '#': { pattern: /[0-9]/ },       // digits
	//   '@': { pattern: /[a-zA-Z]/ },    // letters
	//   '*': { pattern: /[a-zA-Z0-9]/ }, // letters & digits
	// }

	let hideLabel = item.attributes?.hideLabel ?? false;
	let maxCount = item.attributes?.maxCount ?? undefined;
	let touched = $state(false);
	let extAttrs = $state<Record<string, any>>({});

	const rules = $derived.by(() =>
		rulesFromAttributes(item.attributes, { is_required: item.is_required, type: 'string' })
	);
	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (error) return error;
		if (readOnly) return '';

		const maskType = item?.attributes?.maskType;
		const label = item.attributes?.labelText ?? item.name;
		const isRequired = item.is_required === true;

		// Delegate mask-aware checks (currency, phone, email) to shared helper
		const maskErr = validateMaskedValue(value, item.attributes, { fieldLabel: label, isRequired });
		if (maskErr) return maskErr;
		// For masked input types, skip the generic string pattern validation (rules.pattern) because masked formats are validated above
		if (['currency', 'phone', 'email'].includes(maskType)) {
			return '';
		}

		// For custom or other masks: use standard string validation
		return (
			validateValue(value, rules, {
				type: 'string',
				fieldLabel: label
			}).firstError ?? ''
		);
	});

	function oninput(e: Event) {
		const target = e.target as HTMLInputElement;
		// Filter input based on mask type
		const maskType = item?.attributes?.maskType;
		if (maskType) {
			const filtered = filterInputByMaskType(target.value, maskType);
			if (filtered !== target.value) {
				target.value = filtered;
				value = filtered;
			}
		}
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
			componentName: 'TextInput',
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
	$effect(() => {
		publishToGlobalFormState({ item, value });
	});

	const a11y = buildFieldAria({
		uuid: item.uuid,
		labelText,
		helperText,
		isRequired: item.is_required,
		readOnly: readOnly
	});

	// Apply mask to the real input element once it exists
	let maskApplied = false;
	$effect(() => {
		if (maskApplied || typeof document === 'undefined') return;
		const maskType = item?.attributes?.maskType;
			// Apply maska for phone and currency
			if (!['phone', 'currency'].includes(maskType)) {
			return;
		}
		const raw = normalizeDash(item.attributes?.mask).trim();
		if (!raw) return;
		const el = document.getElementById(item.uuid) as HTMLInputElement | null;
		if (el) {
			const applied = applyMaskaWithTokens(el, raw, maskType);
			if (applied) maskApplied = true;
		}
	});
</script>

<div class="field-container text-input-field">
	<PrintRow {item} {printing} {labelText} value={value || ''} />

	<div
		class="web-input"
		class:visible={!printing && item.visible_web !== false}
		class:moustache={enableVarSub}
	>
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
			{...maxCount ? { maxlength: maxCount } : {}}
			{oninput}
			{onblur}
			{...extAttrs as any}
		>
			<span slot="labelText" id={a11y.labelId} class:required={item.is_required}
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
