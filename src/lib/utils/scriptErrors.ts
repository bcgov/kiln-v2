import { writable } from "svelte/store";

export type ScriptErrors = Record<string, string>;

export const scriptErrors = writable<ScriptErrors>({});