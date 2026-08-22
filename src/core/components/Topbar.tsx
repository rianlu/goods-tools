import { ShieldCheck } from 'lucide-react'
import type { StudioId } from '../types.ts'

export type StudioNavOption = {
  id: StudioId
  label: string
  icon: string
  badge?: string
}

export const STUDIOS: StudioNavOption[] = [
  { id: 'badge', label: '马口铁吧唧', icon: '🧷' },
  { id: 'photocard', label: '拍立得 / 小卡', icon: '📸', badge: 'NEW' },
]

type TopbarProps = {
  activeStudio: StudioId
  onSelectStudio: (id: StudioId) => void
}

export function Topbar({ activeStudio, onSelectStudio }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            G
          </div>
          <div>
            <strong>谷子Tools</strong>
            <span>周边效果模拟与打样工具箱</span>
          </div>
        </div>

        {/* 品类切换导航栏 (Studio Switcher) */}
        <nav className="studio-switcher" aria-label="周边品类切换">
          {STUDIOS.map((studio) => {
            const isActive = activeStudio === studio.id
            return (
              <button
                key={studio.id}
                type="button"
                className={`studio-tab ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() => onSelectStudio(studio.id)}
              >
                <span className="studio-icon">{studio.icon}</span>
                <span className="studio-label">{studio.label}</span>
                {studio.badge && <span className="studio-badge">{studio.badge}</span>}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="local-badge" title="图片数据纯本地内存处理，零上云">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>图片仅本地处理</span>
      </div>
    </header>
  )
}

