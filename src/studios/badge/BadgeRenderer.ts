import { drawMappedArtwork } from '../../core/engine/canvas-utils.ts'
import { mmToPixels } from '../../core/geometry/dpi.ts'
import type { BaseCraft, FilmCraft, ViewMode } from '../../core/types.ts'
import { previewDiameterRatio, type BadgeShape } from './presets.ts'
import type { BadgeState } from './types.ts'

export const DISPLAY_SIZE = 900
export const PREVIEW_EXPORT_SIZE = 1080

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D rendering context is not available.')
  }
  return context
}

// ---------------------------------------------------------------------------
// Seeded PRNG for deterministic procedural textures
// ---------------------------------------------------------------------------

function seededRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ---------------------------------------------------------------------------
// Shape Path Helpers
// ---------------------------------------------------------------------------

export function shapePath(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  size: number,
) {
  context.beginPath()
  if (shape === 'round') {
    context.arc(centerX, centerY, size / 2, 0, Math.PI * 2)
  } else {
    const half = size / 2
    const radius = size * 0.08
    context.roundRect(centerX - half, centerY - half, size, size, radius)
  }
}

export function shapeRingPath(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  outerSize: number,
  innerSize: number,
) {
  context.beginPath()
  if (shape === 'round') {
    context.arc(centerX, centerY, outerSize / 2, 0, Math.PI * 2, false)
    context.arc(centerX, centerY, innerSize / 2, 0, Math.PI * 2, true)
  } else {
    const outerHalf = outerSize / 2
    const innerHalf = innerSize / 2
    const outerRadius = outerSize * 0.08
    const innerRadius = innerSize * 0.08
    context.roundRect(centerX - outerHalf, centerY - outerHalf, outerSize, outerSize, outerRadius)
    context.roundRect(centerX - innerHalf, centerY - innerHalf, innerSize, innerSize, innerRadius)
  }
}

// ---------------------------------------------------------------------------
// Procedural Glitter Engine (Base Sparkle Layer & Star Accents)
// ---------------------------------------------------------------------------

type GlitterStar = {
  x: number
  y: number
  r: number
  phase: number
  arms: 4 | 6
}

type GlitterLayer = {
  baseCanvas: HTMLCanvasElement
  stars: GlitterStar[]
}

const glitterLayerCache = new Map<string, GlitterLayer>()

function getGlitterLayer(craft: BaseCraft, size: number): GlitterLayer {
  const key = `${craft}-${Math.round(size)}`
  const cached = glitterLayerCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size)
  canvas.height = Math.round(size)
  const ctx = getContext(canvas)

  const isGold = craft === 'gold-glitter'
  const isFine = craft === 'fine-silver'
  const isSand = craft === 'sand-glitter'
  const isBrushed = craft === 'brushed-silver'
  const isChunky = craft === 'silver-glitter'

  const seed = isGold ? 777 : isFine ? 303 : isSand ? 512 : isBrushed ? 888 : 101
  const rand = seededRandom(seed)

  // 1. Base metallic background grain
  const imgData = ctx.createImageData(canvas.width, canvas.height)
  const data = imgData.data

  for (let i = 0; i < data.length; i += 4) {
    const noise = rand()
    let r: number
    let g: number
    let b: number
    let a: number

    if (isGold) {
      r = 230 + Math.floor(noise * 25)
      g = 180 + Math.floor(noise * 45)
      b = 60 + Math.floor(noise * 40)
      a = 210 + Math.floor(noise * 45)
    } else if (isSand) {
      const v = 220 + Math.floor(noise * 35)
      r = v + Math.floor(rand() * 8 - 4)
      g = v + Math.floor(rand() * 8 - 4)
      b = v + 4 + Math.floor(rand() * 8)
      a = 185 + Math.floor(noise * 70)
    } else if (isBrushed) {
      const v = 205 + Math.floor(noise * 45)
      r = v
      g = v
      b = v + 3
      a = 195 + Math.floor(noise * 55)
    } else if (isFine) {
      const v = 225 + Math.floor(noise * 30)
      r = v
      g = v + 1
      b = v + 4
      a = 200 + Math.floor(noise * 55)
    } else {
      const v = 210 + Math.floor(noise * 45)
      r = v
      g = v
      b = v + 4
      a = 215 + Math.floor(noise * 40)
    }

    data[i] = Math.min(255, Math.max(0, r))
    data[i + 1] = Math.min(255, Math.max(0, g))
    data[i + 2] = Math.min(255, Math.max(0, b))
    data[i + 3] = a
  }
  ctx.putImageData(imgData, 0, 0)

  // 2. High-density metallic flakes
  const flakeCount = isSand ? 3200 : isFine ? 2600 : isBrushed ? 1800 : 1600
  if (isBrushed) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.lineWidth = 0.8
    for (let i = 0; i < flakeCount; i++) {
      const fx = rand() * size
      const fy = rand() * size
      const len = 4 + rand() * 14
      ctx.beginPath()
      ctx.moveTo(fx - len / 2, fy - len * 0.2)
      ctx.lineTo(fx + len / 2, fy + len * 0.2)
      ctx.stroke()
    }
  } else {
    for (let i = 0; i < flakeCount; i++) {
      const fx = rand() * size
      const fy = rand() * size
      const fr = isSand ? 0.4 + rand() * 0.7 : isFine ? 0.5 + rand() * 0.9 : 0.8 + rand() * 1.8
      const alpha = 0.45 + rand() * 0.55
      ctx.fillStyle = isGold
        ? `rgba(255, ${205 + Math.round(rand() * 45)}, ${80 + Math.round(rand() * 70)}, ${alpha})`
        : `rgba(${235 + Math.round(rand() * 20)}, ${242 + Math.round(rand() * 13)}, 255, ${alpha})`
      ctx.beginPath()
      ctx.arc(fx, fy, fr, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 3. Crisp star sparkle points
  const starCount = isSand ? 18 : isFine ? 44 : isChunky ? 36 : 28
  const stars: GlitterStar[] = []
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: (rand() - 0.5) * size,
      y: (rand() - 0.5) * size,
      r: (isChunky ? 4.5 + rand() * 8.0 : isFine ? 2.5 + rand() * 4.8 : 3.5 + rand() * 6.5) * (size / 512),
      phase: rand() * Math.PI * 2,
      arms: rand() > 0.3 ? 4 : 6,
    })
  }

  const layer = { baseCanvas: canvas, stars }
  glitterLayerCache.set(key, layer)
  return layer
}

function drawStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  arms: 4 | 6,
  tint: string,
  alpha: number,
) {
  if (alpha <= 0.02 || radius <= 0.5) return
  context.save()
  context.translate(x, y)
  context.globalAlpha = Math.min(1, alpha)

  // Core glow
  const glow = context.createRadialGradient(0, 0, 0, 0, 0, radius * 1.2)
  glow.addColorStop(0, '#ffffff')
  glow.addColorStop(0.3, tint)
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = glow
  context.fillRect(-radius * 1.2, -radius * 1.2, radius * 2.4, radius * 2.4)

  // Diamond/Cross Star Rays
  context.fillStyle = '#ffffff'
  const t = radius * 0.16
  const numArms = arms === 6 ? 3 : 2
  for (let a = 0; a < numArms; a++) {
    context.save()
    context.rotate((a * Math.PI) / (arms === 6 ? 3 : 2))
    context.beginPath()
    context.moveTo(-radius, 0)
    context.lineTo(0, -t)
    context.lineTo(radius, 0)
    context.lineTo(0, t)
    context.closePath()
    context.fill()
    context.restore()
  }

  context.restore()
}

function drawGlitterBase(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tiltX: number,
  tiltY: number,
  phase: number | null,
  craft: BaseCraft,
) {
  const layer = getGlitterLayer(craft, faceSize)
  const layerSize = layer.baseCanvas.width
  const shiftX = tiltX * faceSize * 0.025
  const shiftY = tiltY * faceSize * 0.025

  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  // Base metallic grain layer — brushed-silver uses overlay to preserve contrast
  context.globalCompositeOperation = craft === 'brushed-silver' ? 'overlay' : 'screen'
  context.globalAlpha = craft === 'sand-glitter' ? 0.75 : craft === 'brushed-silver' ? 0.8 : 0.82
  context.drawImage(
    layer.baseCanvas,
    -layerSize / 2 + shiftX,
    -layerSize / 2 + shiftY,
    layerSize,
    layerSize,
  )

  // Sand glitter soft chromatic wash
  if (craft === 'sand-glitter') {
    const sandWash = context.createRadialGradient(
      shiftX * 2,
      shiftY * 2,
      0,
      0,
      0,
      faceSize * 0.5,
    )
    sandWash.addColorStop(0, 'rgba(255, 230, 245, 0.25)')
    sandWash.addColorStop(0.5, 'rgba(220, 250, 255, 0.22)')
    sandWash.addColorStop(1, 'rgba(255, 245, 225, 0.18)')
    context.globalCompositeOperation = 'overlay'
    context.fillStyle = sandWash
    context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)
  }

  // Shimmer band: sweeping light accent that intensifies particles in the specular zone
  const bandCenter = (tiltX * 0.7 + tiltY * 0.3) * faceSize * 0.4
  const bandHalf = faceSize * 0.38
  const shimmerGrad = context.createLinearGradient(
    bandCenter - bandHalf,
    -faceSize * 0.3,
    bandCenter + bandHalf,
    faceSize * 0.3,
  )
  const isGold = craft === 'gold-glitter'
  const shimmerColor = isGold ? 'rgba(255, 235, 160, 0.45)' : 'rgba(235, 245, 255, 0.45)'
  shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
  shimmerGrad.addColorStop(0.5, shimmerColor)
  shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')

  context.globalCompositeOperation = 'color-dodge'
  context.globalAlpha = 0.55
  context.fillStyle = shimmerGrad
  context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

  context.restore()
}

