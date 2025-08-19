import type { Item } from '$lib/types/form';

export type ValueParser<T> = (value: string) => T;
export type ValueComparator<T> = (a: T, b: T) => boolean;

export interface ValueSyncOptions<T> {
	item: Item;
	getValue: () => T;
	setValue: (value: T) => void;
	componentName: string;
	parser?: ValueParser<T>;
	comparator?: ValueComparator<T>;
}

/**
 * Creates an effect for synchronizing form field values with external updates
 * @param options Configuration options for value synchronization
 * @returns Cleanup function
 */
export function createValueSyncEffect<T = any>(options: ValueSyncOptions<T>) {
	const {
		item,
		getValue,
		setValue,
		componentName,
		parser = (value: string) => value as T,
		comparator = (a: T, b: T) => a !== b
	} = options;

	const element = document.getElementById(item.uuid);
	if (!element) return () => {};

	const handleExternalChange = (event: Event) => {
		const target = event.target as HTMLInputElement;
		if (!target) return;

		const parsedValue = parser(target.value);
		const currentValue = getValue();

		if (comparator(parsedValue, currentValue)) {
			setValue(parsedValue);
		}
	};

	const handleExternalUpdate = (event: Event) => {
		const customEvent = event as CustomEvent;
		if (!customEvent.detail) return;

		const parsedValue = parser(customEvent.detail.value);
		const currentValue = getValue();

		if (comparator(parsedValue, currentValue)) {
			setValue(parsedValue);
		}
	};

	element.addEventListener('input', handleExternalChange);
	element.addEventListener('change', handleExternalChange);
	element.addEventListener('external-update', handleExternalUpdate);

	// Dispatch initial update event
	element.dispatchEvent(
		new CustomEvent('svelte:updated', {
			detail: { component: componentName, value: getValue() }
		})
	);

	return () => {
		element.removeEventListener('input', handleExternalChange);
		element.removeEventListener('change', handleExternalChange);
		element.removeEventListener('external-update', handleExternalUpdate);
	};
}

/**
 * Publish a field's current value into the global form state.
 * Lets createSavedData read from window.__kilnFormState.
 * Keys written:
 *  - item.uuid (always)
 *  - item.attributes.id (when present; used for repeaters' index-specific IDs)
 */
export function publishToGlobalFormState<T>({ item, value }: { item: Item; value: T }) {
	if (typeof window === 'undefined') return;
	const win: any = window;
	win.__kilnFormState = win.__kilnFormState || {};
	const k1 = item?.uuid;
	const k2 = (item as any)?.attributes?.id;
	if (k1) win.__kilnFormState[k1] = value;
	if (k2) win.__kilnFormState[k2] = value;
}

// Predefined parsers for common types
export const parsers = {
	string: (value: string) => value,
	number: (value: string) => {
		const num = parseFloat(value);
		return isNaN(num) ? 0 : num;
	},
	boolean: (value: string) => value === 'true' || value === '1'
};

// Predefined comparators
export const comparators = {
	strict: <T>(a: T, b: T) => a !== b,
	number: (a: number, b: number) => !isNaN(a) && a !== b,
	string: (a: string, b: string) => a !== b
};



/**
 * Initializer for a global event bridge that:
 * - Listens for input/change
 * - Observes 'value', 'checked', and option 'selected' attribute mutations
 * - Overrides relevant property setters (value/checked/selected)
 * - Dispatches 'external-update' plus bubbling input/change where appropriate
 *
 * Installs at most once per page.
 */
