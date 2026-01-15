import { isFieldVisible } from './form';
import type { FormDefinition, Item, FieldValue } from '../types/form';
import { isClassSpecMask } from '$lib/utils/mask';

export type ValueType = 'string' | 'number' | 'date' | 'boolean';

export type ValidationRules = {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  length?: number;
  step?: number;
  pattern?: RegExp | string;
  mask?: string;
  isInteger?: boolean;
  isEmail?: boolean;
  isUrl?: boolean;
  custom?:
  | ((value: any) => string | null | undefined)
  | Array<(value: any) => string | null | undefined>;
};

export type ValidateOptions = {
  type?: ValueType;
  fieldLabel?: string;
};

// helper
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// normalize many unicode dashes (‐-‒–—―−﹘﹣－) to ASCII '-'
const DASH_RX = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
function normalizeMask(mask: string) {
  return mask?.normalize('NFKC').replace(DASH_RX, "-");
}

// Convert allowed-class spec to a permissive regex that allows partial typing
function classSpecToRegex(spec: string): RegExp | null {
  const s = normalizeMask(spec).trim();

  if (s === 'a-z' || s === 'A-Z' || s === 'a-zA-Z') return /^[A-Za-z]*$/;
  if (s === '0-9') return /^\d*$/;
  if (/^(?:a-z0-9|A-Z0-9|a-zA-Z0-9)$/i.test(s)) return /^[A-Za-z0-9]*$/;

  const m = s.match(/^\[([^\]]+)\]$/);
  if (m) {
    const inner = m[1]; // e.g. A-Za-z' -
    // We assume JSON provides a safe class; if needed you can further sanitize here.
    return new RegExp(`^[${inner}]*$`);
  }
  return null;
}