function drawGlitterAccents(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tiltX: number,
  tiltY: number,
  phase: number | null,
  craft: BaseCraft,
  isHolo: boolean,
) {
  const layer = getGlitterLayer(craft, faceSize)
  const shiftX = tiltX * faceSize * 0.025
  const shiftY = tiltY * faceSize * 0.025
  const isGold = craft === 'gold-glitter'

  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)
  context.globalCompositeOperation = 'screen'

  for (const star of layer.stars) {
    const starX = star.x + shiftX
    const starY = star.y + shiftY

    // 根据形状裁切边界：圆形用半径，方形用矩形边界
    const limit = (faceSize / 2) * 0.95
    if (shape === 'round') {
      if (Math.hypot(starX, starY) > limit) continue
    } else {
      if (Math.abs(starX) > limit || Math.abs(starY) > limit) continue
    }

    const lightDist = Math.hypot(
      starX - tiltX * faceSize * 0.35,
      starY - tiltY * faceSize * 0.35,
    )
    const lightAlign = 1 - Math.min(1, lightDist / (faceSize * 0.5))
    const twinkle =
      phase == null
        ? 0.35 + 0.55 * Math.sin(star.phase) ** 4
        : Math.max(0, Math.sin(phase * 2.2 + star.phase)) ** 3.5

    const finalAlpha = (0.2 + 0.8 * lightAlign) * twinkle
    if (finalAlpha < 0.05) continue

    let tint = isGold ? 'rgba(255, 220, 120, 0.95)' : 'rgba(235, 245, 255, 0.95)'
    if (isHolo) {
      const hue =
        ((starX / faceSize) * 180 +
          (starY / faceSize) * 180 +
          (tiltX + tiltY) * 90 +
          360) %
        360
      tint = `hsl(${hue}, 85%, 75%)`
    }

    drawStar(
      context,
      starX,
      starY,
      star.r * (0.8 + 0.4 * finalAlpha),
      star.arms,
      tint,
      finalAlpha * (isHolo ? 1.0 : 0.9),
    )
  }

  context.restore()
}

// ---------------------------------------------------------------------------
// Pearl Base Engine
// ---------------------------------------------------------------------------

function drawPearlBase(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tiltX: number,
  tiltY: number,
  phase: number | null,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  const angle = -0.45 + tiltX * 0.3 + tiltY * 0.15
  context.rotate(angle)

  // Layer 1: 主体珠光双色渐变 (提升 alpha，让珠光底可见)
  const pearlGrad = context.createLinearGradient(-faceSize * 0.6, 0, faceSize * 0.6, 0)
  pearlGrad.addColorStop(0, 'rgba(255, 210, 240, 0.52)')
  pearlGrad.addColorStop(0.3, 'rgba(210, 242, 255, 0.58)')
  pearlGrad.addColorStop(0.65, 'rgba(255, 248, 200, 0.52)')
  pearlGrad.addColorStop(1, 'rgba(225, 210, 255, 0.55)')

  context.globalCompositeOperation = 'overlay'
  context.fillStyle = pearlGrad
  context.fillRect(-faceSize * 1.5, -faceSize * 1.5, faceSize * 3, faceSize * 3)

  // Layer 2: 流光光泽扫描带
  const sweepCenter = (tiltX * 0.7 + tiltY * 0.3) * faceSize * 0.35
  const sweepHalf = faceSize * 0.38
  const peak = phase == null ? 0.32 : 0.26 + 0.18 * Math.hypot(tiltX, tiltY)
  const sheenGrad = context.createLinearGradient(
    sweepCenter - sweepHalf,
    0,
    sweepCenter + sweepHalf,
    0,
  )
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
  sheenGrad.addColorStop(0.5, `rgba(255, 250, 245, ${peak})`)
  sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')

  context.globalCompositeOperation = 'screen'
  context.fillStyle = sheenGrad
  context.fillRect(-faceSize * 1.5, -faceSize * 1.5, faceSize * 3, faceSize * 3)

  context.restore()
}

// ---------------------------------------------------------------------------
// Film Craft: Glossy & Matte
// ---------------------------------------------------------------------------

function drawGlossyFilm(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tiltX: number,
  tiltY: number,
  phase: number | null,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  context.globalCompositeOperation = 'soft-light'
  context.fillStyle = 'rgba(255, 255, 255, 0.16)'
  context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

  context.rotate(-0.48 + tiltY * 0.1)
  context.globalCompositeOperation = 'screen'
  const peak = phase == null ? 0.24 : 0.2 + 0.14 * Math.hypot(tiltX, tiltY)
  const bandCenter = -faceSize * 0.08 + (tiltX * 0.8 + tiltY * 0.4) * faceSize * 0.45
  const bandHalf = faceSize * 0.28

  const mainBand = context.createLinearGradient(
    bandCenter - bandHalf,
    0,
    bandCenter + bandHalf,
    0,
  )
  mainBand.addColorStop(0, 'rgba(255, 255, 255, 0)')
  mainBand.addColorStop(0.3, `rgba(255, 255, 255, ${peak * 0.5})`)
  mainBand.addColorStop(0.5, `rgba(255, 255, 255, ${peak})`)
  mainBand.addColorStop(0.7, `rgba(255, 255, 255, ${peak * 0.5})`)
  mainBand.addColorStop(1, 'rgba(255, 255, 255, 0)')

  context.fillStyle = mainBand
  context.fillRect(-faceSize * 1.5, -faceSize * 1.5, faceSize * 3, faceSize * 3)

  const secCenter = bandCenter + faceSize * 0.22
  const secHalf = bandHalf * 0.24
  const secLine = context.createLinearGradient(
    secCenter - secHalf,
    0,
    secCenter + secHalf,
    0,
  )
  secLine.addColorStop(0, 'rgba(255, 255, 255, 0)')
  secLine.addColorStop(0.5, `rgba(255, 255, 255, ${peak * 0.45})`)
  secLine.addColorStop(1, 'rgba(255, 255, 255, 0)')

  context.fillStyle = secLine
  context.fillRect(-faceSize * 1.5, -faceSize * 1.5, faceSize * 3, faceSize * 3)

  context.restore()
}

