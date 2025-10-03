import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { UsersIcon, BookOpenIcon, ClipboardListIcon, CalendarIcon, BellIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || ' https://yms-backend-a2x4.onrender.com';

// Sample fallback data
const fallbackAssignedClass = {
  name: 'Class Loading',
  students: 0
};
const recentActivities = [{ id: 1, type: 'Result', description: 'Uploaded Term 1 results for Class 3A', time: '2 hours ago' }, { id: 2, type: 'Attendance', description: 'Marked attendance for Class 3A', time: '1 day ago' }, { id: 3, type: 'Active', description: 'New student Alex Johnson added to Class 3A', time: '3 days ago' }];
const upcomingEvents = [{ id: 1, title: 'Math Quiz', class: 'Class 3A', date: '2023-07-15' }, { id: 2, title: 'Science Project Due', class: 'Class 3A', date: '2023-07-20' }, { id: 3, title: 'Parent-Teacher Meeting', class: 'All Classes', date: '2023-07-25' }];

const TeacherDashboard = () => {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // counts fetched/derived after profile load
  const [assignedStudentsCount, setAssignedStudentsCount] = useState(undefined);
  const [teacherSubjectCount, setTeacherSubjectCount] = useState(undefined);

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
      // Students count: normalize by filtering students whose class matches teacherProfile.assignedClass
      try {
        // 1) Use explicit profile count if available
        if (typeof teacherProfile.studentsCount === 'number') {
          setAssignedStudentsCount(teacherProfile.studentsCount);
        } else if (Array.isArray(teacherProfile.raw?.students)) {
          // 2) If profile includes students array, filter it strictly by class match
          const filtered = teacherProfile.raw.students.filter(s =>
            classMatches(s.class || s.className || s.assignedClass || s.klass || s.grade, teacherProfile.assignedClass)
          );
          setAssignedStudentsCount(filtered.length);
        } else if (teacherProfile.assignedClass) {
          // 3) Query students endpoint (prefer filtered endpoint), then always apply classMatches locally
          const q = encodeURIComponent(teacherProfile.assignedClass);
          try {
            const res = await fetch(`${API_BASE}/api/students?class=${q}`);
            let arr = [];
            if (res.ok) {
              arr = await res.json();
            } else {
              const res2 = await fetch(`${API_BASE}/api/students`);
              if (res2.ok) arr = await res2.json();
            }
            const filtered = Array.isArray(arr)
              ? arr.filter(s =>
                  classMatches(s.class || s.className || s.assignedClass || s.klass || s.grade, teacherProfile.assignedClass)
                )
              : [];
            setAssignedStudentsCount(filtered.length);
          } catch (e) {
            console.warn('Student fetch failed, skipping remote count', e);
          }
        } else {
          setAssignedStudentsCount(undefined);
        }
      } catch (e) {
        console.warn('Failed to compute assigned students count', e);
      }

      // Subjects count: prefer profile value then query subjects by teacher id/uid and fall back to parsing subject string
      try {
        if (typeof teacherProfile.subjectsCount === 'number') {
          setTeacherSubjectCount(teacherProfile.subjectsCount);
        } else if (Array.isArray(teacherProfile.raw?.subjects)) {
          setTeacherSubjectCount(teacherProfile.raw.subjects.length);
        } else {
          const teacherId = teacherProfile.id ?? teacherProfile.uid ?? teacherProfile.uid;
          if (teacherId) {
            const tryUrls = [
              `${API_BASE}/api/subjects?teacherId=${encodeURIComponent(teacherId)}`,
              `${API_BASE}/api/subjects?teacher=${encodeURIComponent(teacherId)}`
            ];
            let counted = undefined;
            for (const url of tryUrls) {
              try {
                const res = await fetch(url);
                if (res.ok) {
                  const list = await res.json();
                  counted = Array.isArray(list) ? list.length : (list?.length ?? undefined);
                  break;
                }
              } catch {
                // ignore and try next
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
          } else {
            if (typeof teacherProfile.subject === 'string' && teacherProfile.subject.trim()) {
              const n = teacherProfile.subject.split(',').map(s => s.trim()).filter(Boolean).length;
              setTeacherSubjectCount(n);
            } else {
              setTeacherSubjectCount(0);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to compute teacher subject count', e);
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

            // If students is missing, treat as empty array
            const studentsArr = Array.isArray(data.students) ? data.students : [];
            const subjectsArr = Array.isArray(data.subjects)
              ? data.subjects
              : (typeof data.subject === 'string' && data.subject.trim())
                ? data.subject.split(',').map(s => s.trim()).filter(Boolean)
                : [];

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
              email: data.email ?? '',
              phone: data.phone ?? '',
              subject: subjectsArr.join(', '),
              subjectsCount: subjectsArr.length,
              assignedClass: (typeof data.assignedClass === 'string' ? data.assignedClass : (data.assignedClassName ?? (data.assignedClass?.name ?? ''))),
              studentsCount: data.studentsCount ?? studentsArr.length,
              pictureSrc,
              mustChangePassword: !!data.mustChangePassword,
              raw: data
            };
          };

          setTeacherProfile(normalize(data));
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

  // derive stats using teacherProfile when available
  const assignedClassName = teacherProfile?.assignedClass || fallbackAssignedClass.name;
  // total students prefers fetched assignedStudentsCount, then profile count, then fallback
  const totalStudents = assignedStudentsCount ?? teacherProfile?.studentsCount ?? fallbackAssignedClass.students;

  // subject count prefers fetched teacherSubjectCount then profile subjectsCount then fallback
  const subjectCount = teacherSubjectCount ?? teacherProfile?.subjectsCount
    ?? (typeof teacherProfile?.subject === 'string' && teacherProfile.subject.trim()
        ? teacherProfile.subject.split(',').map(s => s.trim()).filter(Boolean).length
        : 0);

  const upcomingEventsCount = Array.isArray(upcomingEvents) ? upcomingEvents.length : 0;

  const stats = [{
    name: 'Assigned Class',
    value: assignedClassName,
    icon: <UsersIcon className="h-6 w-6" />,
    color: 'bg-blue-500'
  }, {
    name: 'Total Students',
    value: totalStudents,
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
            {/* <p className="text-sm text-gray-500">
              {teacherProfile?.subject ? `Subject: ${teacherProfile.subject}` : ''}
            </p> */}
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
            <h2 className="text-lg font-medium text-gray-900">Recent Activities</h2>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {recentActivities.map(activity => (
                <li key={activity.id} className="px-4 py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {activity.type === 'Result' && <ClipboardListIcon className="h-6 w-6 text-blue-500" />}
                      {activity.type === 'Attendance' && <UsersIcon className="h-6 w-6 text-green-500" />}
                      {activity.type === 'Active' && <BellIcon className="h-6 w-6 text-purple-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{activity.description}</p>
                      <p className="text-sm text-gray-500 truncate">{activity.time}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">Upcoming Events</h2>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {upcomingEvents.map(event => (
                <li key={event.id} className="px-4 py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <CalendarIcon className="h-6 w-6 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {event.class} | {new Date(event.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
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