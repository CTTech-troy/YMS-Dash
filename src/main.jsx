import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Dev helper: ignore noisy "message channel closed" errors from browser extensions
if (import.meta.env.DEV) {
  // 1) Suppress unhandledrejection that originates from extensions
  window.addEventListener('unhandledrejection', (ev) => {
    try {
      const msg = ev?.reason?.message || (typeof ev?.reason === 'string' ? ev.reason : '');
      if (msg && /message channel closed/i.test(msg)) {
        // prevent the ugly console error while keeping other rejections visible
        ev.preventDefault();
        // keep a lightweight debug trace
        // console.debug('Ignored extension messaging rejection:', msg);
      }
    } catch (_) {
      // ignore
    }
  });

  // 2) Optionally filter console.error output so DevTools isn't spammed
  const _origConsoleError = console.error.bind(console);
  console.error = (...args) => {
    try {
      const joined = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      if (/message channel closed/i.test(joined)) {
        // ignore extension message-channel closed noise
        return;
      }
    } catch (_) {
      // ignore parsing problems and continue
    }
    _origConsoleError(...args);
  };
}