let matteTile: HTMLCanvasElement | null = null

function getMatteTile(): HTMLCanvasElement {
  if (matteTile) return matteTile
  const size = 128
  matteTile = document.createElement('canvas')
  matteTile.width = size
  matteTile.height = size
  const ctx = getContext(matteTile)
  const img = ctx.createImageData(size, size)
  const rand = seededRandom(47)
  for (let i = 0; i < img.data.length; i += 4) {
    const val = 124 + rand() * 20
    img.data[i] = val
    img.data[i + 1] = val
    img.data[i + 2] = val + 2
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return matteTile
}

function drawMatteFilm(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  context.globalCompositeOperation = 'saturation'
  context.fillStyle = 'rgba(140, 140, 145, 0.28)'
  context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

  context.globalCompositeOperation = 'soft-light'
  context.fillStyle = 'rgba(215, 215, 220, 0.25)'
  context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

  const pattern = context.createPattern(getMatteTile(), 'repeat')
  if (pattern) {
    context.globalCompositeOperation = 'overlay'
    context.globalAlpha = 0.28
    context.fillStyle = pattern
    context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)
  }

  context.restore()
}

// ---------------------------------------------------------------------------
// Holographic Films: Rainbow, Cracked Ice, Cross Star
// ---------------------------------------------------------------------------

function drawSpecularHighlight(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tiltX: number,
  tiltY: number,
  phase: number | null,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)
  context.globalCompositeOperation = 'screen'

  const hx = -faceSize * 0.12 + tiltX * faceSize * 0.32
  const hy = -faceSize * 0.14 + tiltY * faceSize * 0.32
  const strength = phase == null ? 0.22 : 0.18 + 0.16 * Math.hypot(tiltX, tiltY)

  const highlight = context.createRadialGradient(hx, hy, 0, hx, hy, faceSize * 0.42)
  highlight.addColorStop(0, `rgba(255, 255, 255, ${strength})`)
  highlight.addColorStop(0.35, `rgba(255, 255, 255, ${strength * 0.4})`)
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)')

  context.fillStyle = highlight
  context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)
  context.restore()
}

function drawRainbowHolo(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tiltX: number,
  tiltY: number,
  phase: number | null,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  const p = phase ?? 0.8
  const baseAngle = -0.52 + Math.sin(p) * 0.35
  context.rotate(baseAngle)

  const period = faceSize * 0.62
  const offset = (tiltX * 0.75 + tiltY * 0.45) * faceSize
  const grad = context.createLinearGradient(
    -faceSize * 1.5 + offset,
    0,
    faceSize * 1.5 + offset,
    0,
  )

  const stops = [
    { pos: 0.0, col: 'hsla(0, 90%, 65%, 0.45)' },
    { pos: 0.14, col: 'hsla(45, 95%, 60%, 0.45)' },
    { pos: 0.28, col: 'hsla(115, 85%, 60%, 0.45)' },
    { pos: 0.42, col: 'hsla(185, 90%, 65%, 0.45)' },
    { pos: 0.57, col: 'hsla(235, 90%, 70%, 0.45)' },
    { pos: 0.72, col: 'hsla(285, 90%, 68%, 0.45)' },
    { pos: 0.86, col: 'hsla(335, 90%, 65%, 0.45)' },
    { pos: 1.0, col: 'hsla(360, 90%, 65%, 0.45)' },
  ]

  for (let rep = -3; rep <= 3; rep++) {
    for (const s of stops) {
      const pNorm = (s.pos * period + rep * period + faceSize * 2.5) / (faceSize * 5)
      if (pNorm >= 0 && pNorm <= 1) {
        grad.addColorStop(pNorm, s.col)
      }
    }
  }

  context.globalCompositeOperation = 'overlay'
  context.globalAlpha = 0.5
  context.fillStyle = grad
  context.fillRect(-faceSize * 2, -faceSize * 2, faceSize * 4, faceSize * 4)

  context.globalCompositeOperation = 'screen'
  context.globalAlpha = 0.24
  context.fillStyle = grad
  context.fillRect(-faceSize * 2, -faceSize * 2, faceSize * 4, faceSize * 4)

  drawSpecularHighlight(context, shape, 0, 0, faceSize, tiltX, tiltY, phase)
  context.restore()
}

type CrackedIceShard = {
  points: Array<{ x: number; y: number }>
  centerX: number
  centerY: number
  normalAngle: number
  baseHue: number
}

let crackedIceShards: CrackedIceShard[] | null = null

