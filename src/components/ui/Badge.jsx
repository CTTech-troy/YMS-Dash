const variants = {
  default: 'bg-slate-100 text-slate-700 ring-slate-200/80',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200/60',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200/60',
  danger: 'bg-rose-50 text-rose-800 ring-rose-200/60',
  info: 'bg-sky-50 text-sky-800 ring-sky-200/60',
  indigo: 'bg-indigo-50 text-indigo-800 ring-indigo-200/60'
};

export function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${variants[variant] || variants.default} ${className}`}
    >
      {children}
    </span>
  );
}
