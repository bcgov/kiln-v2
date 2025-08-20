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
	import { requiredLabel, filterAttributes } from '$lib/utils/helpers';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
	}>();

	let selected = $state(
		item?.value ?? item.attributes?.selected ?? item.attributes?.defaultSelected ?? ''
	);
	let error = $state(item.attributes?.error ?? '');
	let readonly = $state(item.is_read_only ?? false);
	let labelText = requiredLabel(item.attributes?.labelText ?? '', item.is_required ?? false);
	let helperText = item.help_text ?? item.description ?? '';
	let options = item.options ?? [];
	let touched = $state(false);

	let extAttrs = $state<Record<string, any>>({});

	const rules = $derived.by(() =>
		rulesFromAttributes(item.attributes, { is_required: item.is_required, type: 'string' })
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
</script>

<div class="field-container radio-button-field">
	<div
		class="print-row"
		class:visible={printing && item.visible_pdf !== false}
		id={printing && item.visible_pdf !== false ? item.uuid : undefined}
	>
		<div class="print-label">{@html labelText}</div>
		<div class="print-value">
			{#each options as opt}
				<div
					class="bx--radio-button-wrapper"
					style="display: flex; align-items: center; gap: 10px;"
				>
					<div>{selected === opt.value ? '◉' : '○'}</div>
					<div>{opt.label}</div>
				</div>
			{/each}
		</div>
	</div>

	<div
		class="web-input"
		style={readonly ? 'pointer-events: none;' : ''}
		class:visible={!printing && item.visible_web !== false}
	>
		<RadioButtonGroup
			{...filterAttributes(item?.attributes)}
			{...extAttrs as any}
			id={item.uuid}
			class={item.class}
			name={item.uuid}
			bind:selected
			role="radiogroup"
			data-selected={selected}
			{onchange}
		>
			<span slot="legendText">{@html labelText}</span>

			{#each options as opt, index}
				<RadioButton value={opt.value} labelText={opt.label} id={`${item.uuid}-option-${index}`} />
			{/each}
		</RadioButtonGroup>
		{#if helperText}
			<div class="helper-text">{helperText}</div>
		{/if}
		{#if anyError}
			<div class="invalid-text">{anyError}</div>
		{/if}
	</div>
</div>
