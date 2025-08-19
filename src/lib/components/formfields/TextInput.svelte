<script lang="ts">
	import { TextInput } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
	import {
		createValueSyncEffect,
		parsers,
		comparators,
		publishToGlobalFormState,
		createAttributeSyncEffect
	} from '$lib/utils/valueSync';
	import './fields.css';
	import { filterAttributes, requiredLabel } from '$lib/utils/helpers';
	import { maska } from 'maska/svelte';
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

	// Derived validation rules and computed error (gives precedence to server-provided error)
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
		return createAttributeSyncEffect({
			item,
			onAttr: (name, value) => {
				if (name === 'class' || name === 'style') return;
				if (extAttrs[name] !== value && value !== undefined) {
					extAttrs = { ...extAttrs, [name]: value };
				}
			}
		});
	});

	// publish value to a shared global state for saving
	$effect(() => {
		publishToGlobalFormState({ item, value });
	});
</script>

<div class="field-container text-input-field">
	<div
		class="print-row"
		class:visible={printing && item.visible_pdf !== false}
		id={printing && item.visible_pdf !== false ? item.uuid : undefined}
	>
		<div class="print-label">{@html labelText}</div>
		<div class="print-value">{value || ''}</div>
	</div>

	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		{#if mask}
			<input
				{...filterAttributes(item?.attributes)}
				{...extAttrs as any}
				id={item.uuid}
				class="bx--text-input {item.class}"
				{placeholder}
				aria-label={labelText}
				bind:value
				use:maska={mask}
				readonly={readOnly}
				aria-invalid={!!anyError}
				{...maxCount ? { maxlength: maxCount } : {}}
				{oninput}
				{onblur}
			/>
			{#if anyError}
				<div class="bx--form-requirement">{anyError}</div>
			{/if}
			{#if helperText}
				<div class="bx--form__helper-text">{helperText}</div>
			{/if}
		{:else}
			<TextInput
				{...filterAttributes(item?.attributes)}
				{...extAttrs as any}
				id={item.uuid}
				class={item.class}
				{placeholder}
				{helperText}
				bind:value
				readonly={readOnly}
				invalid={!!anyError}
				invalidText={anyError}
				{hideLabel}
				{...maxCount ? { maxlength: maxCount } : {}}
				{oninput}
				{onblur}
			>
				<span slot="labelText">{@html labelText}</span>
			</TextInput>
		{/if}
	</div>
</div>
