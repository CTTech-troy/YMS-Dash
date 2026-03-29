const REMOTE = 'https://yms-backend-a2x4.onrender.com';

function trimBase(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

const raw = trimBase(import.meta.env.VITE_API_URL);
export const API_BASE = raw || (import.meta.env.DEV ? '' : REMOTE);
