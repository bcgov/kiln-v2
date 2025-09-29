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

		// Hash Util to uniquely identify style/script content
		function hashString(str: string): string {
			let h = 0,
				i = 0,
				chr = 0;
			if (str.length === 0) return '0';
			for (i = 0; i < str.length; i++) {
				chr = str.charCodeAt(i);
				h = (h << 5) - h + chr;
				h |= 0;
			}
			return h.toString(36);
		}

		const combinedCss = (styles ?? [])
			.filter((s: { type: string; content: string }) => s?.type !== 'pdf')
			.map((s: { type: string; content: string }) => s?.content?.trim())
			.filter(Boolean)
			.join('\n\n/* ---- next stylesheet ---- */\n\n');

		if (combinedCss) {
			const cssHash = hashString(combinedCss);
			const existingStyle = document.querySelector<HTMLStyleElement>(
				`style[data-ssi="true"][data-hash="${cssHash}"]`
			);
			if (!existingStyle) {
				// Remove older style injections (different hash) before adding
				document.querySelectorAll('style[data-ssi="true"]').forEach((el) => el.remove());
				const styleEl = document.createElement('style');
				styleEl.setAttribute('data-ssi', 'true');
				styleEl.setAttribute('data-hash', cssHash);
				styleEl.id = 'ssi-style';
				styleEl.textContent = combinedCss;
				document.head.appendChild(styleEl);
			}
		}

		// Inject all scripts
		if (mode !== 'view') {
			const combinedJsRaw = (scripts ?? [])
				.filter((s: { type: string; content: string }) => s?.type !== 'pdf')
				.map((s: { type: string; content: string }) => {
					let code = s?.content?.trim() ?? '';
					code = code.replace(/<script[^>]*>|<\/script>/gi, '').trim();
					if (/^\s*function\s*\(/.test(code)) {
						code = `(${code})();`;
					}
					return code;
				})
				.filter(Boolean)
				.join('\n;\n/* ---- next script ---- */\n');

			if (combinedJsRaw) {
				const jsHash = hashString(combinedJsRaw);

				// Use a SAFE string key + bracket access to avoid identifier syntax errors e.g. "__FORM_EXEC_-k3j2"
				const guardKey = `__FORM_EXEC_${jsHash}`;
				const guardKeyLiteral = JSON.stringify(guardKey);

				const guarded =
					`;(function(){try{` +
					`if(window[${guardKeyLiteral}]){console.debug('[SSI] Skip duplicate script', ${guardKeyLiteral});return;}` +
					`window[${guardKeyLiteral}] = true;` +
					`${combinedJsRaw}\n` +
					`}catch(e){console.error('[SSI] Script error (', ${guardKeyLiteral}, ')', e);}})();`;

				const existingScript = document.querySelector<HTMLScriptElement>(
					`script[data-ssi="true"][data-hash="${jsHash}"]`
				);

				if (!existingScript) {
					// Drop older SSI scripts with different hash
					document.querySelectorAll('script[data-ssi="true"]').forEach((el) => el.remove());
					const scriptEl = document.createElement('script');
					scriptEl.setAttribute('data-ssi', 'true');
					scriptEl.setAttribute('data-hash', jsHash);
					scriptEl.id = 'ssi-script';
					scriptEl.textContent = guarded;
					document.body.appendChild(scriptEl);
				}
			}
		}

		// Cleanup function
		return () => {
			document.querySelectorAll('style[data-ssi], script[data-ssi]').forEach((el) => el.remove());
		};
	});
</script>
