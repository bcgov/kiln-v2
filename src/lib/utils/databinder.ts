/** Create a deep clone via JSON serialization (simple data only). */
function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

/** Recursively inject values from dataMap into form items, including repeaters. */
function injectValues(
	items: any[],
	dataMap: Record<string, any>,
	debugMap: Record<string, any>
): any[] {
	return items.map((item) => {
		let newItem = { ...item };

		const isRepeater = newItem.attributes?.isRepeatable || newItem.repeater;
		const dataValue = dataMap[newItem.id || newItem.uuid];

		if (isRepeater && Array.isArray(dataValue)) {
			newItem.repeaterData = dataValue;
			if (newItem.children && Array.isArray(newItem.children)) {
				newItem.children = injectValues(newItem.children, {}, debugMap);
			}
			debugMap[newItem.id || newItem.uuid] = `[repeater] ${dataValue.length} rows`;
			return newItem;
		}

		if (newItem.children && Array.isArray(newItem.children)) {
			newItem.children = injectValues(newItem.children, dataMap, debugMap);
		} else if (newItem.containerItems && Array.isArray(newItem.containerItems)) {
			newItem.containerItems = injectValues(newItem.containerItems, dataMap, debugMap);
		}

		const id = newItem.id || newItem.uuid;
		if (dataMap && id && dataMap[id] !== undefined && !isRepeater) {
			newItem.value = dataMap[id];
			if (newItem.attributes && typeof newItem.attributes === 'object') {
				const { value, defaultValue, checked, selected, ...rest } = newItem.attributes;
				newItem.attributes = {
					...rest,
					value: null,
					defaultValue: null,
					checked: dataMap[id],
					selected: dataMap[id]
				};
                newItem.value = dataMap[id];
			}
			debugMap[id] = dataMap[id];
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
