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

		// Combine and inject all styles as a single <style>
		const combinedCss = (styles ?? [])
			.filter((s: { type: string; content: string }) => s?.type !== 'pdf')
			.map((s: { type: string; content: string }) => s?.content?.trim())
			.filter(Boolean)
			.join('\n\n/* ---- next stylesheet ---- */\n\n');

		if (combinedCss) {
			const styleEl = document.createElement('style');
			styleEl.setAttribute('data-ssi', 'true');
			styleEl.id = 'ssi-style';
			styleEl.textContent = combinedCss;
			document.head.appendChild(styleEl);
		}

		// Combine and inject all scripts as a single <script>
		if (mode !== 'view') {
			const combinedJs = (scripts ?? [])
				.filter((s: { type: string; content: string }) => s?.type !== 'pdf')
				.map((s: { type: string; content: string }) => {
					let code = s?.content?.trim() ?? '';

					// Remove <script> wrappers if present
					code = code.replace(/<script[^>]*>|<\/script>/gi, '').trim();

					// Wrap illegal anonymous top-level function() { ... }
					// Detect if the whole code starts with "function("
					if (/^\s*function\s*\(/.test(code)) {
						code = `(${code})();`;
					}

					return code;
				})
				.filter(Boolean)
				.join('\n;\n/* ---- next script ---- */\n');

			if (combinedJs) {
				const scriptEl = document.createElement('script');
				scriptEl.setAttribute('data-ssi', 'true');
				scriptEl.id = 'ssi-script';
				scriptEl.textContent = combinedJs;
				document.body.appendChild(scriptEl); // safer than head
			}
		}

		// Cleanup function
		return () => {
			document.querySelectorAll('style[data-ssi], script[data-ssi]').forEach((el) => el.remove());
		};
	});
</script>
