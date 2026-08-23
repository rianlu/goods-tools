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
import {
  CORNER_RADIUS_OPTIONS,
  FRAME_OPTIONS,
  PHOTOCARD_PRESETS,
} from './presets.ts'
import type { PhotocardState } from './types.ts'

const BASE_CRAFTS: Array<{ id: BaseCraft; label: string }> = [
  { id: 'none', label: '300g 标准相纸' },
  { id: 'pearl', label: '珠光贝母卡纸' },
  { id: 'fine-silver', label: '细银闪卡纸' },
  { id: 'silver-glitter', label: '银葱闪卡纸' },
  { id: 'sand-glitter', label: '幻彩白沙相纸' },
  { id: 'brushed-silver', label: '拉丝银卡' },
  { id: 'gold-glitter', label: '细金闪卡纸' },
]

const FILM_CRAFTS: Array<{ id: FilmCraft; label: string }> = [
  { id: 'none', label: '无覆膜' },
  { id: 'glossy', label: '高透相纸亮膜' },
  { id: 'matte', label: '丝绒哑膜' },
  { id: 'rainbow', label: '素面彩虹镭射' },
  { id: 'cracked-ice', label: '碎玻璃镭射' },
  { id: 'cross', label: '十字星芒' },
]

const SIGNATURE_COLORS = [
  { value: '#1a1b1e', label: '经典黑' },
  { value: '#ffffff', label: '纯洁白' },
  { value: '#d4af37', label: '烫金色' },
  { value: '#e056fd', label: '梦幻粉' },
  { value: '#22a6b3', label: '海蓝色' },
]

type PhotocardInspectorProps = {
  state: PhotocardState
  onChangeState: (updater: (prev: PhotocardState) => PhotocardState) => void
  onUploadFile: (file: File) => void
  onResetArtwork: () => void
  onResetTransform: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  onExportPreview: () => void
  onRequestExportPrint: (side: 'front' | 'back') => void
  isLocked: boolean
}

