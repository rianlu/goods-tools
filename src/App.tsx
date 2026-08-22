import { ImagePlus, RefreshCw } from 'lucide-react'
import {
  type DragEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ExportModal } from './core/components/ExportModal.tsx'
import { StageToolbar } from './core/components/StageToolbar.tsx'
import { Topbar } from './core/components/Topbar.tsx'
import {
  createDemoArtwork,
  downloadCanvas,
  loadArtwork,
  validateArtworkFile,
} from './core/engine/canvas-utils.ts'
import {
  computeBadgeOrbit,
  computePhotocardFlip,
} from './core/engine/lighting.ts'
import { clamp, mmToPixels } from './core/geometry/dpi.ts'
import {
  DEFAULT_TRANSFORM,
  constrainTransform,
} from './core/geometry/transform.ts'
import type { Artwork, ExportSpec, StudioId, Transform, ViewMode } from './core/types.ts'
import { BadgeInspector } from './studios/badge/BadgeInspector.tsx'
import {
  createBadgePreviewExport,
  createBadgePrintExport,
  renderBadgeWorkspace,
} from './studios/badge/BadgeRenderer.ts'
import { BADGE_PRESETS, SHAPE_OPTIONS } from './studios/badge/presets.ts'
import type { BadgeState } from './studios/badge/types.ts'
import { PhotocardInspector } from './studios/photocard/PhotocardInspector.tsx'
import {
  createPhotocardPreviewExport,
  createPhotocardPrintExport,
  renderPhotocardWorkspace,
} from './studios/photocard/PhotocardRenderer.ts'
import { PHOTOCARD_PRESETS } from './studios/photocard/presets.ts'
import type { PhotocardState } from './studios/photocard/types.ts'

