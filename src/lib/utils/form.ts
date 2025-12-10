import type { FormDefinition, Item, FieldValue, FormData, SavedData } from '../types/form';
import { ensureFreshToken } from '$lib/utils/keycloak';


function getCookie(name: string): string | null {
	const match = document.cookie.match(
		new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
	);
	return match ? decodeURIComponent(match[1]) : null;
}

// --- Visibility ---
export function isFieldVisible(
  item: Item,
  mode: 'web' | 'pdf' = 'web',
  formState?: Record<string, FieldValue>
): boolean {
  // Use visible_web or visible_pdf
  let visible = mode === 'pdf' ? item.visible_pdf !== false : item.visible_web !== false;
  // Evaluate custom_visibility if present
  if (item.custom_visibility && typeof item.custom_visibility === 'string') {
    try {
      // The custom_visibility string should be a JS function body, e.g. "{return true}"
      // Allow access to formState if needed
      const fn = new Function('formState', item.custom_visibility.replace(/^{|}$/g, ''));
      visible = !!fn(formState || {});
    } catch (e) {
      // fallback to previous visible value
    }
  }
  return visible;
}

// --- Save logic ---
// Determine if a field should be included in the saved data
export function shouldFieldBeIncludedForSaving(
  item: Item,
  mode: 'web' | 'pdf' = 'web',
  formState?: Record<string, FieldValue>
): boolean {
  // Save if visible or save_on_submit is true
  return isFieldVisible(item, mode, formState) || !!item.save_on_submit;
}

// --- Save data creation ---
// Create the payload to be sent to the save API
export function createSavedData(ctx?: {
  formState?: Record<string, FieldValue>;
  groupState?: Record<string, FieldValue[]>;
  items?: Item[];
  formDefinition?: FormDefinition;
  metadata?: Record<string, any>;
}): SavedData {
  const win: any = typeof window !== 'undefined' ? window : undefined;

  const formState: Record<string, FieldValue> =
    ctx?.formState ?? (win?.__kilnFormState as Record<string, FieldValue>) ?? {};

  const formDefinition: FormDefinition =
    ctx?.formDefinition ??
    (win?.__kilnFormDefinition as FormDefinition) ??
    (win?.formData as FormDefinition);

  const items: Item[] = ctx?.items ?? ((formDefinition?.elements as Item[]) || []);

  const groupState: Record<string, FieldValue[]> =
    ctx?.groupState ?? (win?.__kilnGroupState as Record<string, FieldValue[]>) ?? {};

  const saveFieldData: Record<string, FieldValue> = {};

  function processItems(list: Item[], state: Record<string, FieldValue>) {
    for (const item of list) {
      if (item.type === 'container' && item.children) {
        const isRepeatable = item.attributes?.isRepeatable === true;

        if (isRepeatable) {
          // Prefer explicit groupState rows when provided
          const explicitRows = groupState[item.uuid];
          if (Array.isArray(explicitRows) && explicitRows.length > 0) {
            const rows = explicitRows
              .map((rowState) => {
                const row: Record<string, FieldValue> = {};
                for (const child of item.children || []) {
                  if (
                    rowState &&
                    typeof rowState === 'object' &&
                    !Array.isArray(rowState) &&
                    shouldFieldBeIncludedForSaving(child, 'web', rowState as Record<string, FieldValue>) &&
                    (rowState as Record<string, FieldValue>)[child.uuid] !== undefined
                  ) {
                    row[child.uuid] = (rowState as Record<string, FieldValue>)[child.uuid];
                  }
                }
                return Object.keys(row).length > 0 ? row : null;
              })
              .filter(Boolean) as Record<string, FieldValue>[];

            if (rows.length > 0) {
              saveFieldData[item.uuid] = rows as unknown as FieldValue;
            }
            continue;
          }

          // Infer rows using Container.svelte stableKey pattern: `${containerUuid}-${groupId}-${originalChildUuid}`
          const childUuids = new Set((item.children || []).map((c) => c.uuid));
          const prefix = `${item.uuid}-`;
          const byGroupId = new Map<string, Record<string, FieldValue>>();

          for (const key of Object.keys(state)) {
            if (!key.startsWith(prefix)) continue;

            const matchedChildUuid = [...childUuids].find((cu) => key.endsWith(`-${cu}`));
            if (!matchedChildUuid) continue;

            const rest = key.slice(prefix.length); // "<groupId>-<childUuid>"
            const suffix = `-${matchedChildUuid}`;
            const groupId = rest.slice(0, rest.length - suffix.length);

            const groupObj = byGroupId.get(groupId) ?? {};
            groupObj[matchedChildUuid] = state[key];
            byGroupId.set(groupId, groupObj);
          }

          const inferredRows = [...byGroupId.values()].filter((row) => Object.keys(row).length > 0);
          if (inferredRows.length > 0) {
            saveFieldData[item.uuid] = inferredRows as unknown as FieldValue;
          }
        } else {
          // Non-repeatable: process children as normal fields
          for (const child of item.children) {
            if (child.type === 'container' && child.children) {
              processItems([child], state);
            } else if (shouldFieldBeIncludedForSaving(child, 'web', state)) {
              const val = state[child.uuid];
              if (val !== undefined) {
                saveFieldData[child.uuid] = val;
              }
            }
          }
        }
      } else {
        // Simple field
        if (shouldFieldBeIncludedForSaving(item, 'web', state)) {
          const val = state[item.uuid];
          if (val !== undefined) {
            saveFieldData[item.uuid] = val;
          }
        }
      }
    }
  }

  processItems(items, formState);

  const updatedMetadata = {
    ...(ctx?.metadata || {}),
    updated_date: new Date().toISOString()
  };

  // Ensure form_definition is a Template object
  const template: any = {
    ...formDefinition,
    id: (formDefinition as any).id ?? '',
    version: (formDefinition as any).version ?? '',
    status: (formDefinition as any).status ?? '',
    data: (formDefinition as any).data ?? {},
    created_by: (formDefinition as any).created_by ?? '',
    created_date: (formDefinition as any).created_date ?? '',
    updated_by: (formDefinition as any).updated_by ?? '',
    updated_date: (formDefinition as any).updated_date ?? '',
  };

  return {
    data: saveFieldData,
    form_definition: template,
    metadata: updatedMetadata
  };
}