function getCrackedIceShards(size: number): CrackedIceShard[] {
  if (crackedIceShards) return crackedIceShards
  const rand = seededRandom(1337)
  const shards: CrackedIceShard[] = []
  const cols = 14
  const rows = 14
  const cellW = size / cols
  const cellH = size / rows

  const grid: Array<Array<{ x: number; y: number }>> = []
  for (let r = 0; r <= rows; r++) {
    grid[r] = []
    for (let c = 0; c <= cols; c++) {
      const jx = (rand() - 0.5) * cellW * 0.75
      const jy = (rand() - 0.5) * cellH * 0.75
      grid[r][c] = {
        x: c * cellW + jx - size / 2,
        y: r * cellH + jy - size / 2,
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p0 = grid[r][c]
      const p1 = grid[r][c + 1]
      const p2 = grid[r + 1][c + 1]
      const p3 = grid[r + 1][c]

      const t1Points = [p0, p1, p2]
      const t1Cx = (p0.x + p1.x + p2.x) / 3
      const t1Cy = (p0.y + p1.y + p2.y) / 3
      shards.push({
        points: t1Points,
        centerX: t1Cx,
        centerY: t1Cy,
        normalAngle: rand() * Math.PI * 2,
        baseHue: (t1Cx * 0.35 + t1Cy * 0.35 + 360) % 360,
      })

      const t2Points = [p0, p2, p3]
      const t2Cx = (p0.x + p2.x + p3.x) / 3
      const t2Cy = (p0.y + p2.y + p3.y) / 3
      shards.push({
        points: t2Points,
        centerX: t2Cx,
        centerY: t2Cy,
        normalAngle: rand() * Math.PI * 2,
        baseHue: (t2Cx * 0.35 + t2Cy * 0.35 + 180 + 360) % 360,
      })
    }
  }

  crackedIceShards = shards
  return shards
}

function drawCrackedIceHolo(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tiltX: number,
  tiltY: number,
  phase: number | null,
) {
  const shards = getCrackedIceShards(faceSize)
  const lightAngle = Math.atan2(tiltY, tiltX)
  const tiltMagnitude = Math.min(1, Math.hypot(tiltX, tiltY) * 2.5)

  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)
  context.globalCompositeOperation = 'screen'

  for (const shard of shards) {
    const distToCenter = Math.hypot(shard.centerX, shard.centerY)
    if (distToCenter > (faceSize / 2) * 1.05) continue

    const diff = Math.cos(shard.normalAngle - lightAngle)
    const intensity = Math.max(0, diff) ** 2.2
    const hue =
      (shard.baseHue +
        (tiltX + tiltY) * 120 +
        (phase ? phase * 45 : 0) +
        360) %
      360

    context.beginPath()
    context.moveTo(shard.points[0].x, shard.points[0].y)
    context.lineTo(shard.points[1].x, shard.points[1].y)
    context.lineTo(shard.points[2].x, shard.points[2].y)
    context.closePath()

    context.fillStyle = `hsla(${hue}, 85%, 62%, ${0.12 + 0.28 * intensity * (0.3 + 0.7 * tiltMagnitude)})`
    context.fill()

    context.strokeStyle = `hsla(${hue}, 90%, 85%, ${0.25 + 0.35 * intensity})`
    context.lineWidth = 1.0
    context.stroke()
  }

  drawSpecularHighlight(context, shape, 0, 0, faceSize, tiltX, tiltY, phase)
  context.restore()
}

function drawCrossHolo(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tiltX: number,
  tiltY: number,
  phase: number | null,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  const spacing = faceSize * 0.08
  const half = faceSize / 2
  const count = Math.ceil(faceSize / spacing)

  context.globalCompositeOperation = 'screen'

  for (let r = 0; r <= count; r++) {
    for (let c = 0; c <= count; c++) {
      const x = -half + c * spacing + (r % 2 === 0 ? 0 : spacing * 0.5)
      const y = -half + r * spacing
      if (Math.hypot(x, y) > faceSize * 0.5) continue

      const dist = Math.hypot(x - tiltX * faceSize * 0.35, y - tiltY * faceSize * 0.35)
      const align = Math.max(0, 1 - dist / (faceSize * 0.45))
      const p = phase ?? 0.8
      const flare = Math.sin(p * 2 + (c * 3 + r * 2)) ** 4
      const alpha = (0.2 + 0.8 * align) * (0.35 + 0.65 * flare)
      if (alpha < 0.08) continue

      const hue = (c * 24 + r * 20 + (tiltX + tiltY) * 90 + 360) % 360
      const starRadius = spacing * 0.35 * (0.8 + 0.4 * alpha)

      context.save()
      context.translate(x, y)
      context.globalAlpha = alpha * 0.85
      context.fillStyle = `hsl(${hue}, 90%, 75%)`

      context.beginPath()
      context.arc(0, 0, starRadius * 0.25, 0, Math.PI * 2)
      context.fill()

      context.fillRect(-starRadius, -starRadius * 0.1, starRadius * 2, starRadius * 0.2)
      context.fillRect(-starRadius * 0.1, -starRadius, starRadius * 0.2, starRadius * 2)

      context.restore()
    }
  }

  drawSpecularHighlight(context, shape, 0, 0, faceSize, tiltX, tiltY, phase)
  context.restore()
}

