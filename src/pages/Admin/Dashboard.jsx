// src/pages/Admin/Dashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { UserIcon, UsersIcon, BookOpenIcon, ClipboardListIcon, CreditCardIcon, BellIcon, CalendarIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AdminDashboard = () => {
  // hydrate from last-session snapshot for instant UI
  const _cachedSnapshot = (() => {
    try { return JSON.parse(sessionStorage.getItem('dashboardData') || 'null'); } catch { return null; }
  })();
  const [events, setEvents] = useState(() => _cachedSnapshot?.events ?? []);
  const [eventsLoading, setEventsLoading] = useState(() => (_cachedSnapshot ? false : true));
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    description: '',
    forTeachers: true
  });
  // runtime stats
  const [teachersCount, setTeachersCount] = useState(() => _cachedSnapshot?.teachersCount ?? null);
  const [studentsCount, setStudentsCount] = useState(() => _cachedSnapshot?.studentsCount ?? null);
  const [classesMap, setClassesMap] = useState(() => _cachedSnapshot?.classesMap ?? {}); // { className: count }
  const [studentIssues, setStudentIssues] = useState(() => _cachedSnapshot?.studentIssues ?? []); // students with missing fields
  const [notifications, setNotifications] = useState(() => _cachedSnapshot?.notifications ?? []); // notifications state
  const [notificationsError, setNotificationsError] = useState(null);
  const [deletingId, setDeletingId] = useState(null); // id of event being deleted
  const [resultsList, setResultsList] = useState(() => _cachedSnapshot?.results ?? []);
  const [resultsCount, setResultsCount] = useState(() => _cachedSnapshot?.resultsCount ?? null);

  // Loading state for teacher/student/class related UI
  const [statsLoading, setStatsLoading] = useState(() => (_cachedSnapshot ? false : true));
  // show heavy lists a tick after first paint to prioritize stats rendering
  const [showHeavyLists, setShowHeavyLists] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowHeavyLists(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Build student issues: returns array of { uid, name, problem, raw }
  const buildStudentIssues = (students) => {
    const issues = [];
    if (!Array.isArray(students)) return issues;
    students.forEach((st) => {
      const uid = st.uid || st.studentId || st.id || st._id || null;
      const name = st.name || st.fullName || `${st.firstName || ''} ${st.lastName || ''}`.trim() || null;
      const email = st.email || st.emailAddress || st.contactEmail || null;
      const cls = (st.class || st.className || st.classroom || st.grade || st.class_group || st.classNameRaw || '').toString().trim() || null;

      const missing = [];
      if (!name) missing.push('missing name');
      if (!email) missing.push('missing email');
      if (!cls) missing.push('no class assigned');

      missing.forEach(m => {
        issues.push({
          uid: uid || `YMS-UNKNOWN-${String(st._id || st.id || Math.random()).slice(0,8)}`,
          name,
          problem: m,
          raw: st
        });
      });
    });
    return issues;
  };

  // track previous notifications and reload once per session when notifications first appear
  const prevNotificationsCountRef = useRef(0);
  const checkAndReloadForNotifications = (formatted) => {
    try {
      const count = Array.isArray(formatted) ? formatted.length : 0;
      const alreadyReloaded = sessionStorage.getItem('reloadedForNotifications') === '1';
      if (count > 0 && !alreadyReloaded && prevNotificationsCountRef.current === 0) {
        sessionStorage.setItem('reloadedForNotifications', '1');
        setTimeout(() => window.location.reload(), 50);
      }
      prevNotificationsCountRef.current = count;
    } catch (e) {
      // ignore
    }
  };

  // detect notification variant to colour the bell icon
  const detectNotificationVariant = (n) => {
    if (!n) return 'default';
    const text = ((n.title || n.message || n.body || n.text || '') + '').toLowerCase();
    const action = ((n.action || n.type || n.event || n.kind) + '').toLowerCase();
    const status = ((n.status || n.success || '') + '').toLowerCase();

    // explicit status checks first
    if (/failed|error|unsuccessful|not sent|not delivered/.test(status) || /fail|failed|error|unsuccessful|not sent|not delivered/.test(text + ' ' + action)) return 'failed';
    if (/delete|removed|deleted|remove/.test(action) || /delete|removed|deleted|remove/.test(text)) return 'delete';
    if (/create|created|added|new|joined|registered/.test(action) || /create|created|added|new|joined|registered/.test(text)) return 'create';

    // fallback based on boolean-ish status
    if (status === 'false' || status === '0') return 'failed';
    if (status === 'true' || status === '1' || status === 'ok' || status === 'success') {
      if (/create|created|added|new/.test(text + ' ' + action)) return 'create';
      return 'default';
    }
    return 'default';
  };

  // Fetch events / teachers / students / notifications in parallel (single, fast load)
  useEffect(() => {
    const ac = new AbortController();
    const signal = ac.signal;

    const formatDateTime = (ts) => {
      if (!ts) return '';
      if (ts && typeof ts.toDate === 'function') {
        try { return ts.toDate().toLocaleString(); } catch (e) { /* ignore */ }
      }
      if (typeof ts === 'number') {
        const ms = ts < 1e12 ? ts * 1000 : ts;
        return new Date(ms).toLocaleString();
      }
      const parsed = new Date(ts);
      if (!isNaN(parsed)) return parsed.toLocaleString();
      return '';
    };

    const findFirstArray = (obj, depth = 0) => {
      if (!obj || depth > 4) return null;
      if (Array.isArray(obj)) return obj;
      if (typeof obj !== 'object') return null;
      for (const v of Object.values(obj)) {
        if (Array.isArray(v)) return v;
      }
      for (const v of Object.values(obj)) {
        const found = findFirstArray(v, depth + 1);
        if (found) return found;
      }
      return null;
    };

    const normalizeArray = (payload) => {
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.teachers)) return payload.teachers;
      if (Array.isArray(payload.students)) return payload.students;
      if (Array.isArray(payload.data)) return payload.data;
      const found = findFirstArray(payload);
      return found || [];
    };

    const loadAll = async () => {
      setEventsLoading(true);
      setNotificationsError(null);
      // ensure we ask backend for total student count
      try {
        const raw = sessionStorage.getItem('dashboardData');
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached) {
            if (Array.isArray(cached.events)) setEvents(cached.events);
            if (typeof cached.teachersCount === 'number') setTeachersCount(cached.teachersCount);
            if (typeof cached.studentsCount === 'number') setStudentsCount(cached.studentsCount);
            if (cached.classesMap && typeof cached.classesMap === 'object') setClassesMap(cached.classesMap);
            if (Array.isArray(cached.studentIssues)) setStudentIssues(cached.studentIssues);
            if (Array.isArray(cached.notifications)) setNotifications(cached.notifications);
            if (Array.isArray(cached.results)) setResultsList(cached.results);
            if (typeof cached.resultsCount === 'number') setResultsCount(cached.resultsCount);
            // show UI immediately from cache, but still continue to refresh below
            setStatsLoading(false);
            setEventsLoading(false);
          }
        }
      } catch (e) {
        // ignore cache parse errors
      }

      try {
        // include students count and also fetch results
        const [eventsRes, tRes, sRes, nRes, rRes] = await Promise.all([
          fetch(`${API_BASE}/api/events`, { signal }),
          fetch(`${API_BASE}/api/teachers`, { signal }),
          fetch(`${API_BASE}/api/students?includeTotal=1`, { signal }), // request totalCount
          fetch(`${API_BASE}/api/notifications`, { signal }),
          fetch(`${API_BASE}/api/results`, { signal })
        ]);

        const [eventsJson, tJson, sJson, nJson, rJson] = await Promise.all([
          eventsRes.ok ? eventsRes.json().catch(() => []) : [],
          tRes.ok ? tRes.json().catch(() => null) : null,
          sRes.ok ? sRes.json().catch(() => null) : null,
          nRes.ok ? nRes.json().catch(() => []) : [],
          rRes.ok ? rRes.json().catch(() => []) : []
        ]);

        // events
        setEvents(Array.isArray(eventsJson) ? eventsJson : (eventsJson && Array.isArray(eventsJson.data) ? eventsJson.data : []));

        // teachers & students
        const teachers = normalizeArray(tJson);
        const students = normalizeArray(sJson);
        setTeachersCount(teachers.length);
        // prefer server-provided totalCount when available
        if (sJson && (typeof sJson.totalCount === 'number')) {
          setStudentsCount(sJson.totalCount);
        } else {
          setStudentsCount(students.length);
        }

        // compute classes map and student issues once (use helper)
        const map = {};
        students.forEach((st) => {
          const cls = (st.class || st.className || st.classroom || st.grade || st.class_group || st.classNameRaw || '').toString().trim();
          if (cls) map[cls] = (map[cls] || 0) + 1;
        });
        setClassesMap(map);
        setStudentIssues(buildStudentIssues(students));
        setStatsLoading(false);

        // results (show count + recent list)
        const resultsArray = Array.isArray(rJson) ? rJson : (Array.isArray(rJson.data) ? rJson.data : []);
        setResultsList(resultsArray);
        setResultsCount(resultsArray.length);

        // notifications
        const notificationsArray = Array.isArray(nJson) ? nJson : (Array.isArray(nJson.data) ? nJson.data : []);
        // map notifications in chunks / idle time so first paint is not blocked
        chunkedMap(notificationsArray, (n) => {
          const id = n.id || n._id || n.uid || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
          const title = n.title || n.subject || n.heading || 'Notification';
          const message = n.message || n.body || n.text || (n.payload && n.payload.message) || 'No message provided';
          const rawTimestamp = n.createdAt ?? n.timestamp ?? n.time ?? n.date ?? n.created_at ?? null;
          const variant = detectNotificationVariant(n);
          return {
            id,
            title,
            message,
            time: rawTimestamp ? formatDateTime(rawTimestamp) : (n.time || 'Just now'),
            raw: n,
            read: Boolean(n.read || n.isRead || n.read_at),
            variant
          };
        }, { chunkSize: 150 }).then((formatted) => {
          formatted.sort((a, b) => {
            const aT = new Date(a.raw.createdAt ?? a.raw.timestamp ?? a.raw.time ?? a.time).getTime() || 0;
            const bT = new Date(b.raw.createdAt ?? b.raw.timestamp ?? b.raw.time ?? b.time).getTime() || 0;
            return bT - aT;
          });
          setNotifications(formatted);
          checkAndReloadForNotifications(formatted);
        }).catch(() => {
          // fallback quick sync map on failure
          const fallback = notificationsArray.map(n => ({ id: n.id || n._id, title: n.title || 'Notification', message: n.message || n.body || '', time: formatDateTime(n.createdAt) || 'Just now', raw: n, read: !!(n.read), variant: detectNotificationVariant(n) }));
          setNotifications(fallback);
          checkAndReloadForNotifications(fallback);
        });

        // Persist a lightweight snapshot to sessionStorage for faster next load
        try {
          const snapshot = {
            events: Array.isArray(eventsJson) ? eventsJson : (eventsJson && Array.isArray(eventsJson.data) ? eventsJson.data : []),
            teachersCount: Array.isArray(teachers) ? teachers.length : (teachers?.length ?? null),
            studentsCount: typeof sJson?.totalCount === 'number' ? sJson.totalCount : (Array.isArray(students) ? students.length : (students?.length ?? null)),
            classesMap: map,
            studentIssues: buildStudentIssues(students),
            notifications: notifications,
            results: resultsArray,
            resultsCount: resultsArray.length
          };
          sessionStorage.setItem('dashboardData', JSON.stringify(snapshot));
        } catch (e) {
          // ignore storage errors (e.g. quota)
        }

      } catch (err) {
        if (err && err.name === 'AbortError') return;
        console.error('Fast load failed:', err);
        setEvents([]);
        setTeachersCount(null);
        setStudentsCount(null);
        setClassesMap({});
        setStudentIssues([]);
        setNotifications([]);
        setNotificationsError(err?.message || 'Failed to load data');
      } finally {
        setEventsLoading(false);
      }
    };

    loadAll();
    return () => { ac.abort(); };
  }, []);

  // Refresh notifications periodically (best-effort; now every second)
  useEffect(() => {
    const ac = new AbortController();
    const signal = ac.signal;
    let isFetching = false; // prevent overlapping requests

    const formatDateTime = (ts) => {
      if (!ts) return '';
      if (ts && typeof ts.toDate === 'function') {
        try { return ts.toDate().toLocaleString(); } catch (e) {}
      }
      if (typeof ts === 'number') {
        const ms = ts < 1e12 ? ts * 1000 : ts;
        return new Date(ms).toLocaleString();
      }
      const parsed = new Date(ts);
      if (!isNaN(parsed)) return parsed.toLocaleString();
      return '';
    };

    const normalizeArray = (payload) => {
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.data)) return payload.data;
      for (const k of ['notifications', 'items', 'results', 'list']) {
        if (Array.isArray(payload[k])) return payload[k];
      }
      for (const v of Object.values(payload)) {
        if (Array.isArray(v)) return v;
      }
      return [];
    };

    const fetchAndSet = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        const res = await fetch(`${API_BASE}/api/notifications`, { signal });
        if (!res.ok) {
          setNotifications([]);
          return;
        }
        const data = await res.json().catch(() => []);
        const arr = normalizeArray(data);
        const formatted = arr.map((n) => {
          const id = n.id || n._id || n.uid || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
          const title = n.title || n.subject || n.heading || 'Notification';
          const message = n.message || n.body || n.text || (n.payload && n.payload.message) || 'No message provided';
          const rawTimestamp = n.createdAt ?? n.timestamp ?? n.time ?? n.date ?? n.created_at ?? null;
          const variant = detectNotificationVariant(n);
          return {
            id,
            title,
            message,
            time: rawTimestamp ? formatDateTime(rawTimestamp) : (n.time || 'Just now'),
            raw: n,
            read: Boolean(n.read || n.isRead || n.read_at),
            variant
          };
        });
        formatted.sort((a, b) => {
          const aT = new Date(a.raw.createdAt ?? a.raw.timestamp ?? a.raw.time ?? a.time).getTime() || 0;
          const bT = new Date(b.raw.createdAt ?? b.raw.timestamp ?? b.raw.time ?? b.time).getTime() || 0;
          return bT - aT;
        });
        // set notifications asynchronously so JSON parsing / mapping yields to the browser first
        setTimeout(() => {
          setNotifications((prev) => {
            if (prev.length === formatted.length && prev.every((p, i) => p.id === formatted[i].id && p.read === formatted[i].read)) return prev;
            return formatted;
          });
          checkAndReloadForNotifications(formatted);
        }, 0);
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        console.error('Failed to fetch notifications', err);
        setNotifications([]);
      } finally {
        isFetching = false;
      }
    };

    // initial fetch then periodic refresh every 1s
    fetchAndSet();
    const t = setInterval(fetchAndSet, 10000); // poll every 10s (less pressure)
    return () => {
      ac.abort();
      clearInterval(t);
    };
  }, []);

  // compute stats memoized to avoid recreating on every render
  const stats = React.useMemo(() => ([
    { name: 'Total Teachers', value: teachersCount ?? '…', icon: <UserIcon className="h-6 w-6" />, color: 'bg-blue-500' },
    { name: 'Total Students', value: studentsCount ?? '…', icon: <UsersIcon className="h-6 w-6" />, color: 'bg-green-500' },
    { name: 'Total Classes', value: Object.keys(classesMap).length ?? '…', icon: <BookOpenIcon className="h-6 w-6" />, color: 'bg-yellow-500' },
    { name: 'Published Results', value: resultsCount ?? '…', icon: <ClipboardListIcon className="h-6 w-6" />, color: 'bg-purple-500' }
  ]), [teachersCount, studentsCount, classesMap, resultsCount]);

  // Fetch events from API
  useEffect(() => {
    setEventsLoading(true);
    fetch(`${API_BASE}/api/events`)
      .then(res => res.json())
      .then(data => {
        setEvents(Array.isArray(data) ? data : []);
        setEventsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch events", err);
        setEvents([]);
        setEventsLoading(false);
      });
  }, []);
  // Note: single consolidated fetch handles events/teachers/students/notifications above.
  // Removed duplicate events-only fetch to avoid conflicting requests


  // Fetch teachers and students, compute counts and unique classes (no repetition)
  useEffect(() => {
    let mounted = true;

    // Find the first array anywhere inside the response object (tolerant)
    const findFirstArray = (obj, depth = 0) => {
      if (!obj || depth > 4) return null;
      if (Array.isArray(obj)) return obj;
      if (typeof obj !== 'object') return null;
      for (const v of Object.values(obj)) {
        if (Array.isArray(v)) return v;
      }
      for (const v of Object.values(obj)) {
        const found = findFirstArray(v, depth + 1);
        if (found) return found;
      }
      return null;
    };

    const normalizeArray = (payload) => {
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.teachers)) return payload.teachers;
      if (Array.isArray(payload.students)) return payload.students;
      if (Array.isArray(payload.data)) return payload.data;
      if (Array.isArray(payload.data?.students)) return payload.data.students;
      // fallback: search recursively for the first array
      const found = findFirstArray(payload);
      return found || [];
    };

    const fetchData = async () => {
      try {
        const [tRes, sRes] = await Promise.all([
          fetch(`${API_BASE}/api/teachers`),
          fetch(`${API_BASE}/api/students`)
        ]);
        const tJson = await tRes.json().catch(() => null);
        const sJson = await sRes.json().catch(() => null);

        const teachers = normalizeArray(tJson);
        const students = normalizeArray(sJson);

        // debug if students exist but not shown
        if (import.meta.env.DEV) {
          console.debug('Teachers response (raw):', tJson);
          console.debug('Students response (raw):', sJson);
          console.debug('Normalized students count:', students.length);
        }

        if (!mounted) return;
        setTeachersCount(teachers.length);
        setStudentsCount(students.length);

        // build classes map without repetition, count students per class
        const map = {};
        const issues = [];
        students.forEach((st) => {
          // tolerant name/email/class extraction
          const name = st.name || st.fullName || `${st.firstName || ''} ${st.lastName || ''}`.trim();
          const email = st.email || st.emailAddress || st.contactEmail || '';
          const cls = (st.class || st.className || st.classroom || st.grade || st.class_group || st.classNameRaw || '').toString().trim();

          // Only report missing-class issues — stop reporting "missing name or email"
          if (!cls) {
            issues.push({ id: st.id || st.uid || st._id || name || '(unknown)', problem: 'no class assigned', raw: st });
            return;
          }

          map[cls] = (map[cls] || 0) + 1;

          // keep a dev-only debug log for missing name/email, but don't surface as an issue
          if (import.meta.env.DEV && (!name || !email)) {
            console.debug('Student missing name/email (dev-only):', { id: st.id || st.uid || st._id, name, email, raw: st });
          }
        });
        setClassesMap(map);
        setStudentIssues(issues);
      } catch (err) {
        console.error('Failed loading teacher/student stats', err);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, []);
  // Handle event form input changes
  const handleEventFormChange = e => {
    const {
      name,
      value,
      type,
      checked
    } = e.target;
    setEventForm({
      ...eventForm,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  // Add new event (update to POST to API)
  const handleAddEvent = async e => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.date) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/events/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventForm)
      });
      const result = await res.json();
      if (res.ok) {
        setEvents(prev => [...prev, result.data]);
        toast.success('Event added successfully!');
        setShowAddEventModal(false);
        setEventForm({
          title: '',
          date: '',
          description: '',
          forTeachers: true
        });
      } else {
        toast.error(result.error || "Failed to add event");
      }
    } catch {
      toast.error("Failed to add event");
    }
  };
  // Delete event
  const handleDeleteEvent = async (id) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      setDeletingId(id);
      const res = await fetch(`${API_BASE}/api/events/${id}`, {
        method: 'DELETE'
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setEvents(prev => prev.filter ( e => e.id !== id));
        toast.success(json.message || 'Event deleted successfully!');
      } else {
        console.error('Delete failed', json);
        toast.error(json.error || 'Failed to delete event');
      }
    } catch (err) {
      console.error('Network error deleting event', err);
      toast.error('Network error deleting event');
    } finally {
      setDeletingId(null);
    }
  };
  // Add handler to mark a notification read locally and attempt server update
  // Place this inside the component (before return)
  const markNotificationRead = async (id) => {
    setNotifications((prev) => prev.map(n => n.id === id ? { ...n, read: true } : n));
    // best-effort server call; ignore failures
    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, { method: 'POST' });
    } catch (e) {
      // ignore
    }
  };
  return <DashboardLayout title="Admin Dashboard">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 rounded-md p-3 ${stat.color}`}>
                  <div className="text-white">{stat.icon}</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">
                        {statsLoading ? <span className="text-gray-500">Loading…</span> : stat.value}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>)}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Classes summary (unique classes, counts) */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-gray-900">Classes</h2>
            <div className="text-sm text-gray-500">{statsLoading ? 'Loading…' : `${Object.keys(classesMap).length} classes`}</div>
          </div>
          <div className="divide-y divide-gray-100 max-h-60 overflow-auto">
            {statsLoading ? (
              <div className="text-sm text-gray-500 p-3">Loading classes…</div>
            ) : Object.keys(classesMap).length === 0 ? (
              <div className="text-sm text-gray-500 p-3">No classes found.</div>
            ) : (
              Object.entries(classesMap).map(([cls, cnt]) => (
                <div key={cls} className="py-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">{cls}</div>
                  <div className="text-sm text-gray-500">{cnt} student{cnt > 1 ? 's' : ''}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Student data issues */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-gray-900">Student data checks</h2>
            <div className="text-sm text-red-600">{statsLoading ? 'Loading…' : `${studentIssues.length} issue(s)`}</div>
          </div>
          {statsLoading ? (
            <div className="text-sm text-gray-500 p-3">Loading student checks…</div>
          ) : studentIssues.length === 0 ? (
            <div className="text-sm text-gray-500">All students look OK.</div>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-60 overflow-auto">
              {studentIssues.map((issue, idx) => (
                <li key={`${issue.uid}-${idx}`} className="py-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{issue.name}</div>
                      <div className="text-xs text-gray-500">{issue.uid || '—'}</div>
                      <div className="text-xs text-red-600">{issue.problem}</div>
                    </div>
                    <button
                      onClick={() => {
                        console.log('Problem student raw:', issue.raw);
                        toast('Opened student in console (inspect raw data)');
                      }}
                      className="text-xs text-green-600 hover:underline"
                    >
                      Inspect
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
         {/* Notifications */}
         <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">
              Recent Notifications
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {notifications.filter(n => !n.read).length} unread
            </span>
          </div>
          <div className="border-t border-gray-200">
            {!showHeavyLists ? (
              <div className="px-4 py-6 text-center text-gray-500">Loading notifications…</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {notifications.map(notification => <li
                    key={notification.id}
                    onClick={() => !notification.read && markNotificationRead(notification.id)}
                    className={`px-4 py-4 cursor-pointer ${!notification.read ? 'bg-green-50' : ''}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <BellIcon className={`h-6 w-6 ${
                          notification.variant === 'delete' ? 'text-red-500' :
                          notification.variant === 'create' ? 'text-green-500' :
                          notification.variant === 'failed' ? 'text-yellow-500' :
                          (!notification.read ? 'text-green-500' : 'text-gray-400')
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {notification.time}
                        </p>
                      </div>
                    </div>
                  </li>)}
              </ul>
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">
              Upcoming Events
            </h2>
            <button type="button" onClick={() => setShowAddEventModal(true)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Event
            </button>
          </div>
          <div className="border-t border-gray-200">
            {!showHeavyLists ? (
              <div className="px-4 py-4 text-center text-gray-500">Loading events…</div>
            ) : eventsLoading ? (
              <div className="px-4 py-4 text-center text-gray-500">Loading events…</div>
            ) : events.length === 0 ? (
               <div className="px-4 py-4 text-center text-gray-500">
                 No upcoming events. Click "Add Event" to create one.
               </div>
             ) : (
               <ul className="divide-y divide-gray-200">
                 {events.map(event => (
                   <li key={event.id} className="px-4 py-4">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center space-x-4">
                         <div className="flex-shrink-0">
                           <CalendarIcon className="h-6 w-6 text-orange-500" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-sm font-medium text-gray-900">
                             {event.title}
                           </p>
                           <p className="text-sm text-gray-500">
                             {new Date(event.date).toLocaleDateString('en-US', {
                               weekday: 'long',
                               year: 'numeric',
                               month: 'long',
                               day: 'numeric'
                             })}
                           </p>
                           {event.description && <p className="text-sm text-gray-500 mt-1">
                             {event.description}
                           </p>}
                           {event.forTeachers && <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                             Visible to Teachers
                           </span>}
                         </div>
                       </div>
                       <div>
                         <button
                           onClick={() => handleDeleteEvent(event.id)}
                           disabled={deletingId === event.id}
                           className={`text-red-600 hover:text-red-900 ${deletingId === event.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                           aria-disabled={deletingId === event.id}
                         >
                           <TrashIcon className="h-5 w-5" />
                         </button>
                       </div>
                     </div>
                   </li>
                 ))}
               </ul>
             )}
           </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddEventModal && (
  <div className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto">
    <div className="fixed inset-0 bg-gray-500 opacity-75" aria-hidden="true"></div>

    <div className="relative z-20 inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full">
      <form onSubmit={handleAddEvent}>
        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Add New Event
              </h3>
              <div className="mt-6 space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Event Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    required
                    value={eventForm.title}
                    onChange={handleEventFormChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                    Event Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    id="date"
                    required 
                    value={eventForm.date}
                    onChange={handleEventFormChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    name="description"
                    id="description"
                    rows={3}
                    value={eventForm.description}
                    onChange={handleEventFormChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    id="forTeachers"
                    name="forTeachers"
                    type="checkbox"
                    checked={eventForm.forTeachers}
                    onChange={handleEventFormChange}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label htmlFor="forTeachers" className="ml-2 block text-sm text-gray-900">
                    Make visible to teachers
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
          <button
            type="submit"
            className="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Add Event
          </button>
          <button
            type="button"
            onClick={() => setShowAddEventModal(false)}
            className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
)}

    </DashboardLayout>;
};
export default AdminDashboard;