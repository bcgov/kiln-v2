<script lang="ts">
	import JsBarcode from 'jsbarcode';

	let barcodeValue = $state('');

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

	export function setBarcodeValue(value: string): void {
		barcodeValue = value || '';
		if (typeof document !== 'undefined') {
			if (barcodeValue) {
				document.documentElement.setAttribute('data-has-barcode', 'true');
			} else {
				document.documentElement.removeAttribute('data-has-barcode');
			}
		}
	}

	export function clearBarcodeValue(): void {
		barcodeValue = '';
		if (typeof document !== 'undefined') {
			document.documentElement.removeAttribute('data-has-barcode');
		}
	}

	export function setBarcodeIntoFooter(): void {
		const barcodePlaceholder = document.getElementById("barcode-placeholder");
		if (!barcodePlaceholder || !barcodeValue) {
			return;
		}

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		barcodePlaceholder.innerHTML = '';
		barcodePlaceholder.appendChild(svg);

		JsBarcode(svg, barcodeValue, {
            width: 2,
			height: 16,
            margin: 0,
			displayValue: false
		});
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

	export function generateBarcode(): void {
		if (typeof document === 'undefined') return;

		const barcodePlaceholder = document.getElementById('barcode-placeholder');
		if (!barcodePlaceholder) {
			document.documentElement.removeAttribute('data-has-barcode');
			return;
		}

		const templateText = barcodePlaceholder.textContent?.trim() || '';
		if (!templateText) {
			document.documentElement.removeAttribute('data-has-barcode');
			return;
		}

        console.log("barcodeTemplateText", templateText);

		const resolvedBarcodeValue = replacePlaceholders(templateText, getPlaceholderValues());
		if (!resolvedBarcodeValue) {
			document.documentElement.removeAttribute('data-has-barcode');
			return;
		}

        console.log("resolvedBarcodeValue", resolvedBarcodeValue);

		document.documentElement.setAttribute('data-has-barcode', 'true');

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		barcodePlaceholder.innerHTML = '';
		barcodePlaceholder.appendChild(svg);

		JsBarcode(svg, resolvedBarcodeValue, {
			width: 1,
			height: 20,
			margin: 0,
            format: 'CODE128A',
			displayValue: false
		});
	}

	export function clearBarcodeFromTemplate(): void {
		barcodeValue = '';
		if (typeof document === 'undefined') return;
		document.documentElement.removeAttribute('data-has-barcode');
	}
</script>

<div class="paged-page" data-footer-text=""></div>

<style>
	.paged-page {
		display: none;
	}

	.print-barcode {
		display: none;
	}

	@media print {
		.print-barcode {
			display: block;
			position: fixed;
			bottom: 25mm;
			left: 50%;
			transform: translateX(-50%);
			z-index: 1001;
		}
	}
</style>