function drawHoloFilm(
  context: CanvasRenderingContext2D,
  craft: FilmCraft,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tiltX: number,
  tiltY: number,
  phase: number | null,
) {
  if (craft === 'rainbow') {
    drawRainbowHolo(context, shape, centerX, centerY, faceSize, tiltX, tiltY, phase)
  } else if (craft === 'cracked-ice') {
    drawCrackedIceHolo(context, shape, centerX, centerY, faceSize, tiltX, tiltY, phase)
  } else if (craft === 'cross') {
    drawCrossHolo(context, shape, centerX, centerY, faceSize, tiltX, tiltY, phase)
  }
}

// ---------------------------------------------------------------------------
// 3D Physical Shading & Edge Bevel (Convex Dome Light & Metallic Rim)
// ---------------------------------------------------------------------------

function drawPhysicalBadgeShading(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tiltX: number,
  tiltY: number,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()

  // 1. Subtle Convex Dome Ambient Light (马口铁微凸穹顶环境光)
  const domeLightX = centerX - faceSize * 0.15 + tiltX * faceSize * 0.2
  const domeLightY = centerY - faceSize * 0.2 + tiltY * faceSize * 0.2
  const domeGrad = context.createRadialGradient(
    domeLightX,
    domeLightY,
    faceSize * 0.05,
    centerX,
    centerY,
    faceSize * 0.58,
  )
  domeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)')
  domeGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)')
  domeGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.04)')
  domeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.22)')

  context.globalCompositeOperation = 'source-over'
  context.fillStyle = domeGrad
  context.fillRect(centerX - faceSize / 2, centerY - faceSize / 2, faceSize, faceSize)

  // 2. Inner Edge Curvature Occlusion (纸张压入背面的边缘渐变暗角)
  if (shape === 'round') {
    const wrap = context.createRadialGradient(
      centerX,
      centerY,
      faceSize * 0.38,
      centerX,
      centerY,
      faceSize * 0.5,
    )
    wrap.addColorStop(0, 'rgba(0, 0, 0, 0)')
    wrap.addColorStop(0.65, 'rgba(0, 0, 0, 0.02)')
    wrap.addColorStop(0.88, 'rgba(0, 0, 0, 0.18)')
    wrap.addColorStop(1, 'rgba(0, 0, 0, 0.38)')

    context.fillStyle = wrap
    context.fillRect(centerX - faceSize / 2, centerY - faceSize / 2, faceSize, faceSize)
  } else {
    const half = faceSize / 2
    const wrapDepth = faceSize * 0.11

    const top = context.createLinearGradient(0, centerY - half, 0, centerY - half + wrapDepth)
    top.addColorStop(0, 'rgba(0, 0, 0, 0.32)')
    top.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = top
    context.fillRect(centerX - half, centerY - half, faceSize, wrapDepth)

    const bottom = context.createLinearGradient(0, centerY + half - wrapDepth, 0, centerY + half)
    bottom.addColorStop(0, 'rgba(0, 0, 0, 0.32)')
    bottom.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = bottom
    context.fillRect(centerX - half, centerY + half - wrapDepth, faceSize, wrapDepth)

    const left = context.createLinearGradient(centerX - half, 0, centerX - half + wrapDepth, 0)
    left.addColorStop(0, 'rgba(0, 0, 0, 0.32)')
    left.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = left
    context.fillRect(centerX - half, centerY - half, wrapDepth, faceSize)

    const right = context.createLinearGradient(centerX + half - wrapDepth, 0, centerX + half, 0)
    right.addColorStop(0, 'rgba(0, 0, 0, 0)')
    right.addColorStop(1, 'rgba(0, 0, 0, 0.32)')
    context.fillStyle = right
    context.fillRect(centerX + half - wrapDepth, centerY - half, wrapDepth, faceSize)
  }

  // 3. Metallic Outer Bevel Rim Sheen (冲压金属包边高光轮廓线)
  context.lineWidth = Math.max(1.5, faceSize * 0.005)
  if (shape === 'round') {
    const rimGrad = context.createLinearGradient(
      centerX - faceSize * 0.4 + tiltX * faceSize * 0.2,
      centerY - faceSize * 0.4 + tiltY * faceSize * 0.2,
      centerX + faceSize * 0.4,
      centerY + faceSize * 0.4,
    )
    rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)')
    rimGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.15)')
    rimGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.35)')
    rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.35)')

    context.strokeStyle = rimGrad
    context.beginPath()
    context.arc(centerX, centerY, faceSize / 2 - context.lineWidth / 2, 0, Math.PI * 2)
    context.stroke()
  } else {
    const rimGrad = context.createLinearGradient(
      centerX - faceSize * 0.5,
      centerY - faceSize * 0.5,
      centerX + faceSize * 0.5,
      centerY + faceSize * 0.5,
    )
    rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)')
    rimGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)')
    rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)')

    context.strokeStyle = rimGrad
    shapePath(context, shape, centerX, centerY, faceSize - context.lineWidth)
    context.stroke()
  }

  context.restore()
}

// ---------------------------------------------------------------------------
// Five-Layer Composite Badge Face Pipeline
// ---------------------------------------------------------------------------

