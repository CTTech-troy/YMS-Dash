import React from 'react';

export function PageHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
