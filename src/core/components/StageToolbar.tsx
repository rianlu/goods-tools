import {
  Eye,
  Layers,
  Lock,
  Maximize2,
  Pause,
  Play,
  Unlock,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { ViewMode } from '../types.ts'

type StageToolbarProps = {
  view: ViewMode
  onViewChange: (mode: ViewMode) => void
  viewOptions?: Array<{ id: ViewMode; label: string; icon?: React.ReactNode }>
  viewportZoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onZoomFit: () => void
  isLocked: boolean
  onToggleLock: () => void
  isAnimating: boolean
  onToggleAnimate: () => void
  extraActions?: React.ReactNode
}

export function StageToolbar({
  view,
  onViewChange,
  viewOptions = [
    { id: 'preview', label: '成品效果', icon: <Eye size={16} /> },
    { id: 'print', label: '包边预览', icon: <Layers size={16} /> },
  ],
  viewportZoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
  isLocked,
  onToggleLock,
  isAnimating,
  onToggleAnimate,
  extraActions,
}: StageToolbarProps) {
  return (
    <div className="stage-toolbar">
      <div className="view-switcher" role="tablist" aria-label="工作台视图">
        {viewOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={view === opt.id ? 'is-active' : ''}
            role="tab"
            aria-selected={view === opt.id}
            onClick={() => onViewChange(opt.id)}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      <div className="stage-actions">
        {extraActions}

        {/* 视口比例尺 (50%~250%) */}
        <div className="viewport-zoom-group" aria-label="视口缩放控制">
          <button
            type="button"
            onClick={onZoomOut}
            title="缩小视口 (-25%)"
            aria-label="缩小视口"
            disabled={viewportZoom <= 0.5}
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            className="zoom-readout-btn"
            title="点击重置为 100% 视口"
            aria-label={`当前视口倍率 ${Math.round(viewportZoom * 100)}%，点击重置`}
          >
            {Math.round(viewportZoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            title="放大视口 (+25%)"
            aria-label="放大视口"
            disabled={viewportZoom >= 2.5}
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={onZoomFit}
            className="zoom-fit-btn"
            title="适应视口"
            aria-label="适应视口"
          >
            <Maximize2 size={13} />
            适应
          </button>
        </div>

        {/* 构图锁定按钮 */}
        <button
          type="button"
          className={`icon-button ${isLocked ? 'is-active' : ''}`}
          onClick={onToggleLock}
          aria-label={isLocked ? '解锁构图' : '锁定构图'}
          title={isLocked ? '点击解锁构图' : '点击锁定构图'}
        >
          {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
        </button>

        {/* 播放动画按钮 */}
        <button
          type="button"
          className={`icon-button ${isAnimating ? 'is-active' : ''}`}
          onClick={onToggleAnimate}
          aria-label={isAnimating ? '停止动态预览' : '开始动态预览'}
          title={isAnimating ? '停止动态预览' : '开始动态预览'}
        >
          {isAnimating ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>
    </div>
  )
}

