import type { BaseCraft } from '../../types.ts'


const glitterLayers = new Map<string, HTMLCanvasElement>()

function hash2D(x: number, y: number): number {
  const sin = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123
  return sin - Math.floor(sin)
}

/**
 * 生成或获取高密度确定性闪粉微粒图层
 */
export function getGlitterLayer(
  width: number,
  height: number,
  craft: BaseCraft,
): HTMLCanvasElement {
  const key = `${width}x${height}-${craft}`
  const cached = glitterLayers.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.clearRect(0, 0, width, height)

  if (craft === 'pearl') {
    // 珠光贝母卡纸：双色温虹彩柔光渐变
    const pearlGrad = ctx.createLinearGradient(0, 0, width, height)
    pearlGrad.addColorStop(0, 'rgba(255, 230, 245, 0.4)')
    pearlGrad.addColorStop(0.35, 'rgba(220, 245, 255, 0.45)')
    pearlGrad.addColorStop(0.7, 'rgba(255, 248, 220, 0.4)')
    pearlGrad.addColorStop(1, 'rgba(235, 225, 255, 0.45)')
    ctx.fillStyle = pearlGrad
    ctx.fillRect(0, 0, width, height)
    glitterLayers.set(key, canvas)
    return canvas
  }

  if (craft === 'brushed-silver') {
    // 拉丝银卡：横向微细发丝纹理
    ctx.lineWidth = 1.0
    for (let y = 0; y < height; y += 1.5) {
      const alpha = 0.05 + hash2D(y * 3.7, 11) * 0.16
      const isDark = hash2D(y * 1.3, 77) > 0.4
      ctx.strokeStyle = isDark
        ? `rgba(90, 95, 108, ${alpha})`
        : `rgba(255, 255, 255, ${alpha * 1.5})`
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    glitterLayers.set(key, canvas)
    return canvas
  }

  const count =
    craft === 'fine-silver' || craft === 'gold-glitter' || craft === 'sand-glitter'
      ? Math.floor((width * height) / 32)
      : craft === 'silver-glitter'
        ? Math.floor((width * height) / 75)
        : Math.floor((width * height) / 45)

  for (let i = 0; i < count; i++) {
    const x = hash2D(i, 1) * width
    const y = hash2D(i, 2) * height
    const baseSize =
      craft === 'fine-silver'
        ? 0.5 + hash2D(i, 3) * 0.9
        : craft === 'silver-glitter'
          ? 1.8 + hash2D(i, 3) * 3.0
          : craft === 'sand-glitter'
            ? 0.6 + hash2D(i, 3) * 1.5
            : craft === 'gold-glitter'
              ? 0.9 + hash2D(i, 3) * 2.2
              : 1.0 + hash2D(i, 3) * 1.8

    const angle = hash2D(i, 4) * Math.PI * 2
    const brightness = 0.6 + hash2D(i, 5) * 0.4
    const alpha = 0.4 + hash2D(i, 6) * 0.6

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)

    if (craft === 'silver-glitter') {
      ctx.beginPath()
      for (let s = 0; s < 6; s++) {
        const rad = (s * Math.PI) / 3
        const px = Math.cos(rad) * baseSize
        const py = Math.sin(rad) * baseSize
        if (s === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      const sparkleVal = Math.floor(brightness * 255)
      ctx.fillStyle = `rgba(${sparkleVal}, ${sparkleVal}, ${Math.min(255, sparkleVal + 20)}, ${alpha})`
      ctx.fill()
    } else if (craft === 'gold-glitter') {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, baseSize)
      grad.addColorStop(0, `rgba(255, 245, 175, ${alpha})`)
      grad.addColorStop(0.5, `rgba(240, 195, 75, ${alpha * 0.75})`)
      grad.addColorStop(1, 'rgba(180, 130, 30, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(0, 0, baseSize, 0, Math.PI * 2)
      ctx.fill()
    } else if (craft === 'sand-glitter') {
      const hue = Math.floor(hash2D(i, 7) * 360)
      ctx.fillStyle = `hsla(${hue}, 90%, ${65 + brightness * 30}%, ${alpha * 0.9})`
      ctx.beginPath()
      ctx.arc(0, 0, baseSize, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // 细银闪
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, baseSize)
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
      grad.addColorStop(0.6, `rgba(220, 235, 255, ${alpha * 0.7})`)
      grad.addColorStop(1, 'rgba(180, 200, 225, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(0, 0, baseSize, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  glitterLayers.set(key, canvas)
  return canvas
}

