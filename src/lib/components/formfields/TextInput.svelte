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
	import { filterAttributes, buildFieldAria } from '$lib/utils/helpers';
	import { maska } from 'maska/svelte';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';
	import PrintRow from './common/PrintRow.svelte';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
	}>();

	let value = $state(item?.value ?? item.attributes?.value ?? item.attributes?.defaultValue ?? '');
	let error = $state(item.attributes?.error ?? '');
	let readOnly = $state(item.is_read_only ?? false);
	let labelText = $state(item.attributes?.labelText ?? '');
	let placeholder = item.attributes?.placeholder ?? '';
	let helperText = item.help_text ?? item.description ?? '';

	//maska patterns:
	// 	{
	//   '#': { pattern: /[0-9]/ },       // digits
	//   '@': { pattern: /[a-zA-Z]/ },    // letters
	//   '*': { pattern: /[a-zA-Z0-9]/ }, // letters & digits
	// }

	let mask = item.attributes?.mask ?? undefined;
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
		if (!mask || maskApplied || typeof document === 'undefined') return;
		const el = document.getElementById(item.uuid) as HTMLInputElement | null;
		if (el) {
			maska(el, mask);
			maskApplied = true;
		}
	});
</script>

<div class="field-container text-input-field">
	<PrintRow {item} {printing} {labelText} value={value || ''} />

	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<TextInput
			{...filterAttributes(item?.attributes)}
			id={item.uuid}
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
