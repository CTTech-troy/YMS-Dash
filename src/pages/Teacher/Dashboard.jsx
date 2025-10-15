import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { UsersIcon, BookOpenIcon, ClipboardListIcon, CalendarIcon, BellIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || ' https://yms-backend-a2x4.onrender.com';

// Sample fallback data
const fallbackAssignedClass = {
  name: 'Class Loading',
  students: 0
};
const recentActivities = [{ id: 1, type: 'Result', description: 'Uploaded Term 1 results for Class 3A', time: '2 hours ago' }, { id: 2, type: 'Attendance', description: 'Marked attendance for Class 3A', time: '1 day ago' }, { id: 3, type: 'Active', description: 'New student Alex Johnson added to Class 3A', time: '3 days ago' }];

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
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [assignedStudentsCount, setAssignedStudentsCount] = useState(undefined);
  const [teacherSubjectCount, setTeacherSubjectCount] = useState(undefined);

  // Normalizers: trim + lowercase canonical fields
  const normalizeClassValue = (c) => String(c ?? '').trim().toLowerCase();
  const normalizeStudent = (s) => {
    if (!s || typeof s !== 'object') return s;
    const unified = normalizeClassValue(s.class || s.studentClass || s.className || s.grade);
    return { ...s, class: unified };
  };

  // helper to compare class names/ids (case-insensitive)
  const classMatches = (studentClass, assignedClass) => {
    if (!studentClass || !assignedClass) return false;
    return String(studentClass).trim().toLowerCase() === String(assignedClass).trim().toLowerCase();
  };

  // fetch counts: students in assigned class and subjects added by this teacher
  useEffect(() => {
    if (!teacherProfile) {
      setAssignedStudentsCount(undefined);
      setTeacherSubjectCount(undefined);
      return;
    }

    const fetchCounts = async () => {
      // canonical assigned class (lowercase, trimmed)
      const assignedClass = normalizeClassValue(teacherProfile.assignedClass);
      // helper list for principals
      const principalClasses = ['jss1','jss2','jss3','ss1','ss2','ss3'];

      // 1) Students count
      try {
        // prefer explicit count if provided from profile
        if (typeof teacherProfile.studentsCount === 'number') {
          setAssignedStudentsCount(teacherProfile.studentsCount);
        } else if (Array.isArray(teacherProfile.raw?.students)) {
          // normalize local students before counting
          const normalizedLocal = teacherProfile.raw.students.map(normalizeStudent);

          // debug logging for normalized data and counts
          console.log('fetchCounts: assignedClass =', assignedClass);
          console.log('fetchCounts: normalizedLocal length =', normalizedLocal.length);
          console.log('fetchCounts: normalizedLocal classes =', normalizedLocal.map(s => s.class));

           // role-based / assignedClass-based visibility
           if (assignedClass === 'admin') {
             // admin assignedClass -> show all students
             setAssignedStudentsCount(normalizedLocal.length);
           } else if (assignedClass === 'principal') {
             // principal assignedClass -> only JSS1-SS3
             setAssignedStudentsCount(normalizedLocal.filter(s => principalClasses.includes(s.class)).length);
           } else if (assignedClass && assignedClass !== '') {
             // specific class assigned to teacher
             setAssignedStudentsCount(normalizedLocal.filter(s => s.class === assignedClass).length);
           } else {
             // fallback: count all local students
             setAssignedStudentsCount(normalizedLocal.length);
           }
        } else {
          // No local students array -> query backend (try scoped query first, otherwise fetch all)
          try {
            let arr = [];
            // If admin/principal we fetch complete list and apply server-side or client-side filter
            if (assignedClass === 'admin' || assignedClass === 'principal' || !assignedClass) {
              // fetch all students
              const res = await fetch(`${API_BASE}/api/students`);
              if (res.ok) arr = await res.json();
              
            } else {
              // try server-side class query first
              const q = encodeURIComponent(assignedClass);
              let res = await fetch(`${API_BASE}/api/students?class=${q}`);
              if (res.ok) {
                arr = await res.json();
              } else {
                // fallback to fetching all students
                const res2 = await fetch(`${API_BASE}/api/students`);
                if (res2.ok) arr = await res2.json();
              }
            }

            const list = Array.isArray(arr) ? arr : (arr?.data || arr?.students || []);
            const normalized = list.map(normalizeStudent);

            let filtered = [];
            if (assignedClass === 'admin') {
              filtered = normalized;
            } else if (assignedClass === 'principal') {
              filtered = normalized.filter(s => principalClasses.includes(s.class));
            } else if (assignedClass && assignedClass !== '') {
              filtered = normalized.filter(s => s.class === assignedClass);
            } else {
              filtered = normalized;
            }

            setAssignedStudentsCount(filtered.length);
          } catch (e) {
            console.warn('Student fetch failed, skipping remote count', e);
            setAssignedStudentsCount(undefined);
          }
        }
      } catch (e) {
        console.warn('Failed to compute assigned students count', e);
        setAssignedStudentsCount(undefined);
      }

      // 2) Subjects count (unchanged logic, normalized helpers used where helpful)
      try {
        if (typeof teacherProfile.subjectsCount === 'number') {
          setTeacherSubjectCount(teacherProfile.subjectsCount);
        } else if (Array.isArray(teacherProfile.raw?.subjects)) {
          setTeacherSubjectCount(teacherProfile.raw.subjects.length);
        } else {
          const teacherId = teacherProfile.id ?? teacherProfile.uid ?? null;
          let counted;
          if (teacherId) {
            const tryUrls = [
              `${API_BASE}/api/subjects?teacherId=${encodeURIComponent(teacherId)}`,
              `${API_BASE}/api/subjects?teacher=${encodeURIComponent(teacherId)}`
            ];
            for (const url of tryUrls) {
              try {
                const res = await fetch(url);
                if (res.ok) {
                  const list = await res.json();
                  counted = Array.isArray(list) ? list.length : (list?.length ?? counted);
                  break;
                }
              } catch {
                // ignore and try next
              }
            }
          }
          if (typeof counted === 'number') {
            setTeacherSubjectCount(counted);
          } else if (typeof teacherProfile.subject === 'string' && teacherProfile.subject.trim()) {
            const n = teacherProfile.subject.split(',').map(s => s.trim()).filter(Boolean).length;
            setTeacherSubjectCount(n);
          } else {
            setTeacherSubjectCount(0);
          }
        }
      } catch (e) {
        console.warn('Failed to compute teacher subject count', e);
        setTeacherSubjectCount(0);
      }
    };

    fetchCounts();
  }, [teacherProfile, userRole]);

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
               // canonical assignedClass (lowercase, trimmed)
               assignedClass: normalizeClassValue(data.assignedClass ?? data.classAssigned ?? data.class ?? data.assignedClassName ?? data.assignedClass?.name ?? ''),
               studentsCount: data.studentsCount ?? normalizedStudents.length,
                pictureSrc,
                mustChangePassword: !!data.mustChangePassword,
               raw: { ...data, students: normalizedStudents, subjects: Array.isArray(subjectsArr) ? subjectsArr : [] }
             };
           };
