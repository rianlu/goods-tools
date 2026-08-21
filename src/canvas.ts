import {
  clamp,
  mmToPixels,
  previewDiameterRatio,
  type BadgeShape,
  type Transform,
} from './geometry.ts'

export const DISPLAY_SIZE = 900
export const PREVIEW_EXPORT_SIZE = 1080
export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const MAX_WORKING_EDGE = 2048

export type BaseCraft =
  | 'none'
  | 'fine-silver'
  | 'silver-glitter'
  | 'brushed-silver'
  | 'sand-glitter'
  | 'gold-glitter'
  | 'pearl'

export type FilmCraft =
  | 'none'
  | 'glossy'
  | 'matte'
  | 'rainbow'
  | 'cracked-ice'
  | 'cross'

export type Craft = BaseCraft | FilmCraft
export type ViewMode = 'preview' | 'print'

export type Artwork = {
  source: CanvasImageSource
  width: number
  height: number
  name: string
  isDemo?: boolean
}

export type RenderState = {
  artwork: Artwork
  transform: Transform
  baseCraft: BaseCraft
  filmCraft: FilmCraft
  shape: BadgeShape
  printDiameterMm: number
  finishedDiameterMm: number
  safeDiameterMm: number
}

// ---------------------------------------------------------------------------
// Context & Geometry Helpers
// ---------------------------------------------------------------------------

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法创建 Canvas 2D 画布')
  return context
}

function traceShapePath(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  x: number,
  y: number,
  size: number,
) {
  if (shape === 'round') {
    context.arc(x, y, size / 2, 0, Math.PI * 2)
    return
  }

  if (shape === 'square') {
    // Square badge with standard 12% rounded corner radius
    const half = size / 2
    const radius = size * 0.12
    const left = x - half
    const right = x + half
    const top = y - half
    const bottom = y + half
    context.moveTo(left + radius, top)
    context.lineTo(right - radius, top)
    context.quadraticCurveTo(right, top, right, top + radius)
    context.lineTo(right, bottom - radius)
    context.quadraticCurveTo(right, bottom, right - radius, bottom)
    context.lineTo(left + radius, bottom)
    context.quadraticCurveTo(left, bottom, left, bottom - radius)
    context.lineTo(left, top + radius)
    context.quadraticCurveTo(left, top, left + radius, top)
    context.closePath()
  }
}

function shapePath(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  x: number,
  y: number,
  size: number,
) {
  context.beginPath()
  traceShapePath(context, shape, x, y, size)
}

function shapeRingPath(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  x: number,
  y: number,
  outerSize: number,
  innerSize: number,
) {
  context.beginPath()
  traceShapePath(context, shape, x, y, outerSize)
  traceShapePath(context, shape, x, y, innerSize)
}

function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

// ---------------------------------------------------------------------------
// Artwork Transform & Placement
// ---------------------------------------------------------------------------

function drawMappedArtwork(
  context: CanvasRenderingContext2D,
  state: RenderState,
  centerX: number,
  centerY: number,
  printDiameter: number,
  canvasSize: number,
) {
  const { artwork, transform } = state
  const baseScale = printDiameter / Math.min(artwork.width, artwork.height)
  const scale = baseScale * transform.zoom
  const width = artwork.width * scale
  const height = artwork.height * scale
  const x = centerX - width / 2 + transform.offsetX * canvasSize
  const y = centerY - height / 2 + transform.offsetY * canvasSize

  context.drawImage(artwork.source, x, y, width, height)
}

// ---------------------------------------------------------------------------
// Glitter Base Engine (Fine Silver, Chunky Silver Onion, Gold, Brushed, Sand)
// ---------------------------------------------------------------------------

type GlitterCraft =
  | 'fine-silver'
  | 'silver-glitter'
  | 'gold-glitter'
  | 'brushed-silver'
  | 'sand-glitter'

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

