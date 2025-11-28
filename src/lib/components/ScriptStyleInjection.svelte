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

	const EXTERNAL_FORM_INIT_TIMEOUT = Number(import.meta.env.VITE_EXTERNAL_FORM_INIT_TIMEOUT) || 500;

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

	$effect(() => {
		if (!browser) return;

		// Map all non-PDF rendering paths to 'web'
		const isPdf = mode === 'pdf';

		const combinedCss = (styles ?? [])
			.filter((s: { type: string; content: string }) => (s?.type || 'web').toLowerCase() !== 'pdf')
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
				styleEl.id = `ssi-style-${cssHash}`;
				styleEl.textContent = combinedCss;
				document.head.appendChild(styleEl);
			}
		}

		// ==== SCRIPTS (web only) ====
		if (!isPdf) {
			const combinedJsRaw = (scripts ?? [])
				.filter(
					(s: { type: string; content: string }) => (s?.type || 'web').toLowerCase() !== 'pdf'
				)
				.map((s: { type: string; content: string }) => {
					let code = s?.content?.trim() ?? '';
					code = code.replace(/<script[^>]*>|<\/script>/gi, '').trim();
					if (/^\s*function\s*\(/.test(code)) code = `(${code})();`;
					return code;
				})
				.filter(Boolean)
				.join('\n;\n/* ---- next script ---- */\n');

			if (combinedJsRaw) {
				const jsHash = hashString(combinedJsRaw);
				const guardKey = `__FORM_EXEC_${jsHash}`;

				if ((window as any)[guardKey] === true) {
					console.debug('[SSI] Script already executed, skipping:', guardKey);
				} else {
					(window as any)[guardKey] = true;

					const existingScript = document.querySelector<HTMLScriptElement>(
						`script[data-ssi="true"][data-hash="${jsHash}"]`
					);

					if (!existingScript) {
						document.querySelectorAll('script[data-ssi="true"]').forEach((el) => {
							const oldHash = el.getAttribute('data-hash');
							if (oldHash !== jsHash) {
								el.remove();
								delete (window as any)[`__FORM_EXEC_${oldHash}`];
							}
						});

						const wrapped =
							`;(function(){try{${combinedJsRaw}\n}` +
							`catch(e){console.error('[SSI] Script error:', e);}})();`;

						const scriptEl = document.createElement('script');
						scriptEl.setAttribute('data-ssi', 'true');
						scriptEl.setAttribute('data-hash', jsHash);
						scriptEl.id = `ssi-script-${jsHash}`;
						scriptEl.textContent = wrapped;
						document.body.appendChild(scriptEl);

						if (typeof (window as any).externalFormInit === 'function') {
							setTimeout(() => {
								const fieldRefs: Record<string, HTMLElement> = {};
								const allInputs = document.querySelectorAll<HTMLElement>(
									'input, select, textarea, button[id]'
								);
								allInputs.forEach((el) => {
									if (el.id) {
										fieldRefs[el.id] = el;
									}
								});
								try {
									(window as any).externalFormInit(fieldRefs);
								} catch (e) {
									console.error('externalFormInit error:', e);
								}
							}, EXTERNAL_FORM_INIT_TIMEOUT);
						}
					}
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

	/* Kiln-v2: freeze scroll position for printing (prevents header drift) */
	(() => {
		const root = document.documentElement;
		if (root.dataset.ffScrollPrintBound) return;
		root.dataset.ffScrollPrintBound = '1';

		let prevWinY = 0;
		const scrollers: any[] = [];

		const findScrollers = () =>
			Array.from(
				document.querySelectorAll(
					'.full-frame, .scrollable-content, .content-wrapper, main, [data-scroll], .app, .content'
				)
			);

		function resetAllToTop() {
			try {
				window.scrollTo(0, 0);
			} catch {}
			try {
				document.documentElement.scrollTop = 0;
			} catch {}
			try {
				document.body.scrollTop = 0;
			} catch {}
			scrollers.forEach((el) => {
				el.dataset.prevScrollTop = String(el.scrollTop || 0);
				try {
					el.scrollTop = 0;
				} catch {}
			});
		}

		function restoreAllScroll() {
			try {
				window.scrollTo(0, prevWinY);
			} catch {}
			scrollers.forEach((el) => {
				const y = +(el.dataset.prevScrollTop || 0);
				try {
					el.scrollTop = y;
				} catch {}
				delete el.dataset.prevScrollTop;
			});
		}

		function beforePrint() {
			prevWinY =
				window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
			scrollers.splice(0, scrollers.length, ...findScrollers());
			resetAllToTop();
		}

		function afterPrint() {
			restoreAllScroll();
		}

		window.addEventListener('beforeprint', beforePrint);
		window.addEventListener('afterprint', afterPrint);

		// Fallback for engines that only emit matchMedia changes
		const mq = window.matchMedia && window.matchMedia('print');
		if (mq && mq.addEventListener) {
			mq.addEventListener('change', (e) =>
				window.dispatchEvent(new Event(e.matches ? 'beforeprint' : 'afterprint'))
			);
		}
	})();
</script>
