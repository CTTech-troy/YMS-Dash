import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { UsersIcon, BookOpenIcon, ClipboardListIcon, CalendarIcon, BellIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config/api.js';
import api from '../../api/axios';
import { normalizeClassLabel, canonicalClassKey, resolveClassFromRecord } from '../../utils/schoolClass';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';

// Sample fallback data
const fallbackAssignedClass = {
  name: 'Class Loading',
  students: 0
};

// upcoming events loaded from API and filtered for teacher-visible events
const isVisibleToTeacher = (ev) => {
  if (!ev) return false;
  // treat boolean forTeachers first
  if (typeof ev.forTeachers === 'boolean') return ev.forTeachers;
  // array of roles
  if (Array.isArray(ev.visibleTo)) {
    return ev.visibleTo.map(v => String(v).toLowerCase()).includes('teacher') || ev.visibleTo.map(v => String(v).toLowerCase()).includes('teachers');
  }
  // common string fields that may indicate audience/role/visibility
  const fields = [ev.visibleTo, ev.audience, ev.target, ev.role, ev.visibility, ev.for, ev.to];
  for (const f of fields) {
    if (!f) continue;
    if (typeof f === 'string' && /teacher|teachers|staff/i.test(f)) return true;
    if (Array.isArray(f) && f.map(x => String(x).toLowerCase()).includes('teacher')) return true;
  }
  // if no visibility-related fields present, assume event is public/for-all -> include for teachers
  const hasVisibilityFields = ['visibleTo','audience','target','role','visibility','for','to','forTeachers'].some(k => Object.prototype.hasOwnProperty.call(ev, k));
  return !hasVisibilityFields;
};

const TeacherDashboard = () => {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // events & notifications state
  // upcoming events loaded from API and filtered for teacher-visible events
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  // const [notifications, setNotifications] = useState([]);
  // const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [assignedStudentsCount, setAssignedStudentsCount] = useState(undefined);
  const [teacherSubjectCount, setTeacherSubjectCount] = useState(undefined);

  const normalizeStudent = (s) => {
    if (!s || typeof s !== 'object') return s;
    const unified = normalizeClassLabel(resolveClassFromRecord(s));
    return { ...s, class: unified };
  };

  useEffect(() => {
    if (!currentUser || userRole !== 'teacher') {
      setAssignedStudentsCount(undefined);
      setTeacherSubjectCount(undefined);
      return;
    }

    let cancelled = false;

    const loadRosterAndSubjectCounts = async () => {
      setAssignedStudentsCount(undefined);
      setTeacherSubjectCount(undefined);

      try {
        const uid = currentUser.uid || currentUser.id;
        let assignedClassRaw = currentUser.assignedClass || currentUser.class || '';

        if (uid) {
          try {
            let tRes = await api.get(`/api/teachers/${encodeURIComponent(uid)}`);
            let tData = tRes.data;
            if (!tData || (Array.isArray(tData) && tData.length === 0)) {
              tRes = await api.get('/api/teachers', { params: { uid } });
              tData = tRes.data;
            }
            const teacher = Array.isArray(tData) ? tData[0] : tData;
            assignedClassRaw = teacher?.assignedClass || teacher?.classAssigned || teacher?.class || assignedClassRaw;
          } catch {
            /* keep currentUser fallbacks */
          }
        }

        const teacherClassKey = canonicalClassKey(assignedClassRaw);
        const adminLike = ['admin', 'principal', 'headmaster', 'head'].includes(teacherClassKey);

        let allStudentsArray = [];
        let nextToken = null;
        let hasMore = true;
        let pageCount = 0;

        while (hasMore && pageCount < 200) {
          let url = '/api/students?limit=25';
          if (nextToken) url += `&startAfter=${encodeURIComponent(nextToken)}`;

          const sRes = await api.get(url);
          const raw = sRes.data;
          const pageData = Array.isArray(raw)
            ? raw
            : (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw?.students) ? raw.students : []));

          if (Array.isArray(pageData) && pageData.length > 0) {
            allStudentsArray = allStudentsArray.concat(pageData);
          }

          nextToken = raw?.nextPageToken || null;
          hasMore = raw?.hasMore === true;
          pageCount += 1;
          if (!hasMore) break;
        }

        const normalized = allStudentsArray.map((s) => {
          const detectedClass = normalizeClassLabel(resolveClassFromRecord(s));
          const classKey = canonicalClassKey(s);
          return { ...s, class: detectedClass, classKey };
        });

        let rosterCount = 0;
        if (adminLike) {
          rosterCount = normalized.length;
        } else if (teacherClassKey) {
          rosterCount = normalized.filter(
            (st) => (st.classKey ?? canonicalClassKey(st.raw || st)) === teacherClassKey
          ).length;
        }

        const subRes = await api.get('/api/subjects');
        const subRaw = subRes.data;
        const arr = Array.isArray(subRaw)
          ? subRaw
          : (Array.isArray(subRaw?.data) ? subRaw.data : (Array.isArray(subRaw?.subjects) ? subRaw.subjects : []));

        const ownerKeys = ['createdBy', 'creator', 'owner', 'teacherUid', 'teacherId', 'staffId', 'userId', 'created_by'];
        const userIds = [currentUser?.uid, currentUser?.id, currentUser?.email].filter(Boolean).map(String);
        const mine = arr.filter((s) =>
          ownerKeys.some((k) => s[k] && userIds.includes(String(s[k])))
        );
        const seen = new Set();
        let subjectDedupeCount = 0;
        for (const sub of mine) {
          const key = String(sub.id || sub.name || '').toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          subjectDedupeCount += 1;
        }

        if (!cancelled) {
          setAssignedStudentsCount(rosterCount);
          setTeacherSubjectCount(subjectDedupeCount);
        }
      } catch (e) {
        if (!cancelled) {
          setAssignedStudentsCount(0);
          setTeacherSubjectCount(0);
        }
      }
    };

    loadRosterAndSubjectCounts();
    return () => {
      cancelled = true;
    };
  }, [currentUser, userRole]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser || userRole !== 'teacher') return;
      setProfileLoading(true);
      try {
        // try direct endpoint first
        let res = await fetch(`${API_BASE}/api/teachers/${encodeURIComponent(currentUser.uid)}`);
        let data = null;
        if (res.ok) {
          data = await res.json();
          // accept array or object
          if (Array.isArray(data) && data.length) data = data[0];
        } else {
          // fallback to list and find by uid
          res = await fetch(`${API_BASE}/api/teachers`);
          if (res.ok) {
            const list = await res.json();
            data = Array.isArray(list) ? list.find(t => ((t.uid ?? t.staffId) || '').toLowerCase() === (currentUser.uid || '').toLowerCase()) : null;
          } else {
            throw new Error('Failed to fetch teachers');
          }
        }

        if (!data) {
          setTeacherProfile(null);
          console.warn('Teacher profile not found for uid:', currentUser.uid);
        } else {
          const normalize = (data) => {
             if (!data) {
               // Return a safe default object if data is null
               return {
                 id: null,
                 name: '',
                 uid: '',
                 email: '',
                 phone: '',
                 subject: '',
                 subjectsCount: 0,
                 assignedClass: '',
                 studentsCount: 0,
                 pictureSrc: '/images/default-avatar.png',
                 mustChangePassword: false,
                 raw: {}
               };
             }
 
            // Normalize students array
            const studentsArr = Array.isArray(data.students) ? data.students : (Array.isArray(data.raw?.students) ? data.raw.students : []);
            const normalizedStudents = studentsArr.map(normalizeStudent);
 
            // Normalize subjects array (support string or array)
            const subjectsArr = Array.isArray(data.subjects)
              ? data.subjects
              : (typeof data.subject === 'string' && data.subject.trim()
                  ? data.subject.split(',').map(s => s.trim()).filter(Boolean)
                  : (Array.isArray(data.raw?.subjects) ? data.raw.subjects : []));
 
             const rawPicture = data.picture ?? data.profilePicture ?? '';
             const pictureSrc = rawPicture
               ? (typeof rawPicture === 'string' && rawPicture.startsWith('data:')
                   ? rawPicture
                   : `data:image/jpeg;base64,${rawPicture}`)
               : '/images/default-avatar.png';
 
             return {
               id: data.id ?? data._id ?? null,
               name: data.fullName ?? data.name ?? '',
               uid: data.uid ?? data.staffId ?? '',
               email: data.email ?? data.email ?? '',
               phone: data.phone ?? '',
               subject: Array.isArray(subjectsArr) ? subjectsArr.join(', ') : '',
               subjectsCount: Array.isArray(subjectsArr) ? subjectsArr.length : 0,
               assignedClass: normalizeClassLabel(
                 resolveClassFromRecord({
                   assignedClass:
                     data.assignedClass ?? data.classAssigned ?? data.class ?? data.assignedClassName ?? data.assignedClass?.name
                 })
               ),
               studentsCount: data.studentsCount ?? normalizedStudents.length,
                pictureSrc,
                mustChangePassword: !!data.mustChangePassword,
               raw: { ...data, students: normalizedStudents, subjects: Array.isArray(subjectsArr) ? subjectsArr : [] }
             };
           };
const normalized = normalize(data);
setTeacherProfile(normalized);
         }
       } catch (err) {
         console.error('Error fetching teacher profile', err);
         setTeacherProfile(null);
       } finally {
         setProfileLoading(false);
       }
     };
 
    fetchProfile();
  }, [currentUser, userRole]);

  // fetch upcoming events (only those visible to teachers)
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();
    (async () => {
      setEventsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/events`, { signal: ac.signal });
        if (!res.ok) {
          throw new Error('Failed to load events');
        }
        const json = await res.json();
        const list = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
        const visible = list.filter(isVisibleToTeacher);
        if (!mounted) return;
        setUpcomingEvents(visible);
      } catch (err) {
        if (err && err.name === 'AbortError') {
          // ignore aborts (normal during cleanup)
        } else {
          console.warn('Could not load events', err);
        }
        if (mounted) setUpcomingEvents([]);
      } finally {
        if (mounted) setEventsLoading(false);
      }
    })();
    return () => { mounted = false; ac.abort(); };
  }, []);


  const assignedClassName = teacherProfile?.assignedClass || fallbackAssignedClass.name;

  const totalStudents = assignedStudentsCount === undefined ? '—' : assignedStudentsCount;

  const subjectCount = teacherSubjectCount === undefined ? '—' : teacherSubjectCount;

  const upcomingEventsCount = Array.isArray(upcomingEvents) ? upcomingEvents.length : 0;

  const [classComparison, setClassComparison] = useState(null);

  const stats = [{
    name: 'Assigned Class',
    value: assignedClassName,
    icon: <UsersIcon className="h-6 w-6" />,
    color: 'bg-blue-500'
  }, {
    name: 'Total Students',
    // Display exact count from API for assigned class
    value: totalStudents,
    icon: <UsersIcon className="h-6 w-6" />,
    color: 'bg-green-500'
  }, {
    name: 'Total Subjects',
    // Display exact count from API for teacher's subjects
    value: subjectCount,
    icon: <ClipboardListIcon className="h-6 w-6" />,
    color: 'bg-orange-500'
  }, {
    name: 'Upcoming Events',
    value: upcomingEventsCount,
    icon: <BellIcon className="h-6 w-6" />,
    color: 'bg-purple-500'
  }];

  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    (async () => {
      try {
        const [tRes, sRes] = await Promise.all([
          fetch(`${API_BASE}/api/teachers`, { signal: ac.signal }),
          fetch(`${API_BASE}/api/students`, { signal: ac.signal })
        ]);

        const tJson = tRes.ok ? await tRes.json().catch(() => null) : null;
        const sJson = sRes.ok ? await sRes.json().catch(() => null) : null;

        const teachersList = Array.isArray(tJson) ? tJson : (Array.isArray(tJson?.data) ? tJson.data : (Array.isArray(tJson?.teachers) ? tJson.teachers : []));
        const studentsList = Array.isArray(sJson) ? sJson : (Array.isArray(sJson?.data) ? sJson.data : (Array.isArray(sJson?.students) ? sJson.students : []));

        if (!mounted) return;

        const normTeachers = teachersList.map((t) => {
          const raw = t.assignedClass ?? t.classAssigned ?? t.class ?? t.assignedClassName ?? '';
          const assigned = normalizeClassLabel(resolveClassFromRecord({ assignedClass: raw, class: raw }));
          const classKey = canonicalClassKey(raw);
          return { ...t, assignedClass: assigned, classKey };
        });

        const normStudents = studentsList.map((s) => {
          const cls = normalizeClassLabel(resolveClassFromRecord(s));
          const classKey = canonicalClassKey(s);
          return { ...s, class: cls, classKey };
        });

        const classToTeachers = {};
        normTeachers.forEach((t) => {
          const key = t.classKey || '__unassigned__';
          classToTeachers[key] = classToTeachers[key] || [];
          classToTeachers[key].push(t);
        });

        const teacherMatches = {};
        const unmatchedStudents = [];

        const principalClassKeys = ['jss1', 'jss2', 'jss3', 'ss1', 'ss2', 'ss3'];

        for (const t of normTeachers) {
          let matched = [];
          if (t.classKey === 'admin') {
            matched = [...normStudents];
          } else if (t.classKey === 'principal') {
            matched = normStudents.filter((s) => principalClassKeys.includes(s.classKey));
          } else if (t.classKey) {
            matched = normStudents.filter((s) => s.classKey === t.classKey);
          } else {
            matched = [];
          }
          teacherMatches[t.uid ?? t.id ?? (t.email || t.staffId || JSON.stringify(t))] = {
            teacher: t,
            count: matched.length,
            students: matched
          };
        }

        const teacherAssignedSet = new Set(normTeachers.map((t) => t.classKey).filter(Boolean));
        for (const s of normStudents) {
          if (teacherAssignedSet.has(s.classKey)) continue;
          unmatchedStudents.push(s);
        }

        // store small summary in state for UI
        setClassComparison({
          totalTeachers: normTeachers.length,
          totalStudents: normStudents.length,
          teacherMatches,
          unmatchedStudentsCount: unmatchedStudents.length,
          unmatchedStudentsSample: unmatchedStudents.slice(0, 8)
        });
      } catch (err) {
        if (err && err.name === 'AbortError') {
          // ignore
        } else {
          console.warn('class comparison failed', err);
        }
      }
    })();

    return () => { mounted = false; ac.abort(); };
  }, []); // run once on mount

  return (
    <DashboardLayout title="Teacher Dashboard">
      <div className="space-y-8">
        <PageHeader
          title="Overview"
          description="Your class, subjects, and school calendar at a glance."
        />

      {teacherProfile?.mustChangePassword && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 shadow-sm ring-1 ring-amber-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-amber-900">Please update your password</p>
              <p className="text-sm text-amber-800/90">
                You're using the initial account password. For security, please change it now.
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => navigate('/teacher/change-password')}>
              Change password
            </Button>
          </div>
        </div>
      )}

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="shrink-0">
            <img
              src={teacherProfile?.pictureSrc ?? '/images/default-avatar.png'}
              alt=""
              className="h-16 w-16 rounded-2xl object-cover ring-2 ring-slate-100"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-slate-900">
              {profileLoading ? 'Loading profile…' : (teacherProfile?.name || 'Teacher')}
            </h3>
            <p className="text-sm text-slate-500">
              {teacherProfile?.uid ? `Staff ID: ${teacherProfile.uid}` : currentUser?.uid}
            </p>
            <p className="text-sm text-slate-500">{teacherProfile?.email || '—'}</p>
          </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <Card key={stat.name} padding={false} className="overflow-hidden border-slate-200/90 p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-4">
                <div className={`flex shrink-0 rounded-xl p-3 ${stat.color}`}>
                  <div className="text-white">{stat.icon}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{stat.name}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{stat.value}</p>
                </div>
              </div>
          </Card>
        ))}
      </div>

      <Card padding={false} className="overflow-hidden border-slate-200/90 shadow-[var(--shadow-card)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Upcoming events</h2>
            <p className="text-xs text-slate-500">Visible to staff</p>
          </div>
          <div>
            {eventsLoading ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">Loading events…</div>
            ) : upcomingEvents.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">No upcoming events for teachers.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingEvents.map(event => (
                  <li key={event.id || event._id || `${event.title}-${event.date}`} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                        <CalendarIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{event.title || event.name || 'Untitled event'}</p>
                        <p className="text-sm text-slate-500">
                          {(event.class || event.forClass || event.targetClass || 'All Classes')} {event.date ? ` · ${new Date(event.date).toLocaleDateString()}` : ''}
                        </p>
                        {event.location && <p className="text-xs text-slate-400">{event.location}</p>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
      </Card>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick actions</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate('/teacher/results')}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ClipboardListIcon className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-slate-900">Add results</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/teacher/classes')}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <UsersIcon className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-slate-900">Classes & students</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/teacher/attendance')}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <CalendarIcon className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-slate-900">Attendance</span>
          </button>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;