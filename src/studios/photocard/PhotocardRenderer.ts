import { drawMappedArtwork, drawRoundRect } from '../../core/engine/canvas-utils.ts'
import { computeLighting } from '../../core/engine/lighting.ts'
import { getGlitterLayer } from '../../core/engine/shaders/glitter.ts'
import { drawHoloFilm } from '../../core/engine/shaders/holo.ts'
import { mmToPixels } from '../../core/geometry/dpi.ts'
import type { ViewMode } from '../../core/types.ts'
import type { PhotocardState } from './types.ts'

export const DISPLAY_SIZE = 900
export const PREVIEW_EXPORT_SIZE = 1080

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D rendering context is not available.')
  }
  return context
}

export function drawNeutralStudioBackground(
  context: CanvasRenderingContext2D,
  size: number,
) {
  context.fillStyle = '#ebedf0'
  context.fillRect(0, 0, size, size)

  context.strokeStyle = 'rgba(23, 24, 28, 0.04)'
  context.lineWidth = 1
  const step = size / 18
  context.beginPath()
  for (let p = 0; p <= size; p += step) {
    context.moveTo(p, 0)
    context.lineTo(p, size)
    context.moveTo(0, p)
    context.lineTo(size, p)
  }
  context.stroke()
}

/**
 * 绘制精美默认卡背设计 (当用户未上传背面时呈现)
 */
function drawDefaultCardBack(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  isDark = false,
) {
  context.save()
  context.translate(x, y)

  // 1. 底色
  context.fillStyle = isDark ? '#141518' : '#f0f3f6'
  context.fillRect(0, 0, width, height)

  // 2. 斜向几何条纹
  context.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(23, 24, 28, 0.04)'
  context.lineWidth = 2
  const step = 24
  context.beginPath()
  for (let d = -height; d < width + height; d += step) {
    context.moveTo(d, 0)
    context.lineTo(d + height, height)
  }
  context.stroke()

  // 3. 内边框饰线
  const pad = width * 0.08
  context.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(23, 24, 28, 0.12)'
  context.lineWidth = 1.5
  context.strokeRect(pad, pad, width - pad * 2, height - pad * 2)

  // 4. 卡背中心印标
  const cx = width / 2
  const cy = height / 2

  context.textAlign = 'center'
  context.textBaseline = 'middle'

  context.fillStyle = isDark ? '#f4d35e' : '#e056fd'
  context.font = `900 ${Math.round(width * 0.12)}px system-ui, -apple-system, sans-serif`
  context.fillText('GZ', cx, cy - height * 0.06)

  context.fillStyle = isDark ? '#ffffff' : '#23252a'
  context.font = `800 ${Math.max(10, Math.round(width * 0.045))}px system-ui, -apple-system, sans-serif`
  context.fillText('COLLECTION CARD', cx, cy + height * 0.05)

  context.fillStyle = isDark ? '#7a808c' : '#88919d'
  context.font = `600 ${Math.max(8, Math.round(width * 0.03))}px monospace`
  context.fillText('★ LIMITED EDITION ★', cx, cy + height * 0.11)

  context.restore()
}

/**
 * 绘制单面拍立得/小卡实体
 */
