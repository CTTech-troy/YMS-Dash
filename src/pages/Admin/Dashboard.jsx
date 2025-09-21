// src/pages/Admin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { UserIcon, UsersIcon, BookOpenIcon, ClipboardListIcon, CreditCardIcon, BellIcon, CalendarIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { toast } from 'sonner';
// Sample upcoming events data
const initialEvents = [{
  id: 1,
  title: 'End of Term Examination',
  date: '2023-07-15',
  description: 'Final examinations for all classes',
  forTeachers: true
}, {
  id: 2,
  title: 'Parent-Teacher Meeting',
  date: '2023-07-20',
  description: 'Discuss student progress with parents',
  forTeachers: true
}, {
  id: 3,
  title: 'Staff Development Workshop',
  date: '2023-07-25',
  description: 'Professional development for all teaching staff',
  forTeachers: true
}];
// Sample notification data
const notifications = [{
  id: 1,
  title: 'New Student Registration',
  message: 'A new student has been registered in Class 3A',
  time: '2 hours ago',
  read: false
}, {
  id: 2,
  title: 'Result Published',
  message: 'Class 5A results have been published',
  time: '1 day ago',
  read: true
}, {
  id: 3,
  title: 'System Update',
  message: 'The system will be down for maintenance on Saturday',
  time: '2 days ago',
  read: false
}];
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const AdminDashboard = () => {
  const [events, setEvents] = useState(initialEvents);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    description: '',
    forTeachers: true
  });
  // runtime stats
  const [teachersCount, setTeachersCount] = useState(null);
  const [studentsCount, setStudentsCount] = useState(null);
  const [classesMap, setClassesMap] = useState({}); // { className: count }
  const [studentIssues, setStudentIssues] = useState([]); // students with missing fields
  // Stats for the dashboard
  const stats = [
    { name: 'Total Teachers', value: teachersCount ?? '…', icon: <UserIcon className="h-6 w-6" />, color: 'bg-blue-500' },
    { name: 'Total Students', value: studentsCount ?? '…', icon: <UsersIcon className="h-6 w-6" />, color: 'bg-green-500' },
    { name: 'Total Classes', value: Object.keys(classesMap).length ?? '…', icon: <BookOpenIcon className="h-6 w-6" />, color: 'bg-yellow-500' },
    { name: 'Published Results', value: 1100, icon: <ClipboardListIcon className="h-6 w-6" />, color: 'bg-purple-500' }
  ];

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
      // common explicit shapes
      if (Array.isArray(payload.teachers)) return payload.teachers;
      if (Array.isArray(payload.students)) return payload.students;
      if (Array.isArray(payload.data)) return payload.data;
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
        if (process.env.NODE_ENV === 'development') {
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
           if (!cls) {
            issues.push({ id: st.id || st.uid || st._id || name || '(unknown)', problem: 'no class assigned', raw: st });
            return;
          }
          map[cls] = (map[cls] || 0) + 1;
          // optional basic checks per student
          if (!name || !email) {
            issues.push({ id: st.id || st.uid || st._id || name || '(unknown)', problem: 'missing name or email', raw: st });
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
  // Add new event
  const handleAddEvent = e => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.date) {
      toast.error('Please fill in all required fields');
      return;
    }
    const newEvent = {
      id: events.length + 1,
      ...eventForm
    };
    setEvents([...events, newEvent]);
    setEventForm({
      title: '',
      date: '',
      description: '',
      forTeachers: true
    });
    setShowAddEventModal(false);
    toast.success('Event added successfully!');
  };
  // Delete event
  const handleDeleteEvent = id => {
    if (confirm('Are you sure you want to delete this event?')) {
      setEvents(events.filter(event => event.id !== id));
      toast.success('Event deleted successfully!');
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
                        {stat.value}
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
            <div className="text-sm text-gray-500">{Object.keys(classesMap).length} classes</div>
          </div>
          <div className="divide-y divide-gray-100 max-h-60 overflow-auto">
            {Object.keys(classesMap).length === 0 ? (
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
            <div className="text-sm text-red-600">{studentIssues.length} issue(s)</div>
          </div>
          {studentIssues.length === 0 ? (
            <div className="text-sm text-gray-500">All students look OK.</div>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-60 overflow-auto">
              {studentIssues.map(issue => (
                <li key={issue.id} className="py-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{issue.id}</div>
                      <div className="text-xs text-gray-500">{issue.name}</div>
                      <div className="text-xs text-gray-500">{issue.problem}</div>
                    </div>
                    <button
                      onClick={() => {
                        // quick inspect in console
                        console.log('Problem student raw:', issue.raw);
                        toast('Opened student in console (inspect raw data)');
                      }}
                      className="text-xs text-blue-600 hover:underline"
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
            <ul className="divide-y divide-gray-200">
              {notifications.map(notification => <li key={notification.id} className={`px-4 py-4 ${!notification.read ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <BellIcon className={`h-6 w-6 ${!notification.read ? 'text-blue-500' : 'text-gray-400'}`} />
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
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">
              Upcoming Events
            </h2>
            <button type="button" onClick={() => setShowAddEventModal(true)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Event
            </button>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {events.map(event => <li key={event.id} className="px-4 py-4">
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
                        {event.forTeachers && <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Visible to Teachers
                          </span>}
                      </div>
                    </div>
                    <div>
                      <button onClick={() => handleDeleteEvent(event.id)} className="text-red-600 hover:text-red-900">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </li>)}
              {events.length === 0 && <li className="px-4 py-4 text-center text-gray-500">
                  No upcoming events. Click "Add Event" to create one.
                </li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddEventModal && <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
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
                          <input type="text" name="title" id="title" required value={eventForm.title} onChange={handleEventFormChange} className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                        </div>
                        <div>
                          <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                            Event Date
                          </label>
                          <input type="date" name="date" id="date" required value={eventForm.date} onChange={handleEventFormChange} className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                        </div>
                        <div>
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                            Description
                          </label>
                          <textarea name="description" id="description" rows={3} value={eventForm.description} onChange={handleEventFormChange} className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                        </div>
                        <div className="flex items-center">
                          <input id="forTeachers" name="forTeachers" type="checkbox" checked={eventForm.forTeachers} onChange={handleEventFormChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <label htmlFor="forTeachers" className="ml-2 block text-sm text-gray-900">
                            Make visible to teachers
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm">
                    Add Event
                  </button>
                  <button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" onClick={() => setShowAddEventModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>}
    </DashboardLayout>;
};
export default AdminDashboard;