// helper
function hydrateFormStateFromDOM(formDefinition?: FormDefinition) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!formDefinition) return;

  const w = window as any;

  const formState: Record<string, FieldValue> =
    (w.__kilnFormState as Record<string, FieldValue>) || (w.__kilnFormState = {});

  const activeGroups: Record<string, string[]> =
    (w.__kilnActiveGroups as Record<string, string[]>) || (w.__kilnActiveGroups = {});

  const readElementValue = (id: string): string | undefined => {
    const el = document.getElementById(id) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null;

    if (!el) return undefined;

    // for our use-case (text inputs, dates, etc...) .value is fine
    const raw = (el as any).value;
    if (raw == null) return undefined;

    const s = String(raw);
    // do not overwrite with blank string
    if (s.trim() === '') return undefined;

    return s;
  };

  const walk = (items: Item[]) => {
    for (const item of items) {
      // Containers
      if (item.type === 'container' && Array.isArray(item.children) && item.children.length) {
        const isRepeatable = item.attributes?.isRepeatable === true;

        if (isRepeatable) {
          // For repeaters, we rely on stableKey = `${containerUuid}-${groupId}-${childUuid}`
          const groupIds = activeGroups[item.uuid] || [];
          for (const child of item.children) {
            const childUuid = child.uuid;
            for (const groupId of groupIds) {
              const stableKey = `${item.uuid}-${groupId}-${childUuid}`;

              // Always take the current DOM value if present and different
              const v = readElementValue(stableKey);
              if (v !== undefined && formState[stableKey] !== v) {
                formState[stableKey] = v;
              }
            }
          }
        } else {
          // Non-repeatable container – recurse into children
          walk(item.children);
        }
        continue;
      }

      // Simple field (non-container)
      const uuid = item.uuid;
      if (!uuid) continue;

      const v = readElementValue(uuid);
      if (v !== undefined && formState[uuid] !== v) {
        formState[uuid] = v;
      }
    }
  };

  walk((formDefinition.elements as Item[]) || []);
}


