import type { Artwork, Transform } from '../types.ts'
import { clamp } from './dpi.ts'

export const DEFAULT_TRANSFORM: Transform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
}

/**
 * 约束图片排版位置与缩放，保证画稿完全覆盖目标工作区
 */
export function constrainTransform(
  transform: Transform,
  artwork?: Artwork | null,
  targetAspect = 1,
): Transform {
  const scale = clamp(transform.scale, 1, 4)

  if (!artwork || !artwork.width || !artwork.height) {
    return {
      scale,
      offsetX: clamp(transform.offsetX, -1, 1),
      offsetY: clamp(transform.offsetY, -1, 1),
    }
  }

  const imageAspect = artwork.width / artwork.height
  const baseScale =
    imageAspect > targetAspect ? imageAspect / targetAspect : targetAspect / imageAspect

  const coverScale = baseScale * scale
  const maxOffsetX = imageAspect >= targetAspect
    ? Math.max(0, (coverScale - 1) / 2)
    : Math.max(0, (scale - 1) / 2)
  const maxOffsetY = imageAspect >= targetAspect
    ? Math.max(0, (scale - 1) / 2)
    : Math.max(0, (coverScale - 1) / 2)

  return {
    scale,
    offsetX: clamp(transform.offsetX, -maxOffsetX, maxOffsetX),
    offsetY: clamp(transform.offsetY, -maxOffsetY, maxOffsetY),
  }
}

