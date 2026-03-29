import React from 'react';

export function TableShell({ children, className = '' }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)] ${className}`}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function TableToolbar({ children, className = '' }) {
  return (
    <div
      className={`flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5 ${className}`}
    >
      {children}
    </div>
  );
}
