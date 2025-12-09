<script lang="ts">
	/**
	 * PrintFooter Component
	 *
	 * Manages the print footer for forms via CSS @page margin boxes.
	 * Sets the data-form-id attribute on documentElement which is read by
	 * the @bottom-left margin box rule in print.css.
	 *
	 * The footer displays form identification (form_id, title, version date)
	 * on the left and page numbers on the right (via CSS counters).
	 *
	 * Note: The fixed positioned fallback div is kept as a placeholder for
	 * browsers without @page margin box support, but content is rendered
	 * via CSS margin boxes defined in print.css.
	 */

	/**
	 * Updates the footer text displayed during print.
	 * Sets the data-form-id attribute for CSS @page @bottom-left margin box.
	 *
	 * @param text - The formatted footer text (e.g., "CF0609 - Form Title (2025-01-01)")
	 */
	export function setFooterText(text: string): void {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-form-id', text);
		}
	}

	/**
	 * Clears the footer text and removes the data attribute.
	 * Called during print cleanup.
	 */
	export function clearFooterText(): void {
		if (typeof document !== 'undefined') {
			document.documentElement.removeAttribute('data-form-id');
		}
	}
</script>

<!--
	Placeholder div for potential future fallback support.
	Actual footer content is rendered via CSS @page margin boxes in print.css.
-->
<div class="paged-page" data-footer-text=""></div>

<style>
	/* Hidden placeholder - footer rendered via CSS @page margin boxes */
	.paged-page {
		display: none;
	}
</style>