export function drawBadgeFace(
  context: CanvasRenderingContext2D,
  state: BadgeState,
  centerX: number,
  centerY: number,
  faceSize: number,
  tiltX = 0,
  tiltY = 0,
  phase: number | null = null,
) {
  context.save()
  shapePath(context, state.shape, centerX, centerY, faceSize)
  context.clip()

  // Layer 1: Base User Artwork
  drawMappedArtwork(
    context,
    state.artwork,
    state.transform,
    centerX,
    centerY,
    faceSize,
    faceSize,
  )

  // Layer 2: Base Craft Layer (Glitter / Pearl / Sand / Brushed / Fine Silver)
  if (
    state.baseCraft === 'fine-silver' ||
    state.baseCraft === 'silver-glitter' ||
    state.baseCraft === 'gold-glitter' ||
    state.baseCraft === 'brushed-silver' ||
    state.baseCraft === 'sand-glitter'
  ) {
    drawGlitterBase(
      context,
      state.shape,
      centerX,
      centerY,
      faceSize,
      tiltX,
      tiltY,
      phase,
      state.baseCraft,
    )
  } else if (state.baseCraft === 'pearl') {
    drawPearlBase(context, state.shape, centerX, centerY, faceSize, tiltX, tiltY, phase)
  }

  // Layer 3: Film Craft Layer (Glossy / Matte / Rainbow / Cracked-Ice / Cross)
  if (state.filmCraft === 'glossy') {
    drawGlossyFilm(context, state.shape, centerX, centerY, faceSize, tiltX, tiltY, phase)
  } else if (state.filmCraft === 'matte') {
    drawMatteFilm(context, state.shape, centerX, centerY, faceSize)
  } else if (
    state.filmCraft === 'rainbow' ||
    state.filmCraft === 'cracked-ice' ||
    state.filmCraft === 'cross'
  ) {
    drawHoloFilm(
      context,
      state.filmCraft,
      state.shape,
      centerX,
      centerY,
      faceSize,
      tiltX,
      tiltY,
      phase,
    )
  }

  // Layer 4: Double-Glitter Top Accents (Star Sparkles Piercing Film Layer)
  if (
    state.baseCraft === 'fine-silver' ||
    state.baseCraft === 'silver-glitter' ||
    state.baseCraft === 'gold-glitter' ||
    state.baseCraft === 'sand-glitter'
  ) {
    const isHolo =
      state.filmCraft === 'rainbow' ||
      state.filmCraft === 'cracked-ice' ||
      state.filmCraft === 'cross'
    drawGlitterAccents(
      context,
      state.shape,
      centerX,
      centerY,
      faceSize,
      tiltX,
      tiltY,
      phase,
      state.baseCraft,
      isHolo,
    )
  }

  // Layer 5: 3D Convex Dome Ambient Light & Edge Bevel Wrap
  drawPhysicalBadgeShading(context, state.shape, centerX, centerY, faceSize, tiltX, tiltY)

  context.restore()
}

// ---------------------------------------------------------------------------
// Preview Scene with 2D Tilting Transforms & Layered Drop Shadows
// ---------------------------------------------------------------------------

export function drawNeutralStudioBackground(
  context: CanvasRenderingContext2D,
  size: number,
) {
  context.fillStyle = '#eaedf1'
  context.fillRect(0, 0, size, size)

  context.save()
  context.strokeStyle = 'rgba(23, 24, 28, 0.05)'
  context.lineWidth = 1
  const grid = size / 14
  for (let v = grid; v < size; v += grid) {
    context.beginPath()
    context.moveTo(v, 0)
    context.lineTo(v, size)
    context.moveTo(0, v)
    context.lineTo(size, v)
    context.stroke()
  }
  context.restore()
}

export function drawPreviewScene(
  context: CanvasRenderingContext2D,
  size: number,
  state: BadgeState,
  tiltX = 0,
  tiltY = 0,
  phase: number | null = null,
) {
  const center = size / 2
  const faceSize = size * previewDiameterRatio(state.finishedDiameterMm)

  // Neutral studio background
  drawNeutralStudioBackground(context, size)

  // ♾️ 3D 物理运动：吧唧是刚性实体，只做旋转和位移，不做透视拉伸
  // perspectiveScale 会让圆形吧唧在运动中产生椭圆形变，视觉效果不真实
  const tiltAngle = tiltX * 0.06 - tiltY * 0.03
  const tiltOffsetX = tiltX * faceSize * 0.065
  const tiltOffsetY = tiltY * faceSize * 0.045

  // Layer 1: Ambient Diffuse Drop Shadow (大范围漫反射软阴影，随倾斜拉伸)
  context.save()
  context.translate(center + tiltOffsetX * 1.2, center + tiltOffsetY + faceSize * 0.04)
  context.rotate(tiltAngle * 0.6)
  // 仅阴影允许轻微拉伸，模拟光源变化，不应用于吧唧本体
  context.scale(1 - Math.abs(tiltY) * 0.02, 1 + Math.abs(tiltX) * 0.015)
  context.shadowColor = 'rgba(18, 22, 32, 0.22)'
  context.shadowBlur = faceSize * (0.10 + Math.hypot(tiltX, tiltY) * 0.05)
  context.shadowOffsetY = faceSize * (0.04 + Math.hypot(tiltX, tiltY) * 0.025)
  shapePath(context, state.shape, 0, 0, faceSize)
  context.fillStyle = 'rgba(0, 0, 0, 0.01)'
  context.fill()
  context.restore()

  // Layer 2: Tight Contact Drop Shadow (近距离接触硬阴影)
  context.save()
  context.translate(center + tiltOffsetX, center + tiltOffsetY)
  context.rotate(tiltAngle)
  context.shadowColor = 'rgba(18, 22, 32, 0.30)'
  context.shadowBlur = faceSize * 0.03
  context.shadowOffsetY = faceSize * 0.018
  shapePath(context, state.shape, 0, 0, faceSize)
  context.fillStyle = '#000000'
  context.fill()
  context.restore()

  // Badge Face & Physical Layers (吧唧本体，刚性无形变)
  context.save()
  context.translate(center + tiltOffsetX, center + tiltOffsetY)
  context.rotate(tiltAngle)
  drawBadgeFace(context, state, 0, 0, faceSize, tiltX, tiltY, phase)
  context.restore()
}

