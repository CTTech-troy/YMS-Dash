import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import StudentDashboard from './StudentDashboard';
import { API_BASE } from '../../config/api.js';

async function fetchNormalizedResults(studentUid) {
  const resultsResp = await fetch(
    `${API_BASE}/api/results?studentUid=${encodeURIComponent(studentUid)}`
  );
  if (!resultsResp.ok) return [];
  const resultsData = await resultsResp.json().catch(() => null);
  const rawResults = Array.isArray(resultsData)
    ? resultsData
    : resultsData?.data || resultsData?.results || [];
  return rawResults.map((r) => ({
    studentName: (r.studentName || r.name || 'Unknown').trim(),
    studentClass: (r.studentClass || r.class || 'N/A').trim(),
    studentUid: r.studentUid || r.uid,
    subjects: Array.isArray(r.subjects) ? r.subjects : [],
    ...r
  }));
}

function pictureToSrc(p) {
  if (!p) return '/images/default-avatar.png';
  if (typeof p === 'string') return p;
  if (p?.mime && p?.data) return `data:${p.mime};base64,${p.data}`;
  return '/images/default-avatar.png';
}

const ResultChecker = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'student') {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const uid = currentUser.uid;
        const key = `yms_student_dashboard_${uid}`;
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.student && Array.isArray(parsed.allResults)) {
              if (!cancelled) {
                setPayload(parsed);
                setLoading(false);
              }
              return;
            }
          }
        } catch {
          /* continue */
        }

        const results = await fetchNormalizedResults(uid);
        const student = {
          uid,
          studentUid: uid,
          name: currentUser.name || uid,
          studentName: currentUser.name || uid,
          class: currentUser.class || currentUser.studentClass || '—',
          studentClass: currentUser.class || '—',
          picture: pictureToSrc(currentUser.picture),
          fees: currentUser.fees || { total: 0, paid: 0, pending: 0 }
        };
        const next = { student, allResults: results };
        if (!cancelled) {
          setPayload(next);
          try {
            localStorage.setItem(key, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser.role !== 'student') {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Loading your results…
      </div>
    );
  }

  if (!payload) {
    return <Navigate to="/login" replace />;
  }

  return (
    <StudentDashboard
      student={payload.student}
      results={payload.allResults}
      onLogout={() => {
        try {
          const uid = currentUser.uid;
          localStorage.removeItem(`yms_student_dashboard_${uid}`);
        } catch {
          /* ignore */
        }
        logout();
        navigate('/login', { replace: true });
      }}
    />
  );
};

export default ResultChecker;
