<script lang="ts">
	import { Checkbox, FormGroup, RadioButtonGroup } from 'carbon-components-svelte';
	import type { FormOption, Item } from '$lib/types/form';
	import { publishToGlobalFormState, syncExternalAttributes } from '$lib/utils/valueSync';
	import { filterAttributes, buildFieldAria, getFieldLabel } from '$lib/utils/helpers';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';
	import PrintRow from './common/PrintRow.svelte';
	import './fields.css';

	const { item, printing = false } = $props<{ item: Item; printing?: boolean }>();

	// Local state
	let selected = $state<string[]>(
	Array.isArray(item.value)
		? item.value
		: typeof item.value === 'string'
			? item.value.split(',').map(v => v.trim())
			: item.attributes?.defaultSelected ?? []
);
	let touched = $state(false);
	let error = $state(item.attributes?.error ?? '');
	let extAttrs = $state<Record<string, any>>({});

	let readOnly = $derived(item.is_read_only ?? false);
	// Derived
	const options = $derived((item.options ?? []) as FormOption[]);
	const labelText = $derived(getFieldLabel(item));
	const hideLabel = $derived(item.attributes?.hideLabel ?? false);
	const helperText = $derived(item.help_text ?? '');
	const enableVarSub = $derived(item.attributes?.enableVarSub ?? false);

	const a11y = $derived(
		buildFieldAria({
			uuid: item.uuid,
			labelText,
			helperText,
			isRequired: item.is_required,
			readOnly
		})
	);

	const rules = $derived(
		rulesFromAttributes(item.attributes, { is_required: item.is_required, type: 'string' })
	);

	const anyError = $derived(() => {
		if (!touched || readOnly) return error || '';
		return (
			validateValue(selected, rules, {
				type: 'string',
				fieldLabel: item.attributes?.labelText ?? item.name
			}).firstError ?? error
		);
	});

	const printValue = $derived(
		options
			.map((opt) => {
				const prefix = selected.includes(opt.value) ? '☑ ' : '☐ ';
				return prefix + (opt.label || opt.value);
			})
			.join('\n')
	);

	const filteredAttributes = $derived(() => {
		const attrs = { ...(item.attributes ?? {}) };
		delete attrs.defaultSelected;
		delete attrs.disabled;
		return attrs;
	});

	// Sync external values when item.value changes
	let previousKey = $state('');
	$effect(() => {
	if (!item.value) return;

	const external = Array.isArray(item.value)
		? item.value
		: typeof item.value === 'string'
			? item.value.split(',').map(v => v.trim())
			: [];

	const key = JSON.stringify([...external].sort());

	if (key !== previousKey) {
		previousKey = key;
		selected = external;
		touched = false;
	}
});

	// Sync external attributes
	$effect(() => {
		return syncExternalAttributes({
			item,
			get: () => extAttrs,
			set: (next) => (extAttrs = next)
		});
	});

	// Handle user interaction
	function handleCheckboxChange(value: string) {
		touched = true;
		if (selected.includes(value)) {
			selected = selected.filter((v) => v !== value);
		} else {
			selected = [...selected, value];
		}		
	}

	// Publish to global form state when selected changes
	$effect(() => {
		publishToGlobalFormState({ item, value: selected });
	});

	function onblur() {
		touched = true;
	}
</script>

<div class="field-container checkbox-group-field">
	<PrintRow {item} {printing} {labelText} value={printValue} />

	<div id={item.uuid} class="web-input" class:visible={!printing && item.visible_web !== false}>
		<FormGroup
			{...filterAttributes(filteredAttributes)}
			id={item.uuid}
			class={item.class}
			name={item.uuid}
			role="checkboxgroup"
			data-selected={selected}
			{...a11y.ariaProps}
			{...extAttrs as any}
		>
			<legend class="bx--label">
				<span
					id={a11y.labelId}
					class:bx--visually-hidden={hideLabel}
					class:required={item.is_required}
					class:moustache={enableVarSub}>{@html labelText}</span
				>
			</legend>

			{#each options as opt (opt.value)}
				<Checkbox
					id={`${item.uuid}-${opt.value}`}
					value={opt.value}
					checked={selected.includes(opt.value)}
					disabled={readOnly}
					on:change={(e) => handleCheckboxChange(opt.value)}
					on:blur={onblur}
					role="checkbox"
					aria-checked={selected.includes(opt.value) ? 'true' : 'false'}
					aria-labelledby={`${a11y.labelId} ${item.uuid}-${opt.value}-label`}
				>
					<span
						slot="labelChildren"
						id={`${item.uuid}-${opt.value}-label`}
						class:moustache={enableVarSub}
					>
						{opt.label}
					</span>
				</Checkbox>
			{/each}
		</FormGroup>

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
	:global(.bx--fieldset) {
		margin: 0;
		border: 0;
		padding: 0;
	}
	:global(.web-input .bx--checkbox-wrapper) {
		margin-top: 0.5rem;
	}
	.required::after {
		content: ' *';
		color: var(--cds-support-error);
	}
</style>
