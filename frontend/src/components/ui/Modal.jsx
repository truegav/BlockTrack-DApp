import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button.jsx';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size,
  closeOnBackdrop = true,
  hideClose = false,
  className = '',
}) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event) => {
      event.preventDefault();
      onCloseRef.current?.();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, []);

  const handleBackdrop = (event) => {
    if (!closeOnBackdrop) return;
    if (event.target === ref.current) onCloseRef.current?.();
  };

  return (
    <dialog
      ref={ref}
      className={`dialog ${size ? `dialog--${size}` : ''} ${className}`.trim()}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      onClick={handleBackdrop}
    >
      {title ? (
        <div className="dialog__header">
          <div className="dialog__heading">
            <h2 className="dialog__title" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="dialog__desc" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          {!hideClose ? (
            <button
              type="button"
              className="icon-btn"
              aria-label="Close dialog"
              onClick={() => onCloseRef.current?.()}
            >
              <X size={17} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="dialog__body">{children}</div>
      {footer ? <div className="dialog__footer">{footer}</div> : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading = false,
  children,
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      closeOnBackdrop={!loading}
      hideClose={loading}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
