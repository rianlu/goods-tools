export const OUTPUT_DPI = 300

export type BadgeShape = 'round' | 'square'

export const BADGE_SHAPES: Array<{ id: BadgeShape; label: string }> = [
  { id: 'round', label: '圆形' },
  { id: 'square', label: '方形' },
]

export type BadgePreset = {
  id: string
  label: string
  finishedDiameterMm: number
  printDiameterMm: number
  safeDiameterMm: number
}

// ponytail: generic wrap values, replace with measured per-shape profiles when physical calibration matters.
export const BADGE_PRESETS: BadgePreset[] = [
  { id: '25', label: '25mm', finishedDiameterMm: 25, printDiameterMm: 31, safeDiameterMm: 23 },
  { id: '32', label: '32mm', finishedDiameterMm: 32, printDiameterMm: 38, safeDiameterMm: 30 },
  { id: '44', label: '44mm', finishedDiameterMm: 44, printDiameterMm: 52, safeDiameterMm: 42 },
  { id: '58', label: '58mm', finishedDiameterMm: 58, printDiameterMm: 70, safeDiameterMm: 54 },
  { id: '75', label: '75mm', finishedDiameterMm: 75, printDiameterMm: 87, safeDiameterMm: 71 },
]

export const DEFAULT_BADGE_PRESET = BADGE_PRESETS[3]

export function previewDiameterRatio(finishedDiameterMm: number) {
  const normalized =
    (clamp(finishedDiameterMm, 25, 75) - 25) / (75 - 25)
  return 0.44 + normalized * 0.28
}

export type Transform = {
  offsetX: number
  offsetY: number
  zoom: number
}

export type ImageSize = {
  width: number
  height: number
}

export const DEFAULT_TRANSFORM: Transform = {
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function mmToPixels(mm: number, dpi = OUTPUT_DPI) {
  if (!Number.isFinite(mm) || mm <= 0 || !Number.isFinite(dpi) || dpi <= 0) {
    throw new RangeError('尺寸和 DPI 必须大于 0')
  }

  return Math.round((mm / 25.4) * dpi)
}

export function coverGeometry(image: ImageSize, zoom: number) {
  if (image.width <= 0 || image.height <= 0) {
    throw new RangeError('图片尺寸必须大于 0')
  }

  const safeZoom = clamp(zoom, 1, 4)
  const baseScale = 1 / Math.min(image.width, image.height)
  const width = image.width * baseScale * safeZoom
  const height = image.height * baseScale * safeZoom

  return {
    width,
    height,
    maxOffsetX: Math.max(0, (width - 1) / 2),
    maxOffsetY: Math.max(0, (height - 1) / 2),
  }
}

export function constrainTransform(
  transform: Transform,
  image: ImageSize,
): Transform {
  const geometry = coverGeometry(image, transform.zoom)
  const offsetX = clamp(
    transform.offsetX,
    -geometry.maxOffsetX,
    geometry.maxOffsetX,
  )
  const offsetY = clamp(
    transform.offsetY,
    -geometry.maxOffsetY,
    geometry.maxOffsetY,
  )

  return {
    zoom: clamp(transform.zoom, 1, 4),
    offsetX: offsetX === 0 ? 0 : offsetX,
    offsetY: offsetY === 0 ? 0 : offsetY,
  }
}
