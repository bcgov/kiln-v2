<script lang="ts">
	import type { Item } from '$lib/types/form';
	import './fields.css';

	const { item } = $props<{ item: Item }>();
</script>

<div class="field-container text-info-field {item.class}" id={item.uuid}>
	{#if item.attributes?.labelText}
		<div class="text-info-label">{item.attributes.labelText}</div>
	{/if}
	{#if item.attributes?.helperText}
		<div class="text-info-helper">{item.attributes.helperText}</div>
	{/if}
	{@html item?.attributes?.content}
</div>

<style>
	.text-info-field {
		padding: 10px 0px;
		font: initial;
		font-weight: initial;
		font-size: initial;
		font-family: initial;
		font-weight: normal;
		font-family: var(--default-font-family);
		font-size: var(--default-font-size);
	}
</style>
