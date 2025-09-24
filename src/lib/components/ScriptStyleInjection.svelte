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

			// To make sure button functions after user exit print view which trigger the re-render
			const postlude = `
			(function(){
			if (window.__ssiAfterPrintFix) return; window.__ssiAfterPrintFix = true;

			// Find the toggle button(s) without hard-coding an id.
			function findToggleButtons(){
				const nodes = Array.from(document.querySelectorAll('button,[role="button"]'));
				return nodes.filter(b => {
				const t = (b.textContent || b.getAttribute('aria-label') || '').toLowerCase();
				return (b.id && b.id.startsWith('show-letter-')) || t.includes('show letter') || t.includes('show form');
				});
			}

			function isVisible(el){ return !!(el && el.offsetParent !== null); }

			function desiredLabel(){
				const letter = document.getElementById('letter-content') || document.querySelector('.letter-content');
				if (letter) return isVisible(letter) ? 'Show Form' : 'Show Letter';
				// Fallback: if any form control is visible, assume form is showing.
				const anyForm = document.querySelector('.bx--form input, .bx--form textarea, .bx--form select');
				return anyForm ? 'Show Letter' : 'Show Form';
			}

			function syncLabel(){
				const want = desiredLabel();
				findToggleButtons().forEach(btn => {
				btn.innerHTML = want;                 // normalize any <span> wrappers
				btn.setAttribute('aria-label', want);
				});
			}

			function updateAll(){
				// Defined in the JSON, call if present.
				try { window.updateIds?.(); } catch {}
				try { window.updateTemplateData?.(); } catch {}
				try { window.updateTemplates?.(); } catch {}
			}

			// Right before the print snapshot, make sure the letter is hydrated.
			window.addEventListener('beforeprint', () => {
				// Let any pending input changes flush, then update.
				requestAnimationFrame(updateAll);
			});

			// After the dialog closes, re-bind JSON handlers (if any got detached)
			//    and re-hydrate + normalize the toggle label so the next click is correct.
			function rebindAndResync(){
				try { window.initLetterToggle?.(); } catch {}
				updateAll();
				syncLabel();
			}
			let duringPrint = false;
			window.addEventListener('beforeprint', () => { duringPrint = true; });
			window.addEventListener('afterprint', () => setTimeout(rebindAndResync, 0));
			document.addEventListener('visibilitychange', () => {
				if (duringPrint && document.visibilityState === 'visible') {
				setTimeout(rebindAndResync, 0);
				duringPrint = false;
				}
			});

			// normalize any wrapped labels.
			requestAnimationFrame(syncLabel);
			})();`;

			const postEl = document.createElement('script');
			postEl.setAttribute('data-ssi', 'true');
			postEl.id = 'ssi-postlude';
			postEl.textContent = postlude;
			document.body.appendChild(postEl);
		}

		// Cleanup function
		return () => {
			document.querySelectorAll('style[data-ssi], script[data-ssi]').forEach((el) => el.remove());
		};
	});
</script>
