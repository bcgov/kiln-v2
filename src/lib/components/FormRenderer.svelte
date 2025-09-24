<script lang="ts">
	import '$lib/components/formfields/fields.css';

	import type { Item, Template } from '$lib/types/form';
	import Button from './formfields/Button.svelte';
	import Checkbox from './formfields/Checkbox.svelte';
	import Container from './formfields/Container.svelte';
	import DatePicker from './formfields/DatePicker.svelte';
	import NumberInput from './formfields/NumberInput.svelte';
	import RadioButton from './formfields/RadioButton.svelte';
	import Select from './formfields/Select.svelte';
	import TextArea from './formfields/TextArea.svelte';
	import TextInfo from './formfields/TextInfo.svelte';
	import TextInput from './formfields/TextInput.svelte';

	let {
		formData,
		mode,
		printing = false
	} = $props<{
		formData: Template | any;
		mode: string;
		printing?: boolean;
	}>();

	const baseMapping = {
		'text-input': TextInput,
		'checkbox-input': Checkbox,
		'date-picker': DatePicker,
		'text-area': TextArea,
		'button-input': Button,
		'number-input': NumberInput,
		'text-info': TextInfo,
		'radio-input': RadioButton,
		'select-input': Select,
		container: Container
	};

	// Remove all the complex state management
	function withAliases<T>(map: Record<string, T>, aliases: Record<string, string>) {
		for (const [alias, orig] of Object.entries(aliases)) {
			map[alias] = map[orig];
		}
		return map;
	}

	const componentMapping = withAliases(baseMapping, {
		'date-select-input': 'date-picker',
		'textarea-input': 'text-area'
	});

	let elements = $derived.by(() => {
		const result = formData?.elements ?? [];
		return result;
	});

	let printingState = $derived(printing);
</script>

{#snippet renderComponent(item: Item)}
	{@const Component = componentMapping[item.type]}
	{#if Component}
		<Component {item} {mode} printing={printingState} />
	{/if}
{/snippet}

<div class="form-renderer" class:printing={printingState}>
	{#each elements as item (item.uuid)}
		<!-- Note: The JSON scripts require exact element IDs (e.g., FORM_CONTAINER, toggle button, etc.). -->
		<!-- Try wrapping each component with a div carrying id=item.uuid so selectors like getElementById(...) work. -->
		<div id={item.type === 'container' ? item.uuid : undefined} class="ff-item" data-ff-type={item.type} data-print-columns={1} data-uuid={item.uuid}>
			{@render renderComponent(item)}
		</div>
	{/each}
</div>
