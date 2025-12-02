<script lang="ts">
	import '$lib/components/formfields/fields.css';

	import type { Item } from '$lib/types/form';
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
		item,
		mode,
		printing = false
	}: {
		item: Item;
		mode: string;
		printing?: boolean;
	} = $props();

	const componentMap: Record<string, any> = {
		'text-input': TextInput,
		'checkbox-input': Checkbox,
		'date-picker': DatePicker,
		'date-select-input': DatePicker,
		'text-area': TextArea,
		'textarea-input': TextArea,
		'button-input': Button,
		'number-input': NumberInput,
		'text-info': TextInfo,
		'radio-input': RadioButton,
		'select-input': Select,
		container: Container
	};

	let Component = $derived(componentMap[item.type]);
</script>

{#if Component}
	<Component {item} {mode} {printing} />
{/if}
