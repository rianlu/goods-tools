import {
  Download,
  FileOutput,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import type { ChangeEvent, RefObject } from 'react'
import { mmToPixels } from '../../core/geometry/dpi.ts'
import type { BaseCraft, FilmCraft } from '../../core/types.ts'
import { BADGE_PRESETS, SHAPE_OPTIONS } from './presets.ts'
import type { BadgeState } from './types.ts'

const BASE_CRAFTS: Array<{ id: BaseCraft; label: string }> = [
  { id: 'none', label: '无闪底' },
  { id: 'fine-silver', label: '细银闪' },
  { id: 'silver-glitter', label: '银葱' },
  { id: 'brushed-silver', label: '拉丝银葱' },
  { id: 'sand-glitter', label: '幻彩白沙' },
  { id: 'gold-glitter', label: '细金闪' },
  { id: 'pearl', label: '珠光底' },
]

const FILM_CRAFTS: Array<{ id: FilmCraft; label: string }> = [
  { id: 'none', label: '无膜' },
  { id: 'glossy', label: '高透亮膜' },
  { id: 'matte', label: '丝绒哑膜' },
  { id: 'rainbow', label: '素面镭射' },
  { id: 'cracked-ice', label: '碎玻璃镭射' },
  { id: 'cross', label: '十字星芒' },
]

type BadgeInspectorProps = {
  state: BadgeState
  onChangeState: (updater: (prev: BadgeState) => BadgeState) => void
  onUploadFile: (file: File) => void
  onResetArtwork: () => void
  onResetTransform: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  onExportPreview: () => void
  onRequestExportPrint: () => void
  isLocked: boolean
}

export function BadgeInspector({
  state,
  onChangeState,
  onUploadFile,
  onResetArtwork,
  onResetTransform,
  fileInputRef,
  onExportPreview,
  onRequestExportPrint,
  isLocked,
}: BadgeInspectorProps) {
  const activePreset =
    BADGE_PRESETS.find((p) => p.finishedDiameterMm === state.finishedDiameterMm) ||
    BADGE_PRESETS[3]

  const activeShape =
    SHAPE_OPTIONS.find((s) => s.id === state.shape) || SHAPE_OPTIONS[0]

  const printPixels = mmToPixels(state.printDiameterMm)
  const wrapMarginMm = (state.printDiameterMm - state.finishedDiameterMm) / 2

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUploadFile(file)
    e.target.value = ''
  }

  const handleScaleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const scale = Number.parseFloat(e.target.value)
    onChangeState((curr) => ({
      ...curr,
      transform: { ...curr.transform, scale },
    }))
  }

  const selectSize = (finishedMm: number) => {
    const preset = BADGE_PRESETS.find((p) => p.finishedDiameterMm === finishedMm)
    if (!preset) return
    onChangeState((curr) => ({
      ...curr,
      finishedDiameterMm: preset.finishedDiameterMm,
      printDiameterMm: preset.printDiameterMm,
      safeDiameterMm: preset.safeDiameterMm,
    }))
  }

  return (
    <aside className="inspector">
      {/* 1. 图片排版与管理卡片 */}
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">IMAGE</span>
            <h2>图片排版</h2>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="visually-hidden"
          onChange={handleFileChange}
        />

        {/* 统一画稿管理卡片 */}
        <div className="artwork-card">
          <div className="artwork-info-row">
            <div className="artwork-thumb-icon">
              <ImageIcon size={18} />
            </div>
            <div className="artwork-meta">
              <span className="artwork-name" title={state.artwork.name}>
                {state.artwork.name}
              </span>
              <span className="artwork-status">
                {state.artwork.isDemo ? '内置排版样稿' : '已载入画稿'}
              </span>
            </div>
            <div className="artwork-actions">
              <button
                type="button"
                className="action-pill-btn"
                onClick={onResetTransform}
                title="居中重置排版与缩放"
                aria-label="居中重置排版与缩放"
              >
                <RotateCcw size={13} />
                <span>居中</span>
              </button>
              {!state.artwork.isDemo && (
                <button
                  type="button"
                  className="action-pill-btn is-danger"
                  onClick={onResetArtwork}
                  title="恢复默认样稿"
                  aria-label="恢复默认样稿"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            className="upload-trigger-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={16} />
            <span>{state.artwork.isDemo ? '更换本地画稿' : '重新选择图片'}</span>
          </button>
        </div>

        <div className="range-row">
          <label htmlFor="badge-image-scale">图片缩放</label>
          <output htmlFor="badge-image-scale">
            {state.transform.scale.toFixed(2)}x
          </output>
          <input
            id="badge-image-scale"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={state.transform.scale}
            disabled={isLocked}
            onChange={handleScaleChange}
          />
        </div>
      </section>

      {/* 2. 工艺选择 (7 闪底 + 6 覆膜) */}
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">FINISH</span>
            <h2>工艺</h2>
          </div>
        </div>

        <span className="control-label">闪底 (底纸材质)</span>
        <div className="craft-options craft-grid">
          {BASE_CRAFTS.map((craft) => (
            <button
              key={craft.id}
              type="button"
              className={state.baseCraft === craft.id ? 'is-selected' : ''}
              onClick={() =>
                onChangeState((curr) => ({ ...curr, baseCraft: craft.id }))
              }
            >
              <span className={`craft-swatch ${craft.id}`} aria-hidden="true" />
              <span>{craft.label}</span>
            </button>
          ))}
        </div>

        <span className="control-label craft-sub-label">覆膜 (表面光学膜)</span>
        <div className="craft-options craft-grid">
          {FILM_CRAFTS.map((craft) => (
            <button
              key={craft.id}
              type="button"
              className={state.filmCraft === craft.id ? 'is-selected' : ''}
              onClick={() =>
                onChangeState((curr) => ({ ...curr, filmCraft: craft.id }))
              }
            >
              <span className={`craft-swatch ${craft.id}`} aria-hidden="true" />
              <span>{craft.label}</span>
            </button>
          ))}
        </div>

        <div className="craft-hint">
          💡 <strong>双闪组合推荐</strong>：细银闪 / 银葱 / 幻彩白沙 + 碎玻璃 / 素面 / 十字星芒膜。
        </div>
      </section>

      {/* 3. 规格与模具 */}
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">SPEC</span>
            <h2>吧唧规格</h2>
          </div>
          <span className="pixel-readout">{printPixels}px</span>
        </div>

        <span className="control-label">形状模具</span>
        <div className="shape-options">
          {SHAPE_OPTIONS.map((shape) => (
            <button
              key={shape.id}
              type="button"
              className={state.shape === shape.id ? 'is-selected' : ''}
              onClick={() =>
                onChangeState((curr) => ({ ...curr, shape: shape.id }))
              }
            >
              {shape.label}
            </button>
          ))}
        </div>

        <span className="control-label size-control-label">尺寸规格</span>
        {/* 舒展层次分明的吧唧尺寸选择卡片 */}
        <div className="badge-size-container">
          <div className="badge-size-row-3">
            {BADGE_PRESETS.slice(0, 3).map((preset) => {
              const isSelected = state.finishedDiameterMm === preset.finishedDiameterMm
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`badge-size-btn ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => selectSize(preset.finishedDiameterMm)}
                >
                  <strong className="badge-size-num">{preset.name}</strong>
                  <span className="badge-size-tag">{preset.tag}</span>
                </button>
              )
            })}
          </div>
          <div className="badge-size-row-2">
            {BADGE_PRESETS.slice(3).map((preset) => {
              const isSelected = state.finishedDiameterMm === preset.finishedDiameterMm
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`badge-size-btn featured ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => selectSize(preset.finishedDiameterMm)}
                >
                  <div className="featured-inner">
                    <strong className="badge-size-num">{preset.name}</strong>
                    <span className={`badge-size-tag ${preset.id === '58mm' ? 'highlight' : ''}`}>
                      {preset.tag}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="dimension-grid">
          <div>
            <span>成品可见{state.shape === 'round' ? '直径' : '边长'}</span>
            <strong>{state.finishedDiameterMm}mm</strong>
          </div>
          <div>
            <span>完整制作{state.shape === 'round' ? '直径' : '边长'}</span>
            <strong>{state.printDiameterMm}mm</strong>
          </div>
          <div>
            <span>每侧包边区</span>
            <strong>{wrapMarginMm.toFixed(1)}mm</strong>
          </div>
          <div>
            <span>建议安全区</span>
            <strong>{state.safeDiameterMm}mm</strong>
          </div>
        </div>

        <div className="size-note">
          <strong>{activePreset.name}（{activePreset.tag}）</strong>
          {activePreset.description}
        </div>
      </section>

      {/* 4. 导出 */}
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
            onClick={onExportPreview}
          >
            <Download size={18} aria-hidden="true" />
            效果图
            <span>1080px</span>
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={onRequestExportPrint}
          >
            <FileOutput size={18} aria-hidden="true" />
            制作原图
            <span>{printPixels}px</span>
          </button>
        </div>
      </section>
    </aside>
  )
}
