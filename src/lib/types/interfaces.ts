export type ActionResultPayload = {
  index: number;
  label?: string;
  ok: boolean;
  error?: unknown;
  validationErrors?: unknown[];
};