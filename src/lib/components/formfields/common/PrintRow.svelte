<script lang="ts">
	import type { Item } from '$lib/types/form';
	import type { Snippet } from 'svelte';

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
</script>

<div
	class="print-row"
	class:visible={printing && item.visible_pdf !== false}
	id={printing && item.visible_pdf !== false ? item.uuid : undefined}
>
	<div class="print-label" class:required={item.is_required}>{@html labelText}</div>
	<div class="print-value">
		{#if typeof value === 'function'}
			{@render value()}
		{:else if typeof value === 'string'}
			{@html value}
		{:else if value}
			{value}
		{/if}
	</div>
</div>
