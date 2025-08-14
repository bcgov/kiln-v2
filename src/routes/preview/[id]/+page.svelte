<script lang="ts">
	import ExternalPreviewPage from '../ExternalPreviewPage.svelte';
	import { page } from '$app/state';

	let id = $state(
		page.params.id ??
			page.url?.searchParams?.get('id') ??
			page.url?.pathname?.split('/').filter(Boolean).pop() ??
			''
	);
</script>

<ExternalPreviewPage {id} />

<style>
	:global(body) {
		font-family: 'BC Sans', sans-serif;
	}
</style>
