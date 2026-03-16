<script lang="ts">
	import { RadioButtonGroup, RadioButton } from 'carbon-components-svelte';
	import type { Item, FormOption } from '$lib/types/form';
	import {
		createValueSyncEffect,
		parsers,
		comparators,
		publishToGlobalFormState,
		syncExternalAttributes
	} from '$lib/utils/valueSync';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';
	import './fields.css';
	import {
		filterAttributes,
		buildFieldAria,
		getFieldLabel,
		computeIsRequired,
		computeIsReadOnly
	} from '$lib/utils/helpers';
	import PrintRow from './common/PrintRow.svelte';
	import RadioIcon from 'carbon-icons-svelte/lib/RadioButton.svelte';
	import RadioFilledIcon from 'carbon-icons-svelte/lib/RadioButtonChecked.svelte';

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

	// Use computed isReadOnly for local state
	let readonly = $state(computeIsReadOnly(item.is_read_only, isPortalIntegrated));
	let labelText = $state(getFieldLabel(item));
	const hideLabel = item.attributes?.hideLabel ?? false;
	let enableVarSub = $state(item.attributes?.enableVarSub ?? false);
	const helperText = item.help_text ?? '';
	const options = item.options ?? [];
	let touched = $state(false);

	let extAttrs = $state<Record<string, any>>({});

	const rules = $derived(
		rulesFromAttributes(item.attributes, { is_required: isRequired, type: 'string' })
	);

	const anyError = $derived.by(() => {
		if (!touched) return '';
		if (error) return error;
		if (readonly) return '';
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
			componentName: 'RadioButton',
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

{#snippet value()}
	<div class="radio-print-options" class:horizontal={item.attributes?.orientation === 'horizontal'}>
		{#each options as opt (opt.id)}
			<div class="radio-print-option">
				<span class="radio-icon">
					{#if selected.includes(opt.value)}
						<RadioFilledIcon aria-label="Selected" />
					{:else}
						<RadioIcon aria-label="Not selected" />
					{/if}
				</span>
				<span>{@html opt.label || opt.value}</span>
			</div>
		{/each}
	</div>
{/snippet}

<div class="field-container radio-button-field">
	<PrintRow {item} {printing} {labelText} {value} />

	<div
		class="web-input radio-group-wrapper"
		style={readonly ? 'pointer-events: none;' : ''}
		class:visible={!printing && item.visible_web !== false}
		data-selected={selected}
	>
		<RadioButtonGroup
			{...filterAttributes(item?.attributes)}
			id={item.uuid}
			class={item.class}
			name={item.uuid}
			bind:selected
			hideLegend={hideLabel}
			role="radiogroup"
			{...a11y.ariaProps}
			{onchange}
			{...extAttrs as any}
		>
			<span
				slot="legendChildren"
				id={a11y.labelId}
				class:required={isRequired}
				class:moustache={enableVarSub}>{@html labelText}</span
			>

			{#each options as opt, index (opt.id)}
				<RadioButton
					value={opt.value}
					labelText={opt.label}
					id={`${item.uuid}-option-${index}`}
					{onblur}
				/>
			{/each}
		</RadioButtonGroup>
		{#if anyError}
			<div
				id={a11y.errorId}
				class="bx--form-requirement hack-visible"
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
	/* carbon components doesn't have a native way of adding errors to radio groups */
	.bx--form-requirement.hack-visible {
		display: block;
		overflow: visible;
		max-height: 12.5rem;
		font-weight: 400;
		color: var(--cds-text-error, #da1e28);
	}
	.radio-print-options.horizontal {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.radio-print-option {
		display: flex;
		gap: 0.375rem;
		align-items: center;
	}
	.radio-icon {
		display: flex;
		flex-shrink: 0;
	}
</style>
