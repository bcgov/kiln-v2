import { maska } from 'maska/svelte';

/**
 * A regex that matches a wide range of Unicode "dash-like" characters.
 * These include various hyphens, minus signs, and long dashes used in typography,
 * which may look like '-' but are different code points.
 * Example characters matched:
 *   ‐ (U+2010), – (U+2013), — (U+2014), − (U+2212), ﹘ (U+FE58), etc.
 */
export const DASH_RX = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/**
 * Normalizes a string by:
 * 1. Converting Unicode compatibility characters to their base forms (via NFKC normalization),
 * 2. Replacing all Unicode dash variants with a standard ASCII hyphen '-'.
 * This ensures consistent handling of user input that may contain non-standard dashes.
 */
export const normalizeDash = (s?: string) => s?.normalize('NFKC').replace(DASH_RX, '-') ?? '';

/**
 * Determines if a given mask is a "character class specification" (not a formatting mask).
 * These are simple whitelists like:
 *   - "a-z", "A-Z", "a-zA-Z" → letters
 *   - "0-9" → digits
 *   - "a-zA-Z0-9" → alphanumeric
 *   - "[A-Za-z' -]" → custom character set in brackets
 *
 * Such specs are used to generate permissive regexes that allow partial typing
 * (e.g., while the user is still typing, not just full matches).
 */
export function isClassSpecMask(m: unknown): m is string {
	if (typeof m !== 'string') return false;
	const s = normalizeDash(m).trim();
	return /^(?:a-z|A-Z|a-zA-Z|0-9|a-z0-9|A-Z0-9|a-zA-Z0-9)$/i.test(s) || /^\[[^\]]+\]$/.test(s);
}

/**
 * Checks whether a mask string contains Maska-style formatting tokens.
 * Supported tokens include:
 *   - '#' or '9' → digit
 *   - 'a' or 'A' or '@' → letter
 *   - '*' or 'X' → alphanumeric
 *
 * If these tokens are present, the string is treated as a **formatting mask** (e.g., "(###) ###-####").
 */
