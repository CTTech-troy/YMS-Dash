import { API_BASE } from '../config/api.js';

export async function fetchPortalSettings() {
  const res = await fetch(`${API_BASE}/api/settings/portal`, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    return {
      studentResultAccessMode: 'both',
      scratchCardLoginEnabled: true,
      hasStudentPortalPassword: false
    };
  }
  const j = await res.json().catch(() => ({}));
  return {
    studentResultAccessMode: j.studentResultAccessMode || 'both',
    scratchCardLoginEnabled: j.scratchCardLoginEnabled !== false,
    hasStudentPortalPassword: j.hasStudentPortalPassword === true
  };
}

export async function lookupStudentByNumber(studentNumber) {
  const q = encodeURIComponent(String(studentNumber).trim());
  const res = await fetch(`${API_BASE}/api/students/lookup?number=${q}`, { headers: { Accept: 'application/json' } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = j.message || (res.status === 404 ? 'Student record not found' : 'Lookup failed');
    return { success: false, message: msg };
  }
  return { success: true, student: j.student };
}

export async function loginStudentPassword(studentNumber, password) {
  const res = await fetch(`${API_BASE}/api/auth/student/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ studentNumber: String(studentNumber).trim(), password })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, message: j.message || 'Login failed' };
  }
  return { success: true, student: j.student };
}

export async function loginStudentScratch(studentNumber, pin) {
  const res = await fetch(`${API_BASE}/api/auth/student/scratch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ studentNumber: String(studentNumber).trim(), pin: String(pin).trim() })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, message: j.message || 'Login failed' };
  }
  return { success: true, student: j.student };
}

export async function updatePortalSettings(payload) {
  const res = await fetch(`${API_BASE}/api/settings/portal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || 'Failed to save settings');
  }
  return res.json();
}
