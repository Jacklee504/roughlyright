/** Shared presentation helpers for round marks (recap, share page, review). */

export const MARK_ICONS: Record<string, string> = {
  Exact: "◎",
  Close: "✓",
  "In range": "≈",
  Far: "✗",
  Pass: "–",
};

export function markClass(mark: string): string {
  return `mark mark-${mark.replace(/\s+/g, "-")}`;
}

export function markIcon(mark: string): string {
  return MARK_ICONS[mark] ?? "";
}
