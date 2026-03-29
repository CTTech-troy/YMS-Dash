import React from 'react';

const variants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
  danger: 'bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100'
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-5 py-2.5 text-sm rounded-xl'
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
