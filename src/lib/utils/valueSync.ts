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
