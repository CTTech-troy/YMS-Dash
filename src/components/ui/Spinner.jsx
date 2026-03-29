import React from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ className = '', label = 'Loading' }) {
  return (
    <span className={`inline-flex items-center gap-2 text-slate-500 ${className}`} role="status" aria-label={label}>
      <Loader2 className="h-5 w-5 animate-spin text-indigo-500" aria-hidden />
    </span>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-500" aria-hidden />
      <p className="text-sm font-medium">Loading…</p>
    </div>
  );
}
