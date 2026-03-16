<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import type { Item } from '$lib/types/form';
	import {
		filterAttributes,
		getFieldLabel,
		computeIsReadOnly,
		buildFieldAria
	} from '$lib/utils/helpers';
	import { syncExternalAttributes } from '$lib/utils/valueSync';

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	const { item, printing = false } = $props<{
		item: Item;
		printing?: boolean;
		[key: string]: any;
	}>();
	const labelText = $derived(getFieldLabel(item));
	const enableVarSub = $derived(item.attributes?.enableVarSub ?? false);
	const readonly = $state(computeIsReadOnly(item.is_read_only, isPortalIntegrated));

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

<div
	class="field-container button-field no-print"
	class:visible={!printing && item.visible_web !== false && !readonly}
	class:moustache={enableVarSub}
>
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
