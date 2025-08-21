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
	import { filterAttributes } from '$lib/utils/helpers';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
	}>();

	let checked = $state(item?.value ?? item.attributes?.defaultChecked ?? false);
	let labelText = $state(item.attributes?.labelText ?? '');
	let readonly = $state(item.is_read_only ?? false);
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
</script>

<div class="field-container checkbox-field">
	<div
		class="print-row"
		class:visible={printing && item.visible_pdf !== false}
		id={printing && item.visible_pdf !== false ? item.uuid : undefined}
	>
		<div class="print-label" class:required={item.is_required}>{@html labelText}</div>
		<div class="print-value">{checked ? '☑' : '☐'}</div>
	</div>

	<div
		class="web-input"
		class:visible={!printing && item.visible_web !== false}
		class:read-only={readonly}
	>
		<Checkbox
			{...filterAttributes(filteredAttributes)}
			{...extAttrs as any}
			id={item.uuid}
			class={item.class}
			bind:checked
			disabled={readonly}
			{onchange}
			{onblur}
		>
			<span slot="labelText" class:required={item.is_required}>{@html labelText}</span>
		</Checkbox>
		{#if anyError}
			<div class="bx--form-requirement">{anyError}</div>
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
