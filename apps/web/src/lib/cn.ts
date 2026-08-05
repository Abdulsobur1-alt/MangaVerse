/** Falsy-filtering class-name joiner (clsx-style, zero dependencies). */
export type ClassValue = string | number | null | false | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
