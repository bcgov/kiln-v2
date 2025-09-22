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
	import { onMount, onDestroy } from 'svelte';

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

  const getLetter = () => document.querySelector<HTMLElement>('.letter-content');

  function setLetterMode(on: boolean) {
    const html = document.documentElement;
    html.classList.toggle('letter-mode', on);
    const letter = getLetter();
    if (letter) letter.hidden = !on;
  }

  function installToggleDelegate() {
    // start with form view
    queueMicrotask(() => { const l = getLetter(); if (l) l.hidden = true; });

    const onClick = (e: Event) => {
      const btn = (e.target as HTMLElement)?.closest('button,[role="button"]') as HTMLElement | null;
      if (!btn) return;
      const label = (btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
      if (label === 'show letter') { setLetterMode(true);  btn.textContent = 'Show Form'; }
      if (label === 'show form')   { setLetterMode(false); btn.textContent = 'Show Letter'; }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }

  function bindPrintHooks() {
    window.onbeforeprint = () => setLetterMode(true);
    window.onafterprint  = () => setLetterMode(false);
  }

  let cleanup: (() => void) | null = null;
  onMount(() => {
    cleanup = installToggleDelegate();
    bindPrintHooks();
  });
  onDestroy(() => { cleanup?.(); window.onbeforeprint = null; window.onafterprint = null; });
</script>

{#snippet renderComponent(item: Item)}
	{@const Component = componentMapping[item.type]}
	{#if Component}
		<Component {item} {mode} printing={printingState} />
	{/if}
{/snippet}

<div class="form-renderer" class:printing={printingState}>
	{#each elements as item (item.uuid)}
		<div data-print-columns={1}>
			{@render renderComponent(item)}
		</div>
	{/each}
</div>
