<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import { Add, TrashCan } from 'carbon-icons-svelte';
	import FormRenderer from '../FormRenderer.svelte';
	import type { Item } from '$lib/types/form';

	let {
		item,
		mode,
		printing = false
	}: {
		item: Item;
		mode: string;
		printing?: boolean;
	} = $props();

	// Initialize groups based on existing data or create one empty group
	let groups = $state(initializeGroups());

	function initializeGroups() {
		// Check for save data
		if (item.repeaterData && Array.isArray(item.repeaterData) && item.repeaterData.length > 0) {
			return item.repeaterData.map((data, index) => ({
				id: crypto.randomUUID(),
				data: data,
				index: index
			}));
		}
		return [{ id: crypto.randomUUID(), data: {}, index: 0 }];
	}

	let isRepeatable = $derived(item.attributes?.isRepeatable === true);
	let legend = $derived(item.attributes?.legend ?? item.name);
	let level = $derived(item.attributes?.level ?? 2);
	let repeaterItemLabel = $derived(item.attributes?.repeater_item_label ?? item.name);
	let children = $derived(item.children ?? []);
	let groupCount = $derived(groups.length);

	function addGroup() {
		const newGroup = {
			id: crypto.randomUUID(),
			data: {},
			index: groups.length
		};
		groups.push(newGroup);
		groups = groups;
	}

	function removeGroup(index: number) {
		if (groups.length <= 1) return;
		groups.splice(index, 1);
		groups = groups.map((group, idx) => ({ ...group, index: idx }));
	}

	function getGroupSpecificChildren(group: { id: string; data: any; index: number }) {
		return children.map((child) => {
			const originalUuid = child.uuid;
			// Generate stable and index-specific UUIDs for the child
			// This allows the child to be uniquely identified within the group
			// while maintaining a consistent key across renders
			const stableKey = `${item.uuid}-${group.id}-${originalUuid}`;
			const indexUuid = `${item.uuid}-${group.index}-${originalUuid}`;

			const groupSpecificChild = {
				...child,
				originalUuid,
				_stableKey: stableKey,
				_indexUuid: indexUuid
			};

			if (group.data && group.data[originalUuid] !== undefined) {
				groupSpecificChild.value = group.data[originalUuid];
				if (groupSpecificChild.attributes) {
					groupSpecificChild.attributes = {
						...groupSpecificChild.attributes,
						value: group.data[originalUuid]
					};
				}
			}

			return groupSpecificChild;
		});
	}

	function applyWrapperStyles(child: Item): string | null | undefined {
		return typeof child.visible_web === 'string' ? child.visible_web : undefined;
	}

	// Map container_type to class names and optional styles
	const containerTypeClassMap = {
		section: 'container-section',
		fieldset: 'container-fieldset',
		page: 'container-page',
		header: 'container-header',
		footer: 'container-footer'
	};

	const containerTypeStyleMap = {
		section: '',
		fieldset: '',
		page: 'padding: 2rem; background: #f9f9f9;',
		header: 'background: #e8f0fe; font-weight: bold;',
		footer: 'background: #f1f1f1; font-style: italic;'
	};

	type ContainerType = keyof typeof containerTypeClassMap;

	let containerType: ContainerType = $derived(
		(item.attributes?.container_type as ContainerType) ?? 'fieldset'
	);
	let containerClass = $derived(containerTypeClassMap[containerType] ?? 'container-fieldset');
	let containerStyle = $derived(containerTypeStyleMap[containerType] ?? '');
</script>

{#if isRepeatable}
	<fieldset
		class="container-repeatable container-group {containerClass} {item.class}"
		class:printing
		style={containerStyle}
	>
		{#if legend}
			<legend>
				{@html `<h${level}>${legend}</h${level}>`}
			</legend>
		{/if}
		{#each groups as group, idx (group.id)}
			<div class="group-item-container">
				{#if !printing}
					<div class="group-item-header">
						{repeaterItemLabel}
						{idx + 1}
						{#if groupCount > 1 && !item.is_read_only}
							<Button
								kind="ghost"
								onclick={() => removeGroup(idx)}
								icon={TrashCan}
								class="no-print"
								style="margin-left: 1rem;"
							>
								Remove
							</Button>
						{/if}
					</div>
				{:else}
					<div class="print-group-header">
						{repeaterItemLabel}
						{idx + 1}
					</div>
				{/if}
				<div
					class="group-fields-grid"
					style="display: grid; grid-template-columns: repeat(1, 1fr);"
				>
					{#each getGroupSpecificChildren(group) as child (child._stableKey)}
						<div style={applyWrapperStyles(child)} data-print-columns={child.visible_pdf || 1}>
							<FormRenderer
								formData={{
									elements: [
										{
											...child,
											uuid: child._stableKey,
											attributes: {
												...(child.attributes || {}),
												id: child._indexUuid,
												name: child._indexUuid
											}
										}
									]
								}}
								{mode}
								{printing}
							/>
						</div>
					{/each}
				</div>
			</div>
		{/each}
		{#if !printing && !item.is_read_only && isRepeatable}
			<div class="custom-buttons-only">
				<Button kind="ghost" onclick={addGroup} icon={Add} class="no-print">Add another</Button>
			</div>
		{/if}
	</fieldset>
{:else}
	<fieldset
		class="container-regular container-group {containerClass} {item.class}"
		class:printing
		style={containerStyle}
	>
		{#if legend}
			<legend>
				{@html `<h${level}>${legend}</h${level}>`}
			</legend>
		{/if}
		<div
			class="container-fields-grid"
			style="display: grid; grid-template-columns: repeat(1, 1fr);"
		>
			{#each children as child (child.uuid)}
				<div style={applyWrapperStyles(child)} data-print-columns={child.visible_pdf || 1}>
					<FormRenderer formData={{ elements: [child] }} {mode} {printing} />
				</div>
			{/each}
		</div>
	</fieldset>
{/if}

<style>
	.container-group {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 1rem;
	}

	/* Container type classes */
	/* .container-section {
		border: 2px solid #1976d2;
		border-radius: 6px;
		padding: 1.5rem;
		background: #f5faff;
	}
	.container-fieldset {
		border: 1px solid #ccc;
		border-radius: 4px;
		padding: 1rem;
	}
	.container-page {
		border: none;
		background: #f9f9f9;
		padding: 2rem;
	}

	.container-header {
		border-bottom: 2px solid #1976d2;
		background: #e8f0fe;
		font-weight: bold;
		padding: 1rem 1rem 0.5rem 1rem;
	}
	.container-footer {
		border-top: 1px solid #ccc;
		background: #f1f1f1;
		font-style: italic;
		padding: 0.5rem 1rem 1rem 1rem;
	} */

	@media print {
		/* Do not draw boxes around groups in print; just manage spacing */
		.container-group.printing {
			border: none !important;
			margin: 0 0 0.5rem 0;
			page-break-inside: avoid;
		}

		/* Reduce printed legend size and remove heavy background */
		.container-group.printing legend {
			background-color: transparent !important;
			padding: 0 0 4px 0;
			font-weight: 600;
			font-size: 13px;
			border: 0;
		}

		/* Group item header: bold only, no boxy backgrounds/borders */
		.print-group-header {
			background-color: transparent !important;
			padding: 0 0 2px 0;
			font-weight: 700;
			font-size: 12px;
			border: 0;
		}

		.group-item-container {
			margin-bottom: 0.5rem;
		}

		/* Ensure container-page is on its own page in print */
		.container-page {
			page-break-before: always;
			page-break-after: always;
			break-before: page;
			break-after: page;
		}
	}
</style>