function getGlitterLayer(craft: GlitterCraft, faceSize: number): GlitterLayer {
  const targetSize = Math.ceil(faceSize / 64) * 64
  const key = `${craft}:${targetSize}`
  const cached = glitterLayerCache.get(key)
  if (cached) return cached

  const size = Math.max(512, targetSize)
  const isGold = craft === 'gold-glitter'
  const isBrushed = craft === 'brushed-silver'
  const isSand = craft === 'sand-glitter'
  const isChunky = craft === 'silver-glitter' // Chunky silver onion with larger hexagonal sequins
  const isFine = craft === 'fine-silver'

  const seed = isGold ? 104729 : isBrushed ? 554433 : isSand ? 771122 : isChunky ? 993311 : 882377
  const rand = seededRandom(seed)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = getContext(canvas)

  // 1. Dense background micro-grain
  const imgData = ctx.createImageData(size, size)
  const data = imgData.data
  const density = isSand ? 0.35 : isFine ? 0.26 : 0.16

  for (let i = 0; i < data.length; i += 4) {
    if (rand() < density) {
      const bright = isSand ? 0.5 + rand() * 0.5 : 0.4 + rand() * 0.6
      if (isGold) {
        data[i] = Math.round(255 * bright)
        data[i + 1] = Math.round((190 + rand() * 50) * bright)
        data[i + 2] = Math.round((60 + rand() * 60) * bright)
      } else if (isSand) {
        data[i] = Math.round((235 + rand() * 20) * bright)
        data[i + 1] = Math.round((240 + rand() * 15) * bright)
        data[i + 2] = Math.round((250 + rand() * 5) * bright)
      } else {
        data[i] = Math.round((225 + rand() * 30) * bright)
        data[i + 1] = Math.round((230 + rand() * 25) * bright)
        data[i + 2] = Math.round((245 + rand() * 10) * bright)
      }
      data[i + 3] = Math.round(110 + rand() * 145)
    }
  }
  ctx.putImageData(imgData, 0, 0)

  // Brushed Metal Streaks (for brushed-silver)
  if (isBrushed) {
    ctx.save()
    ctx.rotate(-0.35)
    const lineCount = 380
    for (let i = 0; i < lineCount; i++) {
      const ly = (rand() - 0.5) * size * 1.5
      const lw = 0.5 + rand() * 1.5
      const la = 0.08 + rand() * 0.22
      ctx.strokeStyle = `rgba(255, 255, 255, ${la})`
      ctx.lineWidth = lw
      ctx.beginPath()
      ctx.moveTo(-size, ly)
      ctx.lineTo(size * 2, ly)
      ctx.stroke()
    }
    ctx.restore()
  }

  // 2. Metallic flake specks / Sequins
  if (isChunky) {
    // 银葱 (Chunky Silver Onion): Distinct polygonal / hexagonal reflective glitter sequins
    const sequinCount = Math.round((size / 512) ** 2 * 1400)
    for (let i = 0; i < sequinCount; i++) {
      const sx = rand() * size
      const sy = rand() * size
      const sr = 1.6 + rand() * 2.8
      const rot = rand() * Math.PI
      const alpha = 0.55 + rand() * 0.45

      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(rot)
      ctx.fillStyle = `rgba(${230 + Math.round(rand() * 25)}, ${235 + Math.round(rand() * 20)}, 255, ${alpha})`

      // Draw hexagonal flake
      ctx.beginPath()
      for (let side = 0; side < 6; side++) {
        const a = (side * Math.PI) / 3
        const px = Math.cos(a) * sr
        const py = Math.sin(a) * sr
        if (side === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()

      // High-specular center glint
      if (rand() > 0.6) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
        ctx.fillRect(-sr * 0.25, -sr * 0.25, sr * 0.5, sr * 0.5)
      }
      ctx.restore()
    }
  } else {
    // Standard / Fine / Sand / Gold flakes
    const flakeMultiplier = isSand ? 0.6 : isFine ? 1.4 : 1.0
    const flakeCount = Math.round((size / 512) ** 2 * 2400 * flakeMultiplier)
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
  craft: GlitterCraft,
) {
  const layer = getGlitterLayer(craft, faceSize)
  const layerSize = layer.baseCanvas.width
  const shiftX = tiltX * faceSize * 0.025
  const shiftY = tiltY * faceSize * 0.025

  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  // Base metallic grain layer with screen blending
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = craft === 'sand-glitter' ? 0.75 : 0.82
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
  craft: GlitterCraft,
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

    // Check if star falls inside badge radius
    if (Math.hypot(starX, starY) > (faceSize / 2) * 0.95) continue

    // Twinkle modulation: sparkles peak based on proximity to the 2D tilt axis
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
      // In double glitter, stars refracted through holographic film get chromatic rainbow dispersion
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
// Pearl Base Engine (Soft Iridescent Wash & Mother-of-Pearl Micro-Luster)
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

  // Soft duo-chrome pearlescent wash (Rose-Cyan angle-dependent luster)
  const angle = -0.45 + tiltX * 0.3 + tiltY * 0.15
  context.rotate(angle)

  const pearlGrad = context.createLinearGradient(-faceSize * 0.6, 0, faceSize * 0.6, 0)
  pearlGrad.addColorStop(0, 'rgba(255, 225, 240, 0.22)') // soft rose
  pearlGrad.addColorStop(0.35, 'rgba(220, 245, 255, 0.25)') // sky blue
  pearlGrad.addColorStop(0.7, 'rgba(255, 248, 220, 0.22)') // soft champagne
  pearlGrad.addColorStop(1, 'rgba(235, 225, 255, 0.25)') // lavender

  context.globalCompositeOperation = 'overlay'
  context.fillStyle = pearlGrad
  context.fillRect(-faceSize * 1.5, -faceSize * 1.5, faceSize * 3, faceSize * 3)

  // Silky surface sheen band
  const sweepCenter = (tiltX * 0.7 + tiltY * 0.3) * faceSize * 0.35
  const sweepHalf = faceSize * 0.32
  const peak = phase == null ? 0.16 : 0.14 + 0.12 * Math.hypot(tiltX, tiltY)
  const sheenGrad = context.createLinearGradient(
    sweepCenter - sweepHalf,
    0,
    sweepCenter + sweepHalf,
    0,
  )
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
  sheenGrad.addColorStop(0.5, `rgba(255, 252, 248, ${peak})`)
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

  // Overall glossy clear-coat lift
  context.globalCompositeOperation = 'soft-light'
  context.fillStyle = 'rgba(255, 255, 255, 0.16)'
  context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

  // Curved window reflection bar
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

  // Secondary thin trailing reflection line
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

  // Matte velvety desaturation & gentle contrast flattening
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

type HoloCraft = 'rainbow' | 'cracked-ice' | 'cross'

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

  // Continuous spectral diffraction grating: multi-stop smooth rainbow bands
  const period = faceSize * 0.62
  const offset = (tiltX * 0.75 + tiltY * 0.45) * faceSize
  const grad = context.createLinearGradient(
    -faceSize * 1.5 + offset,
    0,
    faceSize * 1.5 + offset,
    0,
  )

  const stops = [
    { pos: 0.0, col: 'hsla(0, 90%, 65%, 0.45)' }, // Red
    { pos: 0.14, col: 'hsla(45, 95%, 60%, 0.45)' }, // Orange/Yellow
    { pos: 0.28, col: 'hsla(115, 85%, 60%, 0.45)' }, // Green
    { pos: 0.42, col: 'hsla(185, 90%, 65%, 0.45)' }, // Cyan
    { pos: 0.57, col: 'hsla(235, 90%, 70%, 0.45)' }, // Blue
    { pos: 0.72, col: 'hsla(285, 90%, 68%, 0.45)' }, // Purple/Violet
    { pos: 0.86, col: 'hsla(335, 90%, 65%, 0.45)' }, // Magenta
    { pos: 1.0, col: 'hsla(360, 90%, 65%, 0.45)' }, // Red
  ]

  for (let rep = -3; rep <= 3; rep++) {
    for (const s of stops) {
      const pNorm = (s.pos * period + rep * period + faceSize * 2.5) / (faceSize * 5)
      if (pNorm >= 0 && pNorm <= 1) {
        grad.addColorStop(pNorm, s.col)
      }
    }
  }

  // Layer 1: Overlay for rich prismatic chromatic saturation
  context.globalCompositeOperation = 'overlay'
  context.globalAlpha = 0.5
  context.fillStyle = grad
  context.fillRect(-faceSize * 2, -faceSize * 2, faceSize * 4, faceSize * 4)

  // Layer 2: Screen for iridescent luminosity
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = 0.24
  context.fillStyle = grad
  context.fillRect(-faceSize * 2, -faceSize * 2, faceSize * 4, faceSize * 4)

  // Specular hotspot
  drawSpecularHighlight(context, shape, 0, 0, faceSize, tiltX, tiltY, phase)
  context.restore()
}

// Procedural Cracked Ice Crystals Cache
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
      const p00 = grid[r][c]
      const p10 = grid[r + 1][c]
      const p01 = grid[r][c + 1]
      const p11 = grid[r + 1][c + 1]

      const shard1 = [p00, p10, p11]
      const shard2 = [p00, p11, p01]

      for (const pts of [shard1, shard2]) {
        const cx = (pts[0].x + pts[1].x + pts[2].x) / 3
        const cy = (pts[0].y + pts[1].y + pts[2].y) / 3
        shards.push({
          points: pts,
          centerX: cx,
          centerY: cy,
          normalAngle: rand() * Math.PI * 2,
          baseHue: rand() * 360,
        })
      }
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
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  const shards = getCrackedIceShards(faceSize)
  const lightAngle = Math.atan2(tiltY, tiltX) - Math.PI / 4
  const tiltMagnitude = Math.hypot(tiltX, tiltY)

  // Render individual crystal facet reflections
  context.globalCompositeOperation = 'overlay'
  for (const shard of shards) {
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

    // Shard facet color
    context.fillStyle = `hsla(${hue}, 85%, 62%, ${0.25 + 0.5 * intensity * (0.4 + 0.6 * tiltMagnitude)})`
    context.fill()

    // Sharp holographic crack border
    context.strokeStyle = `hsla(${hue}, 90%, 85%, ${0.45 + 0.55 * intensity})`
    context.lineWidth = 1.0
    context.stroke()
  }

  drawSpecularHighlight(context, shape, 0, 0, faceSize, tiltX, tiltY, phase)
  context.restore()
}

// Cross Star Hologram Film (十字星芒膜)
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

      // Cross Star with Rainbow Flare
      context.save()
      context.translate(x, y)
      context.globalAlpha = alpha * 0.85
      context.fillStyle = `hsl(${hue}, 90%, 75%)`

      // Core dot
      context.beginPath()
      context.arc(0, 0, starRadius * 0.25, 0, Math.PI * 2)
      context.fill()

      // Horizontal ray
      context.fillRect(-starRadius, -starRadius * 0.1, starRadius * 2, starRadius * 0.2)
      // Vertical ray
      context.fillRect(-starRadius * 0.1, -starRadius, starRadius * 0.2, starRadius * 2)

      context.restore()
    }
  }

  drawSpecularHighlight(context, shape, 0, 0, faceSize, tiltX, tiltY, phase)
  context.restore()
}

