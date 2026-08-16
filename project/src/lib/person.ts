import type { Translator } from './i18n/core';

/**
 * TMDB's `known_for_department` is always English ("Acting", "Directing"…).
 * Map it to the UI language, falling back to the raw value for any department
 * we don't have a translation for (t() returns the key when it's missing).
 */
export function departmentLabel(t: Translator, dept: string): string {
  if (!dept) return '';
  const key = `person.dept.${dept}`;
  const label = t(key);
  return label === key ? dept : label;
}
