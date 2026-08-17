import {
  mmToPixels,
  previewDiameterRatio,
  type Transform,
} from './geometry.ts'

export const DISPLAY_SIZE = 900
export const PREVIEW_EXPORT_SIZE = 1080
export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const MAX_WORKING_EDGE = 2048

export type Craft = 'plain' | 'holographic'
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
  craft: Craft
  printDiameterMm: number
  finishedDiameterMm: number
  safeDiameterMm: number
}

function getContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法创建 Canvas 2D 画布')
  return context
}

function circlePath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  diameter: number,
) {
  context.beginPath()
  context.arc(x, y, diameter / 2, 0, Math.PI * 2)
}

function ringPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerDiameter: number,
  innerDiameter: number,
) {
  context.beginPath()
  context.arc(x, y, outerDiameter / 2, 0, Math.PI * 2)
  context.arc(x, y, innerDiameter / 2, 0, Math.PI * 2)
}

function drawMappedArtwork(
  context: CanvasRenderingContext2D,
  state: RenderState,
  centerX: number,
  centerY: number,
  printDiameter: number,
) {
  const { artwork, transform } = state
  const baseScale = printDiameter / Math.min(artwork.width, artwork.height)
  const scale = baseScale * transform.zoom
  const width = artwork.width * scale
  const height = artwork.height * scale
  const x = centerX - width / 2 + transform.offsetX * printDiameter
  const y = centerY - height / 2 + transform.offsetY * printDiameter

  context.drawImage(artwork.source, x, y, width, height)
}

function drawHolographicFilm(
  context: CanvasRenderingContext2D,
  center: number,
  diameter: number,
  phase: number,
) {
  context.save()
  circlePath(context, center, center, diameter)
  context.clip()
  context.globalCompositeOperation = 'soft-light'
  context.translate(center, center)
  context.rotate(-0.52)

  const travel = diameter * 1.5
  const shift = ((phase % 1) - 0.5) * travel
  const band = diameter * 0.58
  const gradient = context.createLinearGradient(
    shift - band,
    0,
    shift + band,
    0,
  )
  gradient.addColorStop(0, 'rgba(99, 214, 209, 0)')
  gradient.addColorStop(0.18, 'rgba(99, 214, 209, 0.22)')
  gradient.addColorStop(0.38, 'rgba(244, 211, 94, 0.18)')
  gradient.addColorStop(0.56, 'rgba(240, 90, 79, 0.2)')
  gradient.addColorStop(0.74, 'rgba(111, 111, 255, 0.18)')
  gradient.addColorStop(1, 'rgba(99, 214, 209, 0)')
  context.fillStyle = gradient
  context.fillRect(-diameter * 1.5, -diameter, diameter * 3, diameter * 2)

  context.globalCompositeOperation = 'screen'
  context.globalAlpha = 0.08
  context.strokeStyle = '#ffffff'
  context.lineWidth = Math.max(1, diameter * 0.003)
  for (let x = -diameter; x <= diameter; x += diameter * 0.075) {
    context.beginPath()
    context.moveTo(x + shift * 0.2, -diameter)
    context.lineTo(x + diameter * 0.24 + shift * 0.2, diameter)
    context.stroke()
  }
  context.restore()
}

function drawPreviewScene(
  context: CanvasRenderingContext2D,
  size: number,
  state: RenderState,
  phase: number,
) {
  const center = size / 2
  const finishedDiameter = size * previewDiameterRatio(state.finishedDiameterMm)
  const printDiameter =
    finishedDiameter * (state.printDiameterMm / state.finishedDiameterMm)
  const shellDiameter = finishedDiameter * 1.08

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

  context.save()
  context.shadowColor = 'rgba(23, 24, 28, 0.28)'
  context.shadowBlur = finishedDiameter * 0.088
  context.shadowOffsetY = finishedDiameter * 0.056
  circlePath(context, center, center, shellDiameter)
  context.fillStyle = '#aab0b5'
  context.fill()
  context.restore()

  const metal = context.createLinearGradient(
    center - shellDiameter / 2,
    center - shellDiameter / 2,
    center + shellDiameter / 2,
    center + shellDiameter / 2,
  )
  metal.addColorStop(0, '#f9fbfc')
  metal.addColorStop(0.24, '#9aa0a5')
  metal.addColorStop(0.48, '#f3f5f6')
  metal.addColorStop(0.72, '#7d8388')
  metal.addColorStop(1, '#dfe3e5')
  circlePath(context, center, center, shellDiameter)
  context.fillStyle = metal
  context.fill()

  context.save()
  circlePath(context, center, center, finishedDiameter)
  context.clip()
  drawMappedArtwork(context, state, center, center, printDiameter)
  context.restore()

  if (state.craft === 'holographic') {
    drawHolographicFilm(context, center, finishedDiameter, phase)
  }

  if (state.craft === 'holographic') {
    context.save()
    circlePath(context, center, center, finishedDiameter)
    context.clip()
    const gloss = context.createRadialGradient(
      center - finishedDiameter * 0.22,
      center - finishedDiameter * 0.26,
      finishedDiameter * 0.04,
      center,
      center,
      finishedDiameter * 0.62,
    )
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.16)')
    gloss.addColorStop(0.42, 'rgba(255, 255, 255, 0.025)')
    gloss.addColorStop(1, 'rgba(23, 24, 28, 0.08)')
    context.fillStyle = gloss
    context.fillRect(0, 0, size, size)
    context.restore()
  }

  circlePath(context, center, center, finishedDiameter)
  context.strokeStyle = 'rgba(255, 255, 255, 0.72)'
  context.lineWidth = Math.max(2, finishedDiameter * 0.0128)
  context.stroke()

  circlePath(context, center, center, shellDiameter)
  context.strokeStyle = 'rgba(23, 24, 28, 0.34)'
  context.lineWidth = Math.max(2, finishedDiameter * 0.0096)
  context.stroke()
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
  circlePath(context, center, center, printDiameter)
  context.clip()
  drawMappedArtwork(context, state, center, center, printDiameter)
  context.restore()

  context.save()
  ringPath(context, center, center, printDiameter, finishedDiameter)
  context.fillStyle = 'rgba(244, 211, 94, 0.17)'
  context.fill('evenodd')
  context.restore()

  context.save()
  context.lineWidth = size * 0.006
  circlePath(context, center, center, printDiameter)
  context.strokeStyle = '#f05a4f'
  context.setLineDash([])
  context.stroke()

  circlePath(context, center, center, finishedDiameter)
  context.strokeStyle = '#17181c'
  context.setLineDash([size * 0.018, size * 0.012])
  context.stroke()

  circlePath(context, center, center, safeDiameter)
  context.strokeStyle = '#20a9a5'
  context.setLineDash([size * 0.004, size * 0.012])
  context.stroke()
  context.restore()
}

export function renderWorkspace(
  canvas: HTMLCanvasElement,
  state: RenderState,
  view: ViewMode,
  phase: number,
) {
  if (canvas.width !== DISPLAY_SIZE || canvas.height !== DISPLAY_SIZE) {
    canvas.width = DISPLAY_SIZE
    canvas.height = DISPLAY_SIZE
  }

  const context = getContext(canvas)
  context.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE)
  if (view === 'preview') {
    drawPreviewScene(context, DISPLAY_SIZE, state, phase)
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
    state.craft === 'holographic' ? 0.56 : 0,
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
  circlePath(context, size / 2, size / 2, size)
  context.clip()
  drawMappedArtwork(context, state, size / 2, size / 2, size)
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
  context.fillText('MAKE IT YOURS', size / 2, size * 0.78)

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
