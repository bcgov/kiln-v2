<script lang="ts">
	import ExternalPreviewPage from '../ExternalPreviewPage.svelte';
	import { page } from '$app/state';

	let id = $state(page.params.id ?? '');
</script>

<ExternalPreviewPage {id} />

<style>
	:global(body) {
		font-family: 'BC Sans', sans-serif;
	}
</style>