function drawHoloFilm(
  context: CanvasRenderingContext2D,
  craft: HoloCraft,
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
    // Square badge linear edge wrap
    const half = faceSize / 2
    const wrapDepth = faceSize * 0.11

    // Top
    const top = context.createLinearGradient(0, centerY - half, 0, centerY - half + wrapDepth)
    top.addColorStop(0, 'rgba(0, 0, 0, 0.32)')
    top.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = top
    context.fillRect(centerX - half, centerY - half, faceSize, wrapDepth)

    // Bottom
    const bottom = context.createLinearGradient(0, centerY + half - wrapDepth, 0, centerY + half)
    bottom.addColorStop(0, 'rgba(0, 0, 0, 0.32)')
    context.fillStyle = bottom
    context.fillRect(centerX - half, centerY + half - wrapDepth, faceSize, wrapDepth)

    // Left
    const left = context.createLinearGradient(centerX - half, 0, centerX - half + wrapDepth, 0)
    left.addColorStop(0, 'rgba(0, 0, 0, 0.32)')
    left.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = left
    context.fillRect(centerX - half, centerY - half, wrapDepth, faceSize)

    // Right
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

function drawBadgeFace(
  context: CanvasRenderingContext2D,
  state: RenderState,
  centerX: number,
  centerY: number,
  faceSize: number,
  artworkSize: number,
  canvasSize: number,
  tiltX: number,
  tiltY: number,
  phase: number | null,
) {
  context.save()
  shapePath(context, state.shape, centerX, centerY, faceSize)
  context.clip()

  // Layer 1: Base User Artwork
  drawMappedArtwork(context, state, centerX, centerY, artworkSize, canvasSize)

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

  // Layer 3: Film Craft Layer (Glossy / Matte / Rainbow / Cracked-Ice / Cross / Water)
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
    state.baseCraft === 'brushed-silver' ||
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
// Preview Scene & Realistic Drop Shadows
// ---------------------------------------------------------------------------

function drawPreviewScene(
  context: CanvasRenderingContext2D,
  size: number,
  state: RenderState,
  tiltX = 0,
  tiltY = 0,
  phase: number | null = null,
) {
  const center = size / 2
  const faceSize = size * previewDiameterRatio(state.finishedDiameterMm)
  const artworkSize = faceSize * (state.printDiameterMm / state.finishedDiameterMm)

  // Neutral studio background
  context.fillStyle = '#eaedf1'
  context.fillRect(0, 0, size, size)

  // Delicate background grid
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

  // Tilting transforms in 2D
  const tiltAngle = tiltX * 0.06 - tiltY * 0.03
  const tiltOffsetX = tiltX * faceSize * 0.035
  const tiltOffsetY = (0.015 + tiltY * 0.025) * faceSize

  // Layer 1: Ambient Diffuse Drop Shadow
  context.save()
  context.translate(center + tiltOffsetX * 1.2, center + tiltOffsetY + faceSize * 0.035)
  context.rotate(tiltAngle)
  context.shadowColor = 'rgba(18, 22, 32, 0.18)'
  context.shadowBlur = faceSize * (0.09 + Math.hypot(tiltX, tiltY) * 0.04)
  context.shadowOffsetY = faceSize * (0.045 + Math.hypot(tiltX, tiltY) * 0.02)
  shapePath(context, state.shape, 0, 0, faceSize)
  context.fillStyle = 'rgba(0, 0, 0, 0.01)'
  context.fill()
  context.restore()

  // Layer 2: Tight Contact Drop Shadow
  context.save()
  context.translate(center + tiltOffsetX, center + tiltOffsetY)
  context.rotate(tiltAngle)
  context.shadowColor = 'rgba(18, 22, 32, 0.28)'
  context.shadowBlur = faceSize * 0.03
  context.shadowOffsetY = faceSize * 0.018
  shapePath(context, state.shape, 0, 0, faceSize)
  context.fillStyle = '#000000'
  context.fill()
  context.restore()

  // Badge Face & Physical Layers
  context.save()
  context.translate(center + tiltOffsetX, center + tiltOffsetY)
  context.rotate(tiltAngle)
  drawBadgeFace(context, state, 0, 0, faceSize, artworkSize, size, tiltX, tiltY, phase)
  context.restore()
}

// ---------------------------------------------------------------------------
// Print Workspace (Editor Alignment, Cut Lines, Safe Areas)
// ---------------------------------------------------------------------------

function drawPrintWorkspace(
  context: CanvasRenderingContext2D,
  size: number,
  state: RenderState,
) {
  const center = size / 2
  const printDiameter = size * 0.72
  const finishedDiameter = printDiameter * (state.finishedDiameterMm / state.printDiameterMm)
  const safeDiameter = printDiameter * (state.safeDiameterMm / state.printDiameterMm)
  const cell = size / 30

  // Checkerboard transparency background
  context.fillStyle = '#eef1f4'
  context.fillRect(0, 0, size, size)
  context.fillStyle = 'rgba(23, 24, 28, 0.04)'
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      if ((x / cell + y / cell) % 2 === 0) {
        context.fillRect(x, y, cell, cell)
      }
    }
  }

  // Artwork in full print area
  context.save()
  shapePath(context, state.shape, center, center, printDiameter)
  context.clip()
  const previewFaceSize = size * previewDiameterRatio(state.finishedDiameterMm)
  const previewArtworkSize =
    previewFaceSize * (state.printDiameterMm / state.finishedDiameterMm)
  drawMappedArtwork(context, state, center, center, previewArtworkSize, size)
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
// Export & Lifecycle
// ---------------------------------------------------------------------------

export function preloadTextures() {
  // Maintained for API compatibility
}

export function renderWorkspace(
  canvas: HTMLCanvasElement,
  state: RenderState,
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

export function createPreviewExport(state: RenderState) {
  const canvas = document.createElement('canvas')
  canvas.width = PREVIEW_EXPORT_SIZE
  canvas.height = PREVIEW_EXPORT_SIZE
  // Export at natural resting studio lighting angle
  drawPreviewScene(getContext(canvas), PREVIEW_EXPORT_SIZE, state, 0.15, 0.1, 0.8)
  return canvas
}

export function createPrintExport(state: RenderState) {
  const size = mmToPixels(state.printDiameterMm)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = getContext(canvas)

  context.clearRect(0, 0, size, size)
  context.save()
  shapePath(context, state.shape, size / 2, size / 2, size)
  context.clip()
  drawMappedArtwork(context, state, size / 2, size / 2, size, size)
  context.restore()
  return canvas
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

async function addPngDpi(blob: Blob, dpi: number) {
  const source = new Uint8Array(await blob.arrayBuffer())
  const signature = source.subarray(0, 8)
  const chunks: Uint8Array[] = [signature]
  let offset = 8
  let inserted = false
  const pixelsPerMeter = Math.round(dpi / 0.0254)

  while (offset + 12 <= source.length) {
    const length = new DataView(source.buffer, source.byteOffset + offset, 4).getUint32(0)
    const end = offset + 12 + length
    if (end > source.length) return blob
    chunks.push(source.subarray(offset, end))
    const type = String.fromCharCode(...source.subarray(offset + 4, offset + 8))
    if (type === 'IHDR' && !inserted) {
      const data = new Uint8Array(9)
      const view = new DataView(data.buffer)
      view.setUint32(0, pixelsPerMeter)
      view.setUint32(4, pixelsPerMeter)
      data[8] = 1
      const chunk = new Uint8Array(4 + 4 + data.length + 4)
      new DataView(chunk.buffer).setUint32(0, data.length)
      chunk.set([112, 72, 89, 115], 4)
      chunk.set(data, 8)
      new DataView(chunk.buffer).setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)))
      chunks.push(chunk)
      inserted = true
    }
    offset = end
  }

  if (!inserted) return blob
  return new Blob(
    chunks.map((chunk) => Uint8Array.from(chunk).buffer),
    { type: 'image/png' },
  )
}

