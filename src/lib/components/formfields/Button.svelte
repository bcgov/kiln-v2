<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
	import { filterAttributes } from '$lib/utils/helpers';
	import { syncExternalAttributes } from '$lib/utils/valueSync';
	import { buildFieldAria } from '$lib/utils/helpers';

	let { item, printing = false }: { item: Item; printing?: boolean; [key: string]: any } = $props();
	let labelText = $derived(item.attributes?.text ?? '');
	let readonly = $state(item.is_read_only ?? false);

	let extAttrs = $state<Record<string, any>>({});
	let ariaLabel = $derived(labelText || item.name || 'button');
	const a11y = $derived.by(() =>
		buildFieldAria({
			uuid: item.uuid,
			labelText,
			includeLabelledBy: false
		})
	);

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
			class={item.class}
			aria-label={ariaLabel}
			role="button"
			{...a11y.ariaProps}
		>
			{labelText}
		</Button>
	</div>
{/if}
