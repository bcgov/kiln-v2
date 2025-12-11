<script lang="ts">
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
</script>

<div class="paged-page" data-footer-text=""></div>

<style>
	.paged-page {
		display: none;
	}
</style>
