import {
  mmToPixels,
  previewDiameterRatio,
  type BadgeShape,
  type Transform,
} from './geometry.ts'

export const DISPLAY_SIZE = 900
export const PREVIEW_EXPORT_SIZE = 1080
export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const MAX_WORKING_EDGE = 2048

export type BaseCraft = 'none' | 'silver-glitter' | 'gold-glitter' | 'pearl'
export type FilmCraft = 'none' | 'glossy' | 'matte' | 'rainbow' | 'cracked-ice' | 'lattice'

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

function getContext(canvas: HTMLCanvasElement) {
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
    // square with 10% corner radius
    const half = size / 2
    const radius = size * 0.1
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
  return
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

function drawGlitterBase(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tilt: number,
  color: [number, number, number],
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  // 闪底: sparkle particles with halos, bright enough to be visible on artwork.
  context.globalCompositeOperation = 'screen'
  const count = 500
  let seed = 12345
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < count; i += 1) {
    const rx = (rand() - 0.5) * faceSize * 1.1
    const ry = (rand() - 0.5) * faceSize * 1.1
    const dist = Math.hypot(rx, ry)
    if (dist > faceSize * 0.48) continue
    const phase = rand() * Math.PI * 2
    const shimmer = 0.4 + 0.6 * Math.abs(Math.sin(tilt * 2 + phase))
    const alpha = 0.35 + shimmer * 0.5
    const psize = 1.0 + rand() * 2.5
    context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
    context.beginPath()
    context.arc(rx, ry, psize, 0, Math.PI * 2)
    context.fill()
    if (rand() > 0.6) {
      context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.3})`
      context.beginPath()
      context.arc(rx, ry, psize * 2.5, 0, Math.PI * 2)
      context.fill()
    }
  }

 context.restore()
}

function drawPearlBase(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tilt: number,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

 // 珠光底: soft iridescent sheen with subtle wave pattern.
 // Not particles — a smooth flowing gradient that shifts with tilt.
  context.globalCompositeOperation = 'overlay'
  context.globalAlpha = 0.8

 // Layer 1: warm-cool wave gradient moving with tilt.
 const wave = context.createLinearGradient(
   -faceSize * 0.3 + tilt * faceSize * 0.25,
   -faceSize * 0.3,
   faceSize * 0.3 + tilt * faceSize * 0.25,
   faceSize * 0.3,
 )
  wave.addColorStop(0, 'rgba(255, 220, 200, 0.7)')
  wave.addColorStop(0.3, 'rgba(200, 220, 255, 0.7)')
  wave.addColorStop(0.6, 'rgba(220, 200, 255, 0.7)')
  wave.addColorStop(1, 'rgba(255, 230, 200, 0.7)')
 context.fillStyle = wave
 context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

 // Layer 2: bright luster band — narrow bright zone that moves with tilt.
 context.globalCompositeOperation = 'screen'
  context.globalAlpha = 0.5
 const bandX = tilt * faceSize * 0.35
 const band = context.createRadialGradient(bandX, -faceSize * 0.1, 0, bandX, -faceSize * 0.1, faceSize * 0.4)
  band.addColorStop(0, 'rgba(255, 250, 245, 0.6)')
  band.addColorStop(0.4, 'rgba(255, 250, 245, 0.2)')
 band.addColorStop(1, 'rgba(255, 250, 245, 0)')
 context.fillStyle = band
 context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

 context.restore()
}

function drawGlossyFilm(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tilt: number,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

 // 亮膜: smooth high-gloss reflection, single bright highlight that moves with tilt.
 context.globalCompositeOperation = 'screen'
 const hx = tilt * faceSize * 0.28
 const hy = -faceSize * 0.15 + Math.abs(tilt) * faceSize * 0.05
 const highlight = context.createRadialGradient(hx, hy, 0, hx, hy, faceSize * 0.55)
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.5)')
  highlight.addColorStop(0.2, 'rgba(255, 255, 255, 0.25)')
  highlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)')
 highlight.addColorStop(1, 'rgba(255, 255, 255, 0)')
 context.fillStyle = highlight
 context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

 // Subtle full-face brightness lift
 context.globalCompositeOperation = 'soft-light'
  context.fillStyle = 'rgba(255, 255, 255, 0.12)'
 context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

  context.restore()
}

function drawMatteFilm(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tilt: number,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

 // 哑光膜: reduces contrast and saturation, adds a soft diffuse glow with no specular.
 // No bright highlight — matte surface scatters light evenly.
  // Layer 1: desaturate by overlaying a neutral gray veil.
  context.globalCompositeOperation = 'saturation'
  context.fillStyle = 'rgba(160, 160, 165, 0.35)'
  context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

  // Layer 2: soft-light to reduce contrast.
  context.globalCompositeOperation = 'soft-light'
  context.fillStyle = 'rgba(190, 190, 195, 0.3)'
 context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

 // Very subtle diffuse brightening that shifts slightly with tilt.
 context.globalCompositeOperation = 'overlay'
  context.globalAlpha = 0.35
 const diffuse = context.createRadialGradient(
   tilt * faceSize * 0.15,
   -faceSize * 0.05,
   0,
   tilt * faceSize * 0.15,
   -faceSize * 0.05,
   faceSize * 0.6,
 )
  diffuse.addColorStop(0, 'rgba(220, 220, 225, 0.35)')
  diffuse.addColorStop(0.5, 'rgba(220, 220, 225, 0.12)')
 diffuse.addColorStop(1, 'rgba(230, 230, 235, 0)')
 context.fillStyle = diffuse
 context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

 context.restore()
}

function drawHolographicFilm(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tilt: number,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  // 素面镭射: smooth rainbow sheen across entire face, shifts with viewing angle.
  // tilt: -1 to 1, controls the hue rotation and highlight position.

  // Layer 1: conic rainbow — full spectrum radiating from center, rotates with tilt.
  // Uses screen blend so rainbow colors are clearly visible over any artwork.
  context.globalCompositeOperation = 'screen'
  const steps = 36
  const rotAngle = tilt * 1.2
  for (let i = 0; i < steps; i += 1) {
    const t0 = i / steps
    const t1 = (i + 1) / steps
    const a0 = t0 * Math.PI * 2 + rotAngle
    const a1 = t1 * Math.PI * 2 + rotAngle
    const hue = ((t0 * 360 + tilt * 40) % 360)
    context.fillStyle = `hsla(${hue}, 95%, 55%, 0.22)`
    context.beginPath()
    context.moveTo(0, 0)
    context.arc(0, 0, faceSize * 0.72, a0, a1)
    context.closePath()
    context.fill()
  }

  // Layer 2: moving specular highlight — bright spot that travels with tilt.
  context.globalCompositeOperation = 'screen'
  const hx = tilt * faceSize * 0.32
  const hy = -faceSize * 0.12 + Math.abs(tilt) * faceSize * 0.06
  const highlight = context.createRadialGradient(hx, hy, 0, hx, hy, faceSize * 0.42)
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.45)')
  highlight.addColorStop(0.3, 'rgba(255, 255, 255, 0.18)')
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = highlight
  context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

  // Layer 3: iridescent edge ring — stronger color near the badge edge.
  context.globalCompositeOperation = 'overlay'
  context.globalAlpha = 0.45
  const edge = context.createRadialGradient(0, 0, faceSize * 0.25, 0, 0, faceSize * 0.52)
  const eh = ((tilt * 180 + 200) % 360)
  edge.addColorStop(0, `hsla(${eh}, 90%, 50%, 0)`)
  edge.addColorStop(0.6, `hsla(${eh}, 90%, 50%, 0.05)`)
  edge.addColorStop(0.85, `hsla(${((eh + 60) % 360)}, 95%, 55%, 0.2)`)
  edge.addColorStop(1, `hsla(${((eh + 120) % 360)}, 95%, 55%, 0.4)`)
  context.fillStyle = edge
  context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

  context.restore()
}

function drawCrackedIceFilm(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tilt: number,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  // 碎冰镭射: irregular cracked-ice rainbow pattern.
  // Each "ice shard" is a polygon with its own hue, creating fragmented rainbow.
  context.globalCompositeOperation = 'screen'
  let seed = 54321
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }

  // Generate Voronoi-like cell centers, then draw each as a colored polygon.
  const cellCount = 32
  const cells: Array<{ x: number; y: number; hue: number }> = []
  for (let i = 0; i < cellCount; i += 1) {
    const rx = (rand() - 0.5) * faceSize * 1.0
    const ry = (rand() - 0.5) * faceSize * 1.0
    if (Math.hypot(rx, ry) > faceSize * 0.48) continue
    const hue = (rand() * 360 + tilt * 60) % 360
    cells.push({ x: rx, y: ry, hue })
  }

  // For each pixel block, find nearest cell center and use its hue.
  const blockSize = 6
  const half = faceSize * 0.48
  for (let py = -half; py <= half; py += blockSize) {
    for (let px = -half; px <= half; px += blockSize) {
      if (Math.hypot(px, py) > half) continue
      let nearest = cells[0]
      let minDist = Infinity
      for (const cell of cells) {
        const d = Math.hypot(px - cell.x, py - cell.y)
        if (d < minDist) {
          minDist = d
          nearest = cell
        }
      }
      if (!nearest) continue
      context.fillStyle = `hsla(${nearest.hue}, 90%, 55%, 0.2)`
      context.fillRect(px, py, blockSize, blockSize)
    }
  }

  // Moving highlight on top.
  context.globalCompositeOperation = 'screen'
  const hx = tilt * faceSize * 0.3
  const hy = -faceSize * 0.1
  const highlight = context.createRadialGradient(hx, hy, 0, hx, hy, faceSize * 0.4)
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.3)')
  highlight.addColorStop(0.3, 'rgba(255, 255, 255, 0.12)')
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = highlight
  context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

  context.restore()
}

function drawLatticeFilm(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
  tilt: number,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()
  context.translate(centerX, centerY)

  // 方格镭射: regular grid of rainbow cells, like a checkered holographic pattern.
  // Each cell shifts hue based on position and tilt.
  context.globalCompositeOperation = 'screen'
  const gridSize = faceSize * 0.08
  const half = faceSize * 0.5
  const cols = Math.ceil(faceSize / gridSize) + 2
  const startX = -Math.ceil(cols / 2) * gridSize

  for (let row = 0; row < cols; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const px = startX + col * gridSize
      const py = startX + row * gridSize
      // Skip cells entirely outside the badge
      if (Math.hypot(px + gridSize / 2, py + gridSize / 2) > half) continue
      const cellHue = ((col * 35 + row * 50 + tilt * 80) % 360 + 360) % 360
      context.fillStyle = `hsla(${cellHue}, 90%, 55%, 0.18)`
      context.fillRect(px, py, gridSize, gridSize)
    }
  }

  // Grid line overlay for crisp lattice edges.
  context.globalCompositeOperation = 'overlay'
  context.globalAlpha = 0.15
  context.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  context.lineWidth = 1
  for (let i = 0; i <= cols; i += 1) {
    const pos = startX + i * gridSize
    context.beginPath()
    context.moveTo(pos, -half)
    context.lineTo(pos, half)
    context.moveTo(-half, pos)
    context.lineTo(half, pos)
    context.stroke()
  }

  // Moving highlight.
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = 1
  const hx = tilt * faceSize * 0.3
  const hy = -faceSize * 0.1
  const highlight = context.createRadialGradient(hx, hy, 0, hx, hy, faceSize * 0.4)
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.3)')
  highlight.addColorStop(0.3, 'rgba(255, 255, 255, 0.12)')
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = highlight
  context.fillRect(-faceSize, -faceSize, faceSize * 2, faceSize * 2)

  context.restore()
}

function drawEdgeShadow(
  context: CanvasRenderingContext2D,
  shape: BadgeShape,
  centerX: number,
  centerY: number,
  faceSize: number,
) {
  context.save()
  shapePath(context, shape, centerX, centerY, faceSize)
  context.clip()

  if (shape === 'round') {
    // Radial gradient works well for circles.
    const wrap = context.createRadialGradient(
      centerX,
      centerY,
      faceSize * 0.34,
      centerX,
      centerY,
      faceSize * 0.52,
    )
    wrap.addColorStop(0, 'rgba(0, 0, 0, 0)')
    wrap.addColorStop(0.6, 'rgba(0, 0, 0, 0)')
    wrap.addColorStop(0.8, 'rgba(0, 0, 0, 0.04)')
    wrap.addColorStop(0.92, 'rgba(0, 0, 0, 0.16)')
    wrap.addColorStop(1, 'rgba(0, 0, 0, 0.36)')
    context.fillStyle = wrap
    context.fillRect(
      centerX - faceSize / 2,
      centerY - faceSize / 2,
      faceSize,
      faceSize,
    )
  } else {
    // For square, rectangle, shield: four-edge linear gradient shadow.
    const half = faceSize / 2
    const max = faceSize * 0.12

    // Use four linear gradients from each edge, composited together.
    // Top edge
    const top = context.createLinearGradient(0, centerY - half, 0, centerY - half + max)
    top.addColorStop(0, 'rgba(0, 0, 0, 0.28)')
    top.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = top
    context.fillRect(centerX - half, centerY - half, faceSize, max)

    // Bottom edge
    const bottom = context.createLinearGradient(0, centerY + half - max, 0, centerY + half)
    bottom.addColorStop(0, 'rgba(0, 0, 0, 0)')
    bottom.addColorStop(1, 'rgba(0, 0, 0, 0.28)')
    context.fillStyle = bottom
    context.fillRect(centerX - half, centerY + half - max, faceSize, max)

    // Left edge
    const left = context.createLinearGradient(centerX - half, 0, centerX - half + max, 0)
    left.addColorStop(0, 'rgba(0, 0, 0, 0.28)')
    left.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = left
    context.fillRect(centerX - half, centerY - half, max, faceSize)

    // Right edge
    const right = context.createLinearGradient(centerX + half - max, 0, centerX + half, 0)
    right.addColorStop(0, 'rgba(0, 0, 0, 0)')
    right.addColorStop(1, 'rgba(0, 0, 0, 0.28)')
    context.fillStyle = right
    context.fillRect(centerX + half - max, centerY - half, max, faceSize)

    // Corner darkening — subtle radial at each corner
    const cornerR = faceSize * 0.15
    const corners = [
      [centerX - half, centerY - half],
      [centerX + half, centerY - half],
      [centerX - half, centerY + half],
      [centerX + half, centerY + half],
    ]
    for (const [cx, cy] of corners) {
      const cg = context.createRadialGradient(cx, cy, 0, cx, cy, cornerR)
      cg.addColorStop(0, 'rgba(0, 0, 0, 0.22)')
      cg.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = cg
      context.fillRect(cx - cornerR, cy - cornerR, cornerR * 2, cornerR * 2)
    }
  }

  context.restore()
}

function drawBadgeFace(
  context: CanvasRenderingContext2D,
  state: RenderState,
  centerX: number,
  centerY: number,
  faceSize: number,
  artworkSize: number,
  canvasSize: number,
  tilt: number,
) {
  context.save()
  shapePath(context, state.shape, centerX, centerY, faceSize)
  context.clip()
  drawMappedArtwork(context, state, centerX, centerY, artworkSize, canvasSize)

  if (state.baseCraft === 'silver-glitter') {
    drawGlitterBase(context, state.shape, centerX, centerY, faceSize, tilt, [220, 228, 240])
  } else if (state.baseCraft === 'gold-glitter') {
    drawGlitterBase(context, state.shape, centerX, centerY, faceSize, tilt, [255, 200, 80])
  } else if (state.baseCraft === 'pearl') {
    drawPearlBase(context, state.shape, centerX, centerY, faceSize, tilt)
  }

  if (state.filmCraft === 'glossy') {
    drawGlossyFilm(context, state.shape, centerX, centerY, faceSize, tilt)
  } else if (state.filmCraft === 'matte') {
    drawMatteFilm(context, state.shape, centerX, centerY, faceSize, tilt)
  } else if (state.filmCraft === 'rainbow') {
    drawHolographicFilm(context, state.shape, centerX, centerY, faceSize, tilt)
  } else if (state.filmCraft === 'cracked-ice') {
    drawCrackedIceFilm(context, state.shape, centerX, centerY, faceSize, tilt)
  } else if (state.filmCraft === 'lattice') {
    drawLatticeFilm(context, state.shape, centerX, centerY, faceSize, tilt)
  }

  drawEdgeShadow(context, state.shape, centerX, centerY, faceSize)

  context.restore()
}

function drawPreviewScene(
  context: CanvasRenderingContext2D,
  size: number,
  state: RenderState,
  tilt: number,
) {
  const center = size / 2
  const faceSize = size * previewDiameterRatio(state.finishedDiameterMm)
  const artworkSize = faceSize * (state.printDiameterMm / state.finishedDiameterMm)

  context.fillStyle = '#e8ecef'
  context.fillRect(0, 0, size, size)

  context.save()
  context.strokeStyle = 'rgba(23, 24, 28, 0.06)'
  context.lineWidth = 1
  const grid = size / 12
  for (let value = grid; value < size; value += grid) {
    context.beginPath()
    context.moveTo(value, 0)
    context.lineTo(value, size)
    context.moveTo(0, value)
    context.lineTo(size, value)
    context.stroke()
  }
  context.restore()

  // Circular wobble: X = sin, Y = cos — traces a circle like swirling a glass.
  const tiltAngle = tilt * 0.10
  const tiltOffsetX = tilt * faceSize * 0.03
  const tiltY = Math.sqrt(Math.max(0, 1 - tilt * tilt))
  const tiltOffsetY = tiltY * faceSize * 0.018

  // Drop shadow.
  context.save()
  context.translate(center + tiltOffsetX, center + tiltOffsetY)
  context.rotate(tiltAngle)
  context.shadowColor = 'rgba(23, 24, 28, 0.22)'
  context.shadowBlur = faceSize * (0.06 + Math.abs(tilt) * 0.03)
  context.shadowOffsetY = faceSize * (0.04 + Math.abs(tilt) * 0.02)
  shapePath(context, state.shape, 0, 0, faceSize)
  context.fillStyle = '#000'
  context.fill()
  context.restore()

  // Badge face.
  context.save()
  context.translate(center + tiltOffsetX, center + tiltOffsetY)
  context.rotate(tiltAngle)
  drawBadgeFace(context, state, 0, 0, faceSize, artworkSize, size, tilt)
  context.restore()
}

function drawPrintWorkspace(
  context: CanvasRenderingContext2D,
  size: number,
  state: RenderState,
) {
  const center = size / 2
  const printDiameter = size * 0.72
  const finishedDiameter =
    printDiameter * (state.finishedDiameterMm / state.printDiameterMm)
  const safeDiameter =
    printDiameter * (state.safeDiameterMm / state.printDiameterMm)
  const cell = size / 30

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

  context.save()
  shapePath(context, state.shape, center, center, printDiameter)
  context.clip()
  const previewFaceSize = size * previewDiameterRatio(state.finishedDiameterMm)
  const previewArtworkSize = previewFaceSize * (state.printDiameterMm / state.finishedDiameterMm)
  drawMappedArtwork(
    context,
    state,
    center,
    center,
    previewArtworkSize,
    size,
  )
  context.restore()

  context.save()
  shapeRingPath(
    context,
    state.shape,
    center,
    center,
    printDiameter,
    finishedDiameter,
  )
  context.fillStyle = 'rgba(244, 211, 94, 0.17)'
  context.fill('evenodd')
  context.restore()

  context.save()
  context.lineWidth = size * 0.006
  shapePath(context, state.shape, center, center, printDiameter)
  context.strokeStyle = '#f05a4f'
  context.setLineDash([])
  context.stroke()

  shapePath(context, state.shape, center, center, finishedDiameter)
  context.strokeStyle = '#17181c'
  context.setLineDash([size * 0.018, size * 0.012])
  context.stroke()

  shapePath(context, state.shape, center, center, safeDiameter)
  context.strokeStyle = '#20a9a5'
  context.setLineDash([size * 0.004, size * 0.012])
  context.stroke()
  context.restore()
}

export function renderWorkspace(
  canvas: HTMLCanvasElement,
  state: RenderState,
  view: ViewMode,
  tilt: number,
) {
  if (canvas.width !== DISPLAY_SIZE || canvas.height !== DISPLAY_SIZE) {
    canvas.width = DISPLAY_SIZE
    canvas.height = DISPLAY_SIZE
  }

  const context = getContext(canvas)
  context.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE)
  if (view === 'preview') {
    drawPreviewScene(context, DISPLAY_SIZE, state, tilt)
  } else {
    drawPrintWorkspace(context, DISPLAY_SIZE, state)
  }
}

export function createPreviewExport(state: RenderState) {
  const canvas = document.createElement('canvas')
  canvas.width = PREVIEW_EXPORT_SIZE
  canvas.height = PREVIEW_EXPORT_SIZE
  drawPreviewScene(
    getContext(canvas),
    PREVIEW_EXPORT_SIZE,
    state,
    0,
  )
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

  context.fillStyle = '#f05a4f'
  context.fillRect(0, 0, size, size)
  context.fillStyle = '#17181c'
  context.beginPath()
  context.moveTo(0, size * 0.72)
  context.lineTo(size, size * 0.18)
  context.lineTo(size, size)
  context.lineTo(0, size)
  context.fill()

  context.fillStyle = '#63d6d1'
  context.beginPath()
  context.arc(size * 0.72, size * 0.31, size * 0.19, 0, Math.PI * 2)
  context.fill()

  context.save()
  context.translate(size * 0.4, size * 0.42)
  context.rotate(-0.12)
  context.fillStyle = '#f4d35e'
  context.font = '900 390px system-ui, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('GZ', 0, 0)
  context.restore()

  context.fillStyle = '#ffffff'
  context.font = '700 72px system-ui, sans-serif'
  context.textAlign = 'center'
  context.fillText('MAKE IT YOURS', size / 2, size * 0.7)

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
