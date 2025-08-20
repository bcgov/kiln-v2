<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
	import { filterAttributes } from '$lib/utils/helpers';
	import { syncExternalAttributes } from '$lib/utils/valueSync';

	let { item, printing = false }: { item: Item; printing?: boolean; [key: string]: any } = $props();
	let labelText = $derived(item.attributes?.text ?? item.name);
	let readonly = $state(item.is_read_only ?? false);

	let extAttrs = $state<Record<string, any>>({});

	$effect(() => {
		return syncExternalAttributes({
			item,
			get: () => extAttrs,
			set: (next) => {
				extAttrs = next;
			}
		});
	});
</script>

{#if !printing && item.visible_web !== false && readonly !== true}
	<div class="field-container button-field no-print">
		<Button
			{...filterAttributes(item?.attributes)}
			{...extAttrs as any}
			id={item.uuid}
			class={item.class}>{labelText}</Button
		>
	</div>
{/if}