const normalized = normalize(data);
// log normalized assigned class and student classes
// (helps verify normalization and counts)
console.log('Normalized teacher.assignedClass:', normalized.assignedClass);
console.log('Normalized student.class list:', (normalized.raw?.students || []).map(s => s.class));
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

  // fetch notifications and expose their read/unread state
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();
    (async () => {
      setNotificationsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/notifications`, { signal: ac.signal });
        if (!res.ok) throw new Error('Failed to load notifications');
        const json = await res.json();
        const list = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
        if (!mounted) return;
        // normalize read flag
        setNotifications(list.map(n => ({ ...n, read: !!(n.read) })));
      } catch (err) {
        if (err && err.name === 'AbortError') {
          // ignore aborts
        } else {
          console.warn('Could not load notifications', err);
        }
        if (mounted) setNotifications([]);
      } finally {
        if (mounted) setNotificationsLoading(false);
      }
    })();
    return () => { mounted = false; ac.abort(); };
  }, []);

  // toggle read/unread state (optimistic UI + backend update)
  const toggleNotificationRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
    try {
      await fetch(`${API_BASE}/api/notifications/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true })
      });
    } catch (err) {
      // rollback on error
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
      toast?.error?.('Could not update notification state');
    }
  };

  // derive stats using normalized teacherProfile when available
  const assignedClassName = teacherProfile?.assignedClass || fallbackAssignedClass.name;
  const normalizedStudentsLen = Array.isArray(teacherProfile?.raw?.students) ? teacherProfile.raw.students.length : undefined;
  const normalizedSubjectsLen = Array.isArray(teacherProfile?.raw?.subjects) ? teacherProfile.raw.subjects.length : undefined;

  // total students prefers normalized students length, then fetched assignedStudentsCount, then profile count, then fallback
  const totalStudents = normalizedStudentsLen ?? assignedStudentsCount ?? teacherProfile?.studentsCount ?? fallbackAssignedClass.students;

  // subject count prefers normalized subjects length, then fetched teacherSubjectCount, then profile subjectsCount, then fallback
  const subjectCount = normalizedSubjectsLen ?? teacherSubjectCount ?? teacherProfile?.subjectsCount
    ?? (typeof teacherProfile?.subject === 'string' && teacherProfile.subject.trim()
        ? teacherProfile.subject.split(',').map(s => s.trim()).filter(Boolean).length
        : 0);

  const upcomingEventsCount = Array.isArray(upcomingEvents) ? upcomingEvents.length : 0;

  const [classComparison, setClassComparison] = useState(null);

  const stats = [{
    name: 'Assigned Class',
    value: assignedClassName,
    icon: <UsersIcon className="h-6 w-6" />,
    color: 'bg-blue-500'
  }, {
    name: 'Total Students',
    // show current logged-in teacher's matched student count when available, otherwise fallback to totalStudents
    value: (() => {
      try {
        if (classComparison && classComparison.teacherMatches) {
          const matches = Object.values(classComparison.teacherMatches || {});
          const meUid = (currentUser?.uid || '').toString().toLowerCase();
          for (const m of matches) {
            const t = m.teacher || {};
            const tUid = (t.uid || t.id || t.staffId || '').toString().toLowerCase();
            if (tUid && meUid && tUid === meUid) return m.count;
          }
        }
      } catch (e) {
        // ignore and fallback
      }
      return totalStudents;
    })(),
    icon: <UsersIcon className="h-6 w-6" />,
    color: 'bg-green-500'
  }, {
    name: 'Total subjects',
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

        // normalize teachers and students
        const normTeachers = teachersList.map(t => {
          const assigned = normalizeClassValue(t.assignedClass ?? t.classAssigned ?? t.class ?? t.assignedClassName ?? '');
          return { ...t, assignedClass: assigned };
        });

        const normStudents = studentsList.map(s => {
          const cls = normalizeClassValue(s.class ?? s.studentClass ?? s.className ?? s.grade ?? '');
          return { ...s, class: cls };
        });

        // build quick lookup for classes -> teachers (could be multiple teachers per class)
        const classToTeachers = {};
        normTeachers.forEach(t => {
          const key = t.assignedClass || '__unassigned__';
          classToTeachers[key] = classToTeachers[key] || [];
          classToTeachers[key].push(t);
        });

        // prepare mapping teacherId -> matched students
        const teacherMatches = {};
        // also track students that don't match any teacher assignedClass
        const unmatchedStudents = [];

        const principalClasses = ['jss1','jss2','jss3','ss1','ss2','ss3'];

        // for each teacher compute matched students
        for (const t of normTeachers) {
          let matched = [];
          if (t.assignedClass === 'admin') {
            // admin sees all students
            matched = [...normStudents];
          } else if (t.assignedClass === 'principal') {
            matched = normStudents.filter(s => principalClasses.includes(s.class));
          } else if (t.assignedClass && t.assignedClass !== '') {
            matched = normStudents.filter(s => s.class === t.assignedClass);
          } else {
            matched = []; // no assigned class
          }
          teacherMatches[t.uid ?? t.id ?? (t.email || t.staffId || JSON.stringify(t))] = {
            teacher: t,
            count: matched.length,
            students: matched
          };
        }

        // find students that don't belong to any teacher's assignedClass (ignore admin/principal special)
        const teacherAssignedSet = new Set(normTeachers.map(t => t.assignedClass).filter(Boolean));
        for (const s of normStudents) {
          // if any teacher assigned that class, consider matched
          if (teacherAssignedSet.has(s.class)) continue;
          // else student is unmatched
          unmatchedStudents.push(s);
        }

        // console output for debugging
        console.log('Class comparison: teachers (normalized):', normTeachers.map(t => ({ uid: t.uid ?? t.id, assignedClass: t.assignedClass })));
        console.log('Class comparison: students (normalized):', normStudents.map(s => ({ id: s.id ?? s.uid, class: s.class })));
        console.log('Teacher -> matched students summary:', Object.fromEntries(Object.entries(teacherMatches).map(([k,v]) => [k, v.count])));
        console.log('Unmatched students (no teacher assigned class found):', unmatchedStudents.map(s => ({ id: s.id ?? s.uid, class: s.class })));

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
      {teacherProfile?.mustChangePassword && (
        <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-yellow-800">Please update your password</p>
              <p className="text-sm text-yellow-700">
                You're using the initial account password. For security, please change it now.
              </p>
            </div>
            <div>
              <button
                onClick={() => navigate('/teacher/change-password')}
                className="ml-4 inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="bg-white shadow rounded-lg p-4 flex items-center space-x-4">
          <div className="flex-shrink-0">
            <img
              src={teacherProfile?.pictureSrc ?? '/images/default-avatar.png'}
              alt="Profile"
              className="h-16 w-16 rounded-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900">
              {profileLoading ? 'Loading profile...' : (teacherProfile?.name || 'Teacher Name')}
            </h3>
            <p className="text-sm text-gray-500">
              {teacherProfile?.uid ? `Staff ID: ${teacherProfile.uid}` : currentUser?.uid}
            </p>
            <p className="text-sm text-gray-500">
              {teacherProfile?.email || '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
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
                        {stat.value}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">Upcoming Events</h2>
          </div>
          <div className="border-t border-gray-200">
            {eventsLoading ? (
              <div className="px-4 py-6 text-center text-gray-500">Loading events…</div>
            ) : upcomingEvents.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500">No upcoming events for teachers.</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {upcomingEvents.map(event => (
                  <li key={event.id || event._id || `${event.title}-${event.date}`} className="px-4 py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <CalendarIcon className="h-6 w-6 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{event.title || event.name || 'Untitled event'}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {(event.class || event.forClass || event.targetClass || 'All Classes')} {event.date ? `| ${new Date(event.date).toLocaleDateString()}` : ''}
                        </p>
                        {event.location && <p className="text-xs text-gray-400 truncate">{event.location}</p>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Notifications panel */}
      <div className="mt-6 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Notifications</h2>
          <div className="text-sm text-gray-500">{notificationsLoading ? '…' : `${notifications.length} total`}</div>
        </div>
        <div className="border-t border-gray-200">
          {notificationsLoading ? (
            <div className="px-4 py-6 text-center text-gray-500">Loading notifications…</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-500">No notifications.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map(n => (
                <li key={n.id || n._id} className={`px-4 py-3 flex items-start justify-between ${n.read ? 'bg-white' : 'bg-blue-50'}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{n.title || n.headline || 'Notification'}</div>
                    <div className="text-xs text-gray-500 truncate">{n.message || n.body || ''}</div>
                    <div className="text-xs text-gray-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                    <button
                      onClick={() => toggleNotificationRead(n.id || n._id)}
                      className={`px-2 py-1 text-xs rounded-md ${n.read ? 'bg-gray-100 text-gray-700' : 'bg-indigo-600 text-white'}`}
                    >
                      {n.read ? 'Mark unread' : 'Mark read'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <button className="bg-white overflow-hidden shadow rounded-lg hover:bg-gray-50 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <ClipboardListIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">Add Results</h3>
              </div>
            </div>
          </button>

          <button className="bg-white overflow-hidden shadow rounded-lg hover:bg-gray-50 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <UsersIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">Students</h3>
              </div>
            </div>
          </button>

          <button className="bg-white overflow-hidden shadow rounded-lg hover:bg-gray-50 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                <CalendarIcon className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">Schedule Event</h3>
              </div>
            </div>
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;