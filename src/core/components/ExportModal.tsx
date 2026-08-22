import { Download, FileOutput, X } from 'lucide-react'
import { useEffect } from 'react'
import type { ExportSpec } from '../types.ts'

type ExportModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  spec: ExportSpec
}

export function ExportModal({ isOpen, onClose, onConfirm, spec }: ExportModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">
              <FileOutput size={18} />
            </span>
            <h3 id="confirm-export-title">{spec.title}</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="关闭弹窗"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">{spec.description}</p>

          <div className="modal-spec-card">
            {spec.specRows.map((row, idx) => (
              <div key={idx} className="spec-row">
                <span className="spec-name">{row.name}</span>
                <span className={`spec-val ${row.highlight ? 'highlight' : ''}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-cancel-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="modal-confirm-btn" onClick={onConfirm}>
            <Download size={16} />
            {spec.confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  )
}

