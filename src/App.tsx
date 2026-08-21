import {
  Circle,
  Download,
  Eye,
  FileOutput,
  Gem,
  ImagePlus,
  Lock,
  LockKeyhole,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Square,
  Sparkles,
  Sun,
  Trash2,
  Unlock,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  type ChangeEvent,
  type DragEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  DISPLAY_SIZE,
  createDemoArtwork,
  createPreviewExport,
  createPrintExport,
  downloadCanvas,
  loadArtwork,
  preloadTextures,
  renderWorkspace,
  validateArtworkFile,
  type BaseCraft,
  type FilmCraft,
  type RenderState,
  type ViewMode,
} from './canvas.ts'
import {
  BADGE_PRESETS,
  BADGE_SHAPES,
  DEFAULT_TRANSFORM,
  DEFAULT_BADGE_PRESET,
  OUTPUT_DPI,
  clamp,
  constrainTransform,
  mmToPixels,
  previewDiameterRatio,
  type BadgeShape,
  type Transform,
} from './geometry.ts'

type Point = { x: number; y: number }

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef({
    lastX: 0,
    lastY: 0,
  })

  const reducedMotion = useReducedMotion()
  const demoArtwork = useMemo(() => createDemoArtwork(), [])
  const [editor, setEditor] = useState<RenderState>(() => ({
    artwork: demoArtwork,
    transform: DEFAULT_TRANSFORM,
    baseCraft: 'fine-silver',
    filmCraft: 'cracked-ice',
    shape: 'round',
    finishedDiameterMm: DEFAULT_BADGE_PRESET.finishedDiameterMm,
    printDiameterMm: DEFAULT_BADGE_PRESET.printDiameterMm,
    safeDiameterMm: DEFAULT_BADGE_PRESET.safeDiameterMm,
  }))
  const [view, setView] = useState<ViewMode>('preview')
  const [animate, setAnimate] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [viewportZoom, setViewportZoom] = useState(1.0)
  const [draggingFile, setDraggingFile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmPrint, setConfirmPrint] = useState(false)
  const [message, setMessage] = useState('默认样稿已就绪，已预置【细银闪 + 碎玻璃镭射】双闪工艺。')
  const [isError, setIsError] = useState(false)

  const printPixels = mmToPixels(editor.printDiameterMm)
  const wrapMarginMm = (editor.printDiameterMm - editor.finishedDiameterMm) / 2
  const activePresetId = BADGE_PRESETS.find(
    (preset) => preset.finishedDiameterMm === editor.finishedDiameterMm,
  )?.id
  const activeShape = BADGE_SHAPES.find((shape) => shape.id === editor.shape)
    ?? BADGE_SHAPES[0]
  const visibleSizeLabel = editor.shape === 'round'
    ? '成品可见直径'
    : editor.shape === 'square'
      ? '成品可见边长'
      : '成品最大宽度'
  const artworkSizeLabel = editor.shape === 'round'
    ? '完整图片直径'
    : '完整图片边长'

  useEffect(() => {
    preloadTextures()
  }, [])

  // Animation Loop: Continuous 360° Circular Hand-held Showcase Orbit
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let animationFrame = 0
    const shouldAnimate = animate && !reducedMotion

    const draw = (time: number) => {
      if (shouldAnimate) {
        // Continuous smooth 360° orbital tilt mimicking a person turning the badge in light
        const speed = 0.0015
        const angle = time * speed
        const tiltX = Math.cos(angle) * 0.75
        const tiltY = Math.sin(angle) * 0.65
        const phase = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
        renderWorkspace(canvas, editor, view, tiltX, tiltY, phase)
        animationFrame = requestAnimationFrame(draw)
      } else {
        // Clean, stable studio lighting angle
        renderWorkspace(canvas, editor, view, 0.15, 0.1, 0.8)
      }
    }

    if (shouldAnimate) {
      animationFrame = requestAnimationFrame(draw)
    } else {
      draw(performance.now())
    }

    return () => cancelAnimationFrame(animationFrame)
  }, [editor, animate, reducedMotion, view])

  // Global Escape key listener to close modal
  useEffect(() => {
    if (!confirmPrint) return
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmPrint(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmPrint])

  function updateTransform(change: (current: Transform) => Transform) {
    setEditor((current) => ({
      ...current,
      transform: constrainTransform(change(current.transform), current.artwork),
    }))
  }

  async function acceptFile(file: File | undefined) {
    if (!file) return
    const validationError = validateArtworkFile(file)
    if (validationError) {
      setMessage(validationError)
      setIsError(true)
      return
    }

    setLoading(true)
    setMessage('正在载入图片...')
    setIsError(false)
    try {
      const artwork = await loadArtwork(file)
      setEditor((current) => ({
        ...current,
        artwork,
        transform: DEFAULT_TRANSFORM,
      }))
      setMessage(`${file.name} 载入成功, 可拖拽移动排版.`)
      setIsError(false)
    } catch {
      setMessage('图片载入失败, 请重试或选择其他图片.')
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    void acceptFile(event.target.files?.[0])
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDraggingFile(false)
    void acceptFile(event.dataTransfer.files?.[0])
  }

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (isLocked) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size === 1) {
      gesture.current.lastX = event.clientX
      gesture.current.lastY = event.clientY
    }
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (isLocked || !pointers.current.has(event.pointerId)) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    // Single pointer dragging strictly adjusts position only (no pinch zoom in canvas)
    if (pointers.current.size === 1) {
      const deltaX = (event.clientX - gesture.current.lastX) / rect.width
      const deltaY = (event.clientY - gesture.current.lastY) / rect.height
      gesture.current.lastX = event.clientX
      gesture.current.lastY = event.clientY

      updateTransform((current) => ({
        ...current,
        offsetX: current.offsetX + deltaX,
        offsetY: current.offsetY + deltaY,
      }))
    }
  }

  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (canvas && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
    pointers.current.delete(event.pointerId)
    if (pointers.current.size === 1) {
      const [remaining] = Array.from(pointers.current.values())
      gesture.current.lastX = remaining.x
      gesture.current.lastY = remaining.y
    }
  }

  function handleCanvasKeyDown(event: React.KeyboardEvent<HTMLCanvasElement>) {
    if (isLocked) return
    const movement = 0.015
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    updateTransform((current) => {
      if (event.key === 'ArrowUp') {
        return { ...current, offsetY: current.offsetY - movement }
      }
      if (event.key === 'ArrowDown') {
        return { ...current, offsetY: current.offsetY + movement }
      }
      if (event.key === 'ArrowLeft') {
        return { ...current, offsetX: current.offsetX - movement }
      }
      if (event.key === 'ArrowRight') {
        return { ...current, offsetX: current.offsetX + movement }
      }
      return current
    })
  }

  function resetArtwork() {
    setEditor((current) => ({
      ...current,
      artwork: demoArtwork,
      transform: DEFAULT_TRANSFORM,
    }))
    setMessage('已恢复默认样稿.')
    setIsError(false)
  }

  function resetTransform() {
    setEditor((current) => ({
      ...current,
      transform: DEFAULT_TRANSFORM,
    }))
    setMessage('图片位置和缩放已重置.')
    setIsError(false)
  }

  function changeBaseCraft(baseCraft: BaseCraft) {
    setEditor((current) => ({ ...current, baseCraft }))
  }

  function changeFilmCraft(filmCraft: FilmCraft) {
    setEditor((current) => ({ ...current, filmCraft }))
  }

  const baseCraftLabelMap: Record<BaseCraft, string | null> = {
    none: null,
    'fine-silver': '细银闪',
    'silver-glitter': '银葱',
    'brushed-silver': '拉丝银葱',
    'sand-glitter': '幻彩白沙',
    'gold-glitter': '细金闪',
    pearl: '珠光底',
  }

  const filmCraftLabelMap: Record<FilmCraft, string | null> = {
    none: null,
    glossy: '亮膜',
    matte: '丝绒哑膜',
    rainbow: '素面镭射',
    'cracked-ice': '碎玻璃镭射',
    cross: '十字星芒',
  }

  const craftLabel =
    [baseCraftLabelMap[editor.baseCraft], filmCraftLabelMap[editor.filmCraft]]
      .filter(Boolean)
      .join('+') || '无工艺'

  async function exportPreview() {
    try {
      await downloadCanvas(
        createPreviewExport(editor),
        `guzitools-badge-${editor.shape}-${editor.finishedDiameterMm}mm-${craftLabel}-preview.png`,
      )
      setMessage('1080x1080 效果图已导出.')
      setIsError(false)
    } catch {
      setMessage('效果图导出失败, 请重试或更换浏览器.')
      setIsError(true)
    }
  }

  async function confirmAndExportPrint() {
    setConfirmPrint(false)
    try {
      const filename = `guzitools-badge-${editor.shape}-${editor.finishedDiameterMm}mm-${craftLabel}-artwork-${editor.printDiameterMm}mm-${OUTPUT_DPI}dpi.png`
      await downloadCanvas(createPrintExport(editor), filename, OUTPUT_DPI)
      setMessage(
        `${printPixels}x${printPixels}px 制作原图已导出, 包含${wrapMarginMm}mm包边区.`,
      )
      setIsError(false)
    } catch {
      setMessage('制作稿导出失败, 请重试或缩小展开尺寸.')
      setIsError(true)
    }
  }

  function selectBadgeSize(finishedDiameterMm: number) {
    const preset = BADGE_PRESETS.find(
      (candidate) => candidate.finishedDiameterMm === finishedDiameterMm,
    )
    if (!preset) return
    setEditor((current) => ({
      ...current,
      finishedDiameterMm: preset.finishedDiameterMm,
      printDiameterMm: preset.printDiameterMm,
      safeDiameterMm: preset.safeDiameterMm,
    }))
    setConfirmPrint(false)
    setMessage(`${preset.label} 成品尺寸已切换, 图片位置保持不变.`)
    setIsError(false)
  }

  function selectBadgeShape(shape: BadgeShape) {
    const selected = BADGE_SHAPES.find((candidate) => candidate.id === shape)
    if (!selected) return
    setEditor((current) => ({ ...current, shape }))
    setConfirmPrint(false)
    setMessage(`${selected.label}吧唧已切换, 图片位置保持不变.`)
    setIsError(false)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <div>
            <strong>谷子Tools</strong>
            <span>吧唧打样台</span>
          </div>
        </div>
        <div className="local-badge">
          <LockKeyhole size={15} aria-hidden="true" />
          图片仅本地处理
        </div>
      </header>

      <main className="workspace">
        <section
          className={`stage ${draggingFile ? 'is-dragging' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault()
            setDraggingFile(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setDraggingFile(false)
            }
          }}
          onDrop={handleDrop}
        >
          <div className="stage-toolbar">
            <div className="view-switcher" aria-label="预览模式">
              <button
                type="button"
                className={view === 'preview' ? 'is-active' : ''}
                aria-pressed={view === 'preview'}
                onClick={() => setView('preview')}
              >
                <Eye size={17} aria-hidden="true" />
                成品效果
              </button>
              <button
                type="button"
                className={view === 'print' ? 'is-active' : ''}
                aria-pressed={view === 'print'}
                onClick={() => setView('print')}
              >
                <ScanLine size={17} aria-hidden="true" />
                包边预览
              </button>
            </div>

            <div className="stage-actions">
              {/* 视口缩放比例尺 - 风格与页面设计统一，放在顶部栏不再挡住吧唧 */}
              <div className="viewport-zoom-group" aria-label="视口缩放比例尺">
                <button
                  type="button"
                  onClick={() => setViewportZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                  title="缩小视口"
                  aria-label="缩小视口"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  type="button"
                  className="zoom-readout-btn"
                  onClick={() => setViewportZoom(1.0)}
                  title="点击重置为 100%"
                  aria-label="重置缩放为 100%"
                >
                  {Math.round(viewportZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setViewportZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
                  title="放大视口"
                  aria-label="放大视口"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  type="button"
                  className="zoom-fit-btn"
                  onClick={() => setViewportZoom(1.0)}
                  title="适应视口"
                  aria-label="适应视口"
                >
                  <Maximize2 size={13} />
                  适应
                </button>
              </div>

              {/* 锁定按钮与播放动画按钮并排，保证视觉统一 */}
              <button
                type="button"
                className={`icon-button ${isLocked ? 'is-active' : ''}`}
                onClick={() => {
                  setIsLocked((curr) => !curr)
                  setMessage(
                    !isLocked
                      ? '构图已锁定 🔒，已禁用图片拖动。'
                      : '构图已解锁 🔓，可拖拽调整图片位置。',
                  )
                }}
                aria-label={isLocked ? '解锁构图' : '锁定构图'}
                title={isLocked ? '点击解锁构图' : '点击锁定构图'}
              >
                {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
              </button>

              <button
                type="button"
                className={`icon-button ${animate ? 'is-active' : ''}`}
                onClick={() => setAnimate((current) => !current)}
                aria-label={animate ? '停止动态预览' : '开始动态预览'}
                title={animate ? '停止动态预览' : '开始动态预览'}
              >
                {animate ? <Pause size={18} /> : <Play size={18} />}
              </button>
            </div>
          </div>

          <div className="canvas-frame">
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
                aria-label={
                  view === 'preview'
                    ? `${activeShape.label}吧唧成品预览画布`
                    : `${activeShape.label}吧唧包边预览画布`
                }
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={pointerUp}
                onKeyDown={handleCanvasKeyDown}
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
            {view === 'preview' ? (
              <span>
                {editor.finishedDiameterMm}mm {activeShape.label}成品正面
              </span>
            ) : (
              <div className="guide-legend" aria-label="印刷参考线">
                <span>
                  <i className="line print-line" />
                  完整图片边界
                </span>
                <span>
                  <i className="line wrap-line" />
                  包边区
                </span>
                <span>
                  <i className="line finished-line" />
                  可见区
                </span>
                <span>
                  <i className="line safe-line" />
                  安全区
                </span>
              </div>
            )}
            <span>{editor.artwork.name}</span>
          </div>
        </section>

        <aside className="inspector" aria-label="打样控制面板">
          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">IMAGE</span>
                <h2>图片</h2>
              </div>
              <div className="section-tools">
                <button
                  type="button"
                  className="icon-button"
                  onClick={resetTransform}
                  aria-label="重置图片位置"
                  title="重置图片位置"
                >
                  <RotateCcw size={17} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={resetArtwork}
                  aria-label="清空上传图片"
                  title="清空上传图片"
                  disabled={editor.artwork.isDemo}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>

            <input
              ref={inputRef}
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInput}
            />
            <button
              type="button"
              className="upload-button"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              <ImagePlus size={18} aria-hidden="true" />
              {loading
                ? '正在处理...'
                : editor.artwork.isDemo
                  ? '上传图片'
                  : '更换图片'}
            </button>

            <label className="range-row">
              <span>缩放</span>
              <output>{editor.transform.zoom.toFixed(2)}x</output>
              <input
                type="range"
                min="1"
                max="4"
                step="0.01"
                value={editor.transform.zoom}
                onChange={(event) => {
                  const zoom = Number(event.target.value)
                  updateTransform((current) => ({ ...current, zoom }))
                }}
              />
            </label>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">FINISH</span>
                <h2>工艺</h2>
              </div>
            </div>
            <span className="control-label">闪底 (底纸材质)</span>
            <div className="craft-options craft-grid">
              {[
                { id: 'none' as const, label: '无闪底', icon: Circle, swatch: 'plain' },
                { id: 'fine-silver' as const, label: '细银闪', icon: Sparkles, swatch: 'fine-silver' },
                { id: 'silver-glitter' as const, label: '银葱', icon: Sparkles, swatch: 'glitter silver' },
                { id: 'brushed-silver' as const, label: '拉丝银葱', icon: Sparkles, swatch: 'brushed' },
                { id: 'sand-glitter' as const, label: '幻彩白沙', icon: Sparkles, swatch: 'sand' },
                { id: 'gold-glitter' as const, label: '细金闪', icon: Sparkles, swatch: 'glitter gold' },
                { id: 'pearl' as const, label: '珠光底', icon: Gem, swatch: 'pearl' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={editor.baseCraft === c.id ? 'is-selected' : ''}
                  aria-pressed={editor.baseCraft === c.id}
                  onClick={() => changeBaseCraft(c.id)}
                >
                  <span className={`craft-swatch ${c.swatch}`}>
                    <c.icon size={18} />
                  </span>
                  {c.label}
                </button>
              ))}
            </div>

            <span className="control-label craft-sub-label">覆膜 (表面光学膜)</span>
            <div className="craft-options craft-grid">
              {[
                { id: 'none' as const, label: '无膜', icon: Circle, swatch: 'plain' },
                { id: 'glossy' as const, label: '高透亮膜', icon: Sun, swatch: 'glossy' },
                { id: 'matte' as const, label: '丝绒哑膜', icon: Sun, swatch: 'matte' },
                { id: 'rainbow' as const, label: '素面镭射', icon: Gem, swatch: 'holographic' },
                { id: 'cracked-ice' as const, label: '碎玻璃镭射', icon: Gem, swatch: 'cracked-ice' },
                { id: 'cross' as const, label: '十字星芒', icon: Sparkles, swatch: 'cross' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={editor.filmCraft === c.id ? 'is-selected' : ''}
                  aria-pressed={editor.filmCraft === c.id}
                  onClick={() => changeFilmCraft(c.id)}
                >
                  <span className={`craft-swatch ${c.swatch}`}>
                    <c.icon size={18} />
                  </span>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="craft-hint">
              💡 <strong>双闪组合推荐</strong>：细银闪 / 银葱 / 幻彩白沙 + 碎玻璃 / 素面 / 十字镭射膜。底纸在图层下方闪耀，表面膜层折射彩虹光栅。
            </p>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">SPEC</span>
                <h2>吧唧规格</h2>
              </div>
              <span className="pixel-readout">{printPixels}px</span>
            </div>

            <span className="control-label">形状</span>
            <div className="shape-options" aria-label="吧唧形状">
              {BADGE_SHAPES.map((shape) => {
                const ShapeIcon = shape.id === 'round' ? Circle : Square
                return (
                  <button
                    key={shape.id}
                    type="button"
                    className={editor.shape === shape.id ? 'is-selected' : ''}
                    aria-pressed={editor.shape === shape.id}
                    onClick={() => selectBadgeShape(shape.id)}
                  >
                    <ShapeIcon size={18} aria-hidden="true" />
                    {shape.label}
                  </button>
                )
              })}
            </div>

            <span className="control-label size-control-label">尺寸</span>
            <div className="size-options" aria-label="吧唧成品尺寸">
              {BADGE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={activePresetId === preset.id ? 'is-selected' : ''}
                  aria-pressed={activePresetId === preset.id}
                  onClick={() => selectBadgeSize(preset.finishedDiameterMm)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="dimension-grid">
              <div>
                <span>{visibleSizeLabel}</span>
                <strong>{editor.finishedDiameterMm}mm</strong>
              </div>
              <div>
                <span>{artworkSizeLabel}</span>
                <strong>{editor.printDiameterMm}mm</strong>
              </div>
              <div>
                <span>每侧包边区</span>
                <strong>{wrapMarginMm.toFixed(1)}mm</strong>
              </div>
              <div>
                <span>建议安全区</span>
                <strong>{editor.safeDiameterMm}mm</strong>
              </div>
            </div>

            <div className="size-note">
              <strong>压边结构</strong>
              外圈会被包入金属边内, 正面图案从可见区开始. 文字和主体尽量放在安全区内.
            </div>
          </section>

          <section className="panel-section export-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">EXPORT</span>
                <h2>导出</h2>
              </div>
            </div>
            <div className="export-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={exportPreview}
              >
                <Download size={18} aria-hidden="true" />
                效果图
                <span>1080px</span>
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => setConfirmPrint(true)}
              >
                <FileOutput size={18} aria-hidden="true" />
                制作原图
                <span>{printPixels}px</span>
              </button>
            </div>
            <p
              className={`status-message ${isError ? 'is-error' : ''}`}
              aria-live="polite"
            >
              {message}
            </p>
          </section>
        </aside>
      </main>

      {/* 确认导出制作原图 - 专业模态弹窗 */}
      {confirmPrint && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setConfirmPrint(false)}
        >
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-print-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-icon">
                  <FileOutput size={18} />
                </span>
                <h3 id="confirm-print-title">确认导出制作原图</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setConfirmPrint(false)}
                aria-label="关闭弹窗"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-desc">
                原图将以 <strong>300 DPI 无损印刷标准</strong> 导出完整画稿。外圈包边区将用于金属卷边包裹，不会出现在成品正面。
              </p>

              <div className="modal-spec-card">
                <div className="spec-row">
                  <span className="spec-name">吧唧规格</span>
                  <span className="spec-val">
                    {editor.finishedDiameterMm}mm {activeShape.label} ({craftLabel})
                  </span>
                </div>
                <div className="spec-row">
                  <span className="spec-name">导出原图尺寸</span>
                  <span className="spec-val highlight">
                    {printPixels} × {printPixels} px ({editor.printDiameterMm}mm)
                  </span>
                </div>
                <div className="spec-row">
                  <span className="spec-name">成品正面可见</span>
                  <span className="spec-val">{editor.finishedDiameterMm}mm</span>
                </div>
                <div className="spec-row">
                  <span className="spec-name">每侧包边预留</span>
                  <span className="spec-val">{wrapMarginMm.toFixed(1)}mm</span>
                </div>
                <div className="spec-row">
                  <span className="spec-name">印刷分辨率</span>
                  <span className="spec-val">300 DPI (CMYK标准)</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setConfirmPrint(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="modal-confirm-btn"
                onClick={confirmAndExportPrint}
              >
                <Download size={16} />
                确认导出原图 ({printPixels}px)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