export function drawCardSurface(
  context: CanvasRenderingContext2D,
  state: PhotocardState,
  centerX: number,
  centerY: number,
  cardWidth: number,
  cardHeight: number,
  tiltX = 0,
  tiltY = 0,
  phase: number | null = null,
  includeCrafts = true,
) {
  const { preset, frameType, cornerRadiusMm, activeSide, baseCraft, filmCraft, signature } =
    state
  const artwork = activeSide === 'front' ? state.frontArtwork : state.backArtwork
  const transform =
    activeSide === 'front' ? state.frontTransform : state.backTransform

  const radiusPx = (cornerRadiusMm / preset.widthMm) * cardWidth
  const light = computeLighting(tiltX, tiltY)
  const isDarkFrame = frameType === 'polaroid-black'

  context.save()

  // 1. 卡片外轮廓裁切
  drawRoundRect(
    context,
    centerX - cardWidth / 2,
    centerY - cardHeight / 2,
    cardWidth,
    cardHeight,
    radiusPx,
  )
  context.clip()

  // 2. 卡纸基底 (300g 相纸、珠光卡纸、银卡)
  if (isDarkFrame) {
    context.fillStyle = '#18191c'
  } else if (includeCrafts && baseCraft === 'pearl') {
    const pearlGrad = context.createLinearGradient(
      centerX - cardWidth / 2,
      centerY - cardHeight / 2,
      centerX + cardWidth / 2,
      centerY + cardHeight / 2,
    )
    pearlGrad.addColorStop(0, '#fcf9fb')
    pearlGrad.addColorStop(0.5, '#f5fafb')
    pearlGrad.addColorStop(1, '#f9f6f7')
    context.fillStyle = pearlGrad
  } else {
    context.fillStyle = '#fafbfc'
  }
  context.fillRect(
    centerX - cardWidth / 2,
    centerY - cardHeight / 2,
    cardWidth,
    cardHeight,
  )

  // 3. 画心窗口与画稿绘制
  const isFullBleed = frameType === 'full-bleed' || activeSide === 'back'

  let winX = centerX - cardWidth / 2
  let winY = centerY - cardHeight / 2
  let winW = cardWidth
  let winH = cardHeight

  if (!isFullBleed) {
    const scaleX = cardWidth / preset.widthMm
    const scaleY = cardHeight / preset.heightMm
    winW = preset.windowWidthMm * scaleX
    winH = preset.windowHeightMm * scaleY
    winX = centerX - winW / 2
    winY = centerY - cardHeight / 2 + preset.windowTopOffsetMm * scaleY

    // 绘制相框内窗口凹陷底色
    context.save()
    context.fillStyle = isDarkFrame ? '#101114' : '#1a1c20'
    context.fillRect(winX, winY, winW, winH)
    context.restore()
  }

  // 在窗口内绘制画稿或默认卡背
  context.save()
  context.beginPath()
  context.rect(winX, winY, winW, winH)
  context.clip()

  if (artwork && artwork.width && artwork.height) {
    drawMappedArtwork(
      context,
      artwork,
      transform,
      winX + winW / 2,
      winY + winH / 2,
      winW,
      winH,
    )
  } else if (activeSide === 'back') {
    drawDefaultCardBack(context, winX, winY, winW, winH, isDarkFrame)
  } else {
    drawMappedArtwork(
      context,
      null,
      transform,
      winX + winW / 2,
      winY + winH / 2,
      winW,
      winH,
    )
  }

  // 4. 闪底层 (仅在预览且开启工艺时叠加)
  if (includeCrafts && baseCraft !== 'none') {
    const glitterCanvas = getGlitterLayer(Math.round(winW), Math.round(winH), baseCraft)
    context.save()
    if (baseCraft === 'pearl') {
      context.globalCompositeOperation = 'overlay'
      context.globalAlpha = 0.65
    } else if (baseCraft === 'brushed-silver') {
      context.globalCompositeOperation = 'overlay'
      context.globalAlpha = 0.8
    } else {
      context.globalCompositeOperation = 'screen'
      context.globalAlpha = baseCraft === 'sand-glitter' ? 0.9 : 0.95
    }
    context.drawImage(glitterCanvas, winX, winY)
    context.restore()
  }

  // 5. 覆膜层 (仅在预览且开启覆膜时叠加)
  if (includeCrafts && filmCraft !== 'none') {
    context.save()
    context.translate(winX, winY)
    drawHoloFilm(context, winW, winH, filmCraft, tiltX, tiltY, phase)
    context.restore()
  }

  // 窗口内阴影（真实相纸开口深度）
  if (!isFullBleed) {
    context.strokeStyle = 'rgba(0, 0, 0, 0.16)'
    context.lineWidth = 1.5
    context.strokeRect(winX, winY, winW, winH)
  }

  context.restore()

  // 6. 胶片齿孔效果 (vintage-film)
  if (frameType === 'vintage-film' && !isFullBleed) {
    context.save()
    context.fillStyle = '#000000'
    const holeW = cardWidth * 0.04
    const holeH = cardHeight * 0.03
    const numHoles = 6
    for (let i = 0; i < numHoles; i++) {
      const hy = winY + (winH / (numHoles + 1)) * (i + 1) - holeH / 2
      context.fillRect(winX - holeW * 1.5, hy, holeW, holeH)
      context.fillRect(winX + winW + holeW * 0.5, hy, holeW, holeH)
    }
    context.restore()
  }

  // 7. 底部手写签名/文字印签 (精确按比例计算，杜绝重叠)
  if (!isFullBleed && activeSide === 'front' && (signature.text || signature.showDate)) {
    context.save()
    const bottomAreaY = winY + winH
    const bottomAreaH = centerY + cardHeight / 2 - bottomAreaY

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = signature.color || (isDarkFrame ? '#ffffff' : '#2b2d33')

    const hasText = Boolean(signature.text)
    const hasDate = Boolean(signature.showDate)

    const fontName =
      signature.font === 'handwritten'
        ? '"Caveat", "Brush Script MT", "Segoe Script", cursive, sans-serif'
        : 'system-ui, -apple-system, sans-serif'

    if (hasText && hasDate) {
      const textFontSize = Math.max(
        11,
        Math.min(Math.round(cardWidth * 0.05), Math.round(bottomAreaH * 0.32)),
      )
      const dateFontSize = Math.max(
        9,
        Math.min(Math.round(cardWidth * 0.032), Math.round(bottomAreaH * 0.22)),
      )

      context.font = `bold ${textFontSize}px ${fontName}`
      context.fillText(signature.text, centerX, bottomAreaY + bottomAreaH * 0.36)

      const dateStr =
        signature.dateText ||
        new Date().toISOString().slice(0, 10).replace(/-/g, '.')
      context.font = `${dateFontSize}px monospace`
      context.fillStyle = isDarkFrame ? '#888d96' : '#8c939d'
      context.fillText(dateStr, centerX, bottomAreaY + bottomAreaH * 0.74)
    } else if (hasText) {
      const textFontSize = Math.max(
        12,
        Math.min(Math.round(cardWidth * 0.058), Math.round(bottomAreaH * 0.46)),
      )
      context.font = `bold ${textFontSize}px ${fontName}`
      context.fillText(signature.text, centerX, bottomAreaY + bottomAreaH * 0.5)
    } else if (hasDate) {
      const dateFontSize = Math.max(
        10,
        Math.min(Math.round(cardWidth * 0.038), Math.round(bottomAreaH * 0.32)),
      )
      const dateStr =
        signature.dateText ||
        new Date().toISOString().slice(0, 10).replace(/-/g, '.')
      context.font = `${dateFontSize}px monospace`
      context.fillStyle = isDarkFrame ? '#888d96' : '#8c939d'
      context.fillText(dateStr, centerX, bottomAreaY + bottomAreaH * 0.5)
    }

    context.restore()
  }

  // 8. 300g 相纸表面真实光泽扫光 (仅在预览模式下绘制)
  if (includeCrafts) {
    context.save()
    context.globalCompositeOperation = 'screen'
    const sweepAngle = (tiltX * 0.8 + (phase ?? 0) * 0.2) % (Math.PI * 2)
    const sweepCx = centerX + Math.cos(sweepAngle) * (cardWidth * 0.5)
    const sweepCy = centerY + Math.sin(sweepAngle) * (cardHeight * 0.5)
    const lightGrad = context.createLinearGradient(
      sweepCx - cardWidth * 0.45,
      sweepCy - cardHeight * 0.45,
      sweepCx + cardWidth * 0.45,
      sweepCy + cardHeight * 0.45,
    )
    lightGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
    lightGrad.addColorStop(0.42, 'rgba(255, 255, 255, 0.04)')
    lightGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.28 * light.specularBoost})`)
    lightGrad.addColorStop(0.58, 'rgba(255, 255, 255, 0.04)')
    lightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = lightGrad
    context.fillRect(
      centerX - cardWidth / 2,
      centerY - cardHeight / 2,
      cardWidth,
      cardHeight,
    )
    context.restore()
  }

  // 9. 卡片 300g 硬质纸张外轮廓微高光与边缘
  context.save()
  context.strokeStyle =
    isDarkFrame ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.09)'
  context.lineWidth = 1.2
  drawRoundRect(
    context,
    centerX - cardWidth / 2,
    centerY - cardHeight / 2,
    cardWidth,
    cardHeight,
    radiusPx,
  )
  context.stroke()
  context.restore()

  context.restore()
}

/**
 * 绘制拍立得/小卡完整 3D 浮动与动态光照预览场景
 */
export function drawPhotocardPreview(
  context: CanvasRenderingContext2D,
  viewSize: number,
  state: PhotocardState,
  tiltX = 0,
  tiltY = 0,
  phase: number | null = null,
  flipAngle?: number,
) {
  const { preset, cornerRadiusMm } = state
  const originX = viewSize / 2
  const originY = viewSize / 2

  const maxDimension = Math.max(preset.widthMm, preset.heightMm)
  const scale = (viewSize * 0.72) / maxDimension
  const cardW = Math.round(preset.widthMm * scale)
  const cardH = Math.round(preset.heightMm * scale)
  const radiusPx = (cornerRadiusMm / preset.widthMm) * cardW
  const light = computeLighting(tiltX, tiltY)

  drawNeutralStudioBackground(context, viewSize)

  const isFlipping = flipAngle !== undefined
  const angle = isFlipping ? flipAngle : (state.activeSide === 'front' ? 0 : Math.PI)
  const isFront = Math.cos(angle) >= 0
  const absCos = Math.abs(Math.cos(angle))

  // 1. 卡片 3D 纯净居中翻转透视矩阵 (翻转时消除左右晃动)
  const floatX = isFlipping ? 0 : tiltX * 18
  const floatY = isFlipping ? 0 : tiltY * 14
  const rotZ = isFlipping ? 0 : tiltX * 0.038
  const perspectiveScaleX = Math.max(0.015, absCos) * (isFlipping ? 1 : (1 - Math.abs(tiltY) * 0.035))
  const perspectiveScaleY = isFlipping ? 1 : (1 - Math.abs(tiltX) * 0.035)

  const centerX = originX + floatX
  const centerY = originY + floatY

  // 2. 真实 3D 悬浮投影 (居中随翻转对称压缩)
  context.save()
  const shadowOffsetX = light.shadowOffsetX * 0.8 * absCos
  const shadowOffsetY = 18 + (1 - absCos) * 10
  const shadowBlur = 24 + (1 - absCos) * 14

  context.translate(originX, originY)
  context.scale(perspectiveScaleX, perspectiveScaleY)
  context.translate(-originX, -originY)

  context.shadowColor = 'rgba(18, 22, 32, 0.22)'
  context.shadowBlur = shadowBlur
  context.shadowOffsetX = shadowOffsetX
  context.shadowOffsetY = shadowOffsetY
  drawRoundRect(
    context,
    originX - cardW / 2,
    originY - cardH / 2,
    cardW,
    cardH,
    radiusPx,
  )
  context.fillStyle = 'rgba(18, 22, 32, 0.05)'
  context.fill()
  context.restore()

  // 3. 绘制带有 3D 翻转的卡片本体
  context.save()
  context.translate(centerX, centerY)
  if (rotZ !== 0) context.rotate(rotZ)
  context.scale(perspectiveScaleX, perspectiveScaleY)
  context.translate(-centerX, -centerY)

  // 当处于极窄侧边切面时，绘制卡纸切面厚度
  if (absCos < 0.04) {
    context.save()
    context.fillStyle = '#f8f9fa'
    context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    context.lineWidth = 1
    context.fillRect(centerX - 1.5, centerY - cardH / 2, 3, cardH)
    context.strokeRect(centerX - 1.5, centerY - cardH / 2, 3, cardH)
    context.restore()
  } else {
    // 渲染正面或背面
    const renderState: PhotocardState = {
      ...state,
      activeSide: isFront ? 'front' : 'back',
    }
    drawCardSurface(context, renderState, centerX, centerY, cardW, cardH, tiltX, tiltY, phase, true)
  }

  context.restore()
}

/**
 * 绘制拍立得/小卡出血线与安全区排版参考视图 (纯净原图显示，无工艺/覆膜干扰)
 */
export function drawPhotocardPrintGuide(
  context: CanvasRenderingContext2D,
  viewSize: number,
  state: PhotocardState,
) {
  const { preset, cornerRadiusMm } = state
  const centerX = viewSize / 2
  const centerY = viewSize / 2

  const totalWMm = preset.widthMm + preset.bleedMm * 2
  const totalHMm = preset.heightMm + preset.bleedMm * 2
  const maxDim = Math.max(totalWMm, totalHMm)
  const scale = (viewSize * 0.76) / maxDim

  const bleedW = Math.round(totalWMm * scale)
  const bleedH = Math.round(totalHMm * scale)
  const trimW = Math.round(preset.widthMm * scale)
  const trimH = Math.round(preset.heightMm * scale)
  const safeW = Math.round((preset.widthMm - 4) * scale)
  const safeH = Math.round((preset.heightMm - 4) * scale)
  const radiusPx = (cornerRadiusMm / preset.widthMm) * trimW

  context.fillStyle = '#f3f4f6'
  context.fillRect(0, 0, viewSize, viewSize)

  const isFullBleed = state.frameType === 'full-bleed' || state.activeSide === 'back'

  // 1. 绘制纯净原图画稿 (无工艺与覆膜干扰)
  context.save()
  drawRoundRect(
    context,
    centerX - bleedW / 2,
    centerY - bleedH / 2,
    bleedW,
    bleedH,
    radiusPx,
  )
  context.clip()

  // 纯画稿渲染，includeCrafts 为 false
  if (isFullBleed) {
    drawCardSurface(context, state, centerX, centerY, bleedW, bleedH, 0, 0, null, false)
  } else {
    drawCardSurface(context, state, centerX, centerY, trimW, trimH, 0, 0, null, false)
  }

  // 2. 出血区黄色包边高亮遮罩 (与吧唧包边预览保持一致视觉规范)
  context.save()
  context.fillStyle = 'rgba(244, 211, 94, 0.25)'
  context.fillRect(centerX - bleedW / 2, centerY - bleedH / 2, bleedW, bleedH)
  context.globalCompositeOperation = 'destination-out'
  drawRoundRect(
    context,
    centerX - trimW / 2,
    centerY - trimH / 2,
    trimW,
    trimH,
    radiusPx,
  )
  context.fill()
  context.restore()

  context.restore()

  // 3. 绘制工业标准参考线
  context.save()

  // 红色实线：完整印刷出血外框 (Bleed Cut Line)
  context.strokeStyle = '#eb5757'
  context.lineWidth = 1.5
  context.setLineDash([])
  context.strokeRect(centerX - bleedW / 2, centerY - bleedH / 2, bleedW, bleedH)

  // 黑色/深色虚线：成品裁切线 (Finished Trim Line)
  context.strokeStyle = '#17181c'
  context.lineWidth = 1.5
  context.setLineDash([viewSize * 0.016, viewSize * 0.01])
  drawRoundRect(
    context,
    centerX - trimW / 2,
    centerY - trimH / 2,
    trimW,
    trimH,
    radiusPx,
  )
  context.stroke()

  // 青色/绿色点虚线：建议安全区 (Safe Margin Line)
  context.strokeStyle = '#20a9a5'
  context.lineWidth = 1.5
  context.setLineDash([viewSize * 0.004, viewSize * 0.01])
  drawRoundRect(
    context,
    centerX - safeW / 2,
    centerY - safeH / 2,
    safeW,
    safeH,
    Math.max(0, radiusPx - 2),
  )
  context.stroke()

  context.restore()
}

export function renderPhotocardWorkspace(
  canvas: HTMLCanvasElement,
  state: PhotocardState,
  view: ViewMode,
  tiltX = 0,
  tiltY = 0,
  phase: number | null = null,
  flipAngle?: number,
) {
  if (canvas.width !== DISPLAY_SIZE || canvas.height !== DISPLAY_SIZE) {
    canvas.width = DISPLAY_SIZE
    canvas.height = DISPLAY_SIZE
  }

  const context = getContext(canvas)
  context.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE)
  if (view === 'preview') {
    drawPhotocardPreview(context, DISPLAY_SIZE, state, tiltX, tiltY, phase, flipAngle)
  } else {
    drawPhotocardPrintGuide(context, DISPLAY_SIZE, state)
  }
}

export function createPhotocardPreviewExport(state: PhotocardState): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PREVIEW_EXPORT_SIZE
  canvas.height = PREVIEW_EXPORT_SIZE
  drawPhotocardPreview(getContext(canvas), PREVIEW_EXPORT_SIZE, state, 0.15, 0.1, 0.8)
  return canvas
}

/**
 * 导出 300 DPI 印刷制作原图 (包含 1.5mm 出血位)
 */
export function createPhotocardPrintExport(
  state: PhotocardState,
  side: 'front' | 'back' = 'front',
): HTMLCanvasElement {
  const { preset } = state
  const totalWMm = preset.widthMm + preset.bleedMm * 2
  const totalHMm = preset.heightMm + preset.bleedMm * 2

  const pixelW = mmToPixels(totalWMm)
  const pixelH = mmToPixels(totalHMm)

  const canvas = document.createElement('canvas')
  canvas.width = pixelW
  canvas.height = pixelH
  const context = getContext(canvas)

  context.clearRect(0, 0, pixelW, pixelH)

  const targetState: PhotocardState = {
    ...state,
    activeSide: side,
  }

  const isFullBleed = targetState.frameType === 'full-bleed' || side === 'back'
  const targetW = isFullBleed ? pixelW : mmToPixels(preset.widthMm)
  const targetH = isFullBleed ? pixelH : mmToPixels(preset.heightMm)

  drawCardSurface(context, targetState, pixelW / 2, pixelH / 2, targetW, targetH, 0, 0, null, false)

  return canvas
}
