export const DEFAULT_DPI = 300
export const MM_PER_INCH = 25.4

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 将物理毫米尺寸换算为 300 DPI 工业印刷像素尺寸
 */
export function mmToPixels(mm: number, dpi = DEFAULT_DPI): number {
  return Math.round((mm / MM_PER_INCH) * dpi)
}

/**
 * 将 300 DPI 像素尺寸换算为物理毫米尺寸
 */
export function pixelsToMm(pixels: number, dpi = DEFAULT_DPI): number {
  return Number(((pixels / dpi) * MM_PER_INCH).toFixed(2))
}