export function initExternalUpdateBridge() {
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return () => {};
	}

	const win: any = window as any;
	if (win.__kilnExternalBridge?.installed) {
		// Already installed; return existing cleanup or a no-op
		return typeof win.__kilnExternalBridge.cleanup === 'function'
			? win.__kilnExternalBridge.cleanup
			: () => {};
	}

	// Track elements currently dispatching to avoid recursion
	const dispatchingElements = new WeakSet<EventTarget>();

	function dispatchSvelteUpdate(target: EventTarget | null) {
		if (!target || dispatchingElements.has(target)) return;

		dispatchingElements.add(target);
		try {
			if (!(target instanceof HTMLElement)) return;

			const tag = target.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
				// For checkbox/radio, prefer boolean checked and also provide a normalized string value
				if (
					tag === 'INPUT' &&
					((target as HTMLInputElement).type === 'checkbox' || (target as HTMLInputElement).type === 'radio')
				) {
					const el = target as HTMLInputElement;
					const valueStr = String(el.value ?? '');
					target.dispatchEvent(
						new CustomEvent('external-update', {
							detail: {
								checked: !!el.checked,
								value: valueStr,
								valueString: valueStr
							}
						})
					);
					target.dispatchEvent(new Event('change', { bubbles: true }));
				} else if (tag === 'SELECT') {
					// For selects, dispatch 'change' for widest compatibility
					const el = target as HTMLSelectElement;
					const valueStr = String(el.value ?? '');
					target.dispatchEvent(
						new CustomEvent('external-update', {
							detail: { value: valueStr, valueString: valueStr }
						})
					);
					target.dispatchEvent(new Event('change', { bubbles: true }));
				} else {
					// INPUT (non checkbox/radio) and TEXTAREA -> dispatch 'input'
					const el = target as HTMLInputElement | HTMLTextAreaElement;
					const valueStr = String(el.value ?? '');
					target.dispatchEvent(
						new CustomEvent('external-update', {
							detail: { value: valueStr, valueString: valueStr }
						})
					);
					target.dispatchEvent(new Event('input', { bubbles: true }));
				}
			} else {
				const valueStr = String(target.textContent ?? '');
				target.dispatchEvent(
					new CustomEvent('external-update', {
						detail: { value: valueStr, valueString: valueStr }
					})
				);
			}
		} finally {
			dispatchingElements.delete(target);
		}
	}

	// Global listeners
	const inputListener = (e: Event) => dispatchSvelteUpdate(e.target as HTMLElement);
	const changeListener = (e: Event) => dispatchSvelteUpdate(e.target as HTMLElement);
	document.addEventListener('input', inputListener, true);
	document.addEventListener('change', changeListener, true);

	// Attribute observers
	const attributeObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== 'attributes') continue;
			const { attributeName, target } = mutation;

			if (!(target instanceof HTMLElement)) continue;

			if (
				(attributeName === 'value' || attributeName === 'checked') &&
				['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
			) {
				dispatchSvelteUpdate(target);
			} else if (attributeName === 'selected' && target instanceof HTMLOptionElement) {
				const select = target.parentElement;
				if (select && select.tagName === 'SELECT') {
					dispatchSvelteUpdate(select);
				}
			}
		}
	});

	function observeElement(el: Element) {
		try {
			if (!(el instanceof HTMLElement)) return;
			const attrs = el.tagName === 'OPTION' ? ['selected'] : ['value', 'checked'];
			attributeObserver.observe(el, { attributes: true, attributeFilter: attrs });
		} catch {
			// ignore
		}
	}

	// Initial observe
	document.querySelectorAll('input, textarea, select, option').forEach(observeElement);

	// Child list observer for dynamic elements
	const treeObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				if (!(node instanceof Element)) continue;

				if (node.matches('input, textarea, select, option')) {
					observeElement(node);
				}
				node.querySelectorAll?.('input, textarea, select, option').forEach(observeElement);
			}
		}
	});
	treeObserver.observe(document.body, { childList: true, subtree: true });

	// Property overrides (not reverted on cleanup; installed once)
	function overrideProperty(proto: any, propName: string) {
		const descriptor = Object.getOwnPropertyDescriptor(proto, propName);
		if (!descriptor || !descriptor.set) return;

		// Avoid double-wrapping if already overridden
		const originalSetter = descriptor.set;
		const originalGetter = descriptor.get;

		Object.defineProperty(proto, propName, {
			get: originalGetter,
			set(this: any, value: any) {
				const oldValue = originalGetter ? originalGetter.call(this) : this[propName];
				if (value === oldValue) {
					originalSetter!.call(this, value);
					return;
				}
				originalSetter!.call(this, value);

				// If option.selected, dispatch on parent select
				if (this instanceof HTMLOptionElement && propName === 'selected') {
					const select = this.parentElement;
					if (select && select.tagName === 'SELECT') {
						dispatchSvelteUpdate(select);
						return;
					}
				}

				dispatchSvelteUpdate(this as HTMLElement);
			},
			configurable: true,
			enumerable: descriptor.enumerable
		});
	}

	try {
		overrideProperty(HTMLInputElement.prototype, 'value');
		overrideProperty(HTMLInputElement.prototype, 'checked');
		overrideProperty(HTMLTextAreaElement.prototype, 'value');
		overrideProperty(HTMLSelectElement.prototype, 'value');
		overrideProperty(HTMLOptionElement.prototype, 'selected');
	} catch {
		// ignore environments where overriding is restricted
	}

	// Register global handle for idempotency and cleanup
	const cleanup = () => {
		document.removeEventListener('input', inputListener, true);
		document.removeEventListener('change', changeListener, true);
		attributeObserver.disconnect();
		treeObserver.disconnect();
		// Property overrides remain; safe since installed once
	};

	win.__kilnExternalBridge = { installed: true, cleanup };

	return cleanup;
}