export async function saveFormData(action: 'save' | 'save_and_close' | 'generate'): Promise<string> {
  try {
    // @ts-ignore
    const { API } = await import('$lib/utils/api');
    let saveFormDataEndpoint = API.saveFormData;
    if (action === 'generate'){
      saveFormDataEndpoint = API.saveFormDataGenerate;
    }

    const win: any = typeof window !== 'undefined' ? window : undefined;

    // Get formDefinition first so we can hydrate from DOM
    const formDefinition: FormDefinition =
      (win?.__kilnFormDefinition as FormDefinition) ??
      (win?.formData as FormDefinition);

    // Ensure __kilnFormState has values for all visible fields
    hydrateFormStateFromDOM(formDefinition);

    // After hydration, read the updated formState + groupState
    const formState: Record<string, FieldValue> =
      (win?.__kilnFormState as Record<string, FieldValue>) ?? {};

    const items: Item[] = ((formDefinition?.elements as Item[]) || []);

    const groupState: Record<string, FieldValue[]> =
      (win?.__kilnGroupState as Record<string, FieldValue[]>) ?? {};

    const state = sessionStorage.getItem("formParams");
    const sessionParams = state ? (JSON.parse(state) as Record<string, string>) : {};
    const token = (window as any)?.keycloak?.token ?? null;

    // Force-sync all date inputs into formState at save time
    if (typeof document !== 'undefined') {
      const dateInputs = document.querySelectorAll<HTMLInputElement>('input[data-kiln-date="true"]');
      dateInputs.forEach((input) => {
        const uuid = input.getAttribute('data-kiln-uuid');
        if (!uuid) return;

        const v = input.value;
        // Only write non-empty values; avoid clobbering with ""
        if (v && v.trim() !== '') {
          formState[uuid] = v;
        }
      });
    }

    // ---- NORMALIZE groupState (handles nested repeaters and preserves visual order) ----
    const activeGroups: Record<string, string[]> =
      (win?.__kilnActiveGroups as Record<string, string[]>) || {};

    const normalizeGroupStateTree = (list: Item[]) => {
      if (!Array.isArray(list)) return;

      for (const it of list) {
        if (!it) continue;

        if (it.type === 'container' && it.attributes?.isRepeatable === true) {
          const containerUuid = it.uuid;
          const gs = groupState[containerUuid] as any;

          if (Array.isArray(gs) && gs.length > 0) {
            const first = gs[0];
            const looksLikeRowObject =
              typeof first === 'object' && first !== null && !Array.isArray(first);

            if (!looksLikeRowObject) {
              // Case: ID array -> build row objects IN THAT ORDER from formState
              const idArray: string[] = gs as string[];
              const rows: Record<string, FieldValue>[] = idArray.map((gid) => {
                const row: Record<string, FieldValue> = {};
                for (const child of (it.children || [])) {
                  const childUuid = (child as Item).uuid;
                  const stableKey = `${containerUuid}-${gid}-${childUuid}`;
                  const v = formState[stableKey];
                  if (v !== undefined) row[childUuid] = v;
                }
                return row;
              });
              groupState[containerUuid] = rows as unknown as FieldValue[];
            }
          } else {
            // Case: empty/missing -> infer rows; try to preserve order via __kilnActiveGroups
            const active = activeGroups[containerUuid] || [];

            // discover group ids present in formState for this container
            const present = new Set<string>();
            Object.keys(formState).forEach((k) => {
              if (!k.startsWith(containerUuid + '-')) return;
              const rest = k.slice(containerUuid.length + 1);
              const gid = rest.split('-')[0];
              present.add(gid);
            });

            const orderedIds = active.length
              ? active.filter((gid) => present.has(gid))
              : Array.from(present.values());

            const rows: Record<string, FieldValue>[] = orderedIds.map((gid) => {
              const row: Record<string, FieldValue> = {};
              for (const child of (it.children || [])) {
                const childUuid = (child as Item).uuid;
                const stableKey = `${containerUuid}-${gid}-${childUuid}`;
                const v = formState[stableKey];
                if (v !== undefined) row[childUuid] = v;
              }
              return row;
            });

            groupState[containerUuid] = rows as unknown as FieldValue[];
          }
        }

        // Recurse – normalize nested containers too
        if (it.type === 'container' && Array.isArray(it.children) && it.children.length) {
          normalizeGroupStateTree(it.children as Item[]);
        }
      }
    };

    normalizeGroupStateTree(items);
    // ---- END NORMALIZE ----

    const payload = {
      action,
      formState,
      groupState,
      formDefinition,
      metadata: {
        updated_date: new Date().toISOString()
      },
      items,
      sessionParams
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const username = getCookie("username");
    if (username && username.trim() !== "") {
      payload.sessionParams.username = username.trim();
    } 
    else {
      let token = (window as any)?.keycloak?.token ?? (getCookie("token") as string | null) ?? null;
      if (!token) {
        const freshToken = await ensureFreshToken(5);
        token = freshToken ?? null; 
      }
      if (token) {
        payload.sessionParams.token = token;
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const response = await fetch(saveFormDataEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log("Save result:", result);

      if (result.data?.action === 'save_and_close') {
        const { saved, unlocked } = result.data;
        if (saved && unlocked) {
          return "success";
        } else if (saved && !unlocked) {
          return "Form saved successfully, but failed to unlock. You may need to close manually.";
        } else {
          return "Failed to save form.";
        }
      }

      return "success";
    } else {
      const errorData = await response.json();
      console.error("Save error:", errorData.error);
      return errorData?.error || "Error saving form. Please try again.";
    }
  } catch (error) {
    console.error("Save error:", error);
    return "failed";
  }
}


export async function unlockICMFinalFlags(): Promise<string> {
  try {
    // @ts-ignore dynamic import to avoid circular refs during SSR
    const { API } = await import('$lib/utils/api');
    const unlockICMFinalEndpoint = API.unlockICMData;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    // Build request body from session storage formParams
    let body: Record<string, any> = {};
    if (typeof window !== 'undefined') {
      const state = window.sessionStorage.getItem('formParams');
      const params = state ? (JSON.parse(state) as Record<string, string>) : {};
      body = { ...params };

      const username = getCookie("username");
      if (username && username.trim() !== "") {
        body.username = username.trim();
      } 
      else {
        let token = (window as any)?.keycloak?.token ?? (getCookie("token") as string | null) ?? null;
        if (!token) {
          const freshToken = await ensureFreshToken(5);
          token = freshToken ?? null; 
        }
        if (token) {
          body.token = token;
          headers.Authorization = `Bearer ${token}`;
        }
      }
    }

    const response = await fetch(unlockICMFinalEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      keepalive: true
    });
    if (response.ok) {
      try {
        const result = await response.json();
      } catch (e){
        console.warn('Unlock ICM Final Flags: No JSON response body', e);
      }
      return 'success';
    } else {
      console.error('Error:', response.statusText);
      return 'failed';
    }
  } catch (error) {
    console.error('Error:', error);
    return 'failed';
  }
}

// --- PDF Payload Placeholder---
export async function generatePDF(formData: FormDefinition, pdfId: string){
  const payload: Record<string, any> = {}
  		try {
			const { getAuthHeaders } = await import('./auth-headers');
			const headers = await getAuthHeaders();

			const payload = {}
			const response = await fetch(`/api/pdf-template/${pdfId}`, {
				method: 'POST',
				headers,
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch PDF (${response.status})`);
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${formData?.form_id || 'form'}.pdf`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.warn('PDF template download failed:', error);

		}
  return { data: payload };
}

// --- Button Action Placeholder ---
export async function submitForButtonAction(buttonConfig: any): Promise<string> {

      // @ts-ignore dynamic import to avoid circular refs during SSR
    const { API } = await import('$lib/utils/api');
    const submitForButtonAction = API.submitForButtonAction;

    try {
			const state = sessionStorage.getItem('formParams');
			const params = state ? JSON.parse(state) : {};
			const savedJson = {
				tokenId: params.id,
				savedForm: JSON.stringify(createSavedData()),
				config: buttonConfig
			};
			// @ts-ignore
			const { API } = await import('$lib/utils/api');
			// await submitForButtonAction(savedJson);
			return 'success';
		} catch (error) {
			console.error('Error:', error);
			return 'failed';
		}
	}
