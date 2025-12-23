<script lang="ts">
	import Barcode from 'svelte-barcode';

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
</script>

<div class="paged-page" data-footer-text=""></div>

<div class="print-barcode">
	{#if barcodeValue}
		<Barcode value={barcodeValue} options={{ height: 30, displayValue: false }} />
	{/if}
</div>

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