// ---------------------------------------------------------------------------
// Print Workspace
// ---------------------------------------------------------------------------

export function drawPrintWorkspace(
  context: CanvasRenderingContext2D,
  size: number,
  state: BadgeState,
) {
  const center = size / 2
  const printDiameter = size * 0.72
  const finishedDiameter = printDiameter * (state.finishedDiameterMm / state.printDiameterMm)
  const safeDiameter = printDiameter * (state.safeDiameterMm / state.printDiameterMm)

  context.fillStyle = '#f3f4f6'
  context.fillRect(0, 0, size, size)

  // Full artwork with wrapping zone
  context.save()
  shapePath(context, state.shape, center, center, printDiameter)
  context.clip()
  const previewFaceSize = size * previewDiameterRatio(state.finishedDiameterMm)
  const previewArtworkSize =
    previewFaceSize * (state.printDiameterMm / state.finishedDiameterMm)
  drawMappedArtwork(context, state.artwork, state.transform, center, center, previewArtworkSize, previewArtworkSize)
  context.restore()

  // Wrap zone highlight (Yellow tinted ring)
  context.save()
  shapeRingPath(context, state.shape, center, center, printDiameter, finishedDiameter)
  context.fillStyle = 'rgba(244, 211, 94, 0.22)'
  context.fill('evenodd')
  context.restore()

  // Cut line & Safe margin lines
  context.save()
  context.lineWidth = size * 0.005

  // Full print cut line (Red solid)
  shapePath(context, state.shape, center, center, printDiameter)
  context.strokeStyle = '#f05a4f'
  context.setLineDash([])
  context.stroke()

  // Finished badge edge (Black dashed)
  shapePath(context, state.shape, center, center, finishedDiameter)
  context.strokeStyle = '#17181c'
  context.setLineDash([size * 0.016, size * 0.01])
  context.stroke()

  // Recommended safe area (Teal dotted)
  shapePath(context, state.shape, center, center, safeDiameter)
  context.strokeStyle = '#20a9a5'
  context.setLineDash([size * 0.004, size * 0.01])
  context.stroke()

  context.restore()
}

// ---------------------------------------------------------------------------
// Lifecycle & Workspace Export
// ---------------------------------------------------------------------------

export function renderBadgeWorkspace(
  canvas: HTMLCanvasElement,
  state: BadgeState,
  view: ViewMode,
  tiltX = 0,
  tiltY = 0,
  phase: number | null = null,
) {
  if (canvas.width !== DISPLAY_SIZE || canvas.height !== DISPLAY_SIZE) {
    canvas.width = DISPLAY_SIZE
    canvas.height = DISPLAY_SIZE
  }

  const context = getContext(canvas)
  context.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE)
  if (view === 'preview') {
    drawPreviewScene(context, DISPLAY_SIZE, state, tiltX, tiltY, phase)
  } else {
    drawPrintWorkspace(context, DISPLAY_SIZE, state)
  }
}

export function createBadgePreviewExport(state: BadgeState): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PREVIEW_EXPORT_SIZE
  canvas.height = PREVIEW_EXPORT_SIZE
  drawPreviewScene(getContext(canvas), PREVIEW_EXPORT_SIZE, state, 0.15, 0.1, null)
  return canvas
}

export function createBadgePrintExport(state: BadgeState): HTMLCanvasElement {
  const size = mmToPixels(state.printDiameterMm)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = getContext(canvas)

  // 修正画稿 Transform 比例：预览中 offset 基于成品面径 (faceSize)，
  // 导出基于总印刷直径 (printDiameter)。需按比例缩放 offset 使排版一致。
  const ratio = state.finishedDiameterMm / state.printDiameterMm
  const exportTransform = {
    ...state.transform,
    offsetX: state.transform.offsetX * ratio,
    offsetY: state.transform.offsetY * ratio,
  }

  context.clearRect(0, 0, size, size)
  context.save()
  shapePath(context, state.shape, size / 2, size / 2, size)
  context.clip()
  drawMappedArtwork(context, state.artwork, exportTransform, size / 2, size / 2, size, size)
  context.restore()
  return canvas
}
