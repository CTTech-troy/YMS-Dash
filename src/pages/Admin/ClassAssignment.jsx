// src/pages/Admin/ClassAssignment.jsx
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { PlusIcon, TrashIcon, PencilIcon } from 'lucide-react';
import { toast } from 'sonner';

const availableClasses = [
  'Creche',
  'Nursery 1',
  'Nursery 2',
  'KG 1',
  'KG 2',
  'Primary 1',
  'Primary 2',
  'Primary 3',
  'Primary 4',
  'Primary 5',
  'JSS1',
  'JSS2',
  'Principal'
];

const ClassAssignment = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [formData, setFormData] = useState({
    teacherId: '',
    class: ''
  });

  const API_BASE = (import.meta.env.VITE_API_URL || 'https://yms-backend-lp9y.onrender.com/').replace(/\/$/, '');
 
   // 🔄 Fetch teachers from DB
   useEffect(() => {
     const fetchTeachers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/teachers`);
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
          // try to get server error message (text/html or text)
          const text = await res.text();
          throw new Error(`Server error ${res.status}: ${text.slice(0, 200)}`);
        }
        if (!contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error('Invalid JSON response from server: ' + text.slice(0, 200));
        }
        const data = await res.json();

        // Ensure assignedClass exists (fallback: null)
        const formatted = data.map(t => ({
          ...t,
          class: t.assignedClass ?? null
        }));

        setTeachers(formatted);
      } catch (error) {
        console.error('Error fetching teachers:', error);
        toast.error('Could not load teachers: ' + (error.message || 'unknown error'));
      } finally {
        setLoading(false);
      }
     };
     fetchTeachers();
   }, []);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // 🔄 Assign class (update in DB)
  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.teacherId || !formData.class) {
      toast.error('Please select both a teacher and a class');
      return;
    }
 
    try {
      const res = await fetch(`${API_BASE}/api/teachers/${formData.teacherId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedClass: formData.class })
      });

      if (!res.ok) throw new Error('Failed to update teacher');
      toast.success('Class assigned successfully!');

      // Update state locally
      const updatedTeachers = teachers.map(teacher =>
        String(teacher.id) === String(formData.teacherId)
          ? { ...teacher, class: formData.class }
          : teacher
      );
      setTeachers(updatedTeachers);
      setFormData({ teacherId: '', class: '' });
      setShowAssignModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Could not assign class');
    }
  };

  // 🔄 Edit class assignment
  const handleEditSubmit = async e => {
    e.preventDefault();
    if (!formData.class) {
      toast.error('Please select a class');
      return;
    }
 
    try {
      const res = await fetch(`${API_BASE}/api/teachers/${selectedTeacher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedClass: formData.class })
      });

      if (!res.ok) throw new Error('Failed to update teacher');
      toast.success('Assignment updated successfully!');

      const updatedTeachers = teachers.map(teacher =>
        String(teacher.id) === String(selectedTeacher.id)
          ? { ...teacher, class: formData.class }
          : teacher
      );
      setTeachers(updatedTeachers);
      setSelectedTeacher(null);
      setFormData({ teacherId: '', class: '' });
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Could not update assignment');
    }
  };

  const handleEditAssignment = teacher => {
    setSelectedTeacher(teacher);
    setFormData({
      teacherId: teacher.id,
      class: teacher.class || ''
    });
    setShowEditModal(true);
  };

  const handleRemoveAssignment = async teacherId => {
    if (!confirm('Are you sure you want to remove this class assignment?')) return;
 
    try {
      const res = await fetch(`${API_BASE}/api/teachers/${teacherId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedClass: null })
      });

      if (!res.ok) throw new Error('Failed to remove assignment');
      toast.success('Class assignment removed successfully!');

      const updatedTeachers = teachers.map(teacher =>
        String(teacher.id) === String(teacherId) ? { ...teacher, class: null } : teacher
      );
      setTeachers(updatedTeachers);
    } catch (err) {
      console.error(err);
      toast.error('Could not remove assignment');
    }
  };

  const getAvailableClassesForAssignment = (currentClass = null) => {
    const assignedClasses = teachers
      .filter(teacher => teacher.class && teacher.class !== currentClass)
      .map(teacher => teacher.class);
    return availableClasses.filter(cls => !assignedClasses.includes(cls));
  };

  const getAvailableTeachers = () =>
    teachers.filter(teacher => !teacher.class && teacher.status === 'active');

  // Helper: ensure image src is a proper data URI or passthrough URL
  const formatImageSrc = src => {
    if (!src) return '/placeholder.png';
    const s = String(src).trim();

    // already a data URL
    if (s.startsWith('data:')) return s;

    // absolute URL or root-relative path
    if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;

    // contains "base64," but missing the data: prefix (e.g. "image/png;base64,AAA...")
    if (s.includes('base64,')) {
      // if starts directly with "base64," prepend default mime
      if (s.startsWith('base64,')) {
        return `data:image/jpeg;${s}`; // default to jpeg
      }
      // if it already looks like "image/png;base64,..." but missing "data:" prefix
      if (!s.startsWith('data:')) {
        return `data:${s}`;
      }
      return s;
    }

    // raw base64 without "base64," marker -> detect and wrap
    const base64Only = s.replace(/\s+/g, '');
    const isBase64Like = base64Only.length > 50 && /^[A-Za-z0-9+/=]+$/.test(base64Only);
    if (isBase64Like) {
      return `data:image/jpeg;base64,${base64Only}`;
    }

    // fallback
    return '/placeholder.png';
  };

  if (loading) {
    return (
      <DashboardLayout title="Class Assignment">
        <p className="text-center text-gray-600">Loading teachers...</p>
      </DashboardLayout>
    );
  }
  return <DashboardLayout title="Class Assignment">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Teacher-Class Assignments
        </h1>
        {/* top "Assign Class" button removed */}
      </div>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Current Assignments
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Each teacher can be assigned to one class.
          </p>
        </div>
        <div className="border-t border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teacher
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  UID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Class
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teachers.map(teacher => <tr key={teacher.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <img className="h-12 w-12 rounded-full object-cover" 
                        src={teacher.picture ? `data:image/jpeg;base64,${teacher.picture}` : "/placeholder.png"}/>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {teacher.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{teacher.uid}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${teacher.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {teacher.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {teacher.class ? <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {teacher.class}
                      </span> : <span className="text-sm text-gray-500">
                        Not assigned
                      </span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {teacher.class && <>
                        <button onClick={() => handleEditAssignment(teacher)} className="text-indigo-600 hover:text-indigo-900 mr-3">
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button onClick={() => handleRemoveAssignment(teacher.id)} className="text-red-600 hover:text-red-900">
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </>}
                    {!teacher.class && teacher.status === 'active' && <button onClick={() => {
                  setFormData({
                    teacherId: teacher.id.toString(),
                    class: ''
                  });
                  setShowAssignModal(true);
                }} className="text-blue-600 hover:text-blue-900">
                        <PlusIcon className="h-5 w-5" />
                      </button>}
                  </td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
      {/* Assign Class Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-50" aria-hidden="true" />
            {/* Modal */}
            <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Assign Class to Teacher
                      </h3>
                      <div className="mt-6 space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Teacher
                          </label>

                          {/* If a teacher was preselected (clicked from the row) show static info,
                              otherwise show the select to choose an available teacher */}
                          {(() => {
                            const t = teachers.find(t => String(t.id) === String(formData.teacherId));
                            if (t) {
                              return (
                                <div className="mt-1 flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <img className="h-12 w-12 rounded-full object-cover" src={formatImageSrc(t.picture)} alt={t.name || 'avatar'} />
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{t.name}</div>
                                    <div className="text-sm text-gray-500">{t.uid}</div>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <>
                                <select id="teacherId" name="teacherId" required value={formData.teacherId} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                  <option value="">Select a teacher</option>
                                  {getAvailableTeachers().map(teacher => (
                                    <option key={teacher.id} value={teacher.id}>
                                      {teacher.name} ({teacher.uid})
                                    </option>
                                  ))}
                                </select>
                                {getAvailableTeachers().length === 0 && !formData.teacherId && (
                                  <p className="mt-1 text-sm text-red-600">
                                    No available teachers. All active teachers are already assigned.
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        <div>
                          <label htmlFor="class" className="block text-sm font-medium text-gray-700">
                            Select Class
                          </label>
                          <select id="class" name="class" required value={formData.class} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                            <option value="">Select a class</option>
                            {getAvailableClassesForAssignment().map(cls => <option key={cls} value={cls}>{cls}</option>)}
                          </select>
                          {getAvailableClassesForAssignment().length === 0 && <p className="mt-1 text-sm text-red-600">
                            No available classes. All classes are already assigned.
                          </p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm" disabled={(getAvailableTeachers().length === 0 && !formData.teacherId) || getAvailableClassesForAssignment().length === 0}>
                    Assign Class
                  </button>
                  <button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" onClick={() => setShowAssignModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {showEditModal && selectedTeacher && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-50" aria-hidden="true" />
            {/* Modal */}
            <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full">
              <form onSubmit={handleEditSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Edit Class Assignment
                      </h3>
                      <div className="mt-6 space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Teacher
                          </label>
                          <div className="mt-1 flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <img className="h-12 w-12 rounded-full object-cover" src={formatImageSrc(selectedTeacher.picture)} alt={selectedTeacher.name || 'avatar'} />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {selectedTeacher.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {selectedTeacher.uid}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="class" className="block text-sm font-medium text-gray-700">
                            Select Class
                          </label>
                          <select id="class" name="class" required value={formData.class} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                            <option value="">Select a class</option>
                            {getAvailableClassesForAssignment(selectedTeacher.class).map(cls => <option key={cls} value={cls}>
                                {cls}
                              </option>)}
                            {selectedTeacher.class && <option value={selectedTeacher.class}>
                                {selectedTeacher.class}
                              </option>}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm">
                    Update Assignment
                  </button>
                  <button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>;
};
export default ClassAssignment;