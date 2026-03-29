import React from 'react';

export function Card({ children, className = '', padding = true }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)] ${padding ? 'p-5 sm:p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {title && <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>}
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