// Heuristic: does the mask contain known mask tokens (formatting masks)?
// Support both Maska-style (#/@/*) and legacy (9/a/*) tokens.
function containsMaskTokens(s: string) {
  return /[#@*9aA]/.test(s);
}

/**
 * Turn a mask into a full-match regex:
 *  - 9 => digit
 *  - a => letter
 *  - * => alphanumeric
 *  - others => literal characters
 */
export function compileMaskToRegex(mask: string): RegExp {
  const m = normalizeMask(mask);
  const pattern = Array.from(m)
    .map((ch) =>
      (ch === "9" || ch === "#" || ch === "N") ? "\\d"
        : (ch === "a" || ch === "A" || ch === "@") ? "[A-Za-z]"
          : (ch === "*" || ch === "X") ? "[A-Za-z0-9]"
            : escapeRe(ch)
    )
    .join("");
  return new RegExp(`^${pattern}$`);
}

function toRegExp(p: RegExp | string | undefined): RegExp | undefined {
  if (!p) return undefined;
  return typeof p === 'string' ? new RegExp(p) : p;
}

function nearInteger(n: number, step: number, base = 0): boolean {
  const eps = 1e-9;
  const q = (n - base) / step;
  return Math.abs(q - Math.round(q)) < eps;
}

/**
 * Parse a numeric string that may contain currency symbols, commas, or spaces.
 * Examples: "$1,234.56", "1,234.56", "1234.56" all become 1234.56
 */
export function parseNumericString(s: string): number | null {
  if (!s || typeof s !== 'string') return null;
  // Remove currency symbols, commas, spaces; keep only digits, decimal, and minus
  const cleaned = s.replace(/[^\d.-]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

/**
 * Validate values that are entered as masked/formatted strings (currency, phone, email).
 * Returns an error message string when invalid, or `null` when valid or not applicable.
 */
export function validateMaskedValue(
  value: any,
  attrs: Record<string, any> = {},
  opts: { fieldLabel?: string; isRequired?: boolean } = {}
): string | null {
  const label = opts.fieldLabel ?? 'This field';
  const isRequired = !!opts.isRequired;
  const maskType = attrs?.maskType;
  const mask = attrs?.mask;

  const isEmpty = !value || String(value).trim() === '';

  // Handle required check using standard message
  if (isEmpty && isRequired) {
    return buildErrorMessage('required', {}, label);
  }

  // If not required and empty, skip validation
  if (isEmpty) {
    return null;
  }

  // Phone: require at least 10 digits
  if (maskType === 'phone') {
    const digits = String(value).replace(/\D/g, '');
    if (digits.length < 10) {
      return buildErrorMessage('ten_digit_phone', {}, label);
    }
    return null;
  }

  // Email: validate format
  if (maskType === 'email') {
    // If a custom mask/pattern is provided, use it; otherwise use standard
    let emailRx: RegExp;
    if (typeof mask === 'string') {
      try {
        emailRx = new RegExp(mask);
        console.log("mask", mask, emailRx)
      } catch {
        emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      }
    } else {
      emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    }
    if (!emailRx.test(String(value))) {
      return buildErrorMessage('email', {}, label);
    }
    return null;
  }

  // Unknown maskType — treat as valid
  return null;
}

function buildErrorMessage(key: string, params: Record<string, any>, label: string): string {
  switch (key) {
    case 'required':
      return `${label} is required.`;
    case 'type_number':
      return `${label} must be a number.`;
    case 'type_integer':
      return `${label} must be an integer.`;
    case 'type_date':
      return `${label} must be a valid date.`;
    case 'min':
      return `${label} must be at least ${params.min}.`;
    case 'max':
      return `${label} must be at most ${params.max}.`;
    case 'range':
      return `${label} must be between ${params.min} and ${params.max}.`;
    case 'length_exact':
      return `${label} must be exactly ${params.length} characters.`;
    case 'minLength':
      return `${label} must be at least ${params.minLength} characters.`;
    case 'maxLength':
      return `${label} must be at most ${params.maxLength} characters.`;
    case 'pattern':
      return `${label} doesn't match the required format of ${params.mask}.`;
    case 'step':
      return `${label} must align to steps of ${params.step}${params.base !== undefined ? ` starting at ${params.base}` : ''}.`;
    case 'email':
      return `${label} must be a valid email address.`;
    case 'url':
      return `${label} must be a valid URL.`;
    case 'after':
      return `${label} must be on or after ${params.after}.`;
    case 'before':
      return `${label} must be on or before ${params.before}.`;
    case 'ten_digit_phone':
      return `${label} must have 10 digits.`;
    default:
      return `${label} is invalid.`;
  }
}

export function validateValue(
  value: any,
  rules: ValidationRules = {},
  opts: ValidateOptions = {}
): { valid: boolean; errors: string[]; firstError: string | null } {
  const type: ValueType = opts.type ?? 'string';
  const label = opts.fieldLabel ?? 'This field';
  const errors: string[] = [];

  const isEmpty = (() => {
    if (type === 'boolean') return value === undefined || value === null || value === false;
    if (type === 'number') return value === undefined || value === null || value === '';
    if (type === 'date') {
      // Only treat as empty if value is undefined, null, or blank string
      return value === undefined || value === null || value === '';
    }
    // string/any
    return value === undefined || value === null || String(value).trim() === '';
  })();

  if (rules.required && isEmpty) {
    errors.push(buildErrorMessage('required', {}, label));
    return { valid: false, errors, firstError: errors[0] };
  }

  // If not required and empty, skip the rest
  if (!rules.required && isEmpty) {
    return { valid: true, errors: [], firstError: null };
  }

  // Type-specific checks
  if (type === 'number') {
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isNaN(n)) {
      errors.push(buildErrorMessage('type_number', {}, label));
    } else {
      if (rules.isInteger && !Number.isInteger(n)) {
        errors.push(buildErrorMessage('type_integer', {}, label));
      }
      const hasMin = typeof rules.min === 'number';
      const hasMax = typeof rules.max === 'number';
      if (hasMin && hasMax && n < (rules.min as number) || hasMax && n > (rules.max as number)) {
        if (hasMin && hasMax && (n < (rules.min as number) || n > (rules.max as number))) {
          errors.push(buildErrorMessage('range', { min: rules.min, max: rules.max }, label));
        } else if (hasMin && n < (rules.min as number)) {
          errors.push(buildErrorMessage('min', { min: rules.min }, label));
        } else if (hasMax && n > (rules.max as number)) {
          errors.push(buildErrorMessage('max', { max: rules.max }, label));
        }
      } else {
        if (hasMin && n < (rules.min as number)) {
          errors.push(buildErrorMessage('min', { min: rules.min }, label));
        }
        if (hasMax && n > (rules.max as number)) {
          errors.push(buildErrorMessage('max', { max: rules.max }, label));
        }
      }
      if (typeof rules.step === 'number') {
        const base = typeof rules.min === 'number' ? rules.min : 0;
        if (!nearInteger(n, rules.step, base)) {
          errors.push(buildErrorMessage('step', { step: rules.step, base }, label));
        }
      }
    }
  }


  const s = String(value);
  if (typeof rules.length === 'number' && s.length !== rules.length) {
    errors.push(buildErrorMessage('length_exact', { length: rules.length }, label));
  }
  if (typeof rules.minLength === 'number' && s.length < rules.minLength) {
    errors.push(buildErrorMessage('minLength', { minLength: rules.minLength }, label));
  }
  if (typeof rules.maxLength === 'number' && s.length > rules.maxLength) {
    errors.push(buildErrorMessage('maxLength', { maxLength: rules.maxLength }, label));
  }
  const rx = toRegExp(rules.pattern);
  if (rx && !rx.test(s)) {
    errors.push(buildErrorMessage('pattern', { mask: rules.mask}, label));
  }
  if (rules.isEmail) {
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(s)) {
      errors.push(buildErrorMessage('email', {}, label));
    }
  }
  if (rules.isUrl) {
    try {
      new URL(s);
    } catch {
      errors.push(buildErrorMessage('url', {}, label));
    }
  }


  // Custom validators
  if (rules.custom) {
    const validators = Array.isArray(rules.custom) ? rules.custom : [rules.custom];
    for (const fn of validators) {
      const msg = fn(value);
      if (msg) errors.push(msg);
    }
  }

  return { valid: errors.length === 0, errors, firstError: errors[0] ?? null };
}

// Convenience mapper from common attribute names to rules
export function rulesFromAttributes(
  attrs: Record<string, any> = {},
  item?: { is_required?: boolean; type?: ValueType }
): ValidationRules {
  const rules: ValidationRules = {};

  // This prevents accessing array.length property which would be 0
  if (Array.isArray(attrs)) {
    attrs = {};
  }

  if (item?.is_required || attrs.required) rules.required = true;

  // Text-like
  if (attrs.maxCount != null) rules.maxLength = Number(attrs.maxCount);
  if (attrs.minLength != null) rules.minLength = Number(attrs.minLength);
  if (attrs.length != null) rules.length = Number(attrs.length);
  if (attrs.pattern != null) {
    const pRaw = normalizeMask(String(attrs.pattern).trim());
    // Preserve the original pattern string for error messages
    rules.mask = pRaw;
    if (isClassSpecMask(pRaw)) {
      const re = classSpecToRegex(pRaw); // -> ^[...]*$
      if (re) rules.pattern = re;
    } else {
      // keep as-is; if you prefer to force full-match, you can wrap with ^(?:... )$ here
      rules.pattern = pRaw;
    }
  }

  // input-mask -> pattern (skip for number inputs; they validate numeric value, not formatted string)
  if (!rules.pattern && typeof attrs.mask === "string" && attrs.mask.trim() && item?.type !== 'number') {
    const raw = normalizeMask(attrs.mask.trim());
    // Preserve the original mask string for error messages and diagnostics
    rules.mask = raw;

    if (isClassSpecMask(raw)) {
      // Allowed-character spec => permissive regex (allows partial typing)
      const re = classSpecToRegex(raw);
      if (re) rules.pattern = re;
    } else if (containsMaskTokens(raw)) {
      // Real formatting mask => compile a strict full-match regex
      rules.pattern = compileMaskToRegex(raw);
    } else {
      try {
        rules.pattern = new RegExp(raw);
      } catch {
        console.warn("Invalid regex mask ignored:", raw);
      }
    }
  }

  // Number-like
  if (attrs.min != null && item?.type !== 'date') rules.min = Number(attrs.min);
  if (attrs.max != null && item?.type !== 'date') rules.max = Number(attrs.max);
  if (attrs.step != null) rules.step = Number(attrs.step);
  if (attrs.integer === true) rules.isInteger = true;

  // Convenience flags
  if (attrs.email === true) rules.isEmail = true;
  if (attrs.url === true) rules.isUrl = true;

  return rules;
}


// --- Field Validation ---
export function validateAllFields(
  items?: Item[],
  formState?: Record<string, FieldValue>,
  groupState?: Record<string, FieldValue[]>
): {
  isValid: boolean;
  errors: Record<string, string | null>;
  errorList: string[];
  consolidatedMessage: string;
} {
  const win: any = typeof window !== 'undefined' ? window : undefined;

  const effectiveFormState: Record<string, FieldValue> =
    formState ?? (win?.__kilnFormState as Record<string, FieldValue>) ?? {};

  const formDefinition: FormDefinition =
    (win?.__kilnFormDefinition as FormDefinition) ??
    (win?.formData as FormDefinition);

  const effectiveItems: Item[] =
    items ?? ((formDefinition?.elements as Item[]) || []);

  const effectiveGroupState: Record<string, FieldValue[]> =
    groupState ?? (win?.__kilnGroupState as Record<string, FieldValue[]>) ?? {};

  const getType = (item: Item): ValueType => {
    switch (item.type) {
      case 'number-input':
        return 'number';
      case 'date-picker':
        return 'date';
      case 'checkbox-input':
        return 'boolean';
      case 'select-input':
      case 'radio-input':
      case 'text-input':
      case 'text-area':
      case 'textarea-input':
      case 'text-info':
      default:
        return 'string';
    }
  };

  const labelOf = (item: Item) =>
    item.attributes?.labelText ?? item.name ?? 'This field';

  const errors: Record<string, string | null> = {};
  const errorList: string[] = [];
  let isValid = true;

  // Infer rows for repeatable containers from stable keys (same logic as createSavedData)
  function inferRowsFromState(container: Item, state: Record<string, FieldValue>) {
    const rows: Record<string, FieldValue>[] = [];
    const childUuids = new Set((container.children || []).map((c) => c.uuid));
    const prefix = `${container.uuid}-`;

    // NEW: respect active group IDs if provided by Container.svelte
    const activeList: string[] | undefined = win?.__kilnActiveGroups?.[container.uuid];
    const active = Array.isArray(activeList) && activeList.length ? new Set(activeList) : undefined;

    const byGroupId = new Map<string, Record<string, FieldValue>>();

    for (const key of Object.keys(state)) {
      if (!key.startsWith(prefix)) continue;
      const matchedChildUuid = [...childUuids].find((cu) => key.endsWith(`-${cu}`));
      if (!matchedChildUuid) continue;

      const rest = key.slice(prefix.length); // "<groupId>-<childUuid>"
      const suffix = `-${matchedChildUuid}`;
      const groupId = rest.slice(0, rest.length - suffix.length);

      // Skip stale/removed groups when we know the active set
      if (active && !active.has(groupId)) continue;

      const groupObj = byGroupId.get(groupId) ?? {};
      groupObj[matchedChildUuid] = state[key];
      byGroupId.set(groupId, groupObj);
    }

    for (const [gid, row] of byGroupId.entries()) {
      if (!active || active.has(gid)) rows.push(row);
    }
    return rows;
  }

  function validateItem(item: Item, state: Record<string, FieldValue>, ctx?: { container?: Item; rowIndex?: number }) {
    if (item.type === 'container' && item.children) {
      const isRepeatable = item.attributes?.isRepeatable === true;

      if (isRepeatable) {
        // Prefer explicit groupState rows when provided
        const explicitRows = effectiveGroupState[item.uuid];
        const rows = Array.isArray(explicitRows) && explicitRows.length > 0
          ? explicitRows
          : inferRowsFromState(item, effectiveFormState);

        rows.forEach((rowState, idx) => {
          for (const child of item.children || []) {
            if (child.type === 'container' && child.children) {
              // nested container: recurse passing rowState
              validateItem(child, rowState as Record<string, FieldValue>, { container: item, rowIndex: idx });
            } else {
              if (
                rowState &&
                typeof rowState === 'object' &&
                !Array.isArray(rowState) &&
                isFieldVisible(child, 'web', rowState as Record<string, FieldValue>)
              ) {
                runValidation(child, rowState as Record<string, FieldValue>, {
                  container: item,
                  rowIndex: idx
                });
              }
            }
          }
        });
      } else {
        // Non-repeatable container: recurse with top-level form state
        for (const child of item.children) {
          if (child.type === 'container' && child.children) {
            validateItem(child, effectiveFormState, { container: item });
          } else {
            if (isFieldVisible(child, 'web', effectiveFormState)) {
              runValidation(child, effectiveFormState, { container: item });
            }
          }
        }
      }
      return;
    }

    // Leaf/simple field
    if (isFieldVisible(item, 'web', state)) {
      runValidation(item, state, ctx);
    }
  }

  function runValidation(item: Item, state: Record<string, FieldValue>, ctx?: { container?: Item; rowIndex?: number }) {
    const type = getType(item);
    const rules = rulesFromAttributes(item.attributes, { is_required: item.is_required, type });
    const fieldLabel = labelOf(item);

    // Use state first; if missing, fall back to item-provided value (e.g., preloaded/bound)
    let value = state[item.uuid];
    if (value === undefined || value === null ) {
      const fallback = item.attributes?.value ?? (item as any).value;
      if (fallback !== undefined) value = fallback;
    }

    const { firstError } = validateValue(value, rules, { type, fieldLabel });
    if (firstError) {
      isValid = false;

      // Create a unique key (handles repeatable rows without clobbering)
      const errorKey = ctx?.rowIndex != null
        ? `${item.uuid}__row_${ctx.rowIndex}`
        : item.uuid;

      // Surface only the first message per key (keep concise)
      if (!errors[errorKey]) {
        errors[errorKey] = firstError;

        const pathParts: string[] = [];
        if (ctx?.container) {
          const legend = ctx.container.attributes?.legend ?? ctx.container.name ?? ctx.container.uuid;
          if (ctx?.rowIndex != null) {
            pathParts.push(`${legend} #${ctx.rowIndex + 1}`);
          } else {
            pathParts.push(legend);
          }
        }
        const pathPrefix = pathParts.length ? `${pathParts.join(' > ')}: ` : '';
        errorList.push(`${pathPrefix}${fieldLabel} - ${firstError}`);
      }
    }
  }

  // Walk the provided or global items
  for (const item of effectiveItems) {
    validateItem(item, effectiveFormState);
  }

  const consolidatedMessage = isValid
    ? 'All fields are valid.'
    : ['Please fix the following errors:', ...errorList.map((e) => `• ${e}`)].join('\n');

  try {
    if (typeof window !== 'undefined') {
      (window as any).__kilnLastValidation = { isValid, errors, errorList, consolidatedMessage };
      window.dispatchEvent(
        new CustomEvent('kiln2:validation-result', {
          detail: { isValid, errors, errorList, consolidatedMessage }
        })
      );
    }
  } catch (e) {
    console.log('validation broadcast error:', e);
  }
  
  return { isValid, errors, errorList, consolidatedMessage };
}
