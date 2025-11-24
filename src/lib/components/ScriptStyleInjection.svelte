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
				document.querySelectorAll('style[data-ssi="true"]').forEach((el) => el.remove());
				const styleEl = document.createElement('style');
				styleEl.setAttribute('data-ssi', 'true');
				styleEl.setAttribute('data-hash', cssHash);
				styleEl.id = `ssi-style-${cssHash}`;
				styleEl.textContent = combinedCss;
				document.head.appendChild(styleEl);
			}
		}

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

						const formRendererProtection = `
							(function() {
								function isFormRendererElement(element) {
									if (!element) return false;

									const isRendererItself = element.classList?.contains('form-renderer');
									const containsRenderer = element.querySelector?.('.form-renderer');

									return isRendererItself || containsRenderer;
								}

								function blockAndLogAttempt(operation, elementInfo) {
									console.error('[FormRenderer Protection] Blocked ' + operation, elementInfo);
								}

								function interceptSetAttribute() {
									const original = Element.prototype.setAttribute;

									Element.prototype.setAttribute = function(attributeName, attributeValue) {
										const isStyleAttribute = attributeName === 'style';
										const containsDisplay = typeof attributeValue === 'string' && attributeValue.includes('display');

										if (isStyleAttribute && containsDisplay && isFormRendererElement(this)) {
											blockAndLogAttempt('setAttribute', {
												element: this,
												tagName: this.tagName,
												className: this.className
											});
											return;
										}

										return original.call(this, attributeName, attributeValue);
									};
								}

								function interceptStyleDisplay() {
									const styleDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style');
									if (!styleDescriptor?.get) return;

									const originalGetter = styleDescriptor.get;

									Object.defineProperty(HTMLElement.prototype, 'style', {
										get: function() {
											const styleObject = originalGetter.call(this);

											if (styleObject.__formRendererProtected) {
												return styleObject;
											}

											styleObject.__formRendererProtected = true;
											const elementReference = this;

											Object.defineProperty(styleObject, 'display', {
												set: function(displayValue) {
													const isHidingElement = displayValue === 'none' || displayValue === '';

													if (isHidingElement && isFormRendererElement(elementReference)) {
														blockAndLogAttempt('style.display', {
															element: elementReference,
															tagName: elementReference.tagName,
															className: elementReference.className
														});
														return;
													}

													styleObject.setProperty('display', displayValue);
												},
												get: function() {
													return styleObject.getPropertyValue('display');
												}
											});

											return styleObject;
										},
										set: styleDescriptor.set
									});
								}

								interceptSetAttribute();
								interceptStyleDisplay();
							})();
						`;

						const wrapped = formRendererProtection +
							`;(function(){try{
								${combinedJsRaw}
							}` +
							`catch(e){
								console.error('Script execution error:', e);
								console.error('Error stack:', e.stack);
							}})();`;

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
                                    console.error('externalFormInit error:', e)
                                }
							}, EXTERNAL_FORM_INIT_TIMEOUT);
						}
					}
				}
			}
		}

		return () => {
			document.querySelectorAll('script[data-ssi="true"]').forEach((el) => {
				const hash = el.getAttribute('data-hash');
				if (hash) {
					const guardKey = `__FORM_EXEC_${hash}`;
					delete (window as any)[guardKey];
				}
				el.remove();
			});
			document.querySelectorAll('style[data-ssi="true"]').forEach((el) => el.remove());
		};
	});
</script>
