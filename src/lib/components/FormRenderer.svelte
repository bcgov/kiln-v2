<script lang="ts">
	import '$lib/components/formfields/fields.css';

	import type { Template } from '$lib/types/form';
	import FieldRenderer from './FieldRenderer.svelte';

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
		<FieldRenderer {item} {mode} printing={printingState} />
	{/each}
</div>