export function hasMaskTokens(s: string) {
	return /[#@*9aA]/.test(s);
}

/**
 * Heuristically determines if a string is intended to be a **full-match regular expression**.
 * Since masks can come from JSON (as plain strings), we can't assume they’re RegExp objects.
 *
 * This function checks for common regex syntax and validates by attempting to construct a RegExp.
 * Returns `true` only if:
 *   - It looks like a regex (has metacharacters or anchors), AND
 *   - It successfully compiles.
 *
 * Used to avoid misinterpreting a regex pattern as a formatting mask.
 */
export function isRegexMask(mask: unknown): mask is string {
	if (typeof mask !== 'string') return false;
	const s = mask.trim();

	// Fast-path heuristics: if it starts/ends with anchors or uses common regex constructs
	if (s.startsWith('^')) return true;
	if (s.endsWith('$')) return true;
	if (s.includes('{') || s.includes('}') || s.includes('|')) return true;
	if (s.includes('?:')) return true;

	// Require at least one regex metacharacter to avoid treating "abc" as a regex
	const hasRegexMeta = /\\|\[|\]|\||\?|\+|\*|\^|\$|\{|\}/.test(s);
	if (!hasRegexMeta) return false;

	// Final safety check: try to compile it
	try {
		new RegExp(s);
		return true;
	} catch {
		return false;
	}
}

/**
 * Decides whether a given mask string should be applied as a **formatting mask** via Maska.
 * Returns `false` for:
 *   - Empty or falsy masks
 *   - Regex patterns (handled by validation, not input formatting)
 *   - Character class specs (used for validation regexes, not Maska)
 *   - Strings with no mask tokens (not a real formatting mask)
 *
 * Only masks with valid Maska tokens (like '###') are applied to the input element.
 */
export function shouldApplyMask(rawMask?: string): boolean {
	if (!rawMask) return false;
	const m = normalizeDash(rawMask).trim();
	if (!m) return false;
	if (isRegexMask(m)) return false;        // Regex → validation, not formatting
	if (isClassSpecMask(m)) return false;    // Char whitelist → validation regex
	if (!hasMaskTokens(m)) return false;     // No tokens → not a Maska pattern
	return true;
}

/**
 * Applies a Maska formatting mask to a given HTML input element.
 * Only applies the mask if it passes `shouldApplyMask` (i.e., it's a real formatting pattern).
 * Returns `true` if the mask was applied, `false` otherwise.
 */
export function applyMaskToElement(el: HTMLInputElement | null, mask?: string) {
	if (!el || !mask) return false;
	const m = normalizeDash(mask).trim();
	if (!shouldApplyMask(m)) return false;
	maska(el, m); // Apply Maska directive to the element
	return true;
}

/**
 * Applies a Maska mask with **custom token definitions**, primarily for numeric/currency patterns.
 * Maska treats '0' and '9' differently by default, but we want:
 *   - '0' → required digit (multiple allowed)
 *   - '9' → optional digit
 *
 * Special cases:
 *   - "0.99" → decimal number (e.g., 123.45)
 *   - "$0.99" → formatted currency
 *
 * Also handles phone patterns (using '###') with default Maska tokens.
 * Falls back to standard mask application if no special handling is needed.
 */
export function applyMaskaWithTokens(
	el: HTMLInputElement | null,
	mask?: string,
	maskType?: string
) {
	if (!el || !mask) return false;
	const m = normalizeDash(mask).trim();
	if (!m) return false;

	// Configure tokens for numeric/currency masks that use '0' and '9'
	if (['0.99', '$0.99'].includes(m)) {
		const tokens = {
			'0': { pattern: /\d/, multiple: true }, // One or more required digits
			'9': { pattern: /\d/, optional: true }  // Optional digit (for cents)
		};
		maska(el, { mask: m, tokens });
		return true;
	}

	// Phone masks (e.g., "(###) ###-####") use '#' which Maska supports by default
	if (m.includes('###')) {
		maska(el, m);
		return true;
	}

	// Otherwise, apply only if it's a valid formatting mask
	if (!shouldApplyMask(m)) return false;
	maska(el, m);
	return true;
}

/**
 * Strips non-numeric characters from a string, keeping only:
 *   - digits (0–9)
 *   - decimal point (.)
 *   - minus sign (-)
 *   - space (used in some negative formats like "(123)")
 *
 * Note: commas (thousands separators) and currency symbols ($, €) are removed.
 * This is used to extract a clean numeric string before parsing to a Number.
 *
 * Example: "$1,234.50" → "1234.50"
 */
export function unmaskNumberString(s?: string): string {
	if (!s) return '';
	// Keep only digits, dot, space, and minus; remove everything else
	const cleaned = String(s).replace(/[^0-9. -]/g, '').trim();
	// Additional safety: remove any remaining commas (though they should already be gone)
	return cleaned.replace(/,/g, '');
}

/**
 * Filters user input in real-time based on `maskType`, restricting allowed characters.
 * Used in `on:input` handlers to prevent invalid keystrokes (e.g., letters in a number field).
 *
 * This is a **loose, permissive filter** — final validation still happens via `validateValue`.
 * It improves UX by preventing obviously invalid characters from appearing.
 */
export function filterInputByMaskType(
	input: string,
	maskType?: string
): string {
	if (!maskType) return input;

	switch (maskType) {
		case 'decimal':
			// Allow digits, one dot, and minus (for negative numbers)
			return input.replace(/[^0-9.-]/g, '');
		case 'currency':
			// Allow digits, dot, minus, and dollar sign (for formats like $123.45 or -$123)
			return input.replace(/[^0-9.$-]/g, '');
		case 'integer':
			// Only digits and minus (no decimal point)
			return input.replace(/[^0-9-]/g, '');
		case 'phone':
			// Allow digits and common phone formatting characters
			return input.replace(/[^0-9\s().\-+]/g, '');
		case 'email':
			// Allow standard email characters (note: not exhaustive — full validation is regex-based)
			return input.replace(/[^a-zA-Z0-9@._+-]/g, '');
		case 'custom':
		default:
			// For custom or unknown mask types, don't restrict input
			return input;
	}
}