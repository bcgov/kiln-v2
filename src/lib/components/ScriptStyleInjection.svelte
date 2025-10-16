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
				const guardKey = `__FORM_EXEC_${jsHash}`;

				// Check if script has already been executed (globally, across all effect runs)
				// This prevents re-execution even if the component re-renders or effect re-runs
				if ((window as any)[guardKey] === true) {
					console.debug('[SSI] Script already executed, skipping:', guardKey);
					return;
				}

				// Mark as executed BEFORE creating the script element
				// This prevents race conditions where the script runs before we set the flag
				(window as any)[guardKey] = true;

				const existingScript = document.querySelector<HTMLScriptElement>(
					`script[data-ssi="true"][data-hash="${jsHash}"]`
				);

				if (!existingScript) {
					// Remove old scripts with different hashes only
					document.querySelectorAll('script[data-ssi="true"]').forEach((el) => {
						const oldHash = el.getAttribute('data-hash');
						if (oldHash !== jsHash) {
							el.remove();
							// Clear the guard for the old hash
							const oldGuardKey = `__FORM_EXEC_${oldHash}`;
							delete (window as any)[oldGuardKey];
						}
					});

					// Simple IIFE wrapper without internal guard (we handle it above)
					const wrapped = `;(function(){try{${combinedJsRaw}\n}catch(e){console.error('[SSI] Script error:', e);}})();`;

					const scriptEl = document.createElement('script');
					scriptEl.setAttribute('data-ssi', 'true');
					scriptEl.setAttribute('data-hash', jsHash);
					scriptEl.id = 'ssi-script';
					scriptEl.textContent = wrapped;
					document.body.appendChild(scriptEl);
				}
			}
		}

		// Cleanup function
		return () => {
			document.querySelectorAll('script[data-ssi="true"]').forEach((el) => {
				const hash = el.getAttribute('data-hash');
				if (hash) {
					const guardKey = `__FORM_EXEC_${hash}`;
					delete (window as any)[guardKey];
				}
				el.remove();
			});
			// Remove SSI styles
			document.querySelectorAll('style[data-ssi="true"]').forEach((el) => el.remove());
		};
	});
</script>
