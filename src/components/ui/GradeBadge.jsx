import React from 'react';

const tone = (grade) => {
  const g = String(grade || '').toUpperCase();
  if (g === 'A+' || g === 'A') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/60';
  if (g === 'B') return 'bg-sky-50 text-sky-800 ring-sky-200/60';
  if (g === 'C') return 'bg-amber-50 text-amber-900 ring-amber-200/60';
  if (g === 'D' || g === 'E') return 'bg-orange-50 text-orange-900 ring-orange-200/60';
  return 'bg-slate-100 text-slate-700 ring-slate-200/80';
};

export function GradeBadge({ grade, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone(grade)} ${className}`}
    >
      {grade || '—'}
    </span>
  );
}
