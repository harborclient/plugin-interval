import { substituteVariables } from "@harborclient/sdk/http";

const VARIABLE_PATTERN = /\{\{\s*[\w.-]+\s*\}\}/;

/**
 * Returns true when unresolved {{variable}} placeholders remain in text.
 *
 * @param text - Text after variable substitution.
 */
export function hasUnresolvedVariables(text: string): boolean {
  return VARIABLE_PATTERN.test(text);
}

/**
 * Result of resolving a numeric timer field from raw editor text.
 */
export interface ResolvedTimerField {
  /**
   * Parsed positive integer when validation succeeded.
   */
  value?: number;

  /**
   * Validation error when the field is invalid or unresolved.
   */
  error?: string;
}

/**
 * Substitutes variables then validates a required positive integer field.
 *
 * @param raw - Editor value, possibly containing {{variables}}.
 * @param variables - Merged collection and environment variable map.
 */
export function resolvePositiveInt(
  raw: string,
  variables: Record<string, string>
): ResolvedTimerField {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Value is required" };
  }

  const resolved = substituteVariables(trimmed, variables);
  if (hasUnresolvedVariables(resolved)) {
    return { error: "Unresolved variable placeholder" };
  }

  const parsed = Number(resolved);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: "Must be a positive integer" };
  }

  return { value: parsed };
}

/**
 * Substitutes variables then validates an optional positive integer field.
 *
 * Empty input is treated as unlimited (no max sends cap).
 *
 * @param raw - Editor value, possibly containing {{variables}}.
 * @param variables - Merged collection and environment variable map.
 */
export function resolveOptionalPositiveInt(
  raw: string,
  variables: Record<string, string>
): ResolvedTimerField {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: undefined };
  }

  return resolvePositiveInt(trimmed, variables);
}
