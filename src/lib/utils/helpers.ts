/**
 * Resolve an API URL considering dev overrides and hosted path prefixes.
 */
export function getApiUrl(path: string, envVar?: string): string {
	console.log("ENV VAR: ",envVar);
    if (envVar) {
      return envVar;
    }

      if (typeof window !== "undefined") {

        
        const match = window.location.pathname.match(/^\/(formfoundry-[^/]+)/);
        const prefix = match ? `/${match[1]}` : "";
        
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        
        
        return `${prefix}/api${cleanPath}`;
      }
      return `/api${path}`;
}

/** Set is_read_only on all items under formData.elements. */
export function setReadOnlyFields(formData: any) {
		function recurse(items: any[]) {
			if (!Array.isArray(items)) return;
			for (const item of items) {
				if (item.attributes) {
					item.is_read_only = true;
				}
				if (item.children) {
					recurse(item.children);
				}
			}
		}
		if (formData?.elements) {
			recurse(formData.elements);
		}
		return formData;
	}

/** Drop null/undefined/empty-string values from an attributes object. */
export function filterAttributes<T extends Record<string, any> | null | undefined>(
  attrs: T
): Partial<NonNullable<T>> {
  if (!attrs) return {};
  const entries = Object.entries(attrs).filter(([, v]) => v !== null && v !== undefined && v !== "");
  return Object.fromEntries(entries) as Partial<NonNullable<T>>;
}

export interface BuildFieldAriaConfig {
	uuid: string;
	labelText?: string;
	helperText?: string;
	isRequired?: boolean;
	readOnly?: boolean;
	includeLabelledBy?: boolean; 
}

export function buildFieldAria(cfg: BuildFieldAriaConfig) {
	const {
		uuid,
		labelText,
		helperText,
		isRequired,
		readOnly,
		includeLabelledBy = true
	} = cfg;
	const labelId = labelText && includeLabelledBy ? `${uuid}-label` : undefined;
	const helperId = helperText ? `${uuid}-helper` : undefined;
	const errorId = `${uuid}-error`;
	const describedByIds = [errorId, helperId].filter(Boolean).join(' ');
	const ariaProps: Record<string, any> = {};
	if (labelId) ariaProps['aria-labelledby'] = labelId;
	if (describedByIds) ariaProps['aria-describedby'] = describedByIds;
	if (isRequired) ariaProps['aria-required'] = true;
	if (readOnly) ariaProps['aria-readonly'] = true;
	return {
		labelId,
		helperId,
		errorId,
		describedBy: describedByIds || undefined,
		ariaProps
	};
}

import type { Item } from '$lib/types/form';

export function getFieldLabel(item: Item): string {
	return item.attributes?.labelText ?? item.attributes?.text ?? item.name ?? '';
}
