<script lang="ts">
	import { browser } from '$app/environment';

	let {
		styles = [],
		scripts = [],
		mode = 'edit'
	} = $props<{
		styles?: Array<{ type: string; content: string }>;
		scripts?: Array<{ type: string; content: string }>;
		mode?: string;
	}>();

	$effect(() => {
		if (!browser) return;

		// Remove previously injected elements
		document.querySelectorAll('style[data-ssi], script[data-ssi]').forEach((el) => el.remove());

		// Inject all styles
		styles?.forEach(({ content }: { content: string }, idx: number) => {
			if (!content) return;
			const styleEl = document.createElement('style');
			styleEl.setAttribute('data-ssi', 'true');
			styleEl.id = `ssi-style-${idx}`;
			styleEl.textContent = content;
			document.head.appendChild(styleEl);
		});

		// Inject all scripts only if not in view mode
		if (mode !== 'view') {
			scripts?.forEach(({ content }: { content: string }, idx: number) => {
				if (!content) return;
				const scriptEl = document.createElement('script');
				scriptEl.setAttribute('data-ssi', 'true');
				scriptEl.id = `ssi-script-${idx}`;
				scriptEl.textContent = content;
				document.head.appendChild(scriptEl);
			});
		}

		// Cleanup function
		return () => {
			document.querySelectorAll('style[data-ssi], script[data-ssi]').forEach((el) => el.remove());
		};
	});
</script>
