import {
  Circle,
  Download,
  Eye,
  FileOutput,
  Gem,
  ImagePlus,
  LockKeyhole,
  Pause,
  Play,
  RectangleHorizontal,
  RotateCcw,
  ScanLine,
  Shield,
  Square,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react'
import {
  type ChangeEvent,
  type DragEvent,
  type PointerEvent,
  type WheelEvent,
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
  constrainTransform,
  mmToPixels,
  previewDiameterRatio,
  type BadgeShape,
  type Transform,
} from './geometry.ts'

type Point = { x: number; y: number }

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

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
    pinchDistance: 0,
    pinchZoom: 1,
  })
  const reducedMotion = useReducedMotion()
  const demoArtwork = useMemo(() => createDemoArtwork(), [])
 const [editor, setEditor] = useState<RenderState>(() => ({
   artwork: demoArtwork,
   transform: DEFAULT_TRANSFORM,
   baseCraft: 'none',
   filmCraft: 'rainbow',
   shape: 'round',
   finishedDiameterMm: DEFAULT_BADGE_PRESET.finishedDiameterMm,
   printDiameterMm: DEFAULT_BADGE_PRESET.printDiameterMm,
   safeDiameterMm: DEFAULT_BADGE_PRESET.safeDiameterMm,
 }))
  const [view, setView] = useState<ViewMode>('preview')
  const [animate, setAnimate] = useState(false)
  const [draggingFile, setDraggingFile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmPrint, setConfirmPrint] = useState(false)
  const [message, setMessage] = useState('默认样稿已就绪, 上传图片即可替换.')
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
  : editor.shape === 'square' || editor.shape === 'rectangle'
    ? '完整图片边长'
    : '完整图片宽度'

 useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let animationFrame = 0
    const shouldAnimate = animate && !reducedMotion

    const draw = (time: number) => {
      // Circular wobble: like swirling a glass, the badge tilts in a circle.
      const phase = shouldAnimate ? (time % 3600) / 3600 * Math.PI * 2 : 0
      const t = shouldAnimate ? Math.sin(phase) : 0
      renderWorkspace(canvas, editor, view, t)
      if (shouldAnimate) animationFrame = requestAnimationFrame(draw)
    }

    draw(performance.now())
    return () => cancelAnimationFrame(animationFrame)
  }, [editor, animate, reducedMotion, view])

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
    setIsError(false)
    setMessage('正在处理图片...')
    try {
      const artwork = await loadArtwork(file)
      setEditor((current) => ({
        ...current,
        artwork,
        transform: DEFAULT_TRANSFORM,
      }))
      setMessage(`${file.name} 已载入, 图片仍保留在本地.`)
    } catch {
      setMessage('图片解码失败, 请换用 JPG、PNG 或 WebP 文件.')
      setIsError(true)
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    void acceptFile(event.target.files?.[0])
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDraggingFile(false)
    void acceptFile(event.dataTransfer.files[0])
  }

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, point)

    if (pointers.current.size === 1) {
      gesture.current.lastX = point.x
      gesture.current.lastY = point.y
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current.pinchDistance = distance(a, b)
      gesture.current.pinchZoom = editor.transform.zoom
    }
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!pointers.current.has(event.pointerId)) return
    const point = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, point)

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const currentDistance = distance(a, b)
      if (gesture.current.pinchDistance > 0) {
        const zoom =
          gesture.current.pinchZoom *
          (currentDistance / gesture.current.pinchDistance)
        updateTransform((current) => ({ ...current, zoom }))
      }
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const logicalScale = canvas.width / canvas.clientWidth
    const logicalDx = (point.x - gesture.current.lastX) * logicalScale
    const logicalDy = (point.y - gesture.current.lastY) * logicalScale
    // Normalize drag offset to canvas size so image position stays
    // consistent when switching between preview and print views.
    const printDiameter = DISPLAY_SIZE

    gesture.current.lastX = point.x
    gesture.current.lastY = point.y
    updateTransform((current) => ({
      ...current,
      offsetX: current.offsetX + logicalDx / printDiameter,
      offsetY: current.offsetY + logicalDy / printDiameter,
    }))
  }

  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size === 1) {
      const [point] = pointers.current.values()
      gesture.current.lastX = point.x
      gesture.current.lastY = point.y
    }
    gesture.current.pinchDistance = 0
  }

  function handleWheel(event: WheelEvent<HTMLCanvasElement>) {
    event.preventDefault()
    const factor = Math.exp(-event.deltaY * 0.0012)
    updateTransform((current) => ({
      ...current,
      zoom: current.zoom * factor,
    }))
  }

  function handleCanvasKeyDown(event: React.KeyboardEvent<HTMLCanvasElement>) {
    const movement = 0.015
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '=','-']
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
      return {
        ...current,
        zoom: current.zoom * (event.key === '-' ? 0.95 : 1.05),
      }
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
    'none': null,
    'silver-glitter': '银闪',
    'gold-glitter': '金闪',
    'pearl': '珠光',
  }
  const filmCraftLabelMap: Record<FilmCraft, string | null> = {
    'none': null,
    'glossy': '亮膜',
    'matte': '哑光',
    'rainbow': '素面镭射',
    'cracked-ice': '碎冰镭射',
    'lattice': '方格镭射',
  }
  const craftLabel = [
    baseCraftLabelMap[editor.baseCraft],
    filmCraftLabelMap[editor.filmCraft],
  ].filter(Boolean).join('+') || '无工艺'

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
      setMessage(`${printPixels}x${printPixels}px 制作原图已导出, 包含${wrapMarginMm}mm包边区.`)
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
          <span className="brand-mark" aria-hidden="true">G</span>
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
            <button
              type="button"
              className="icon-button"
              onClick={() => setAnimate((current) => !current)}
              aria-label={animate ? '停止动态预览' : '开始动态预览'}
              title={animate ? '停止动态预览' : '开始动态预览'}
            >
              {animate ? <Pause size={18} /> : <Play size={18} />}
            </button>
          </div>

          <div className="canvas-frame">
            <canvas
              ref={canvasRef}
              tabIndex={0}
              aria-label={view === 'preview' ? `${activeShape.label}吧唧成品预览画布` : `${activeShape.label}吧唧包边预览画布`}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
              onWheel={handleWheel}
              onKeyDown={handleCanvasKeyDown}
            />
            {draggingFile && (
              <div className="drop-overlay">
                <ImagePlus size={32} aria-hidden="true" />
                松开以载入图片
              </div>
            )}
          </div>

          <div className="stage-footer">
            {view === 'preview' ? (
              <span>{editor.finishedDiameterMm}mm {activeShape.label}成品正面</span>
            ) : (
              <div className="guide-legend" aria-label="印刷参考线">
                <span><i className="line print-line" />完整图片边界</span>
                <span><i className="line wrap-line" />包边区</span>
                <span><i className="line finished-line" />可见区</span>
                <span><i className="line safe-line" />安全区</span>
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
              {loading ? '正在处理...' : editor.artwork.isDemo ? '上传图片' : '更换图片'}
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
          <span className="control-label">闪底</span>
          <div className="craft-options craft-grid">
            {([
              { id: 'none' as const, label: '无闪底', icon: Circle, swatch: 'plain' },
              { id: 'silver-glitter' as const, label: '银闪', icon: Sparkles, swatch: 'glitter silver' },
              { id: 'gold-glitter' as const, label: '金闪', icon: Sparkles, swatch: 'glitter gold' },
              { id: 'pearl' as const, label: '珠光', icon: Gem, swatch: 'pearl' },
            ]).map((c) => (
              <button
                key={c.id}
                type="button"
                className={editor.baseCraft === c.id ? 'is-selected' : ''}
                aria-pressed={editor.baseCraft === c.id}
                onClick={() => changeBaseCraft(c.id)}
              >
                <span className={`craft-swatch ${c.swatch}`}><c.icon size={18} /></span>
                {c.label}
              </button>
            ))}
          </div>

          <span className="control-label craft-sub-label">覆膜</span>
          <div className="craft-options craft-grid">
            {([
              { id: 'none' as const, label: '无膜', icon: Circle, swatch: 'plain' },
              { id: 'glossy' as const, label: '亮膜', icon: Sun, swatch: 'glossy' },
              { id: 'matte' as const, label: '哑光', icon: Sun, swatch: 'matte' },
              { id: 'rainbow' as const, label: '素面镭射', icon: Gem, swatch: 'holographic' },
              { id: 'cracked-ice' as const, label: '碎冰镭射', icon: Gem, swatch: 'cracked-ice' },
              { id: 'lattice' as const, label: '方格镭射', icon: Gem, swatch: 'lattice' },
            ]).map((c) => (
              <button
                key={c.id}
                type="button"
                className={editor.filmCraft === c.id ? 'is-selected' : ''}
                aria-pressed={editor.filmCraft === c.id}
                onClick={() => changeFilmCraft(c.id)}
              >
                <span className={`craft-swatch ${c.swatch}`}><c.icon size={18} /></span>
                {c.label}
              </button>
            ))}
          </div>
          <p className="craft-hint">
            银闪 + 素面镭射 = 双闪. 底层闪粉提供内部闪烁, 表面膜层提供光泽或彩虹反光.
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
                const shapeIcons: Record<BadgeShape, typeof Circle> = {
                  round: Circle,
                  square: Square,
                  rectangle: RectangleHorizontal,
                  shield: Shield,
                }
                const ShapeIcon = shapeIcons[shape.id]
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
              <button type="button" className="secondary-action" onClick={exportPreview}>
                <Download size={18} aria-hidden="true" />
                效果图
                <span>1080px</span>
              </button>
              <button type="button" className="primary-action" onClick={() => setConfirmPrint(true)}>
                <FileOutput size={18} aria-hidden="true" />
                制作原图
                <span>{printPixels}px</span>
              </button>
            </div>
            {confirmPrint && (
              <div className="confirm-panel" role="alert">
                <strong>确认导出制作原图</strong>
                <p>
                  将导出 {editor.printDiameterMm}mm 完整图片、{editor.finishedDiameterMm}mm {activeShape.label}成品可见区的 {printPixels}x{printPixels}px PNG.
                  外圈包边区不会出现在成品正面.
                </p>
                <div>
                  <button type="button" className="confirm-cancel" onClick={() => setConfirmPrint(false)}>
                    取消
                  </button>
                  <button type="button" className="confirm-submit" onClick={confirmAndExportPrint}>
                    确认导出
                  </button>
                </div>
              </div>
            )}
            <p
              className={`status-message ${isError ? 'is-error' : ''}`}
              aria-live="polite"
            >
              {message}
            </p>
          </section>
        </aside>
      </main>
    </div>
  )
}
