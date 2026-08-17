import {
  Circle,
  Download,
  Eye,
  FileOutput,
  ImagePlus,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Sparkles,
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
  type Craft,
  type RenderState,
  type ViewMode,
} from './canvas.ts'
import {
  BADGE_PRESETS,
  DEFAULT_TRANSFORM,
  DEFAULT_BADGE_PRESET,
  OUTPUT_DPI,
  constrainTransform,
  mmToPixels,
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
    craft: 'holographic',
    finishedDiameterMm: DEFAULT_BADGE_PRESET.finishedDiameterMm,
    printDiameterMm: DEFAULT_BADGE_PRESET.printDiameterMm,
    safeDiameterMm: DEFAULT_BADGE_PRESET.safeDiameterMm,
  }))
  const [view, setView] = useState<ViewMode>('preview')
  const [paused, setPaused] = useState(false)
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let animationFrame = 0
    const shouldAnimate =
      editor.craft === 'holographic' && !paused && !reducedMotion

    const draw = (time: number) => {
      renderWorkspace(
        canvas,
        editor,
        view,
        shouldAnimate ? (time % 6200) / 6200 : 0.56,
      )
      if (shouldAnimate) animationFrame = requestAnimationFrame(draw)
    }

    draw(performance.now())
    return () => cancelAnimationFrame(animationFrame)
  }, [editor, paused, reducedMotion, view])

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
    const printDiameter =
      view === 'print'
        ? DISPLAY_SIZE * 0.72
        : DISPLAY_SIZE *
          0.62 *
          (editor.printDiameterMm / editor.finishedDiameterMm)

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

  function changeCraft(craft: Craft) {
    setEditor((current) => ({ ...current, craft }))
  }

  async function exportPreview() {
    try {
      await downloadCanvas(
        createPreviewExport(editor),
        `guzitools-badge-${editor.finishedDiameterMm}mm-preview.png`,
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
      const filename = `guzitools-badge-${editor.finishedDiameterMm}mm-artwork-${editor.printDiameterMm}mm-${OUTPUT_DPI}dpi.png`
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
              onClick={() => setPaused((current) => !current)}
              disabled={editor.craft === 'plain'}
              aria-label={paused ? '播放镭射动画' : '暂停镭射动画'}
              title={paused ? '播放镭射动画' : '暂停镭射动画'}
            >
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
          </div>

          <div className="canvas-frame">
            <canvas
              ref={canvasRef}
              tabIndex={0}
              aria-label={view === 'preview' ? '吧唧成品预览画布' : '吧唧包边预览画布'}
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
              <span>{editor.finishedDiameterMm}mm 成品正面</span>
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
            <div className="craft-options">
              <button
                type="button"
                className={editor.craft === 'plain' ? 'is-selected' : ''}
                aria-pressed={editor.craft === 'plain'}
                onClick={() => changeCraft('plain')}
              >
                <span className="craft-swatch plain"><Circle size={18} /></span>
                无工艺
              </button>
              <button
                type="button"
                className={editor.craft === 'holographic' ? 'is-selected' : ''}
                aria-pressed={editor.craft === 'holographic'}
                onClick={() => changeCraft('holographic')}
              >
                <span className="craft-swatch holographic"><Sparkles size={18} /></span>
                镭射膜
              </button>
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">SIZE</span>
                <h2>成品尺寸</h2>
              </div>
              <span className="pixel-readout">{printPixels}px</span>
            </div>

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
                <span>成品可见直径</span>
                <strong>{editor.finishedDiameterMm}mm</strong>
              </div>
              <div>
                <span>完整图片直径</span>
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
              <strong>看图就能理解</strong>
              外圈会被包边压入内部, 文字和主体尽量放在安全区内.
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
                  将导出 {editor.printDiameterMm}mm 完整图片、{editor.finishedDiameterMm}mm 成品可见区的 {printPixels}x{printPixels}px PNG.
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
