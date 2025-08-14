export function getApiUrl(path: string, envVar?: string): string {
    const isDev = import.meta.env.DEV;
    if (isDev && envVar) {
      return envVar;
    }

      if (typeof window !== "undefined") {

        
        const match = window.location.pathname.match(/^\/(formfoundry-[^/]+)/);
        const prefix = match ? `/${match[1]}` : "";
        
        // ensure path starts with a slash
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        
        
        return `${prefix}/api${cleanPath}`;
      }
      return `/api${path}`;
}

export function requiredLabel(labelText: string, required: boolean): string {
  if (required) {
    return `${labelText} <span class="required">*</span>`;
  }
  return labelText;
}

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