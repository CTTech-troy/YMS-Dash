import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, title, onClose, children, className = '', size = 'lg' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW =
    size === 'sm'
      ? 'max-w-md'
      : size === 'md'
        ? 'max-w-lg'
        : size === 'xl'
          ? 'max-w-5xl'
          : 'max-w-4xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" aria-modal="true" role="dialog">
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 flex max-h-[min(92vh,900px)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-float)] ${maxW} ${className}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          {title ? (
            <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
