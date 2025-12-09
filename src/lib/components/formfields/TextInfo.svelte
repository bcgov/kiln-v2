<!--
	TextInfo Component

	Renders static text/HTML content defined in form JSON.
	This component is used for the "Content Footer" (custom footer with
	ministry info, contact details, etc.) when a text-info field is added
	to the form definition.
-->
<script lang="ts">
	import type { Item } from '$lib/types/form';
	import './fields.css';

	const { item } = $props<{ item: Item }>();
	const labelId = `${item.uuid}-info-label`;
	const labelText = item.attributes?.labelText ?? item.attributes?.text ?? '';
</script>

<div
	class="field-container text-info-field {item.class}"
	id={item.uuid}
	role="note"
	aria-labelledby={labelText ? labelId : undefined}
>
	{#if labelText}
		<div class="text-info-label" id={labelId}>{labelText}</div>
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
