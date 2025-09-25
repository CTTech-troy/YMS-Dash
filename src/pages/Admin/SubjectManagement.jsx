// src/pages/Admin/SubjectManagement.jsx
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { PlusIcon, TrashIcon, EyeIcon } from 'lucide-react';
import { toast } from 'sonner';

const SubjectManagement = () => {
  const [teacherList, setTeacherList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [modalAnimateIn, setModalAnimateIn] = useState(false);
  const [noAssignment, setNoAssignment] = useState(false);
  const API_BASE = (import.meta.env.VITE_API_URL || 'https://yms-backend-lp9y.onrender.com').replace(/\/$/, '');

  // Load subjects from backend and group by teacher
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/subjects`);
        if (!res.ok) throw new Error(`Failed to fetch subjects (${res.status})`);
        const data = await res.json();
        const map = {};
        data.forEach(s => {
          const key = s.teacherUid || 'unassigned';
          if (!map[key]) {
            map[key] = {
              id: key,
              name: s.teachersName || s.teacherName || (s.teacherUid ? s.teacherUid : 'Unassigned'),
              uid: s.teacherUid || '',
              picture: s.teacherImg || null,
              subjects: []
            };
          }
          map[key].subjects.push({
            id: s.id || s._id || `${s.subjectName}-${Math.random().toString(36).slice(2, 8)}`,
            name: s.subjectName || s.name || 'Unnamed Subject',
            class: s.subjectClass || s.class || 'Unknown'
          });
        });
        const list = Object.values(map);
        if (mounted && list.length > 0) setTeacherList(list);
      } catch (err) {
        console.error('Failed to load subjects', err);
        toast.error('Could not load subjects from server.');
      }
    })();
    return () => { mounted = false; };
  }, [API_BASE]);

  const handleCloseSubjectsModal = () => {
    setModalAnimateIn(false);
    setTimeout(() => {
      setShowSubjectsModal(false);
      setSelectedTeacher(null);
    }, 180);
  };

  useEffect(() => {
    if (!showSubjectsModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') handleCloseSubjectsModal();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow || '';
      window.removeEventListener('keydown', onKey);
    };
  }, [showSubjectsModal]);

  const handleViewSubjects = (teacher) => {
    if (!teacher) {
      setNoAssignment(true);
      return;
    }
    const subjects = Array.isArray(teacher.subjects) ? teacher.subjects : [];
    setTeacherInfo({
      id: teacher.id,
      uid: teacher.uid,
      name: teacher.name,
      picture: teacher.picture
    });
    setTeacherSubjects(subjects);

    if (subjects.length === 0) {
      setNoAssignment(true);
      return;
    }

    setSelectedTeacher({ ...teacher, subjects });
    setShowSubjectsModal(true);
    setModalAnimateIn(false);
    setTimeout(() => setModalAnimateIn(true), 10);
  };

  const handleDeleteSubject = (teacherId, subjectId) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    const updatedTeachers = teacherList.map(teacher => {
      if (String(teacher.id) === String(teacherId) || String(teacher.uid) === String(teacherId)) {
        return {
          ...teacher,
          subjects: teacher.subjects.filter(subject => String(subject.id) !== String(subjectId))
        };
      }
      return teacher;
    });
    setTeacherList(updatedTeachers);

    if (selectedTeacher && (String(selectedTeacher.id) === String(teacherId) || String(selectedTeacher.uid) === String(teacherId))) {
      setSelectedTeacher({
        ...selectedTeacher,
        subjects: selectedTeacher.subjects.filter(subject => String(subject.id) !== String(subjectId))
      });
    }
    toast.success('Subject deleted successfully!');
  };

  const filteredTeachers = teacherList.filter(teacher => 
    (teacher.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (teacher.uid || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return <DashboardLayout title="Subject Management">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Teacher Subjects
        </h1>
      </div>

      {/* Search */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="w-full sm:w-96">
            <label htmlFor="search" className="sr-only">Search</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input id="search" name="search" className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Search by teacher name or ID" type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Teachers Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subjects Count</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTeachers.map(teacher => <tr key={String(teacher.id || teacher.uid)}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <img className="h-10 w-10 rounded-full object-cover" src={teacher.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || teacher.uid || 'User')}&background=E5E7EB&color=374151`} alt={teacher.name || teacher.uid} />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{teacher.uid || ''}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">{teacher.subjects.length} subjects</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleViewSubjects(teacher)} className="text-blue-600 hover:text-blue-900 mr-3">
                    <EyeIcon className="h-5 w-5" />
                  </button>
                </td>
              </tr>)}
            {filteredTeachers.length === 0 && <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">No teachers found matching your search.</td>
              </tr>}
          </tbody>
        </table>
      </div>

      {/* View Subjects Modal */}
      {showSubjectsModal && selectedTeacher && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-40 transition-opacity" onClick={handleCloseSubjectsModal} />
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className={`inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full ${modalAnimateIn ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`} style={{ transitionDuration: '180ms' }} onClick={(e) => e.stopPropagation()}>
              <div className="bg-white px-6 pt-6 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="flex-shrink-0">
                    <img src={selectedTeacher.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTeacher.name || selectedTeacher.uid || 'User')}&background=E5E7EB&color=374151`} alt={selectedTeacher.name} className="h-12 w-12 rounded-full object-cover" />
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-4">
                    <h3 id="modal-title" className="text-lg leading-6 font-medium text-gray-900">{selectedTeacher.name}'s Subjects</h3>
                    <p className="mt-1 text-sm text-gray-500">Teacher ID: {selectedTeacher.uid}</p>
                  </div>
                </div>
                <div className="mt-5">
                  {selectedTeacher.subjects && selectedTeacher.subjects.length > 0 ? (
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Subjects by Class</h4>
                      {Object.entries(selectedTeacher.subjects.reduce((acc, subject) => {
                        const k = subject.class || 'Unspecified';
                        if (!acc[k]) acc[k] = [];
                        acc[k].push(subject);
                        return acc;
                      }, {})).map(([className, subjects]) => (
                        <div key={className} className="mb-4">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">{className}</h5>
                          <ul className="space-y-2">
                            {subjects.map(subject => (
                              <li key={subject.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                <div>
                                  <div className="text-sm text-gray-800 font-medium">{subject.name}</div>
                                  {subject.subjectCode && <div className="text-xs text-gray-500">{subject.subjectCode}</div>}
                                </div>
                                <div className="flex items-center space-x-3">
                                  <button onClick={() => handleDeleteSubject(selectedTeacher.uid || selectedTeacher.id, subject.id)} className="text-red-600 hover:text-red-900" title="Remove subject">
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">No subjects found for this teacher.</div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={handleCloseSubjectsModal} className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:ml-3 sm:w-auto sm:text-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>;
};

export default SubjectManagement;
