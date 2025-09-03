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
	string: (a: string, b: string) => a !== b,
	date: (a: string | null, b: string | null) => (a ?? '') === (b ?? '')
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

	const dispatchingElements = new WeakSet<EventTarget>();

	// Mirror common attributes to properties so setAttribute works universally
	function syncPropsFromAttributes(target: HTMLElement, attributeName?: string) {
		const attr = attributeName?.toLowerCase();

		if (target instanceof HTMLOptionElement) {
			if (!attributeName || attr === 'selected') {
				const present = target.hasAttribute('selected');
				if (target.selected !== present) target.selected = present;
			}
			if (!attributeName || attr === 'disabled') {
				const present = target.hasAttribute('disabled');
				if (target.disabled !== present) target.disabled = present;
			}
			if (!attributeName || attr === 'value') {
				const v = target.getAttribute('value') ?? '';
				if (target.value !== v) target.value = v;
			}
			return;
		}

		// Inputs, textareas, selects
		if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
			if (!attributeName || attr === 'value') {
				const v = target.getAttribute('value');
				if (v !== null && (target as any).value !== v) (target as any).value = v;
			}
			const bools = ['checked', 'disabled', 'readonly', 'required', 'multiple'];
			for (const b of bools) {
				if (!attributeName || attr === b) {
					const present = target.hasAttribute(b);
					if (b === 'readonly') {
						if ((target as any).readOnly !== present) (target as any).readOnly = present;
					} else if ((target as any)[b] !== undefined && (target as any)[b] !== present) {
						(target as any)[b] = present;
					}
				}
			}
			const strings = ['min', 'max', 'step', 'placeholder', 'pattern', 'name'];
			for (const s of strings) {
				if (!attributeName || attr === s) {
					const val = target.getAttribute(s);
					if (val !== null && (target as any)[s] !== val) (target as any)[s] = val;
				}
			}
		}
	}

	function dispatchSvelteUpdate(target: EventTarget | null) {
		if (!target || dispatchingElements.has(target)) return;

		dispatchingElements.add(target);
		try {
			if (!(target instanceof HTMLElement)) return;

			const tag = target.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
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
							},
							bubbles: true,
							composed: true
						})
					);
					target.dispatchEvent(new Event('change', { bubbles: true }));
				} else if (tag === 'SELECT') {
					const el = target as HTMLSelectElement;
					const valueStr = String(el.value ?? '');
					target.dispatchEvent(
						new CustomEvent('external-update', {
							detail: { value: valueStr, valueString: valueStr },
							bubbles: true,
							composed: true
						})
					);
					target.dispatchEvent(new Event('change', { bubbles: true }));
				} else {
					const el = target as HTMLInputElement | HTMLTextAreaElement;
					const valueStr = String(el.value ?? '');
					target.dispatchEvent(
						new CustomEvent('external-update', {
							detail: { value: valueStr, valueString: valueStr },
							bubbles: true,
							composed: true
						})
					);
					target.dispatchEvent(new Event('input', { bubbles: true }));
				}
			} else {
				const valueStr = String(target.textContent ?? '');
				target.dispatchEvent(
					new CustomEvent('external-update', {
						detail: { value: valueStr, valueString: valueStr },
						bubbles: true,
						composed: true
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

	// Attribute observers (curated for controls; wrappers are observed without a filter)
	const OBS_ATTRS = [
		'value', 'checked', 'selected',
		'disabled', 'readonly', 'required', 'multiple',
		'min', 'max', 'step',
		'placeholder', 'pattern', 'name'
	];

	function isFormControl(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLOptionElement {
		return !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el instanceof HTMLOptionElement);
	}

	function findFirstDescendantControl(el: HTMLElement): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
		return (el.querySelector('input, textarea, select') as any) ?? null;
	}

	const attributeObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== 'attributes') continue;
			const { attributeName, target } = mutation;
			if (!attributeName || !(target instanceof HTMLElement)) continue;

			// Propagate any attribute to its first descendant control if wrapper.
			// Ignore purely stylistic attributes like class/style
			if (!isFormControl(target)) {
				if (attributeName === 'class' || attributeName === 'style') continue;
				const inner = findFirstDescendantControl(target);
				if (inner) {
					const newVal = target.getAttribute(attributeName);
					const oldVal = inner.getAttribute(attributeName);
					if (newVal !== oldVal) {
						if (newVal === null) inner.removeAttribute(attributeName);
						else inner.setAttribute(attributeName, newVal);
						inner.dispatchEvent(new CustomEvent('external-update', {
							detail: { attr: attributeName, value: newVal },
							bubbles: true,
							composed: true
						}));
					}
				}
			}

			syncPropsFromAttributes(target, attributeName);

			const upper = target.tagName;
			if (
				(attributeName === 'value' || attributeName === 'checked') &&
				['INPUT', 'TEXTAREA', 'SELECT'].includes(upper)
			) {
				dispatchSvelteUpdate(target);
			} else if (attributeName === 'selected' && target instanceof HTMLOptionElement) {
				const select = target.parentElement;
				if (select && select.tagName === 'SELECT') {
					dispatchSvelteUpdate(select);
				}
			} else {
				target.dispatchEvent(
					new CustomEvent('external-update', {
						detail: { attr: attributeName, value: target.getAttribute(attributeName) },
						bubbles: true,
						composed: true
					})
				);
			}
		}
	});

	function observeElement(el: Element) {
		try {
			if (!(el instanceof HTMLElement)) return;

			if (isFormControl(el)) {
				const attrs = el.tagName === 'OPTION' ? ['selected', 'disabled', 'value'] : OBS_ATTRS;
				attributeObserver.observe(el, { attributes: true, attributeFilter: attrs, attributeOldValue: true });
				return;
			}

			if (el.hasAttribute('id') && el.querySelector('input, textarea, select')) {
				attributeObserver.observe(el, { attributes: true, attributeOldValue: true });
			}
		} catch {
			// ignore
		}
	}

	// Initial observe (controls, options, and wrappers-with-controls)
	document.querySelectorAll('input, textarea, select, option, [id]').forEach(observeElement);

	const treeObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				if (!(node instanceof Element)) continue;

				observeElement(node);
				node.querySelectorAll?.('input, textarea, select, option, [id]').forEach(observeElement);
			}
		}
	});
	treeObserver.observe(document.body, { childList: true, subtree: true });

	// Property overrides
	function overrideProperty(proto: any, propName: string) {
		const descriptor = Object.getOwnPropertyDescriptor(proto, propName);
		if (!descriptor || !descriptor.set) return;

		const originalSetter = descriptor.set;
		const originalGetter = descriptor.get;

		Object.defineProperty(proto, propName, {
			get: originalGetter,
			set(this: any, value: any) {
				const oldValue = originalGetter ? originalGetter.call(this) : this[propName];
				if (value === oldValue) return;

				originalSetter!.call(this, value);

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
	} catch (e) {
		console.warn('Could not override element properties for external updates:', e);
	}

	// Register global handle for idempotency and cleanup
	const cleanup = () => {
		document.removeEventListener('input', inputListener, true);
		document.removeEventListener('change', changeListener, true);
		attributeObserver.disconnect();
		treeObserver.disconnect();
	};

	win.__kilnExternalBridge = { installed: true, cleanup };

	return cleanup;
}

/**
 * Listens for bubbling 'external-update' events with {attr, value} and invokes onAttr
 * only when the event originated from this field's element (by composedPath and id).
 */
export interface AttributeSyncOptions {
	item: Item;
	onAttr: (name: string, value: any) => void;
	filter?: (name: string, value: any) => boolean;
}

export function createAttributeSyncEffect(options: AttributeSyncOptions) {
	const { item, onAttr, filter } = options;

	const handler = (e: Event) => {
		const ce = e as CustomEvent<any>;
		const d = ce?.detail || {};
		if (!('attr' in d)) return;

		const path = (ce as any).composedPath?.() as any[] | undefined;
		let hit = false;

		if (path && path.length) {
			hit = path.some((n) => n instanceof HTMLElement && n.id === item.uuid);
		} else {
			const el = document.getElementById(item.uuid);
			const tgt = (ce.target as HTMLElement) || null;
			if (el && tgt) {
				hit = el === tgt || el.contains(tgt) || tgt.contains(el);
			}
		}
		if (!hit) return;

		const name = String(d.attr || '');
		if (!name) return;

		// Optional filter
		if (filter && !filter(name, d.value)) return;

		onAttr(name, d.value);

	};

	document.addEventListener('external-update', handler, true);
	return () => document.removeEventListener('external-update', handler, true);
}
export interface SyncExternalAttributesOptions<T extends Record<string, any> = Record<string, any>> {
	item: Item;
	get: () => T;
	set: (next: T) => void;
	// keys to ignore
	exclude?: string[];
}

export function syncExternalAttributes<T extends Record<string, any> = Record<string, any>>(
	options: SyncExternalAttributesOptions<T>
) {
	const { item, get, set, exclude = ['class', 'style'] } = options;

	return createAttributeSyncEffect({
		item,
		filter: (name, value) => {
			if (exclude.includes(name)) return false;
			if (value === undefined) return false;
			const curr = get();
			return curr?.[name] !== value;
		},
		onAttr: (name, value) => {
			const curr = get();
			set({ ...(curr as any), [name]: value });
		}
	});
}
