/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = localStorage.getItem('schoolUser');
        if (saved && mounted) {
          try {
            const parsed = JSON.parse(saved);
            setCurrentUser(parsed);
            setUserRole(parsed?.role ?? null);
          } catch {
            /* ignore */
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const login = async (uid, password) => {
    try {
      const { data: row } = await api.post('/api/auth/staff/login', {
        uid: String(uid || '').trim(),
        password: password ?? ''
      });

      if (!row || row.ok !== true) {
        const msg = row?.message || 'Login failed';
        return { success: false, message: msg };
      }

      const role = row.role === 'admin' ? 'admin' : 'teacher';
      const loggedIn = {
        id: row.id,
        name: row.name,
        uid: row.uid,
        role,
        avatar: row.avatar ?? null
      };

      setCurrentUser(loggedIn);
      setUserRole(role);
      localStorage.setItem('schoolUser', JSON.stringify(loggedIn));
      return { success: true, user: loggedIn };
    } catch (err) {
      const body = err?.response?.data;
      const msg =
        body?.message ||
        (typeof body === 'string' ? body : null) ||
        err?.message ||
        'Failed to login. Try again.';
      if (err?.response?.status === 404) {
        return { success: false, message: body?.message || 'UID not found' };
      }
      if (err?.response?.status === 401) {
        return { success: false, message: body?.message || 'Incorrect password' };
      }
      if (err?.response?.status === 403) {
        return { success: false, message: body?.message || 'Access denied' };
      }
      console.error('Login error:', err);
      return { success: false, message: msg };
    }
  };

  const studentLogin = (studentPayload = {}) => {
    try {
      const uid = studentPayload.uid || studentPayload.studentUid;
      if (!uid) {
        return { success: false, message: 'Invalid student session' };
      }

      const loggedInStudent = {
        id: studentPayload.id || uid,
        name: studentPayload.name || studentPayload.studentName || uid,
        studentName: studentPayload.name || uid,
        uid,
        role: 'student',
        class: studentPayload.class || studentPayload.studentClass || null,
        studentClass: studentPayload.class || null,
        linNumber: studentPayload.linNumber || null,
        picture: studentPayload.picture || null,
        fees: studentPayload.fees || { total: 0, paid: 0, pending: 0 }
      };

      setCurrentUser(loggedInStudent);
      setUserRole('student');
      localStorage.setItem('schoolUser', JSON.stringify(loggedInStudent));
      return { success: true, user: loggedInStudent };
    } catch (err) {
      console.error('Student login error:', err);
      return { success: false, message: 'Failed to login. Try again.' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setUserRole(null);
    localStorage.removeItem('schoolUser');
    if (isSupabaseConfigured) {
      supabase.auth.signOut().catch(() => {});
    }
  };

  const updateUserFields = (fields = {}) => {
    try {
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, ...fields };
        try {
          localStorage.setItem('schoolUser', JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        return updated;
      });
    } catch (e) {
      console.error('Failed to update user fields', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userRole,
        login,
        studentLogin,
        logout,
        updateUserFields,
        loading
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

const AppContext = createContext(null);

export const AppProvider = ({ children, user }) => {
  const [data, setData] = useState({
    students: [],
    results: [],
    subjects: [],
    loading: !!user,
    error: null,
    ts: null
  });

  const cacheKey = user ? `yms_app_cache_${user.uid || user.id}` : 'yms_app_cache_anon';

  const saveCache = (payload) => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  };
  const loadCache = () => {
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const clearCache = () => {
    try {
      localStorage.removeItem(cacheKey);
    } catch {
      /* ignore */
    }
  };

  const loadAll = useCallback(async (opts = { force: false }) => {
    if (!user) return;
    if (!opts.force) {
      const cached = loadCache();
      if (cached && cached.ts) {
        setData({ ...cached, loading: false, error: null });
      }
    }

    setData((d) => ({ ...d, loading: true, error: null }));
    try {
      const fetchAllStudents = async () => {
        const acc = [];
        let startAfter = null;
        for (;;) {
          const params = { limit: 5000 };
          if (startAfter) params.startAfter = startAfter;
          const res = await api.get('/api/students/all', { params });
          const body = res.data || {};
          const chunk = Array.isArray(body.data) ? body.data : [];
          acc.push(...chunk);
          if (!body.hasMore || !body.nextPageToken) break;
          startAfter = body.nextPageToken;
        }
        return acc;
      };

      const [students, rRes, subRes] = await Promise.all([
        fetchAllStudents(),
        api.get('/api/results'),
        api.get('/api/subjects')
      ]);
      const results = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.results || rRes.data?.data || []);
      const subjects = Array.isArray(subRes.data) ? subRes.data : (subRes.data?.subjects || subRes.data?.data || []);

      const payload = { students, results, subjects, loading: false, error: null, ts: Date.now() };
      setData(payload);
      saveCache(payload);
      return payload;
    } catch (err) {
      console.error('AppProvider.loadAll error', err);
      setData((d) => ({ ...d, loading: false, error: err }));
      return null;
    }
  }, [user, cacheKey]);

  useEffect(() => {
    if (!user) {
      setData({ students: [], results: [], subjects: [], loading: false, error: null, ts: null });
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('yms_app_cache_')) localStorage.removeItem(k);
        });
      } catch {
        /* ignore */
      }
      return;
    }
    loadAll({ force: false });
  }, [user, loadAll]);

  return (
    <AppContext.Provider
      value={{
        ...data,
        reload: () => loadAll({ force: true }),
        clearCache
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppData = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppData must be used inside AppProvider');
  return ctx;
};
