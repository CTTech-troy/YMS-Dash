import React from 'react';

export function Label({ children, htmlFor, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={`mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500 ${className}`}>
      {children}
    </label>
  );
}

export function SelectInput({ className = '', children, ...rest }) {
  return (
    <select
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function TextInput({ className = '', ...rest }) {
  return (
    <input
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${className}`}
      {...rest}
    />
  );
}
