<script lang="ts">
	import { Select, SelectItem } from 'carbon-components-svelte';
	import type { FormOption, Item } from '$lib/types/form';
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

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
	}>();

	let selected = $state(
		item?.value ?? item.attributes?.selected ?? item.attributes?.defaultSelected ?? ''
	);
	let error = $state(item.attributes?.error ?? '');

	// Compute effective required/read-only from enum values
	const isRequired = $derived.by(() => computeIsRequired(item.is_required, isPortalIntegrated));
	const isReadOnly = $derived.by(() => computeIsReadOnly(item.is_read_only, isPortalIntegrated));

	// Use computed isReadOnly for local state (bindings, UI)
	let readOnly = $state(computeIsReadOnly(item.is_read_only, isPortalIntegrated));
	let labelText = $state(getFieldLabel(item));
	const helperText = item.help_text ?? '';
	const hideLabel = item.attributes?.hideLabel ?? false;
	let enableVarSub = $state(item.attributes?.enableVarSub ?? false);
	const options = item.options ?? [];
	let touched = $state(false);

	let extAttrs = $state<Record<string, any>>({});

	let selectedLabel = $derived.by(() => {
		const option = options.find((opt: FormOption) => opt.value === selected);
		return option?.label || selected;
	});

	const rules = $derived(
		rulesFromAttributes(item.attributes, { is_required: isRequired, type: 'string' })
	);

	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (error) return error;
		if (readOnly) return '';
		return (
			validateValue(selected, rules, {
				type: 'string',
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
			getValue: () => selected,
			setValue: (newValue) => {
				selected = newValue;
			},
			componentName: 'Select',
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
		publishToGlobalFormState({ item, value: selected });
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

<div class="field-container select-field">
	<PrintRow {item} {printing} {labelText} value={selectedLabel || ''} />

	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<Select
			{...filterAttributes(item?.attributes)}
			id={item.uuid}
			class={item.class}
			bind:selected
			disabled={readOnly}
			{hideLabel}
			invalid={!!anyError}
			invalidText={anyError}
			{...a11y.ariaProps}
			{onchange}
			{onblur}
			{...extAttrs as any}
		>
			<span
				slot="labelChildren"
				id={a11y.labelId}
				class:required={isRequired}
				class:moustache={enableVarSub}>{@html labelText}</span
			>
			<SelectItem value="" text="Please select an option" />
			{#each options as opt (opt.id)}
				<SelectItem value={opt.value} text={opt.label} />
			{/each}
		</Select>
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
	:global(
			input:disabled,
			textarea:disabled,
			select:disabled,
			button:disabled,
			checkbox:disabled,
			textinput:disabled
		) {
		background-color: white !important;
		color: black !important;
		cursor: text !important;
	}

	:global(input:disabled::placeholder, textarea:disabled::placeholder) {
		color: black !important;
		opacity: 1 !important;
	}
</style>
