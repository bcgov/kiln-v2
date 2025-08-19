<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
	import { filterAttributes } from '$lib/utils/helpers';

	let { item, printing = false }: { item: Item; printing?: boolean; [key: string]: any } = $props();
	let labelText = $derived(item.attributes?.text ?? item.name);
	let readonly = $state(item.is_read_only ?? false);
</script>

{#if !printing && item.visible_web !== false && readonly !== true}
	<div class="field-container button-field no-print">
		<Button class={item.class} {...filterAttributes(item?.attributes)}>{labelText}</Button>
	</div>
{/if}
