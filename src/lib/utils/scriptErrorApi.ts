import { scriptErrors } from "$lib/utils/scriptErrors";

export function setScriptError(fieldId: string, message: string) {
  scriptErrors.update((curr) => ({
    ...curr,
    [fieldId]: message
  }));
}

export function clearScriptError(fieldId: string) {
  scriptErrors.update((curr) => {
    const next = { ...curr };
    delete next[fieldId];
    return next;
  });
}

export function clearAllScriptErrors() {
  scriptErrors.set({});
}