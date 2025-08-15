<script lang="ts">
	import favicon from '$lib/assets/kiln.svg';
	import type { CarbonTheme } from 'carbon-components-svelte/src/Theme/Theme.svelte';
	import './page.css';
	import { Theme } from 'carbon-components-svelte';
	import 'carbon-components-svelte/css/all.css';
	let { children } = $props();

	let theme: CarbonTheme = $state('white'); // "white" | "g10" | "g80" | "g90" | "g100"

	$effect(() => {
		// const storedTheme = (localStorage.getItem('theme') as CarbonTheme) || 'white';
		// theme = storedTheme;
		document.documentElement.setAttribute('theme', theme);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Theme bind:theme persist persistKey="__carbon-theme" />

{@render children()}