export function PhotocardInspector({
  state,
  onChangeState,
  onUploadFile,
  onResetArtwork,
  onResetTransform,
  fileInputRef,
  onExportPreview,
  onRequestExportPrint,
  isLocked,
}: PhotocardInspectorProps) {
  const { preset, activeSide } = state
  const currentArtwork =
    activeSide === 'front' ? state.frontArtwork : state.backArtwork
  const currentTransform =
    activeSide === 'front' ? state.frontTransform : state.backTransform

  const totalWMm = preset.widthMm + preset.bleedMm * 2
  const totalHMm = preset.heightMm + preset.bleedMm * 2
  const printPixelsW = mmToPixels(totalWMm)
  const printPixelsH = mmToPixels(totalHMm)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUploadFile(file)
    e.target.value = ''
  }

  const handleScaleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const scale = Number.parseFloat(e.target.value)
    onChangeState((curr) => {
      if (curr.activeSide === 'front') {
        return {
          ...curr,
          frontTransform: { ...curr.frontTransform, scale },
        }
      }
      return {
        ...curr,
        backTransform: { ...curr.backTransform, scale },
      }
    })
  }

  return (
    <aside className="inspector">
      {/* 1. 正反双面与图片排版 */}
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">CARD SIDE & IMAGE</span>
            <h2>{activeSide === 'front' ? '正面 (画心)' : '背面 (卡背)'}</h2>
          </div>
        </div>

        {/* 双面切换药丸 */}
        <div className="side-switcher" role="tablist" aria-label="卡片正反面切换">
          <button
            type="button"
            className={activeSide === 'front' ? 'is-active' : ''}
            onClick={() => onChangeState((curr) => ({ ...curr, activeSide: 'front' }))}
          >
            🎴 正面 (画心)
          </button>
          <button
            type="button"
            className={activeSide === 'back' ? 'is-active' : ''}
            onClick={() => onChangeState((curr) => ({ ...curr, activeSide: 'back' }))}
          >
            🔄 背面 (卡背)
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="visually-hidden"
          onChange={handleFileChange}
        />

        {/* 优雅画稿管理卡片 */}
        <div className="artwork-card">
          <div className="artwork-info-row">
            <div className="artwork-thumb-icon">
              <ImageIcon size={18} />
            </div>
            <div className="artwork-meta">
              <span className="artwork-name" title={currentArtwork?.name || '默认卡背'}>
                {currentArtwork?.name || (activeSide === 'front' ? '默认样稿' : '默认限定卡背')}
              </span>
              <span className="artwork-status">
                {currentArtwork?.isDemo
                  ? '内置排版样稿'
                  : currentArtwork
                    ? '已载入用户画稿'
                    : '系统默认卡背'}
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
              {currentArtwork && !currentArtwork.isDemo && (
                <button
                  type="button"
                  className="action-pill-btn is-danger"
                  onClick={onResetArtwork}
                  title="清除画稿"
                  aria-label="清除画稿"
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
            <span>
              {currentArtwork && !currentArtwork.isDemo
                ? `更换${activeSide === 'front' ? '正面' : '背面'}图片`
                : `上传${activeSide === 'front' ? '正面画稿' : '背面卡背'}`}
            </span>
          </button>
        </div>

        <div className="range-row">
          <label htmlFor="card-image-scale">图片缩放</label>
          <output htmlFor="card-image-scale">
            {currentTransform.scale.toFixed(2)}x
          </output>
          <input
            id="card-image-scale"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={currentTransform.scale}
            disabled={isLocked}
            onChange={handleScaleChange}
          />
        </div>
      </section>

      {/* 2. 相框模板与外型规格 */}
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">TEMPLATE & SPEC</span>
            <h2>框型与规格</h2>
          </div>
          <span className="pixel-readout">{printPixelsW}×{printPixelsH}px</span>
        </div>

        <span className="control-label">相框模板</span>
        <div className="shape-options">
          {FRAME_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={state.frameType === f.id ? 'is-selected' : ''}
              onClick={() => onChangeState((curr) => ({ ...curr, frameType: f.id }))}
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        <span className="control-label size-control-label">卡片规格尺寸</span>
        <div className="spec-card-grid">
          {PHOTOCARD_PRESETS.map((p) => {
            const isSelected = preset.id === p.id
            return (
              <button
                key={p.id}
                type="button"
                className={`spec-option-card ${isSelected ? 'is-selected' : ''}`}
                onClick={() =>
                  onChangeState((curr) => ({
                    ...curr,
                    preset: p,
                    cornerRadiusMm: p.defaultRadiusMm,
                  }))
                }
              >
                <div className="spec-option-header">
                  <span className="spec-option-title">{p.label.split(' (')[0]}</span>
                  <span className="spec-option-dim">{p.widthMm}×{p.heightMm}mm</span>
                </div>
                <div className="spec-option-detail">
                  {p.id === 'kpop-card' ? '满版无白边' : `画心 ${p.windowWidthMm}×${p.windowHeightMm}mm`}
                </div>
              </button>
            )
          })}
        </div>

        <span className="control-label size-control-label">冲切圆角 (R角)</span>
        <div className="corner-grid-3">
          {CORNER_RADIUS_OPTIONS.map((r) => {
            const isSelected = state.cornerRadiusMm === r.value
            return (
              <button
                key={r.value}
                type="button"
                className={`corner-option-card ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onChangeState((curr) => ({ ...curr, cornerRadiusMm: r.value }))}
              >
                <strong className="corner-tag">{r.tag}</strong>
                <span className="corner-name">{r.label}</span>
              </button>
            )
          })}
        </div>

        <div className="dimension-grid">
          <div>
            <span>成品裁切尺寸</span>
            <strong>{preset.widthMm} × {preset.heightMm}mm</strong>
          </div>
          <div>
            <span>印刷原图 (+1.5mm出血)</span>
            <strong>{totalWMm} × {totalHMm}mm</strong>
          </div>
          <div>
            <span>画心开口</span>
            <strong>
              {state.frameType === 'full-bleed'
                ? '满版'
                : `${preset.windowWidthMm}×${preset.windowHeightMm}mm`}
            </strong>
          </div>
          <div>
            <span>印刷分辨率 (300DPI)</span>
            <strong>{printPixelsW} × {printPixelsH}px</strong>
          </div>
        </div>

        <div className="size-note">
          <strong>{preset.label}</strong>
          {preset.description}
        </div>
      </section>

      {/* 3. 底部手写签名与印记 (仅在拍立得相框模式呈现) */}
      {state.frameType !== 'full-bleed' && activeSide === 'front' && (
        <section className="panel-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">SIGNATURE</span>
              <h2>留白手写签名</h2>
            </div>
          </div>

          <div className="signature-input-group">
            <input
              type="text"
              placeholder="在此输入签名或寄语 (如: Goods-Tools)"
              value={state.signature.text}
              maxLength={24}
              onChange={(e) =>
                onChangeState((curr) => ({
                  ...curr,
                  signature: { ...curr.signature, text: e.target.value },
                }))
              }
              className="signature-text-input"
            />

            {/* 字体风格选择 */}
            <div className="signature-font-bar">
              <button
                type="button"
                className={`font-tab ${state.signature.font === 'handwritten' ? 'is-active' : ''}`}
                onClick={() =>
                  onChangeState((curr) => ({
                    ...curr,
                    signature: { ...curr.signature, font: 'handwritten' },
                  }))
                }
              >
                ✍️ 艺术手写体
              </button>
              <button
                type="button"
                className={`font-tab ${state.signature.font !== 'handwritten' ? 'is-active' : ''}`}
                onClick={() =>
                  onChangeState((curr) => ({
                    ...curr,
                    signature: { ...curr.signature, font: 'sans-serif' },
                  }))
                }
              >
                🔤 现代无衬线
              </button>
            </div>

            {/* 笔迹颜色与日期戳 */}
            <div className="signature-color-bar">
              {SIGNATURE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  style={{ backgroundColor: c.value }}
                  className={`color-dot ${state.signature.color === c.value ? 'is-active' : ''}`}
                  title={c.label}
                  onClick={() =>
                    onChangeState((curr) => ({
                      ...curr,
                      signature: { ...curr.signature, color: c.value },
                    }))
                  }
                />
              ))}
              <label className="date-toggle-label">
                <input
                  type="checkbox"
                  checked={state.signature.showDate}
                  onChange={(e) =>
                    onChangeState((curr) => ({
                      ...curr,
                      signature: { ...curr.signature, showDate: e.target.checked },
                    }))
                  }
                />
                显示日期戳
              </label>
            </div>
          </div>
        </section>
      )}

      {/* 4. 小卡专属材质与覆膜 (7 纸张底材 + 6 光学覆膜) */}
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">FINISH & CRAFT</span>
            <h2>小卡材质与覆膜</h2>
          </div>
        </div>

        <span className="control-label">卡纸底材 (纸张材质)</span>
        <div className="craft-options craft-grid">
          {BASE_CRAFTS.map((craft) => (
            <button
              key={craft.id}
              type="button"
              className={state.baseCraft === craft.id ? 'is-selected' : ''}
              onClick={() => onChangeState((curr) => ({ ...curr, baseCraft: craft.id }))}
            >
              <span className={`craft-swatch ${craft.id}`} aria-hidden="true" />
              <span>{craft.label}</span>
            </button>
          ))}
        </div>

        <span className="control-label craft-sub-label">表面覆膜 (光学特效膜)</span>
        <div className="craft-options craft-grid">
          {FILM_CRAFTS.map((craft) => (
            <button
              key={craft.id}
              type="button"
              className={state.filmCraft === craft.id ? 'is-selected' : ''}
              onClick={() => onChangeState((curr) => ({ ...curr, filmCraft: craft.id }))}
            >
              <span className={`craft-swatch ${craft.id}`} aria-hidden="true" />
              <span>{craft.label}</span>
            </button>
          ))}
        </div>

        <div className="craft-hint">
          💡 <strong>小卡工艺推荐</strong>：珠光贝母卡纸 + 高透相纸亮膜（还原真实洗印），或碎玻璃 / 十字星芒镭射膜打造闪耀效果。
        </div>
      </section>

      {/* 5. 导出 */}
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
            onClick={() => onRequestExportPrint(activeSide)}
          >
            <FileOutput size={18} aria-hidden="true" />
            {activeSide === 'front' ? '正面制作图' : '背面制作图'}
            <span>{printPixelsW}×{printPixelsH}px</span>
          </button>
        </div>
      </section>
    </aside>
  )
}