export function validateArtworkFile(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return '请选择 JPG、PNG 或 WebP 图片.'
  }
  if (file.size > MAX_FILE_BYTES) {
    return '图片超过 15MB, 请压缩后重新选择.'
  }
  return null
}

export async function loadArtwork(file: File): Promise<Artwork> {
  let source: CanvasImageSource
  let width: number
  let height: number
  let bitmap: ImageBitmap | null = null
  let objectUrl: string | null = null

  try {
    if ('createImageBitmap' in window) {
      bitmap = await createImageBitmap(file)
      source = bitmap
      width = bitmap.width
      height = bitmap.height
    } else {
      objectUrl = URL.createObjectURL(file)
      const image = new Image()
      image.src = objectUrl
      await image.decode()
      source = image
      width = image.naturalWidth
      height = image.naturalHeight
    }

    if (width <= 0 || height <= 0) throw new Error('图片尺寸无效')
    const scale = Math.min(1, MAX_WORKING_EDGE / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    getContext(canvas).drawImage(source, 0, 0, canvas.width, canvas.height)

    return {
      source: canvas,
      width: canvas.width,
      height: canvas.height,
      name: file.name,
    }
  } finally {
    bitmap?.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

export function createDemoArtwork(): Artwork {
  const size = 1400
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = getContext(canvas)

  // Gradient background
  const bgGrad = context.createLinearGradient(0, 0, size, size)
  bgGrad.addColorStop(0, '#f25042')
  bgGrad.addColorStop(1, '#e53935')
  context.fillStyle = bgGrad
  context.fillRect(0, 0, size, size)

  // Dynamic geometric blocks
  context.fillStyle = '#17181c'
  context.beginPath()
  context.moveTo(0, size * 0.74)
  context.lineTo(size, size * 0.22)
  context.lineTo(size, size)
  context.lineTo(0, size)
  context.fill()

  context.fillStyle = '#63d6d1'
  context.beginPath()
  context.arc(size * 0.74, size * 0.32, size * 0.18, 0, Math.PI * 2)
  context.fill()

  // Typographic badge label
  context.save()
  context.translate(size * 0.4, size * 0.43)
  context.rotate(-0.1)
  context.fillStyle = '#f4d35e'
  context.font = '900 380px system-ui, -apple-system, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('GZ', 0, 0)
  context.restore()

  context.fillStyle = '#ffffff'
  context.font = '700 70px system-ui, -apple-system, sans-serif'
  context.textAlign = 'center'
  context.fillText('PREVIEW TOOLS', size / 2, size * 0.72)

  return {
    source: canvas,
    width: size,
    height: size,
    name: '默认样稿',
    isDemo: true,
  }
}

export function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  dpi?: number,
) {
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('浏览器未能生成 PNG 文件'))
        return
      }

      const png = dpi ? addPngDpi(blob, dpi) : Promise.resolve(blob)
      void png
        .then((png) => {
          const url = URL.createObjectURL(png)
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          link.click()
          setTimeout(() => URL.revokeObjectURL(url), 0)
          resolve()
        })
        .catch(reject)
    }, 'image/png')
  })
}
