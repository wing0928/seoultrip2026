import { CircleCheck, RotateCcw, X } from 'lucide-react';

export default function UndoToast({ message, onUndo, onClose }) {
  if (!message) return null;

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <CircleCheck className="success-icon" size={20} aria-hidden="true" />
      <span>{message}</span>
      {onUndo && (
        <button type="button" onClick={onUndo}>
          <RotateCcw size={17} />
          復原
        </button>
      )}
      <button type="button" className="toast-close" onClick={onClose} aria-label="關閉通知">
        <X size={17} />
      </button>
    </div>
  );
}
