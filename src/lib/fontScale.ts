export const FONT_SCALE_STORAGE_KEY = "wordflow:fontScale";

export const FONT_SCALES = [
  { value: 0.875, label: "작게" },
  { value: 1, label: "보통" },
  { value: 1.125, label: "크게" },
  { value: 1.25, label: "아주 크게" },
] as const;

export const DEFAULT_FONT_SCALE = 1;

export function isValidFontScale(value: number): boolean {
  return FONT_SCALES.some((option) => option.value === value);
}
