export const FONT_SCALE_STORAGE_KEY = "wordflow:fontScale";

export const FONT_SCALES = [
  { value: 0.875, label: "Small" },
  { value: 1, label: "Default" },
  { value: 1.125, label: "Large" },
  { value: 1.25, label: "X-Large" },
  { value: 1.375, label: "2X-Large" },
  { value: 1.5, label: "3X-Large" },
] as const;

export const DEFAULT_FONT_SCALE = 1;

export function isValidFontScale(value: number): boolean {
  return FONT_SCALES.some((option) => option.value === value);
}
