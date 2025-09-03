/** Create a deep clone via JSON serialization (simple data only). */
function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

// Type coercion for field values
function coerceBoolean(v: any): boolean {
	if (typeof v === 'boolean') return v;
	const s = String(v).trim().toLowerCase();
	return ['true', '1', 'yes', 'on', 'y'].includes(s);
}

function coerceNumber(v: any): number | null {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	return Number.isNaN(n) ? null : n;
}

// Normalize ISO date-time to YYYY-MM-DD
function normalizeDate(v: any): any {
	if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
	return v;
}

type FieldType =
	| 'text-input'
	| 'textarea-input'
	| 'number-input'
	| 'checkbox-input'
	| 'select-input'
	| 'radio-input'
	| 'date-select-input';

/**
 * Apply value to item & its attributes according to its type.
 * Mutates the passed newItem.
 */
function setInjectedValueByType(newItem: any, rawValue: any) {
	const t: FieldType | string = newItem.type;
	if (!newItem.attributes || typeof newItem.attributes !== 'object') {
		newItem.attributes = {};
	}

	switch (t) {
		case 'checkbox-input': {
			const boolVal = coerceBoolean(rawValue);
			newItem.value = boolVal;
			newItem.attributes = {
				...newItem.attributes,
				checked: boolVal,
				defaultChecked: undefined
			};
			break;
		}
		case 'radio-input':
		case 'select-input': {
			const strVal = rawValue == null ? '' : String(rawValue);
			newItem.value = strVal;
			newItem.attributes = {
				...newItem.attributes,
				selected: strVal,
				defaultSelected: undefined
			};
			break;
		}
		case 'number-input': {
			const numVal = coerceNumber(rawValue);
			newItem.value = numVal;
			newItem.attributes = {
				...newItem.attributes,
				value: numVal
			};
			break;
		}
		case 'date-select-input': {
			const norm = normalizeDate(rawValue);
			newItem.value = norm || '';
			newItem.attributes = {
				...newItem.attributes,
				value: norm
			};
			break;
		}
		case 'textarea-input':
		case 'text-input': {
			const strVal = rawValue == null ? '' : String(rawValue);
			newItem.value = strVal;
			newItem.attributes = {
				...newItem.attributes,
				value: strVal
			};
			break;
		}
		default: {
			const strVal = rawValue == null ? '' : rawValue;
			newItem.value = strVal;
			newItem.attributes = {
				...newItem.attributes,
				value: strVal
			};
		}
	}
}

/** Recursively inject values from dataMap into form items, including repeaters. */
function injectValues(
	items: any[],
	dataMap: Record<string, any>,
	debugMap: Record<string, any>
): any[] {
	return items.map((item) => {
		const newItem = { ...item };

		const isRepeater = newItem.attributes?.isRepeatable || newItem.repeater;
		const lookupKey = newItem.id || newItem.uuid;
		const dataValue = dataMap[lookupKey];

		// Handle repeaters: store the array on repeaterData; children keep original definitions (no per-child value injection here).
		if (isRepeater && Array.isArray(dataValue)) {
			newItem.repeaterData = dataValue;
			if (newItem.children && Array.isArray(newItem.children)) {
				// Pass empty map so we don't incorrectly assign same values to each row template
				newItem.children = injectValues(newItem.children, {}, debugMap);
			}
			debugMap[lookupKey] = `[repeater] ${dataValue.length} rows`;
			return newItem;
		}

		// Recurse into containers / nested structures first
		if (newItem.children && Array.isArray(newItem.children)) {
			newItem.children = injectValues(newItem.children, dataMap, debugMap);
		} else if (newItem.containerItems && Array.isArray(newItem.containerItems)) {
			newItem.containerItems = injectValues(newItem.containerItems, dataMap, debugMap);
		}

		// Inject value for leaf/non-repeater items when present in dataMap
		if (dataMap && lookupKey && dataValue !== undefined && !isRepeater) {
			setInjectedValueByType(newItem, dataValue);
			debugMap[lookupKey] = { type: newItem.type, value: newItem.value };
		}

		return newItem;
	});
}

/** Bind external data to a form definition and return the mapped copy with a debug map. */
export interface mappedFormDef {
	mappedFormDef: any;
	debugMap: Record<string, any>;
}

export function bindDataToForm(input: { data: any; form_definition: any }): mappedFormDef {
	if (!input?.form_definition?.data?.items && !input?.form_definition?.elements) {
		return { mappedFormDef: null, debugMap: {} };
	}
	const formDef = deepClone(input.form_definition);
	const items = formDef.data?.items || formDef.elements;
	const debug: Record<string, any> = {};

	const mappedItems = injectValues(items, input.data, debug);

	if (formDef.data?.items) formDef.data.items = mappedItems;
	else formDef.elements = mappedItems;
	return { mappedFormDef: formDef, debugMap: debug };
}
