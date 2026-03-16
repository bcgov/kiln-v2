<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import { Add, TrashCan } from 'carbon-icons-svelte';
	import FieldRenderer from '../FieldRenderer.svelte';
	import type { Item } from '$lib/types/form';
	import { computeIsReadOnly } from '$lib/utils/helpers';
	import { validateValue, rulesFromAttributes } from '$lib/utils/validation';

	let {
		item,
		mode,
		printing = false
	}: {
		item: Item;
		mode: string;
		printing?: boolean;
	} = $props();

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	// Compute effective read-only from enum value
	const isReadOnly = $derived.by(() => computeIsReadOnly(item.is_read_only, isPortalIntegrated));

	// Fall back for crypto.randomUUID (not available in insecure contexts like host.docker.internal)
	function generateUUID(): string {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	const minRepeats = $derived(item.attributes?.minRepeats ?? 1);
	const maxRepeats = $derived(item.attributes?.maxRepeats ?? Infinity);

	// Initialize groups based on existing data or create the minimum required empty groups
	let groups = $state(initializeGroups());

	function initializeGroups() {
		// Use saved data if present
		if (item.repeaterData && Array.isArray(item.repeaterData) && item.repeaterData.length > 0) {
			const loaded = item.repeaterData.map((data, index) => ({
				id: generateUUID(),
				data,
				index
			}));

			// If saved data is fewer than minRepeats, auto-add extra blank groups
			while (loaded.length < minRepeats) {
				loaded.push({
					id: generateUUID(),
					data: {},
					index: loaded.length
				});
		}

			return loaded;
		}

		// Otherwise create minRepeats empty groups
		return Array.from({ length: minRepeats }, (_, i) => ({
			id: generateUUID(),
			data: {},
			index: i
		}));
	}


	const rules = $derived({
		...rulesFromAttributes(item.attributes, { type: 'container' })
	});

	const anyError = $derived.by(() => {
		return (
			validateValue(groups.length, rules, {
				type: 'container',
				fieldLabel: item.attributes?.labelText ?? item.name
			}).firstError ?? ''
		);
	});

	function win(): any | undefined {
		return typeof window === 'undefined' ? undefined : (window as any);
	}

	function activeGroupIds(): string[] {
		return groups.map((g) => g.id);
	}

	function containerKey(): string {
		return (item as any)._containerInstanceKey ?? item.uuid;
	}

	function syncActiveGroupsRegistry() {
		const w = win();
		if (!w) return;
		w.__kilnActiveGroups = w.__kilnActiveGroups || {};
		const registryKey = (item as any)._containerInstanceKey ?? item.uuid;
		w.__kilnActiveGroups[registryKey] = activeGroupIds();
	}

	function cleanupStaleFormState() {
		const w = win();
		if (!w) return;
		const state: Record<string, any> = (w.__kilnFormState = w.__kilnFormState || {});
		const prefix = `${containerKey()}-`;
		const active = new Set(activeGroupIds());

		const childUuids = new Set((item.children || []).map((c) => c.uuid));
		for (const key of Object.keys(state)) {
			if (!key.startsWith(prefix)) continue;
			// key format for repeatable children is: <containerUuid>-<groupId>-<childUuid>
			const rest = key.slice(prefix.length);
			const matchedChildUuid = [...childUuids].find((cu) => key.endsWith(`-${cu}`));
			if (!matchedChildUuid) continue;
			const suffix = `-${matchedChildUuid}`;
			const groupId = rest.slice(0, rest.length - suffix.length);
			if (!active.has(groupId)) {
				delete state[key];
			}
		}

		// Also reset per-container computed group rows so validators won’t use stale rows
		w.__kilnGroupState = w.__kilnGroupState || {};
		w.__kilnGroupState[item.uuid] = [];
	}

	// Use $effect.pre() to prevent race condition where child fields initialize before seeing preloaded data
	$effect.pre(() => {
		syncActiveGroupsRegistry();
		syncInitialGroupDataToFormState();
	});

	$effect(() => {
		cleanupStaleFormState();
	});

	// write initial group data into global form state under stable keys
	function syncInitialGroupDataToFormState() {
		const w = win();
		if (!w) return;
		const state: Record<string, any> = (w.__kilnFormState = w.__kilnFormState || {});
		for (const group of groups) {
			for (const child of children) {
				const originalUuid = child.uuid;
				const v = group?.data?.[originalUuid];
				if (v !== undefined) {
					const stableKey = `${containerKey()}-${group.id}-${originalUuid}`;
					if (state[stableKey] === undefined) {
						state[stableKey] = v;
					}
				}
			}
		}
	}

	function addGroup() {
		if (groups.length >= maxRepeats) return; // prevent exceeding max

		const newGroup = {
			id: generateUUID(),
			data: {},
			index: groups.length
		};
		groups.push(newGroup);
		groups = groups;

		// keep registry in sync
		syncActiveGroupsRegistry();
	}

	function removeGroup(index: number) {
		if (groups.length <= minRepeats) return; // prevent going below min

		groups.splice(index, 1);
		groups = groups.map((group, idx) => ({ ...group, index: idx }));

		// update registry and purge any stale keys that belonged to the removed group
		syncActiveGroupsRegistry();
		cleanupStaleFormState();
	}

	function getGroupSpecificChildren(group: { id: string; data: any; index: number }) {
		const isContainer = (item: any) => item?.type === 'container' && Array.isArray(item?.children);
		const isRepeatableContainer = (item: any) =>
			isContainer(item) && item?.attributes?.isRepeatable === true;
		const parentKey = containerKey();

		function attachNestedRepeaterData(item: any): any {
			const copy = { ...item };

			if (isRepeatableContainer(copy) && Array.isArray(group.data[copy.uuid])) {
				copy._containerInstanceKey = `${parentKey}-${group.id}-${copy.uuid}`;

				if (Array.isArray(group.data[copy.uuid])) {
					copy.repeaterData = group.data[copy.uuid];
				}

				return copy;
			}

			if (Array.isArray(copy.children)) {
				copy.children = copy.children.map(attachNestedRepeaterData);
			}

			return copy;
		}

		return children.map((child) => {
			const originalUuid = child.uuid;
			// Generate stable and index-specific UUIDs for the child
			// This allows the child to be uniquely identified within the group
			// while maintaining a consistent key across renders
			const stableId = `${containerKey()}-${group.id}-${originalUuid}`;
			const indexUuid = `${containerKey()}-${group.index}-${originalUuid}`;

			const groupSpecificChild = {
				...child,
				originalUuid,
				_stableKey: stableId,
				_indexUuid: indexUuid
			};

			//direct nested repeater container
			if (isRepeatableContainer(child) && Array.isArray(group.data[originalUuid])) {
				groupSpecificChild.repeaterData = group.data[originalUuid];
				(groupSpecificChild as any)._containerInstanceKey =
					`${containerKey()}-${group.id}-${originalUuid}`;
				return groupSpecificChild;
			}

			//non-repeatable container: bind nested repeaters inside it
			if (isContainer(child) && !isRepeatableContainer(child)) {
				return attachNestedRepeaterData(groupSpecificChild);
			}

			//Regular field value
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
		fieldset: 'border: 1px solid var(--border-color, #ccc); padding: 15px; border-radius: 5px;',
		page: 'padding: 2rem; background: #f9f9f9;',
		header: 'background: #e8f0fe; font-weight: bold;',
		footer: 'background: #f1f1f1; font-style: italic;'
	};

	type ContainerType = keyof typeof containerTypeClassMap;

	let containerType: ContainerType = $derived(
		(item.attributes?.containerType as ContainerType) ?? 'section'
	);
	let containerClass = $derived(containerTypeClassMap[containerType] ?? 'container-section');
	let containerStyle = $derived(containerTypeStyleMap[containerType] ?? '');

	const legendId = `${item.uuid}-legend`;
	const errorId = `${item.uuid}-error`;

	const isVisible = $derived(
		(!printing && item.visible_web !== false) || (printing && item.visible_pdf !== false)
	);
</script>

{#if isRepeatable}
	<fieldset
		class="container-repeatable container-group {containerClass} {item.class}"
		class:printing
		class:visible={isVisible}
		style={containerStyle}
		id={item.uuid}
		aria-labelledby={legend ? legendId : undefined}
	>
		{#if legend}
			<legend id={legendId}>
				{@html `<h${level}>${legend}</h${level}>`}
			</legend>
		{/if}
		{#each groups as group, idx (group.id)}
			<div
				class="group-item-container"
				role="group"
				aria-label={`${repeaterItemLabel || 'Group'} ${idx + 1}`}
			>
				{#if !printing}
					<div class="group-item-header">
						<span
							>{repeaterItemLabel}
							{repeaterItemLabel ? idx + 1 : ' '}</span
						>
						{#if groupCount > minRepeats && !item.is_read_only}
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
						{repeaterItemLabel ? idx + 1 : ' '}
					</div>
				{/if}
				<div class="group-fields-grid">
					{#each getGroupSpecificChildren(group) as child (child._stableKey)}
						{@const fieldItem =
							child.type === 'container'
								? child
								: {
										...child,
										uuid: child._stableKey,
										attributes: {
											...(child.attributes || {}),
											id: child._stableKey
										}
									}}
						<div
							class={child.type === 'container'
								? 'group-item-child-container'
								: 'group-item-child-field'}
							style={applyWrapperStyles(child)}
							data-print-columns={child.visible_pdf || 1}
						>
							<FieldRenderer item={fieldItem} {mode} {printing} />
						</div>
					{/each}
				</div>
			</div>
		{/each}
		{#if !printing && !isReadOnly && isRepeatable}
			<div class="custom-buttons-only">
				<Button
					kind="ghost"
					onclick={addGroup}
					icon={Add}
					class="no-print"
					disabled={groups.length >= maxRepeats}>Add another</Button
				>

				{#if anyError}
					<div
						id={errorId}
						class="bx--form-requirement"
						class:moustache={enableVarSub}
						role="alert"
					>
						{anyError}
					</div>
				{/if}
			</div>
		{/if}
	</fieldset>
{:else}
	<fieldset
		id={item.uuid}
		class="container-regular container-group {containerClass} {item.class}"
		class:printing
		class:visible={isVisible}
		style={containerStyle}
		aria-labelledby={legend ? legendId : undefined}
	>
		{#if legend}
			<legend id={legendId} class:moustache={enableVarSub}>
				{@html `<h${level}>${legend}</h${level}>`}
			</legend>
		{/if}
		<div class="container-fields-grid">
			{#each children as child (child.uuid)}
				<div
					class={child.type === 'container'
						? 'group-item-child-container'
						: 'group-item-child-field'}
					style={applyWrapperStyles(child)}
					data-print-columns={child.visible_pdf || 1}
				>
					<FieldRenderer item={child} {mode} {printing} />
				</div>
			{/each}
		</div>
	</fieldset>
{/if}

<style>
	/* Fieldset container - border styling handled by containerTypeStyleMap */
	.container-fieldset {
		margin-bottom: 20px;
	}

	/* Section container - no border, just spacing */
	.container-section {
		border: none;
		padding: 0;
		margin-bottom: 20px;
	}
	:global(.bx--btn--ghost:disabled) {
		opacity: 0.5;
	}

	@media print {
		/* Do not draw boxes around groups in print; just manage spacing */
		.container-group.printing {
			border: none !important;
			margin: 0 0 0.5rem 0;
		}

		/* Reduce printed legend size and remove heavy background */
		.container-group.printing legend {
			background-color: transparent !important;
			padding: 0 0 4px 0;
			font-weight: 600;
			font-size: 13px;
			border: 0;
			break-after: avoid;
		}

		/* Group item header: bold only, no boxy backgrounds/borders */
		.print-group-header {
			background-color: transparent !important;
			padding: 0 0 2px 0;
			font-weight: 700;
			font-size: 12px;
			border: 0;
			break-after: avoid;
		}

		.group-item-container {
			margin-bottom: 0.5rem;
		}

		.group-item-child-field {
			&:first-child {
				break-after: avoid;
			}
			/* Can improve cases where a special item is at the bottom of a list, but causes more gaps */
			/* &:last-child {
				break-before: avoid;
			} */
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
