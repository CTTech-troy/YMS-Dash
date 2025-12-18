import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { UsersIcon, BookOpenIcon, ClipboardListIcon, CalendarIcon, BellIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
// import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || ' https://yms-backend-a2x4.onrender.com';

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

  // Normalizers: trim + lowercase canonical fields
  const normalizeClassValue = (c) => String(c ?? '').trim().toLowerCase();
  const normalizeStudent = (s) => {
    if (!s || typeof s !== 'object') return s;
    const unified = normalizeClassValue(s.class || s.studentClass || s.className || s.grade);
    return { ...s, class: unified };
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

      console.debug('fetchCounts starting:', { assignedClass, teacherProfile: teacherProfile.name });

      // ========================================
      // 1) STUDENTS COUNT
      // ========================================
      try {
        let studentList = [];

        // Try to fetch students from API
        try {
          const res = await fetch(`${API_BASE}/api/students`);
          if (res.ok) {
            const json = await res.json();
            studentList = Array.isArray(json) ? json : (json?.data || json?.students || []);
          }
        } catch (e) {
          console.warn('Failed to fetch students from /api/students', e);
          studentList = [];
        }

        // Normalize all students
        const normalizedStudents = studentList.map(normalizeStudent);

        console.debug('fetchCounts: fetched & normalized students', {
          total: normalizedStudents.length,
          classes: [...new Set(normalizedStudents.map(s => s.class))]
        });

        // Filter by teacher's assigned class
        let filteredStudents = [];
        
        if (assignedClass === 'admin') {
          // Admin sees all students
          filteredStudents = normalizedStudents;
        } else if (assignedClass === 'principal' || assignedClass === 'headmaster' || assignedClass === 'head') {
          // Principal sees only standard classes (JSS1-SS3)
          filteredStudents = normalizedStudents.filter(s => principalClasses.includes(s.class));
        } else if (assignedClass && assignedClass !== '') {
          // Teacher with specific assigned class
          filteredStudents = normalizedStudents.filter(s => s.class === assignedClass);
        } else {
          // No assigned class -> show all
          filteredStudents = normalizedStudents;
        }

        console.debug('fetchCounts: student count result', {
          assignedClass,
          filteredCount: filteredStudents.length,
          studentNames: filteredStudents.map(s => ({ name: s.name, class: s.class }))
        });

        setAssignedStudentsCount(filteredStudents.length);
      } catch (e) {
        console.warn('Failed to compute assigned students count', e);
        setAssignedStudentsCount(0);
      }

      // ========================================
      // 2) SUBJECTS COUNT
      // ========================================
      try {
        const teacherId = teacherProfile.id ?? teacherProfile.uid ?? null;
        let subjectList = [];

        if (teacherId) {
          // Try to fetch subjects for this teacher
          try {
            const res = await fetch(`${API_BASE}/api/subjects?teacher=${encodeURIComponent(teacherId)}`);
            if (res.ok) {
              const json = await res.json();
              subjectList = Array.isArray(json) ? json : (json?.data || json?.subjects || []);
            }
          } catch (e) {
            console.warn('Failed to fetch subjects for teacher', e);
          }

          // Fallback: try without filter
          if (subjectList.length === 0) {
            try {
              const res = await fetch(`${API_BASE}/api/subjects`);
              if (res.ok) {
                const json = await res.json();
                const allSubjects = Array.isArray(json) ? json : (json?.data || json?.subjects || []);
                // Filter by teacher ID
                subjectList = allSubjects.filter(s => 
                  (s.teacher === teacherId || s.teacherId === teacherId || s.teacherUid === teacherId)
                );
              }
            } catch (e) {
              console.warn('Failed to fetch all subjects', e);
            }
          }
        }

        console.debug('fetchCounts: subject count result', {
          teacherId,
          subjectCount: subjectList.length,
          subjects: subjectList.map(s => ({ name: s.name, id: s.id }))
        });

        setTeacherSubjectCount(subjectList.length);
      } catch (e) {
        console.warn('Failed to compute teacher subject count', e);
        setTeacherSubjectCount(0);
      }
    };

    fetchCounts();
  }, [teacherProfile]);

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


  // derive stats using fetched counts
  const assignedClassName = teacherProfile?.assignedClass || fallbackAssignedClass.name;

  // total students: use fetched count (most accurate from API)
  const totalStudents = assignedStudentsCount ?? fallbackAssignedClass.students;

  // subject count: use fetched count (most accurate from API)
  const subjectCount = teacherSubjectCount ?? 0;

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

      <div className="mt-6 bg-white shadow rounded-lg">
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