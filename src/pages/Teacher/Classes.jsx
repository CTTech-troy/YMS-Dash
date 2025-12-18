import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { UserIcon, BookOpenIcon, CheckIcon, XIcon, CalendarIcon, ClipboardListIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext'; 

const API_BASE = import.meta.env.VITE_API_URL || ' https://yms-backend-a2x4.onrender.com';

/**
 * TeacherClasses Component
 * 
 * Main component for managing teacher's class, students, subjects, and attendance.
 * Supports two modes:
 *   1. Teacher view: restricted to assigned class
 *   2. Admin/Principal view: sees all classes and students
 */
const TeacherClasses = () => {
  // ============================================================================
  // STATE: Modal Controls
  // ============================================================================
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('students');

  // ============================================================================
  // STATE: Data from Backend
  // ============================================================================
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);
  // Teacher's assigned class (normalized: lowercase, trimmed, single spaces)
  const [assignedClass, setAssignedClass] = useState('');

  // ============================================================================
  // STATE: Subjects Management
  // ============================================================================
  // List of subjects for the assigned class
  const [classSubjects, setClassSubjects] = useState([]);
  // Control visibility of "add subject" modal
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  // Input field: new subject name
  const [newSubjectName, setNewSubjectName] = useState('');
  // Input field: new subject class
  const [newSubjectClass, setNewSubjectClass] = useState('');
  // Input field: new subject code (optional)
  const [newSubjectCode, setNewSubjectCode] = useState('');
  // Control visibility of subject details modal
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  // Currently selected subject in modal
  const [modalSubject, setModalSubject] = useState(null);
  // Edit mode state for subject modal
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  // Edit fields for subject name
  const [editName, setEditName] = useState('');
  // Edit fields for subject class
  const [editClass, setEditClass] = useState('');
  // Edit fields for subject code
  const [editCode, setEditCode] = useState('');
  // Animation state for modal enter/exit
  const [modalAnimateIn, setModalAnimateIn] = useState(false);

  // ============================================================================
  // CONTEXT: Extract Current User Info
  // ============================================================================
  // Get auth context (useAuth provides currentUser/user)
  const auth = useAuth();
  // Extract current user from auth context (try multiple paths for compatibility)
  const currentUser = auth?.currentUser || auth?.user || null;
  // Get teacher/staff UID from auth or localStorage fallback
  const staffIdFromAuth = currentUser?.uid || currentUser?.id || localStorage.getItem('uid') || null;
  // Get teacher/staff name from auth or localStorage fallback
  const staffNameFromAuth = currentUser?.displayName || currentUser?.name || localStorage.getItem('name') || null;

  // ============================================================================
  // API CONFIGURATION
  // ============================================================================
  // Base API URL (from .env or fallback to production URL)
  const API_BASE = (import.meta.env.VITE_API_URL || 'https://yms-backend-a2x4.onrender.com').replace(/\/$/, '');
  // Endpoint for subjects CRUD operations
  const SUBJECTS_BASE = `${API_BASE}/api/subjects`;
  // Endpoint for students list/crud
  const STUDENTS_BASE = `${API_BASE}/api/students`;
  // Endpoint for teachers data
  const TEACHERS_BASE = `${API_BASE}/api/teachers`;
  
  // ============================================================================
  // HELPER: Fetch Subjects with Error Handling
  // ============================================================================
  /**
   * Fetch subjects from API with proper error handling.
   * Ensures all requests go to SUBJECTS_BASE endpoint.
   * 
   * @param {string} pathSuffix - Additional path (e.g., "/:id")
   * @param {object} fetchOptions - Fetch options (method, headers, body)
   * @returns {object} { res, url } - Response object and URL used
   */
  async function fetchSubjects(pathSuffix = '', fetchOptions) {
    const p = pathSuffix && !pathSuffix.startsWith('/') ? `/${pathSuffix}` : (pathSuffix || '');
    const url = `${SUBJECTS_BASE}${p}`;
    try {
      const res = await fetch(url, fetchOptions);
      if (!res.ok) {
        const body = await res.text().catch(() => null);
        console.error('Request failed', { url, status: res.status, body });
        const err = new Error('Request failed');
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return { res, url };
    } catch (err) {
      console.error('Network error for', url, err);
      throw err;
    }
  }

  // ============================================================================
  // EFFECT: Load Students from Backend on Mount
  // ============================================================================
  useEffect(() => {
    const loadStudentsForTeacher = async () => {
      setStudentsLoading(true);
      
      try {
        // Extract teacher UID (prefer auth, fallback to localStorage)
        const uid = staffIdFromAuth || localStorage.getItem('uid');
        let assignedClass = currentUser?.assignedClass || localStorage.getItem('assignedClass') || null;
        
        // Detect admin/principal mode from assignedClass string (DON'T TOUCH THIS)
        const acLower = assignedClass ? String(assignedClass).trim().toLowerCase() : '';
        const adminInitial = acLower === 'admin' || acLower === 'principal' || acLower === 'headmaster' || acLower === 'head';
        
        setIsAdminView(!!adminInitial);

        // ========================================
        // FETCH TEACHER RECORD TO GET ACCURATE assignedClass
        // ========================================
        if (uid && !adminInitial) {
          try {
            // Try endpoint: GET /api/teachers/:uid
            let tRes = await fetch(`${TEACHERS_BASE}/${encodeURIComponent(uid)}`);
            if (!tRes.ok) {
              // Fallback: try query param: GET /api/teachers?uid=...
              tRes = await fetch(`${TEACHERS_BASE}?uid=${encodeURIComponent(uid)}`);
            }
            if (tRes.ok) {
              const tData = await tRes.json();
              // Handle array response or single object
              const teacher = Array.isArray(tData) ? tData[0] : tData;
              // Update assignedClass from teacher record (try multiple field names)
              assignedClass = teacher?.assignedClass || teacher?.classAssigned || teacher?.class || assignedClass || currentUser?.assignedClass;
              
              console.debug('Fetched teacher record:', {
                uid,
                assignedClass,
                teacher: teacher?.name || 'unknown'
              });
            }
          } catch (err) {
            console.error('Failed to fetch teacher assignment', err);
          }
        }

        // Normalize assignedClass for comparison
        const normalizedAssignedClass = assignedClass 
          ? String(assignedClass).trim().toLowerCase().replace(/\s+/g, ' ')
          : '';

        // Determine admin mode after getting accurate assignedClass (DON'T TOUCH THIS)
        const adminMode = normalizedAssignedClass === 'admin'
          || normalizedAssignedClass === 'principal'
          || normalizedAssignedClass === 'headmaster'
          || normalizedAssignedClass === 'head';

        setAssignedClass(normalizedAssignedClass);
        setIsAdminView(!!adminMode);

        // ========================================
        // FETCH ALL STUDENTS FROM API (10 per load, cursor pagination)
        // ========================================
        let allStudents = [];
        let nextToken = null;
        let hasMore = true;

        try {
          while (hasMore) {
            let url = `${STUDENTS_BASE}?limit=10`;
            if (nextToken) {
              url += `&startAfter=${encodeURIComponent(nextToken)}`;
            }

            const sRes = await fetch(url);
            if (!sRes.ok) {
              console.error('Students fetch failed', { status: sRes.status, url });
              break; // stop pagination on error
            }

            const raw = await sRes.json().catch(() => null);
            const pageData = raw?.data || [];
            
            if (Array.isArray(pageData) && pageData.length > 0) {
              allStudents = allStudents.concat(pageData);
              console.debug('Loaded page of students:', {
                pageCount: pageData.length,
                totalSoFar: allStudents.length
              });
            }

            nextToken = raw?.nextPageToken || null;
            hasMore = raw?.hasMore === true;
          }

          console.debug('Fetched all students from API:', {
            totalCount: allStudents.length,
            endpoint: STUDENTS_BASE
          });
        } catch (err) {
          console.error('Network error fetching students', err);
          toast.error('Could not load students from server. Please try again later.');
          setStudentsLoading(false);
          return;
        }

        // ========================================
        // NORMALIZE STUDENTS DATA
        // ========================================
        const normalized = allStudents.map(s => {
          const detectedClass = (s.class || s.studentClass || s.className || s.grade || s.classroom || '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
        
          return {
            raw: s,
            id: s.id || s._id || s.studentId || Math.random().toString(36).slice(2, 9),
            name: s.name || s.fullName || s.studentName || 'Unnamed',
            uid: s.uid || s.studentUid || s.studentId || '',
            class: detectedClass,
            picture: s.picture || s.avatar || ''
          };
        });

        setStudents(normalized);

        // ========================================
        // FILTER BY TEACHER'S CLASS (if not admin)
        // ========================================
        let finalList = [];
        
        if (adminMode) {
          finalList = normalized;
          console.debug('Admin mode: showing all students', { count: finalList.length });
        } else if (normalizedAssignedClass) {
          finalList = normalized.filter(student => student.class === normalizedAssignedClass);
          console.debug('Teacher mode: filtered students', {
            teacherClass: normalizedAssignedClass,
            matchedCount: finalList.length
          });
        } else {
          finalList = normalized;
        }

        setStudents(finalList);
      } catch (err) {
        console.error('Unexpected error in loadStudentsForTeacher', err);
        setStudents([]);
        toast.error('An unexpected error occurred. Please try again.');
      } finally {
        setStudentsLoading(false);
      }
    };

    loadStudentsForTeacher();
  }, [STUDENTS_BASE, TEACHERS_BASE, staffIdFromAuth, currentUser?.assignedClass]);

  // ============================================================================
  // EFFECT: Load Subjects on Mount
  // ============================================================================
  useEffect(() => {
    const load = async () => {
      try {
        const { res, url } = await fetchSubjects('');
        console.debug('Got subjects from', url);
        const data = await res.json();
        
        // Map API response to consistent subject shape
        const mapped = (Array.isArray(data) ? data : []).map(s => ({
          id: s.id || s._id || s.classId,
          name: s.subjectName || s.name || 'Unnamed Subject',
          class: s.subjectClass || s.class || '',
          subjectCode: s.subjectCode || s.code || '',
          teacherImg: s.teacherImg || s.teacherImage || null,
          teachersName: s.teachersName || s.teacherName || null,
          teacherUid: s.teacherUid || null
        }));
        
        // Filter subjects: show all if admin, else restrict to assigned class
        const visible = isAdminView 
          ? mapped 
          : (assignedClass ? mapped.filter(m => String(m.class).trim().toLowerCase().replace(/\s+/g, ' ') === String(assignedClass).trim().toLowerCase().replace(/\s+/g, ' ')) : mapped);
        
        setClassSubjects(visible);
      } catch (err) {
        console.error('Failed to load subjects', err);
        toast.error('Could not load subjects');
      }
    };
    load();
  }, [SUBJECTS_BASE, assignedClass, isAdminView]);

  // ============================================================================
  // COMPUTED: Filter Students by Search Query
  // ============================================================================
  const filteredStudents = students.filter(
    student =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.uid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ============================================================================
  // BUTTON LOADING STATE
  // ============================================================================
  // holds key of the current action e.g. 'addSubject', 'delete-<id>', 'saveSubject', 'view-<id>'
  const [loadingAction, setLoadingAction] = useState(null);

  // ============================================================================
  // HANDLER: Open Add Subject Modal (shows brief loading)
  // ============================================================================
  const handleOpenAddSubject = () => {
    // show quick loading feedback
    setLoadingAction('openAdd');
    setNewSubjectName('');
    setNewSubjectClass(assignedClass || '');
    setNewSubjectCode('');
    setShowAddSubjectModal(true);
    // clear loading after short delay (UI feedback only)
    setTimeout(() => setLoadingAction(null), 300);
  };

  // ============================================================================
  // HANDLER: Add New Subject
  // ============================================================================
  const handleAddSubject = async () => {
    const name = newSubjectName.trim();
    const klass = newSubjectClass.trim();
    const code = newSubjectCode.trim();
    
    // Validation
    if (!name) return toast.error('Please enter a subject name');
    if (!klass) return toast.error('Please select a class');

    setLoadingAction('addSubject');

    // Build request payload with teacher/staff identity
    const payload = {
      subjectName: name,
      subjectClass: assignedClass || klass,
      subjectCode: code || null,
      teacherUid: staffIdFromAuth || localStorage.getItem('uid') || null,
      teacherImg: currentUser?.photoURL || localStorage.getItem('img') || null,
      teachersName: staffNameFromAuth || localStorage.getItem('name') || null,
      staffId: staffIdFromAuth || localStorage.getItem('uid') || null,
      staffName: staffNameFromAuth || localStorage.getItem('name') || null
    };

    try {
      const { res } = await fetchSubjects('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const created = await res.json();
      
      // Build new subject entry from response
      const newEntry = {
        id: created.id || created._id || (classSubjects.length ? Math.max(...classSubjects.map(s => s.id)) + 1 : 1),
        name: created.subjectName || name,
        class: created.subjectClass || (assignedClass || klass),
        subjectCode: created.subjectCode || code,
        teacherUid: created.teacherUid || payload.teacherUid,
        teachersName: created.teachersName || payload.teachersName,
        staffId: created.staffId || payload.staffId,
        staffName: created.staffName || payload.staffName
      };
      
      // Only add to local list if it belongs to teacher's assigned class
      if (!assignedClass || String(newEntry.class).trim().toLowerCase().replace(/\s+/g, ' ') === String(assignedClass).trim().toLowerCase().replace(/\s+/g, ' ')) {
        setClassSubjects(prev => [...prev, newEntry]);
      }
      
      toast.success('Subject added');
      setShowAddSubjectModal(false);
    } catch (err) {
      console.error('Failed adding subject', err);
      toast.error('Could not add subject');
    } finally {
      setLoadingAction(null);
    }
  };

  // ============================================================================
  // HANDLER: Open Subject Details Modal (brief loading)
  // ============================================================================
  const handleOpenSubjectModal = subject => {
    const key = `view-${subject.id}`;
    setLoadingAction(key);
    setModalSubject(subject);
    setEditName(subject.subjectName || subject.name || '');
    setEditClass(subject.subjectClass || subject.class || '');
    setEditCode(subject.subjectCode || subject.code || '');
    setIsEditingSubject(false);
    setShowSubjectModal(true);
    setModalAnimateIn(false);
    setTimeout(() => setModalAnimateIn(true), 10);
    // brief UI feedback
    setTimeout(() => setLoadingAction(null), 200);
  };

  // ============================================================================
  // HANDLER: Close Subject Details Modal
  // ============================================================================
  const handleCloseSubjectModal = () => {
    setModalAnimateIn(false);
    setTimeout(() => {
      setModalSubject(null);
      setIsEditingSubject(false);
      setShowSubjectModal(false);
    }, 180);
  };

  // ============================================================================
  // HANDLER: Start Edit Mode in Subject Modal
  // ============================================================================
  const handleStartEdit = () => {
    setIsEditingSubject(true);
  };

  // ============================================================================
  // HANDLER: Cancel Subject Edit
  // ============================================================================
  const handleCancelEdit = () => {
    if (modalSubject) {
      setEditName(modalSubject.subjectName || modalSubject.name || '');
      setEditClass(modalSubject.subjectClass || modalSubject.class || '');
      setEditCode(modalSubject.subjectCode || modalSubject.code || '');
    }
    setIsEditingSubject(false);
  };

  // ============================================================================
  // HANDLER: Delete Subject
  // ============================================================================
  const handleDeleteSubject = async (id) => {
    if (!id) return;
    const key = `delete-${id}`;
    setLoadingAction(key);
    try {
      const { res } = await fetchSubjects(`/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setClassSubjects(prev => prev.filter(s => String(s.id) !== String(id)));
        toast.success('Subject deleted');
        handleCloseSubjectModal();
      } else {
        const body = await res.text().catch(() => null);
        console.error('Delete failed', body);
        toast.error('Could not delete subject');
      }
    } catch (err) {
      console.error('Delete network error', err);
      toast.error('Could not delete subject');
    } finally {
      setLoadingAction(null);
    }
  };

  // ============================================================================
  // HANDLER: Save Subject Changes
  // ============================================================================
  const handleSaveSubject = async () => {
    if (!modalSubject) return;
    const id = modalSubject.id;
    
    const payload = {
      subjectName: editName.trim(),
      subjectClass: editClass.trim(),
      subjectCode: editCode.trim() || null
    };

    setLoadingAction('saveSubject');
    
    try {
      const { res } = await fetchSubjects(`/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const body = await res.text().catch(() => null);
        console.error('Update failed', body);
        toast.error('Could not update subject');
        return;
      }
      
      const updated = await res.json();
      
      setClassSubjects(prev => prev.map(s => (String(s.id) === String(id) ? {
        id: updated.id || id,
        name: updated.subjectName || payload.subjectName,
        class: updated.subjectClass || payload.subjectClass,
        subjectCode: updated.subjectCode || payload.subjectCode,
        teacherUid: updated.teacherUid || s.teacherUid
      } : s)));
      
      toast.success('Subject updated');
      setModalSubject(prev => ({ ...prev, ...updated }));
      setIsEditingSubject(false);
    } catch (err) {
      console.error('Update network error', err);
      toast.error('Could not update subject');
    } finally {
      setLoadingAction(null);
    }
  };

  // ============================================================================
  // HELPER: Convert Image to Display Source
  // ============================================================================
  function getImageSrc(input, mimeGuess = 'jpeg') {
    if (input == null) return '/images/default-avatar.png';

    if (typeof input === 'string') {
      const s = input.trim();
      if (!s) return '/images/default-avatar.png';
      if (s.startsWith('data:')) return s;
      if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;
      if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 50) {
        return `data:image/${mimeGuess};base64,${s}`;
      }
      return s;
    }

    if (typeof input === 'object') {
      if (typeof input.src === 'string' && input.src.trim()) return getImageSrc(input.src, mimeGuess);
      if (typeof input.url === 'string' && input.url.trim()) return getImageSrc(input.url, mimeGuess);

      if (typeof input.base64 === 'string' && input.base64.trim()) {
        const s = input.base64.trim();
        return s.startsWith('data:') ? s : `data:image/${mimeGuess};base64,${s}`;
      }
      if (typeof input.data === 'string' && input.data.trim()) {
        const s = input.data.trim();
        return s.startsWith('data:') ? s : `data:${input.type || `image/${mimeGuess}`};base64,${s}`;
      }

      const arrData = Array.isArray(input.data) ? input.data : (input.buffer && Array.isArray(input.buffer.data) ? input.buffer.data : null);
      if (arrData) {
        try {
          const uint = new Uint8Array(arrData);
          const blob = new Blob([uint], { type: input.type || `image/${mimeGuess}` });
          return URL.createObjectURL(blob);
        } catch (e) {
          console.warn('Failed converting numeric data to image blob', e);
        }
      }

      if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
        const blob = input instanceof ArrayBuffer 
          ? new Blob([input], { type: `image/${mimeGuess}` }) 
          : new Blob([input.buffer || input], { type: `image/${mimeGuess}` });
        return URL.createObjectURL(blob);
      }
    }

    return '/images/default-avatar.png';
  }
  
  // ============================================================================
  // RENDER: Main Component JSX
  // ============================================================================
  return (
    <DashboardLayout title="My Classes">
      {/* Header with class name and description */}
      <div className="mb-6 min-w-0">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 truncate whitespace-nowrap">{assignedClass || 'My Class'}</h1>
        <p className="mt-1 text-xs sm:text-sm text-gray-500 truncate whitespace-nowrap max-w-[36rem]">Manage your class and students</p>
      </div>

      {/* Tab Navigation: Students | Subjects */}
      <div className="mb-6 border-b border-gray-200">
        <div className="overflow-x-auto">
          <nav className="-mb-px flex space-x-8 min-w-0">
            {/* Students Tab */}
            <button
              onClick={() => setActiveTab('students')}
              className={`${
                activeTab === 'students' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Students
            </button>
            {/* Subjects Tab */}
            <button
              onClick={() => setActiveTab('subjects')}
              className={`${
                activeTab === 'subjects' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Subjects
            </button>
          </nav>
        </div>
      </div>

      {/* TAB: Students */}
      {activeTab === 'students' && (
        <>
          {/* Search Bar + Total Count */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 min-w-0">
              {/* Search Input */}
              <div className="w-full sm:w-96 min-w-0">
                <label htmlFor="search" className="sr-only">
                  Search
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <input
                    id="search"
                    name="search"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Search by name or ID"
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Total Students Count */}
              <div className="flex items-center space-x-4 min-w-0">
                <div className="text-sm text-gray-700 truncate whitespace-nowrap flex items-center gap-2">
                  <span className="font-medium">Total Students:</span>
                  {studentsLoading ? (
                    <span className="inline-flex items-center gap-2 ml-1 text-sm font-semibold text-gray-700">
                      <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <span>Loading…</span>
                    </span>
                  ) : (
                    <span className="inline-block ml-1 font-semibold">{students.length}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Students List */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Students</h2>
            </div>
            <ul className="divide-y divide-gray-200">
              {studentsLoading ? (
                // Show skeleton loaders while loading
                Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="px-6 py-4">
                    <div className="flex items-center justify-between min-w-0">
                      <div className="flex items-center min-w-0">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
                        <div className="ml-4 min-w-0 w-full">
                          <div className="h-4 bg-gray-200 rounded w-48 animate-pulse mb-2" />
                          <div className="h-3 bg-gray-200 rounded w-28 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <>
                  {/* Display filtered students list */}
                  {filteredStudents.map(student => (
                    <li key={student.id} className="px-6 py-4">
                      <div className="flex items-center justify-between min-w-0">
                        <div className="flex items-center min-w-0">
                          {/* Student Avatar */}
                          <div className="flex-shrink-0 h-10 w-10">
                            <img className="h-10 w-10 rounded-full object-cover" src={getImageSrc(student.picture)} alt="" />
                          </div>
                          {/* Student Name and UID */}
                          <div className="ml-4 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate whitespace-nowrap max-w-[14rem] sm:max-w-[20rem]">{student.name}</div>
                            <div className="text-sm text-gray-500 truncate whitespace-nowrap max-w-[10rem]">{student.uid}</div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                  {/* Empty state when no students match search */}
                  {filteredStudents.length === 0 && (
                    <li className="px-6 py-4 text-center text-gray-500">No students found matching your search.</li>
                  )}
                </>
              )}
            </ul>
          </div>
        </>
      )}

      {/* TAB: Subjects */}
      {activeTab === 'subjects' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Header with title and Add button */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-medium text-gray-900 truncate whitespace-nowrap">Class Subjects</h2>
            </div>
            <div className="flex items-center space-x-3 shrink-0">
              {/* Total Subjects Count */}
              <div className="text-sm text-gray-700 truncate whitespace-nowrap">
                <span className="font-medium">Total Subjects:</span>{' '}
                <span className="inline-block ml-1 font-semibold">{classSubjects?.length ?? 0}</span>
              </div>
              {/* Add Subject Button */}
              <button
                onClick={handleOpenAddSubject}
                disabled={!!loadingAction}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                {loadingAction === 'openAdd' || loadingAction === 'addSubject' ? (
                  <span>Loading...</span>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Subjects List */}
          <ul className="divide-y divide-gray-200">
            {classSubjects.map(subject => (
              <li key={subject.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  {/* Subject Icon and Details */}
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <BookOpenIcon className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 truncate whitespace-nowrap max-w-[18rem]">{subject.name}</div>
                      {subject.class && <div className="text-sm text-gray-500 truncate whitespace-nowrap max-w-[18rem]">{subject.class}{subject.subjectCode ? ` • ${subject.subjectCode}` : ''}</div>}
                    </div>
                  </div>
                  {/* View Details Button */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenSubjectModal(subject)}
                      disabled={!!loadingAction}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {loadingAction === `view-${subject.id}` ? 'Loading...' : 'View Details'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Subject Details Modal */}
          {showSubjectModal && modalSubject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              {/* Modal Backdrop */}
              <div className="absolute inset-0 bg-black opacity-50" onClick={handleCloseSubjectModal} />
              {/* Modal Content */}
              <div
                className={
                  `relative bg-white rounded-lg shadow-lg w-full max-w-lg p-6 z-10 transform transition-all duration-180 ease-out ` +
                  (modalAnimateIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95')
                }
                role="dialog"
                aria-modal="true"
              >
                {/* Modal Header */}
                <div className="flex items-start space-x-4 min-w-0">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold truncate whitespace-nowrap">{modalSubject.subjectName || modalSubject.name}</h3>
                    <p className="text-sm text-gray-500 truncate whitespace-nowrap">{modalSubject.teachersName || 'Teacher'}</p>
                  </div>
                </div>
                <div className="mt-4" />
                
                {/* View Mode: Display subject details */}
                {!isEditingSubject ? (
                  <div className="text-sm text-gray-800 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-500">Name</div>
                        <div className="text-sm font-medium text-gray-900 truncate whitespace-nowrap max-w-[18rem]">{modalSubject.subjectName || modalSubject.name}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Class</div>
                        <div className="text-sm font-medium text-gray-900">{modalSubject.subjectClass || modalSubject.class || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Code</div>
                        <div className="text-sm font-medium text-gray-900">{modalSubject.subjectCode || modalSubject.code || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Teacher UID</div>
                        <div className="text-sm font-medium text-gray-900 truncate whitespace-nowrap">{modalSubject.teacherUid || '—'}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Edit Mode: Allow editing subject fields */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Name</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Class</label>
                      <input value={editClass} onChange={e => setEditClass(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Code</label>
                      <input value={editCode} onChange={e => setEditCode(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                  </div>
                )}

                {/* Modal Footer: Action Buttons */}
                <div className="mt-6 flex justify-end space-x-2">
                  {!isEditingSubject ? (
                    <>
                      <button
                        onClick={handleCloseSubjectModal}
                        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                        disabled={!!loadingAction}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(modalSubject.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        disabled={!!loadingAction}
                      >
                        {loadingAction === `delete-${modalSubject.id}` ? 'Loading...' : 'Delete'}
                      </button>
                      <button
                        onClick={handleStartEdit}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        disabled={!!loadingAction}
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300 text-xs sm:text-sm"
                        disabled={!!loadingAction}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSubject}
                        className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs sm:text-sm"
                        disabled={!!loadingAction}
                      >
                        {loadingAction === 'saveSubject' ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowAddSubjectModal(false)} />
          {/* Modal */}
          <div
            className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-subject-title"
          >
            <div className="px-6 pt-6 pb-4">
              <h3 id="add-subject-title" className="text-lg font-medium text-gray-900">
                Add Subject
              </h3>
              
              {/* Class Selection */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Class</label>
                <select
                  value={newSubjectClass}
                  onChange={e => setNewSubjectClass(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 bg-white"
                  disabled={Boolean(assignedClass)}
                >
                  {!assignedClass ? (
                    <>
                      <option value="">Select class</option>
                      <option>Creche</option>
                      <option>KG 1</option>
                      <option>KG 2</option>
                      <option>Nursery 2</option>
                      <option>Basic 1</option>
                      <option>Basic 2</option>
                      <option>Basic 3</option>
                      <option>Basic 4</option>
                      <option>Basic 6</option>
                      <option>JSS 1</option>
                      <option>JSS 2</option>
                      <option>JSS 3</option>
                    
                    </>
                  ) : (
                    <option value={assignedClass}>{assignedClass}</option>
                  )}
                </select>
              </div>

              {/* Subject Name Input */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Subject Name</label>
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={e => setNewSubjectName(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="e.g. Computer Studies"
                  autoFocus
                />
              </div>

              {/* Subject Code Input (Optional) */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Subject Code (optional)</label>
                <input
                  type="text"
                  value={newSubjectCode}
                  onChange={e => setNewSubjectCode(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="e.g. BASIC-SCI-JSS1"
                />
                {/* Show auto-generated code preview when input is empty */}
                {!newSubjectCode && newSubjectName && newSubjectClass && (
                  <div className="mt-2 text-xs text-gray-500">
                    Auto-generated code: <span className="font-medium">{generateCourseCode(newSubjectName, newSubjectClass)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer: Action Buttons */}
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-2">
              <button type="button" onClick={() => setShowAddSubjectModal(false)} className="px-4 py-2 rounded border bg-white" disabled={!!loadingAction}>
                Cancel
              </button>
              <button type="button" onClick={handleAddSubject} className="px-4 py-2 rounded bg-green-600 text-white" disabled={!!loadingAction}>
                {loadingAction === 'addSubject' ? 'Loading...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default TeacherClasses;