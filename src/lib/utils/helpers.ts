/**
 * Resolve an API URL considering dev overrides and hosted path prefixes.
 */
export function getApiUrl(path: string, envVar?: string): string {
    const isDev = import.meta.env.DEV;
    if (isDev && envVar) {
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