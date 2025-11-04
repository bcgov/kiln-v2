<script lang="ts">
	import favicon from '$lib/assets/kiln.svg';
	import type { CarbonTheme } from 'carbon-components-svelte/src/Theme/Theme.svelte';
	import './page.css';
	import { Theme } from 'carbon-components-svelte';
	import 'carbon-components-svelte/css/all.css';
	import { browser } from '$app/environment';
	let { children } = $props();

	let theme: CarbonTheme = $state('white'); // "white" | "g10" | "g80" | "g90" | "g100"

	// Initialize default username cookie for standalone mode
	if (browser && import.meta.env.VITE_STANDALONE_MODE === 'true') {
		const hasUsername = document.cookie.match(/(?:^|;\s*)username=([^;]+)/);
		if (!hasUsername) {
			const defaultUsername = import.meta.env.VITE_DEFAULT_USERNAME || 'testuser';
			document.cookie = `username=${encodeURIComponent(defaultUsername)}; path=/; SameSite=Lax`;
			console.log(`[Standalone Mode] Set default username: ${defaultUsername}`);
		}
	}

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
