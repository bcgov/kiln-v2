import { scriptErrors } from "$lib/utils/scriptErrors";

function syncToWindow(next: Record<string, string>) {
  if (typeof window !== "undefined") {
    (window as any).__kilnScriptErrors = next;
  }
}

export function setScriptError(fieldId: string, message: string) {
  scriptErrors.update((curr) => {
    const next = { ...curr, [fieldId]: message };
    syncToWindow(next);
    return next;
  });
}

export function clearScriptError(fieldId: string) {
  scriptErrors.update((curr) => {
    const next = { ...curr };
    delete next[fieldId];
    syncToWindow(next);
    return next;
  });
}

export function clearAllScriptErrors() {
  scriptErrors.set({});
}