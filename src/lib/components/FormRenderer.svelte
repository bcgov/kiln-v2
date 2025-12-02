<script lang="ts">
	import '$lib/components/formfields/fields.css';

	import type { Item, Template } from '$lib/types/form';
	import FieldRenderer from './FieldRenderer.svelte';
	import { isFieldVisible } from '$lib/utils/form';

	let {
		formData,
		mode,
		printing = false
	} = $props<{
		formData: Template | any;
		mode: string;
		printing?: boolean;
	}>();

	let elements = $derived.by(() => {
		const result = formData?.elements ?? formData?.data ?? [];
		return result;
	});

	let printingState = $derived(printing);
	const viewMode: 'web' | 'pdf' = $derived(printingState ? 'pdf' : 'web');
</script>

<div class="form-renderer" class:printing={printingState}>
	{#each elements as item (item.uuid)}
		{#if isFieldVisible(item, viewMode)}
			<FieldRenderer {item} {mode} printing={printingState} />
		{/if}
	{/each}
</div>
