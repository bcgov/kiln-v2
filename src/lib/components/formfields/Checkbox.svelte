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
	import {
		filterAttributes,
		buildFieldAria,
		getFieldLabel,
		computeIsRequired,
		computeIsReadOnly
	} from '$lib/utils/helpers';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';
	import PrintRow from './common/PrintRow.svelte';
	import CheckboxIcon from 'carbon-icons-svelte/lib/Checkbox.svelte';
	import CheckboxFilledIcon from 'carbon-icons-svelte/lib/CheckboxCheckedFilled.svelte';

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
	}>();

	let checked = $state(item?.value ?? item.attributes?.defaultChecked ?? false);
	let labelText = $state(getFieldLabel(item));

	// Compute effective required/read-only from enum values
	const isRequired = $derived.by(() => computeIsRequired(item.is_required, isPortalIntegrated));
	const isReadOnly = $derived.by(() => computeIsReadOnly(item.is_read_only, isPortalIntegrated));

	// Use computed isReadOnly for local state (bindings, UI)
	let readonly = $state(computeIsReadOnly(item.is_read_only, isPortalIntegrated));
	let helperText = item.help_text ?? '';
	let hideLabel = item.attributes?.hideLabel ?? false;
	let enableVarSub = $state(item.attributes?.enableVarSub ?? false);
	let touched = $state(false);

	let extAttrs = $state<Record<string, any>>({});

	let filteredAttributes = $derived.by(() => {
		const attrs = { ...(item.attributes ?? {}) } as Record<string, any>;
		delete attrs.checked;
		delete attrs.defaultChecked;
		delete attrs.disabled;
		return attrs;
	});

	const rules = $derived.by(() =>
		rulesFromAttributes(item.attributes, { is_required: isRequired, type: 'boolean' })
	);
	let anyError = $derived.by(() => {
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

<div class="field-container checkbox-field">
	<PrintRow item={{ ...item, is_required: false }} {printing} labelText="">
		{#snippet value()}
			<div class="checkbox-print-label">
				<span class="checkbox-icon">
					{#if checked}
						<CheckboxFilledIcon aria-label="Checked" />
					{:else}
						<CheckboxIcon aria-label="Unchecked" />
					{/if}
				</span>
				<span class:required={item.is_required}>{@html labelText}</span>
			</div>
		{/snippet}
	</PrintRow>

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
			{hideLabel}
			{onchange}
			{onblur}
			role="checkbox"
			aria-checked={checked}
			{...a11y.ariaProps}
			{...extAttrs as any}
		>
			<span
				slot="labelChildren"
				id={a11y.labelId}
				class:required={isRequired}
				class:moustache={enableVarSub}>{@html labelText}</span
			>
		</Checkbox>
		{#if anyError}
			<div
				id={a11y.errorId}
				class="bx--form-requirement checkbox-error"
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

	.required::after {
		content: ' *';
		color: var(--cds-support-error);
	}
	.bx--form-requirement.checkbox-error {
		display: block;
		overflow: visible;
		max-height: 12.5rem;
		font-weight: 400;
		color: var(--cds-text-error, #da1e28);
	}
	.checkbox-print-label {
		display: flex;
		gap: 0.375rem;
		align-items: center;
	}
	.checkbox-icon {
		display: flex;
		flex-shrink: 0;
	}
</style>
