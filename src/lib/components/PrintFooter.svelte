<script lang="ts">
	import JsBarcode from 'jsbarcode';

	let { barcode }: { barcode: { content: string } | undefined } = $props();

	export function setFooterText(text: string): void {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-form-id', text);
		}
	}

	export function clearFooterText(): void {
		if (typeof document !== 'undefined') {
			document.documentElement.removeAttribute('data-form-id');
		}
	}

	function getPlaceholderValues(): Record<string, string> {
		if (typeof sessionStorage === 'undefined') return {};
		const raw = sessionStorage.getItem('formParams');
		if (!raw) return {};
		try {
			return JSON.parse(raw) as Record<string, string>;
		} catch {
			return {};
		}
	}

	function replacePlaceholders(template: string, values: Record<string, string>): string {
		const lowerCaseMap: Record<string, string> = {};
		for (const [key, val] of Object.entries(values)) {
			lowerCaseMap[key.toLowerCase()] = val;
		}

		return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
			if (values[key] !== undefined) {
				return values[key];
			}
			const lowerKey = key.toLowerCase();
			if (lowerCaseMap[lowerKey] !== undefined) {
				return lowerCaseMap[lowerKey];
			}
			return '';
		});
	}
	$effect(() => {
		if (!barcode) {
			document.documentElement.style.setProperty('--barcode', '');
			return;
		}
		const templateText = barcode?.content.trim() || '';
		const resolvedBarcodeValue = replacePlaceholders(templateText, getPlaceholderValues());
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		JsBarcode(svg, resolvedBarcodeValue, {
			width: 1,
			height: 20,
			margin: 0,
			format: 'CODE128A',
			displayValue: false
		});
		const serializer = new XMLSerializer();
		const svgString = serializer.serializeToString(svg);
		const encoded = `data:image/svg+xml,${encodeURIComponent(svgString)}`;
		document.documentElement.style.setProperty('--barcode', `url('${encoded}')`);
	});
</script>

<style>
	:root {
		--barcode: '';
	}

	@page {
		@bottom-left {
			line-height: 1.1;
		}
		@bottom-center {
			content: var(--barcode);
			margin: 0 0.5em;
		}
	}
</style>
