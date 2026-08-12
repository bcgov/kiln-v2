<script lang="ts">
	import { TextArea } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
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
	import PrintRow from './common/PrintRow.svelte';
	import { scriptErrors } from "$lib/utils/scriptErrors";
	import { isFieldVisible } from '$lib/utils/form';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
	}>();

	let value = $state(item?.value ?? item.attributes?.value ?? item.attributes?.defaultValue ?? '');
	let error = $state(item.attributes?.error ?? '');

	// Compute effective required/read-only from enum values
	const isRequired = $derived.by(() => computeIsRequired(item.is_required));
	const isReadOnly = $derived.by(() => computeIsReadOnly(item.is_read_only));
	const isVisible = $derived(isFieldVisible(item));

	// Use computed isReadOnly for local state
	let readOnly = $state(computeIsReadOnly(item.is_read_only));
	let labelText = $state(getFieldLabel(item));
	const placeholder = item.attributes?.placeholder ?? '';
	const helperText = item.help_text ?? '';
	const hideLabel = item.attributes?.hideLabel ?? false;
	let enableVarSub = $state(item.attributes?.enableVarSub ?? false);
	const maxlength = item.attributes?.maxCount ?? undefined;
	let touched = $state(false);

	let extAttrs = $state<Record<string, any>>({});

	const rules = $derived(
		rulesFromAttributes(item.attributes, { is_required: isRequired, type: 'string' })
	);

	const scriptError = $derived.by(() => $scriptErrors?.[item.uuid] ?? "");

	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (error) return error;
		if (readOnly) return '';
		// script-driven error from global store
 		if (scriptError) return scriptError;
		return (
			validateValue(value, rules, {
				type: 'string',
				fieldLabel: item.attributes?.labelText ?? item.name
			}).firstError ?? ''
		);
	});

	const rows = Number.isFinite(Number(item?.attributes?.rows)) ? Number(item.attributes.rows) : 4;

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
			componentName: 'TextArea',
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
</script>

<div class="field-container text-area-field">
	<PrintRow {item} {printing} {labelText} value={value || ''} {rows} />

	<div class="web-input" class:visible={!printing && isVisible}>
		<TextArea
			{...filterAttributes(item?.attributes)}
			id={item.uuid}
			class={item.class}
			{placeholder}
			bind:value
			readonly={readOnly}
			{hideLabel}
			invalid={!!anyError}
			invalidText={anyError}
			{maxlength}
			{...a11y.ariaProps}
			{oninput}
			{onblur}
			{...extAttrs as any}
			{rows}
		>
			<span
				slot="labelChildren"
				id={a11y.labelId}
				class:required={isRequired}
				class:moustache={enableVarSub}>{@html labelText}</span
			>
		</TextArea>
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