export function App() {
  const [activeStudio, setActiveStudio] = useState<StudioId>('badge')
  const [view, setView] = useState<ViewMode>('preview')
  const [animate, setAnimate] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [viewportZoom, setViewportZoom] = useState(1.0)
  const [draggingFile, setDraggingFile] = useState(false)
  const [message, setMessage] = useState('谷子效果模拟与打样工具箱已就绪。')
  const [isError, setIsError] = useState(false)
  const [exportSpec, setExportSpec] = useState<ExportSpec | null>(null)

  const demoArtwork = useMemo(() => createDemoArtwork(), [])

  // 1. 马口铁吧唧工作室状态
  const [badgeState, setBadgeState] = useState<BadgeState>({
    artwork: demoArtwork,
    transform: DEFAULT_TRANSFORM,
    baseCraft: 'fine-silver',
    filmCraft: 'cracked-ice',
    shape: 'round',
    finishedDiameterMm: BADGE_PRESETS[3].finishedDiameterMm,
    printDiameterMm: BADGE_PRESETS[3].printDiameterMm,
    safeDiameterMm: BADGE_PRESETS[3].safeDiameterMm,
  })

  // 2. 拍立得/小卡工作室状态
  const [photocardState, setPhotocardState] = useState<PhotocardState>({
    preset: PHOTOCARD_PRESETS[0],
    frameType: 'polaroid-white',
    cornerRadiusMm: 2,
    activeSide: 'front',
    frontArtwork: demoArtwork,
    frontTransform: DEFAULT_TRANSFORM,
    backArtwork: null,
    backTransform: DEFAULT_TRANSFORM,
    baseCraft: 'none',
    filmCraft: 'glossy',
    signature: {
      text: 'Goods-Tools',
      color: '#1a1b1e',
      font: 'sans-serif',
      showDate: true,
    },
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isPointerDownRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const transformStartRef = useRef<Transform>(DEFAULT_TRANSFORM)

  // 检查系统减少动态效果
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  // 动画渲染循环：吧唧为 ♾️ 8字形轨迹，拍立得/小卡为 3D 翻转动效
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let animationFrame = 0
    const shouldAnimate = animate && !reducedMotion

    const draw = (time: number) => {
      if (shouldAnimate) {
        if (activeStudio === 'badge') {
          // 🧷 吧唧：♾️ 8字形拟真手持把玩动效
          const { tiltX, tiltY, phase } = computeBadgeOrbit(time, 0.0016)
          renderBadgeWorkspace(canvas, badgeState, view, tiltX, tiltY, phase)
        } else {
          // 📸 拍立得/小卡：3D 空间连续翻转动效 (展示正反两面)
          const { flipAngle, tiltX, tiltY, phase } = computePhotocardFlip(time, 0.0012)
          renderPhotocardWorkspace(canvas, photocardState, view, tiltX, tiltY, phase, flipAngle)
        }
        animationFrame = requestAnimationFrame(draw)
      } else {
        // 静置视角
        if (activeStudio === 'badge') {
          renderBadgeWorkspace(canvas, badgeState, view, 0.15, 0.1, 0.8)
        } else {
          renderPhotocardWorkspace(canvas, photocardState, view, 0.15, 0.1, 0.8)
        }
      }
    }

    if (shouldAnimate) {
      animationFrame = requestAnimationFrame(draw)
    } else {
      draw(performance.now())
    }

    return () => cancelAnimationFrame(animationFrame)
  }, [activeStudio, badgeState, photocardState, view, animate, reducedMotion])

  // 通用画稿上传
  async function handleUploadFile(file: File) {
    const validationError = validateArtworkFile(file)
    if (validationError) {
      setMessage(validationError)
      setIsError(true)
      return
    }

    setMessage('正在载入图片...')
    setIsError(false)

    try {
      const loaded = await loadArtwork(file)
      if (activeStudio === 'badge') {
        setBadgeState((curr) => ({
          ...curr,
          artwork: loaded,
          transform: constrainTransform(DEFAULT_TRANSFORM, loaded),
        }))
        setMessage(`已载入画稿「${file.name}」`)
      } else {
        setPhotocardState((curr) => {
          if (curr.activeSide === 'front') {
            return {
              ...curr,
              frontArtwork: loaded,
              frontTransform: constrainTransform(DEFAULT_TRANSFORM, loaded),
            }
          }
          return {
            ...curr,
            backArtwork: loaded,
            backTransform: constrainTransform(DEFAULT_TRANSFORM, loaded),
          }
        })
        setMessage(
          `已载入${photocardState.activeSide === 'front' ? '正面' : '背面'}「${file.name}」`,
        )
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '载入图片失败')
      setIsError(true)
    }
  }

  // 视口平移排版指针交互 (仅在按下拖动画稿时生效，鼠标悬停不干扰动画)
  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (isLocked || event.button !== 0) return
    isPointerDownRef.current = true
    pointerStartRef.current = { x: event.clientX, y: event.clientY }

    if (activeStudio === 'badge') {
      transformStartRef.current = badgeState.transform
    } else {
      transformStartRef.current =
        photocardState.activeSide === 'front'
          ? photocardState.frontTransform
          : photocardState.backTransform
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!isPointerDownRef.current || isLocked) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()

    const dx = (event.clientX - pointerStartRef.current.x) / (rect.width * viewportZoom)
    const dy = (event.clientY - pointerStartRef.current.y) / (rect.height * viewportZoom)

    const nextTransform = {
      ...transformStartRef.current,
      offsetX: transformStartRef.current.offsetX + dx,
      offsetY: transformStartRef.current.offsetY + dy,
    }

    if (activeStudio === 'badge') {
      setBadgeState((curr) => ({
        ...curr,
        transform: constrainTransform(nextTransform, curr.artwork),
      }))
    } else {
      setPhotocardState((curr) => {
        const isFront = curr.activeSide === 'front'
        const artwork = isFront ? curr.frontArtwork : curr.backArtwork
        const isFullBleed = curr.frameType === 'full-bleed' || !isFront
        const aspect = isFullBleed
          ? curr.preset.widthMm / curr.preset.heightMm
          : curr.preset.windowWidthMm / curr.preset.windowHeightMm

        if (isFront) {
          return {
            ...curr,
            frontTransform: constrainTransform(nextTransform, artwork, aspect),
          }
        }
        return {
          ...curr,
          backTransform: constrainTransform(nextTransform, artwork, aspect),
        }
      })
    }
  }

  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
  }

  // 拖拽上传
  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setDraggingFile(true)
  }

  function handleDragLeave() {
    setDraggingFile(false)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDraggingFile(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUploadFile(file)
  }

  // 导出触发
  function exportPreviewImage() {
    if (activeStudio === 'badge') {
      const exportCanvas = createBadgePreviewExport(badgeState)
      const filename = `吧唧效果图-${badgeState.finishedDiameterMm}mm-${Date.now()}.png`
      downloadCanvas(exportCanvas, filename)
      setMessage(`已导出 1080px 吧唧效果图「${filename}」`)
    } else {
      const exportCanvas = createPhotocardPreviewExport(photocardState)
      const filename = `小卡效果图-${photocardState.preset.label}-${Date.now()}.png`
      downloadCanvas(exportCanvas, filename)
      setMessage(`已导出 1080px 小卡效果图「${filename}」`)
    }
  }

  function requestBadgePrintExport() {
    const printPixels = mmToPixels(badgeState.printDiameterMm)
    const shapeLabel =
      SHAPE_OPTIONS.find((s) => s.id === badgeState.shape)?.label || '圆形'
    const wrapMarginMm =
      (badgeState.printDiameterMm - badgeState.finishedDiameterMm) / 2

    setExportSpec({
      title: '确认导出制作原图',
      description:
        '原图将以 300 DPI 无损印刷标准导出完整画稿。外圈包边区将用于金属卷边包裹，不会出现在成品正面。',
      specRows: [
        {
          name: '吧唧规格',
          value: `${badgeState.finishedDiameterMm}mm ${shapeLabel}`,
        },
        {
          name: '导出原图尺寸',
          value: `${printPixels} × ${printPixels} px (${badgeState.printDiameterMm}mm)`,
          highlight: true,
        },
        {
          name: '成品正面可见',
          value: `${badgeState.finishedDiameterMm}mm`,
        },
        {
          name: '每侧包边预留',
          value: `${wrapMarginMm.toFixed(1)}mm`,
        },
        {
          name: '印刷分辨率',
          value: '300 DPI (CMYK标准)',
        },
      ],
      exportPixelSize: { width: printPixels, height: printPixels },
      confirmButtonText: `确认导出原图 (${printPixels}px)`,
    })
  }

  function requestPhotocardPrintExport(side: 'front' | 'back') {
    const { preset } = photocardState
    const totalWMm = preset.widthMm + preset.bleedMm * 2
    const totalHMm = preset.heightMm + preset.bleedMm * 2
    const pixelW = mmToPixels(totalWMm)
    const pixelH = mmToPixels(totalHMm)

    setExportSpec({
      title: `确认导出小卡${side === 'front' ? '正面' : '背面'}制作图`,
      description: `原图将以 300 DPI 印刷标准导出，已包含四边各 ${preset.bleedMm}mm 工业印刷出血位。`,
      specRows: [
        {
          name: '小卡规格',
          value: `${preset.label}`,
        },
        {
          name: '导出尺寸 (含出血)',
          value: `${pixelW} × ${pixelH} px (${totalWMm}×${totalHMm}mm)`,
          highlight: true,
        },
        {
          name: '成品裁切尺寸',
          value: `${preset.widthMm} × ${preset.heightMm} mm`,
        },
        {
          name: '印刷出血位',
          value: `四周各 ${preset.bleedMm}mm`,
        },
        {
          name: '印刷分辨率',
          value: '300 DPI (CMYK标准)',
        },
      ],
      exportPixelSize: { width: pixelW, height: pixelH },
      confirmButtonText: `确认导出原图 (${pixelW}×${pixelH}px)`,
    })
  }

  function handleConfirmExport() {
    if (activeStudio === 'badge') {
      const exportCanvas = createBadgePrintExport(badgeState)
      const filename = `吧唧制作原图-${badgeState.finishedDiameterMm}mm-${badgeState.printDiameterMm}mm-300DPI.png`
      downloadCanvas(exportCanvas, filename, 300)
      setMessage(`已导出 300 DPI 制作原图「${filename}」`)
    } else {
      const side = photocardState.activeSide
      const exportCanvas = createPhotocardPrintExport(photocardState, side)
      const filename = `小卡制作原图-${photocardState.preset.id}-${side}-300DPI.png`
      downloadCanvas(exportCanvas, filename, 300)
      setMessage(`已导出 300 DPI 小卡制作原图「${filename}」`)
    }
    setExportSpec(null)
  }

  const viewOptions: Array<{ id: ViewMode; label: string }> = [
    { id: 'preview', label: '成品效果' },
    { id: 'print', label: activeStudio === 'badge' ? '包边预览' : '出血预览' },
  ]

  return (
    <div className="app-shell">
      {/* 1. 顶栏与品类导航 */}
      <Topbar
        activeStudio={activeStudio}
        onSelectStudio={(id) => {
          setActiveStudio(id)
          setView('preview')
          setMessage(`已切换至「${id === 'badge' ? '马口铁吧唧' : '拍立得 / 小卡'}」打样台`)
        }}
      />

      <main className="workspace">
        {/* 2. 舞台工作区 */}
        <section className="stage">
          <StageToolbar
            view={view}
            onViewChange={setView}
            viewOptions={viewOptions}
            viewportZoom={viewportZoom}
            onZoomIn={() => setViewportZoom((z) => clamp(+(z + 0.25).toFixed(2), 0.5, 2.5))}
            onZoomOut={() => setViewportZoom((z) => clamp(+(z - 0.25).toFixed(2), 0.5, 2.5))}
            onZoomReset={() => setViewportZoom(1.0)}
            onZoomFit={() => setViewportZoom(1.0)}
            isLocked={isLocked}
            onToggleLock={() => {
              setIsLocked((l) => !l)
              setMessage(!isLocked ? '构图已锁定 🔒，已禁用拖动。' : '构图已解锁 🔓，可自由平移调整。')
            }}
            isAnimating={animate}
            onToggleAnimate={() => setAnimate((a) => !a)}
            extraActions={
              activeStudio === 'photocard' && (
                <button
                  type="button"
                  className="flip-card-btn"
                  onClick={() =>
                    setPhotocardState((curr) => ({
                      ...curr,
                      activeSide: curr.activeSide === 'front' ? 'back' : 'front',
                    }))
                  }
                  title="翻转卡片正反面"
                >
                  <RefreshCw size={14} />
                  <span>翻转 ({photocardState.activeSide === 'front' ? '正面' : '背面'})</span>
                </button>
              )
            }
          />

          <div
            className="canvas-frame"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div
              style={{
                transform: `scale(${viewportZoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
                display: 'grid',
                placeItems: 'center',
                width: '100%',
              }}
            >
              <canvas
                ref={canvasRef}
                tabIndex={0}
                style={{
                  cursor: isLocked ? 'default' : 'grab',
                }}
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={pointerUp}
              />
            </div>

            {draggingFile && (
              <div className="drop-overlay">
                <ImagePlus size={32} aria-hidden="true" />
                松开以载入图片
              </div>
            )}
          </div>

          <div className="stage-footer">
            <span>
              {activeStudio === 'badge'
                ? `${badgeState.finishedDiameterMm}mm ${badgeState.shape === 'round' ? '圆形' : '方形'}吧唧成品`
                : `${photocardState.preset.label} · ${photocardState.activeSide === 'front' ? '正面' : '背面'}`}
            </span>
            <span className="artwork-name-tag">
              {activeStudio === 'badge'
                ? badgeState.artwork?.name || '默认样稿'
                : (photocardState.activeSide === 'front'
                    ? photocardState.frontArtwork?.name
                    : photocardState.backArtwork?.name) || '未上传图片'}
            </span>
          </div>
        </section>

        {/* 3. 专属右侧控制面板 */}
        {activeStudio === 'badge' ? (
          <BadgeInspector
            state={badgeState}
            onChangeState={setBadgeState}
            onUploadFile={handleUploadFile}
            onResetArtwork={() =>
              setBadgeState((curr) => ({
                ...curr,
                artwork: demoArtwork,
                transform: DEFAULT_TRANSFORM,
              }))
            }
            onResetTransform={() =>
              setBadgeState((curr) => ({
                ...curr,
                transform: DEFAULT_TRANSFORM,
              }))
            }
            fileInputRef={fileInputRef}
            onExportPreview={exportPreviewImage}
            onRequestExportPrint={requestBadgePrintExport}
            isLocked={isLocked}
          />
        ) : (
          <PhotocardInspector
            state={photocardState}
            onChangeState={setPhotocardState}
            onUploadFile={handleUploadFile}
            onResetArtwork={() =>
              setPhotocardState((curr) => ({
                ...curr,
                frontArtwork: demoArtwork,
                frontTransform: DEFAULT_TRANSFORM,
                backArtwork: null,
                backTransform: DEFAULT_TRANSFORM,
              }))
            }
            onResetTransform={() =>
              setPhotocardState((curr) => {
                if (curr.activeSide === 'front') {
                  return { ...curr, frontTransform: DEFAULT_TRANSFORM }
                }
                return { ...curr, backTransform: DEFAULT_TRANSFORM }
              })
            }
            fileInputRef={fileInputRef}
            onExportPreview={exportPreviewImage}
            onRequestExportPrint={requestPhotocardPrintExport}
            isLocked={isLocked}
          />
        )}
      </main>

      {/* 4. 300 DPI 导出确认弹窗 */}
      <ExportModal
        isOpen={exportSpec !== null}
        onClose={() => setExportSpec(null)}
        onConfirm={handleConfirmExport}
        spec={
          exportSpec || {
            title: '确认导出制作原图',
            description: '',
            specRows: [],
            exportPixelSize: { width: 0, height: 0 },
            confirmButtonText: '确认导出',
          }
        }
      />
    </div>
  )
}

export default App
