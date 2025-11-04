<script lang="ts">
	import { Checkbox } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
	import {
		createValueSyncEffect,
		parsers,
		comparators,
		publishToGlobalFormState,
		createAttributeSyncEffect
	} from '$lib/utils/valueSync';
	import './fields.css';
	import { filterAttributes, buildFieldAria, getFieldLabel } from '$lib/utils/helpers';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';
	import PrintRow from './common/PrintRow.svelte';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
	}>();

	let checked = $state(item?.value ?? item.attributes?.defaultChecked ?? false);
	let labelText = $state(getFieldLabel(item));
	let readonly = $state(item.is_read_only ?? false);
	let helperText = item.help_text ?? '';
	let touched = $state(false);

	let extAttrs = $state<Record<string, any>>({});

	const filteredAttributes = $derived.by(() => {
		const attrs = { ...(item.attributes ?? {}) } as Record<string, any>;
		delete attrs.checked;
		delete attrs.defaultChecked;
		delete attrs.disabled;
		return attrs;
	});

	const rules = $derived.by(() =>
		rulesFromAttributes(item.attributes, { is_required: item.is_required, type: 'boolean' })
	);
	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (item.attributes?.error) return item.attributes.error;
		if (readonly) return '';
		return (
			validateValue(checked, rules, {
				type: 'boolean',
				fieldLabel: item.attributes?.labelText ?? item.name
			}).firstError ?? ''
		);
	});

	function onchange() {
		touched = true;
	}
	function onblur() {
		touched = true;
	}

	$effect(() => {
		return createValueSyncEffect({
			item,
			getValue: () => checked,
			setValue: (newValue) => {
				checked = newValue;
			},
			componentName: 'Checkbox',
			parser: parsers.boolean,
			comparator: comparators.strict
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

	$effect(() => {
		publishToGlobalFormState({ item, value: checked });
	});

	const a11y = buildFieldAria({
		uuid: item.uuid,
		labelText,
		helperText,
		isRequired: item.is_required,
		readOnly: readonly
	});
</script>

<div class="field-container checkbox-field">
	<PrintRow {item} {printing} {labelText} value={checked ? '☑' : '☐'} />

	<div
		class="web-input"
		class:visible={!printing && item.visible_web !== false}
		class:read-only={readonly}
	>
		<Checkbox
			{...filterAttributes(filteredAttributes)}
			id={item.uuid}
			class={item.class}
			bind:checked
			disabled={readonly}
			{onchange}
			{onblur}
			role="checkbox"
			aria-checked={checked}
			{...a11y.ariaProps}
			{...extAttrs as any}
		>
			<span slot="labelText" id={a11y.labelId} class:required={item.is_required}
				>{@html labelText}</span
			>
		</Checkbox>
		{#if anyError}
			<div id={a11y.errorId} class="bx--form-requirement" role="alert">{anyError}</div>
		{/if}
		{#if helperText}
			<div id={a11y.helperId} class="bx--form__helper-text">{helperText}</div>
		{/if}
	</div>
</div>

<style>
	/* Scope to only checkboxes inside a read-only web-input container */
	:global(.web-input.read-only .bx--checkbox-wrapper),
	:global(.web-input.read-only .bx--checkbox-label),
	:global(.web-input.read-only .bx--checkbox-label-text) {
		color: black !important;
		cursor: default !important;
		opacity: 1 !important;
	}

	/* If Carbon dims the checkbox box itself */
	:global(.web-input.read-only .bx--checkbox) {
		border-color: black !important;
		background-color: white !important;
	}
</style>
