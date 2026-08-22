import type { FilmCraft } from '../../types.ts'

/**
 * 绘制光学覆膜层 (素面彩虹色散、碎玻璃晶格折射、十字星芒、爱心镭射、满天星、亮膜、哑膜)
 */
export function drawHoloFilm(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  craft: FilmCraft,
  tiltX = 0,
  tiltY = 0,
  phase: number | null = null,
) {
  if (craft === 'none') return

  ctx.save()

  if (craft === 'glossy') {
    // 高透亮膜双层反光带 (随 tilt 动态扫光)
    ctx.globalCompositeOperation = 'screen'
    const sweepAngle = (tiltX * 0.6 + (phase ?? 0) * 0.15) % (Math.PI * 2)
    const sweepX = width / 2 + Math.cos(sweepAngle) * (width * 0.45)
    const sweepY = height / 2 + Math.sin(sweepAngle) * (height * 0.45)

    const grad = ctx.createLinearGradient(
      sweepX - width * 0.4,
      sweepY - height * 0.4,
      sweepX + width * 0.4,
      sweepY + height * 0.4,
    )
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)')
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)')
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.36)')
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.08)')
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  } else if (craft === 'matte') {
    // 丝绒哑膜
    ctx.globalCompositeOperation = 'soft-light'
    ctx.fillStyle = 'rgba(240, 245, 250, 0.35)'
    ctx.fillRect(0, 0, width, height)
  } else if (craft === 'rainbow') {
    // 素面彩虹镭射 (双通道混合：Overlay 增强色彩饱和 + Screen 提亮高光)
    const angle = ((phase ?? Math.atan2(tiltY, tiltX)) + Math.PI / 4) % (Math.PI * 2)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const cx = width / 2
    const cy = height / 2
    const len = Math.max(width, height) * 1.2

    const grad = ctx.createLinearGradient(
      cx - cos * len,
      cy - sin * len,
      cx + cos * len,
      cy + sin * len,
    )
    const rainbowStops = [
      'rgba(255, 60, 60, 0.55)',
      'rgba(255, 170, 0, 0.55)',
      'rgba(240, 240, 40, 0.55)',
      'rgba(40, 230, 110, 0.55)',
      'rgba(0, 200, 255, 0.55)',
      'rgba(130, 80, 255, 0.55)',
      'rgba(255, 60, 210, 0.55)',
      'rgba(255, 60, 60, 0.55)',
    ]
    for (let s = 0; s < rainbowStops.length; s++) {
      grad.addColorStop(s / (rainbowStops.length - 1), rainbowStops[s])
    }

    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = 0.45
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)

    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = 0.28
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  } else if (craft === 'cracked-ice') {
    // 碎玻璃镭射晶格 (多面多晶折射，带高光晶刃)
    ctx.globalCompositeOperation = 'screen'
    const cellSize = 36
    const cols = Math.ceil(width / cellSize) + 1
    const rows = Math.ceil(height / cellSize) + 1
    const currentPhase = phase ?? (tiltX + tiltY) * 2

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellSize
        const y = r * cellSize
        const cellHash = Math.sin(c * 17.1 + r * 53.7) * 43758.5453
        const localPhase = (cellHash * 10 + currentPhase) % (Math.PI * 2)
        const intensity = Math.pow(Math.max(0, Math.sin(localPhase)), 2.2)
        if (intensity < 0.05) continue

        const hue = Math.floor(((cellHash * 360 + currentPhase * 60) % 360 + 360) % 360)
        ctx.fillStyle = `hsla(${hue}, 90%, 65%, ${intensity * 0.6})`

        ctx.beginPath()
        ctx.moveTo(x + cellSize * 0.1, y + cellSize * 0.2)
        ctx.lineTo(x + cellSize * 0.9, y + cellSize * 0.1)
        ctx.lineTo(x + cellSize * 0.8, y + cellSize * 0.9)
        ctx.lineTo(x + cellSize * 0.2, y + cellSize * 0.8)
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = `hsla(${hue}, 95%, 85%, ${intensity * 0.75})`
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  } else if (craft === 'cross') {
    // 十字星芒膜 (Cross Star Flare)
    ctx.globalCompositeOperation = 'screen'
    const step = 42
    const cols = Math.ceil(width / step) + 1
    const rows = Math.ceil(height / step) + 1
    const currentPhase = phase ?? (tiltX * 2 + tiltY * 2)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * step + ((r % 2) * step) / 2
        const cy = r * step
        const hash = Math.sin(c * 31.7 + r * 19.3) * 43758.5453
        const sparkle = Math.pow(Math.max(0, Math.sin(hash * 10 + currentPhase * 1.5)), 3.6)
        if (sparkle < 0.08) continue

        const size = (7 + sparkle * 18) * 0.8
        const hue = Math.floor(((hash * 360 + currentPhase * 40) % 360 + 360) % 360)
        ctx.strokeStyle = `hsla(${hue}, 90%, 82%, ${sparkle * 0.85})`
        ctx.lineWidth = 1.2

        ctx.beginPath()
        ctx.moveTo(cx - size, cy)
        ctx.lineTo(cx + size, cy)
        ctx.moveTo(cx, cy - size)
        ctx.lineTo(cx, cy + size)
        ctx.stroke()

        // 核心亮点
        ctx.fillStyle = `hsla(${hue}, 95%, 95%, ${sparkle * 0.9})`
        ctx.beginPath()
        ctx.arc(cx, cy, 1.8 + sparkle * 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  ctx.restore()
}
