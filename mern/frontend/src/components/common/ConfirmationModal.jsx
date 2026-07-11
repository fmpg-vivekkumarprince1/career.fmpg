import { useEffect, useId } from 'react';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "bg-red-600 hover:bg-red-700 text-white",
  cancelButtonClass = "fmpg-secondary-button",
  icon = null,
  type = "danger" // danger, warning, info, success
}) => {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIconByType = () => {
    switch (type) {
      case 'danger':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="ui-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ui-modal-panel max-w-md" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        {/* Modal Header */}
        <div className="p-6 pb-4">
          <div>
            <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${type === 'danger' ? 'bg-rose-50 text-rose-600' : type === 'warning' ? 'bg-amber-50 text-amber-600' : type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
              {icon || getIconByType()}
            </div>
            <h3 id={titleId} className="text-xl font-bold text-slate-900 mb-2">
              {title}
            </h3>
            <p id={descriptionId} className="text-slate-600 text-sm leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col-reverse gap-3 p-6 pt-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className={`min-h-11 px-5 py-2.5 rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 ${cancelButtonClass}`}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`min-h-11 px-5 py-2.5 rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-rose-300 ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
