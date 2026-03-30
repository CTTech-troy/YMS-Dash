// src/pages/Admin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import {
  UserIcon,
  UsersIcon,
  BookOpenIcon,
  ClipboardListIcon,
  CreditCardIcon,
  CalendarIcon,
  PlusIcon,
  TrashIcon,
  GraduationCap,
  ArrowRight,
  LayoutGrid,
  Sparkles,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE } from '../../config/api.js';

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const adminName = currentUser?.name || currentUser?.fullName || 'Admin';

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
  const [studentIssues, setStudentIssues] = useState(() => _cachedSnapshot?.studentIssues ?? []);
  const [deletingId, setDeletingId] = useState(null);
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

  // Fetch events / teachers / students / results in parallel (single, fast load)
  useEffect(() => {
    const ac = new AbortController();
    const signal = ac.signal;

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

    const fetchAllStudentsPaged = async () => {
      const acc = [];
      let startAfter = null;
      for (;;) {
        const u = new URL(`${API_BASE}/api/students/all`);
        u.searchParams.set('limit', '5000');
        if (startAfter) u.searchParams.set('startAfter', startAfter);
        const res = await fetch(u.toString(), { signal });
        if (!res.ok) break;
        const j = await res.json().catch(() => null);
        const chunk = Array.isArray(j?.data) ? j.data : [];
        acc.push(...chunk);
        if (!j?.hasMore || !j?.nextPageToken) break;
        startAfter = j.nextPageToken;
      }
      return acc;
    };

    const fetchStudentCountExact = async () => {
      const res = await fetch(`${API_BASE}/api/students/count`, { signal });
      if (!res.ok) return null;
      const j = await res.json().catch(() => null);
      return typeof j?.total === 'number' ? j.total : null;
    };

    const loadAll = async () => {
      setEventsLoading(true);
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
        const [eventsRes, tRes, rRes, studentsList, exactTotal] = await Promise.all([
          fetch(`${API_BASE}/api/events`, { signal }),
          fetch(`${API_BASE}/api/teachers`, { signal }),
          fetch(`${API_BASE}/api/results`, { signal }),
          fetchAllStudentsPaged(),
          fetchStudentCountExact()
        ]);

        const [eventsJson, tJson, rJson] = await Promise.all([
          eventsRes.ok ? eventsRes.json().catch(() => []) : [],
          tRes.ok ? tRes.json().catch(() => null) : null,
          rRes.ok ? rRes.json().catch(() => []) : []
        ]);

        // events
        setEvents(Array.isArray(eventsJson) ? eventsJson : (eventsJson && Array.isArray(eventsJson.data) ? eventsJson.data : []));

        // teachers & students
        const teachers = normalizeArray(tJson);
        const students = Array.isArray(studentsList) ? studentsList : [];
        setTeachersCount(teachers.length);
        setStudentsCount(exactTotal != null ? exactTotal : students.length);

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
        setResultsCount(resultsArray.length);

        // Persist a lightweight snapshot to sessionStorage for faster next load
        try {
          const countForCache = exactTotal != null ? exactTotal : students.length;
          const snapshot = {
            events: Array.isArray(eventsJson) ? eventsJson : (eventsJson && Array.isArray(eventsJson.data) ? eventsJson.data : []),
            teachersCount: Array.isArray(teachers) ? teachers.length : (teachers?.length ?? null),
            studentsCount: countForCache,
            classesMap: map,
            studentIssues: buildStudentIssues(students),
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
      } finally {
        setEventsLoading(false);
      }
    };

    loadAll();
    return () => { ac.abort(); };
  }, []);

  const stats = React.useMemo(() => ([
    {
      name: 'Teachers',
      description: 'Staff on record',
      value: teachersCount ?? '—',
      icon: UserIcon,
      accent: 'from-sky-500 to-blue-600',
      ring: 'ring-sky-500/20',
    },
    {
      name: 'Students',
      description: 'Enrolled learners',
      value: studentsCount ?? '—',
      icon: UsersIcon,
      accent: 'from-emerald-500 to-teal-600',
      ring: 'ring-emerald-500/20',
    },
    {
      name: 'Classes',
      description: 'Active class groups',
      value: Object.keys(classesMap).length ?? '—',
      icon: GraduationCap,
      accent: 'from-amber-500 to-orange-600',
      ring: 'ring-amber-500/20',
    },
    {
      name: 'Results',
      description: 'Published records',
      value: resultsCount ?? '—',
      icon: ClipboardListIcon,
      accent: 'from-violet-500 to-indigo-600',
      ring: 'ring-violet-500/20',
    },
  ]), [teachersCount, studentsCount, classesMap, resultsCount]);

  const quickLinks = [
    { to: '/admin/teachers', label: 'Teachers', sub: 'Hire & profiles', icon: UserIcon },
    { to: '/admin/students', label: 'Students', sub: 'Enrollment', icon: UsersIcon },
    { to: '/admin/subjects', label: 'Subjects', sub: 'Curriculum', icon: BookOpenIcon },
    { to: '/admin/results', label: 'Results', sub: 'Grades & reports', icon: ClipboardListIcon },
    { to: '/admin/scratch-cards', label: 'Scratch cards', sub: 'Access codes', icon: CreditCardIcon },
    { to: '/admin/portal-settings', label: 'Portal access', sub: 'Student login', icon: Lock },
    { to: '/admin/class-assignment', label: 'Class assignment', sub: 'Rosters', icon: LayoutGrid },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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
  return (
    <DashboardLayout title="Overview">
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-8 text-white shadow-lg ring-1 ring-white/10 sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-200 ring-1 ring-white/20">
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Administration
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                {greeting}, {adminName}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Yetland Management School — monitor enrollment, academics, and daily operations from one dashboard.
              </p>
              <p className="mt-3 text-sm text-slate-400">{todayLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="rounded-lg bg-emerald-500/20 p-2.5 text-emerald-300">
                <GraduationCap className="h-8 w-8" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
                <p className="text-lg font-semibold">Live sync</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.name}
                className={`group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ${stat.ring} transition hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{stat.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{stat.description}</p>
                    <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
                      {statsLoading ? <span className="text-lg font-normal text-slate-400">Loading…</span> : stat.value}
                    </p>
                  </div>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${stat.accent} text-white shadow-md`}>
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick access</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((link) => {
              const QuickIcon = link.icon;
              return (
              <Link
                key={link.to}
                to={link.to}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:shadow-md"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-indigo-600 group-hover:text-white">
                    <QuickIcon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{link.label}</p>
                    <p className="text-xs text-slate-500">{link.sub}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" aria-hidden />
              </Link>
            );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">Classes</h2>
                <span className="text-xs font-medium text-slate-500">
                  {statsLoading ? '…' : `${Object.keys(classesMap).length} groups`}
                </span>
              </div>
              <div className="max-h-72 overflow-auto px-2">
                {statsLoading ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-500">Loading classes…</div>
                ) : Object.keys(classesMap).length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-500">No class data yet.</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {Object.entries(classesMap).map(([cls, cnt]) => (
                      <li key={cls} className="flex items-center justify-between gap-3 px-3 py-3">
                        <span className="text-sm font-medium text-slate-900">{cls}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {cnt} learner{cnt === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">Data quality</h2>
                <span className={`text-xs font-medium ${studentIssues.length ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {statsLoading ? '…' : `${studentIssues.length} issue${studentIssues.length === 1 ? '' : 's'}`}
                </span>
              </div>
              <div className="max-h-72 overflow-auto px-2">
                {statsLoading ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-500">Checking records…</div>
                ) : studentIssues.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-600">
                    All student records look complete for tracked fields.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {studentIssues.map((issue, idx) => (
                      <li key={`${issue.uid}-${idx}`} className="px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{issue.name || '—'}</p>
                            <p className="text-xs text-slate-500">{issue.uid || '—'}</p>
                            <p className="mt-1 text-xs text-rose-600">{issue.problem}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Problem student raw:', issue.raw);
                              toast('Details logged to the browser console');
                            }}
                            className="shrink-0 text-xs font-medium text-emerald-700 hover:underline"
                          >
                            Inspect
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">School calendar</h2>
              <p className="text-xs text-slate-500">Events visible to staff where applicable</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddEventModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <PlusIcon className="h-4 w-4" aria-hidden />
              Add event
            </button>
          </div>
          <div>
            {!showHeavyLists ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">Loading events…</div>
            ) : eventsLoading ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">Loading events…</div>
            ) : events.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                No scheduled events. Add one to keep teachers and admins aligned.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {events.map((event) => (
                  <li key={event.id} className="px-5 py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                          <CalendarIcon className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{event.title}</p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {new Date(event.date).toLocaleDateString(undefined, {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                          {event.description && <p className="mt-2 text-sm text-slate-600">{event.description}</p>}
                          {event.forTeachers && (
                            <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100">
                              Visible to teachers
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(event.id)}
                        disabled={deletingId === event.id}
                        className={`self-start rounded-lg p-2 text-rose-600 transition hover:bg-rose-50 ${deletingId === event.id ? 'cursor-not-allowed opacity-50' : ''}`}
                        aria-label="Delete event"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {showAddEventModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4">
          <button
            type="button"
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            aria-label="Close modal"
            onClick={() => setShowAddEventModal(false)}
          />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5">
            <form onSubmit={handleAddEvent}>
              <div className="border-b border-slate-100 px-6 py-5">
                <h3 className="text-lg font-semibold text-slate-900">Schedule an event</h3>
                <p className="mt-1 text-sm text-slate-500">Appears on the admin dashboard and optionally for teachers.</p>
              </div>
              <div className="space-y-5 px-6 py-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-slate-700">
                    Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    required
                    value={eventForm.title}
                    onChange={handleEventFormChange}
                    className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-slate-700">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    id="date"
                    required
                    value={eventForm.date}
                    onChange={handleEventFormChange}
                    className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    name="description"
                    id="description"
                    rows={3}
                    value={eventForm.description}
                    onChange={handleEventFormChange}
                    className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="forTeachers"
                    name="forTeachers"
                    type="checkbox"
                    checked={eventForm.forTeachers}
                    onChange={handleEventFormChange}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="forTeachers" className="text-sm text-slate-800">
                    Visible to teachers
                  </label>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddEventModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  Save event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
export default AdminDashboard;