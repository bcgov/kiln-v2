<script lang="ts">
	import type { Item } from '$lib/types/form';
	import type { Snippet } from 'svelte';
	import { buildFieldAria } from '$lib/utils/helpers';

	const {
		item,
		printing = false,
		labelText = '',
		value
	} = $props<{
		item: Item;
		printing?: boolean;
		labelText?: string;
		value?: string | HTMLElement | Snippet;
	}>();

	const valueId = `${item.uuid}-print-value`;
	const a11y = buildFieldAria({
		uuid: item.uuid,
		labelText,
		includeLabelledBy: true
	});

	const groupAria = {
		...a11y.ariaProps,
		'aria-describedby': valueId
	};
</script>

<div
	class="print-row"
	class:visible={printing && item.visible_pdf !== false}
	id={printing && item.visible_pdf !== false ? item.uuid : undefined}
	role="group"
	{...groupAria}
	aria-hidden={!printing || item.visible_pdf === false}
>
	<div class="print-label" class:required={item.is_required} id={a11y.labelId}>{@html labelText}</div>
	<div class="print-value" id={valueId}>
		{#if typeof value === 'function'}
			{@render value()}
		{:else if typeof value === 'string'}
			{@html value}
		{:else if value}
			{value}
		{/if}
	</div>
</div>
