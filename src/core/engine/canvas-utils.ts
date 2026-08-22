import type { Artwork, Transform } from '../types.ts'

export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const MAX_WORKING_EDGE = 2048

/**
 * 校验上传文件
 */
export function validateArtworkFile(file: File): string | null {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return '仅支持 JPG、PNG 或 WebP 格式的图片文件'
  }
  if (file.size > MAX_FILE_BYTES) {
    return '图片大小不能超过 15MB'
  }
  return null
}

/**
 * 加载并按最大边 2048px 缩放画稿
 */
export async function loadArtwork(file: File): Promise<Artwork> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('图片解码失败，请换一张图片尝试'))
    })

    const maxEdge = Math.max(image.naturalWidth, image.naturalHeight)
    if (maxEdge <= MAX_WORKING_EDGE) {
      return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        name: file.name,
      }
    }

    const scale = MAX_WORKING_EDGE / maxEdge
    const targetW = Math.round(image.naturalWidth * scale)
    const targetH = Math.round(image.naturalHeight * scale)
    const offscreen = document.createElement('canvas')
    offscreen.width = targetW
    offscreen.height = targetH
    const ctx = offscreen.getContext('2d')
    if (!ctx) throw new Error('无法创建离屏缩放画布')
    ctx.drawImage(image, 0, 0, targetW, targetH)

    return {
      source: offscreen,
      width: targetW,
      height: targetH,
      name: file.name,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 创建内置默认排版样稿
 */
export function createDemoArtwork(size = 1024): Artwork {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建样稿画布')

  const bgGrad = ctx.createLinearGradient(0, 0, size, size)
  bgGrad.addColorStop(0, '#f05a4f')
  bgGrad.addColorStop(1, '#ff7a59')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = '#17181c'
  ctx.beginPath()
  ctx.moveTo(0, size * 0.74)
  ctx.lineTo(size, size * 0.22)
  ctx.lineTo(size, size)
  ctx.lineTo(0, size)
  ctx.fill()

  ctx.fillStyle = '#63d6d1'
  ctx.beginPath()
  ctx.arc(size * 0.74, size * 0.32, size * 0.18, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.translate(size * 0.4, size * 0.43)
  ctx.rotate(-0.1)
  ctx.fillStyle = '#f4d35e'
  ctx.font = '900 380px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('GZ', 0, 0)
  ctx.restore()

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 70px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('PREVIEW TOOLS', size / 2, size * 0.72)

  return {
    source: canvas,
    width: size,
    height: size,
    name: '默认样稿',
    isDemo: true,
  }
}

/**
 * 绘制圆角矩形路径
 */
export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * 绘制映射并变换后的用户画稿
 */
export function drawMappedArtwork(
  ctx: CanvasRenderingContext2D,
  artwork: Artwork | null,
  transform: Transform,
  centerX: number,
  centerY: number,
  targetWidth: number,
  targetHeight: number,
) {
  if (!artwork || !artwork.width || !artwork.height) {
    ctx.fillStyle = '#1c202a'
    ctx.fillRect(
      centerX - targetWidth / 2,
      centerY - targetHeight / 2,
      targetWidth,
      targetHeight,
    )
    return
  }

  const artAspect = artwork.width / artwork.height
  const targetAspect = targetWidth / targetHeight

  let baseW = targetWidth
  let baseH = targetHeight

  if (artAspect > targetAspect) {
    baseW = targetHeight * artAspect
  } else {
    baseH = targetWidth / artAspect
  }

  const finalW = baseW * transform.scale
  const finalH = baseH * transform.scale
  const posX = centerX + transform.offsetX * targetWidth - finalW / 2
  const posY = centerY + transform.offsetY * targetHeight - finalH / 2

  ctx.drawImage(artwork.source, posX, posY, finalW, finalH)
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

  return new Blob(chunks as BlobPart[], { type: 'image/png' })
}

/**
 * 触发 Canvas 图像文件无损下载，支持注入 300 DPI 元数据
 */
export function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  dpi?: number,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('浏览器未能生成 PNG 文件'))
        return
      }

      const png = dpi ? addPngDpi(blob, dpi) : Promise.resolve(blob)
      void png
        .then((pngBlob) => {
          const url = URL.createObjectURL(pngBlob)
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

