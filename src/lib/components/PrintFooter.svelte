<script lang="ts">
	import JsBarcode from 'jsbarcode';

	let { formId = '' } = $props();

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
	}

	export function clearBarcodeValue(): void {
		barcodeValue = '';
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
