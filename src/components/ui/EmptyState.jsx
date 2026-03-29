import React from 'react';

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <Icon className="h-7 w-7 text-slate-400" aria-hidden />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
