import axios from 'axios';

const REMOTE_API = 'https://yms-backend-a2x4.onrender.com';

function trimBase(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

const rawEnv = trimBase(import.meta.env.VITE_API_URL);
const API_BASE =
  rawEnv ||
  (import.meta.env.DEV ? '' : REMOTE_API);

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

function isLocalHostBase(url) {
  const s = trimBase(url);
  if (!s) return false;
  try {
    const u = new URL(s.includes('://') ? s : `http://${s}`);
    const h = (u.hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch {
    return /localhost|127\.0\.0\.1/i.test(s);
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const cfg = error?.config;
    if (!cfg || cfg.__ymsRemoteFallbackDone) {
      return Promise.reject(error);
    }
    const noResponse = !error?.response;
    const code = error?.code;
    const msg = String(error?.message || '');
    const isNetwork =
      noResponse &&
      (code === 'ERR_NETWORK' ||
        code === 'ECONNABORTED' ||
        msg.includes('Network Error') ||
        /ECONNREFUSED|Failed to fetch/i.test(msg));
    if (!isNetwork) {
      return Promise.reject(error);
    }
    const urlPath = String(cfg.url || '');
    if (urlPath.includes('/api/auth/staff')) {
      return Promise.reject(error);
    }
    const reqBase = cfg.baseURL != null ? cfg.baseURL : API_BASE;
    if (!isLocalHostBase(reqBase)) {
      return Promise.reject(error);
    }
    cfg.__ymsRemoteFallbackDone = true;
    cfg.baseURL = REMOTE_API;
    return api.request(cfg);
  }
);

export default api;
