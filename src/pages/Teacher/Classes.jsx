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
  // Control visibility of mark attendance modal
  const [showMarkAttendanceModal, setShowMarkAttendanceModal] = useState(false);
  const [showStudentHistoryModal, setShowStudentHistoryModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateOption, setSelectedDateOption] = useState('today');
  const [activeTab, setActiveTab] = useState('students');

  // ============================================================================
  // STATE: Data from Backend
  // ============================================================================
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(true);

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
  const API_BASE = (import.meta.env.VITE_API_URL || ' https://yms-backend-a2x4.onrender.com').replace(/\/$/, '');
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
  /**
   * Main effect to load students when component mounts.
   * 
   * Process:
   * 1. Extract teacher UID and assigned class from auth/localStorage
   * 2. Detect if user is admin/principal (assignedClass === 'admin'/'principal'/etc)
   * 3. Fetch teacher record to get accurate assignedClass
   * 4. Query students API with class filter if teacher, or all students if admin
   * 5. Normalize student data (lowercase class, handle image paths)
   * 6. Filter students by class if teacher
   * 7. Fetch results/grades for the class or teacher
   */
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
            picture: s.picture || s.avatar || '',
            attendance: s.attendance || { present: 0, absent: 0, total: 0, history: [] }
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

        // ========================================
        // FETCH RESULTS/GRADES
        // ========================================
        try {
          setResultsLoading(true);
          const RESULTS_BASE = `${API_BASE}/api/results`;
          let rUrl = RESULTS_BASE;
          
          if (!adminMode) {
            if (normalizedAssignedClass) rUrl = `${RESULTS_BASE}?class=${encodeURIComponent(normalizedAssignedClass)}`;
            else if (staffIdFromAuth) rUrl = `${RESULTS_BASE}?teacherUid=${encodeURIComponent(staffIdFromAuth)}`;
          }
          
          const rRes = await fetch(rUrl);
          if (rRes.ok) {
            const rRaw = await rRes.json().catch(() => []);
            const rArr = Array.isArray(rRaw) ? rRaw : (rRaw.data || rRaw.results || []);
            setResults(rArr);
          } else {
            const rf = await fetch(RESULTS_BASE);
            if (rf.ok) {
              const rr = await rf.json().catch(() => []);
              setResults(Array.isArray(rr) ? rr : (rr.data || rr.results || []));
            } else {
              setResults([]);
            }
          }
        } catch (e) {
          console.warn('Failed fetching results', e);
          setResults([]);
        } finally {
          setResultsLoading(false);
        }
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
  /**
   * Fetch subjects from API on component mount.
   * 
   * Process:
   * 1. Call fetchSubjects() to get all subjects
   * 2. Normalize subject fields (subjectName, subjectClass, etc.)
   * 3. Filter subjects by assigned class if teacher
   * 4. Show all subjects if admin
   */
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
          : (assignedClass ? mapped.filter(m => String(m.class).trim() === String(assignedClass).trim()) : mapped);
        
        setClassSubjects(visible);
      } catch (err) {
        console.error('Failed to load subjects', err);
        toast.error('Could not load subjects');
      }
    };
    load();
  }, [SUBJECTS_BASE, assignedClass, isAdminView]);

  // ============================================================================
  // HANDLER: Open Attendance Modal
  // ============================================================================
  /**
   * Initialize attendance modal when "Mark Attendance" button is clicked.
   * 
   * Sets all students to "present" by default, then shows modal.
   */
  const handleOpenAttendanceModal = () => {
    // Initialize attendance: all students present by default
    const initialAttendance = {};
    students.forEach(student => {
      initialAttendance[student.id] = true;
    });
    setAttendance(initialAttendance);
    setSelectedDateOption('today');
    setAttendanceDate(new Date().toISOString().split('T')[0]);
    setShowMarkAttendanceModal(true);
  };

  // ============================================================================
  // HANDLER: Toggle Student Attendance
  // ============================================================================
  /**
   * Toggle attendance status for a single student.
   * Flips the boolean value for the given student ID.
   */
  const toggleAttendance = studentId => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // ============================================================================
  // HANDLER: Change Attendance Date
  // ============================================================================
  /**
   * Handle date option change in attendance modal.
   * 
   * Updates attendanceDate based on selected option:
   * - 'today': use current date
   * - 'yesterday': use yesterday's date
   * - 'custom': keep current selected date (user can input manually)
   */
  const handleDateOptionChange = option => {
    setSelectedDateOption(option);
    let date = new Date();
    if (option === 'yesterday') {
      date.setDate(date.getDate() - 1);
    } else if (option === 'custom') {
      // Keep the current selected date, don't auto-update
      return;
    }
    setAttendanceDate(date.toISOString().split('T')[0]);
  };

  // ============================================================================
  // HANDLER: Save Attendance
  // ============================================================================
  /**
   * Save attendance to backend (currently just shows success toast).
   * In production, this would POST attendance data to an API endpoint.
   */
  const handleSaveAttendance = () => {
    // In a real application, this would save to a database
    toast.success('Attendance saved successfully!');
    setShowMarkAttendanceModal(false);
  };

  // ============================================================================
  // HANDLER: View Student History
  // ============================================================================
  /**
   * Open student history/details modal for a specific student.
   */
  const handleViewStudentHistory = student => {
    setSelectedStudent(student);
    setShowStudentHistoryModal(true);
  };

  // ============================================================================
  // COMPUTED: Filter Students by Search Query
  // ============================================================================
  /**
   * Filter students list by search query (name or student ID).
   * Case-insensitive partial matching.
   */
  const filteredStudents = students.filter(
    student =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.uid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ============================================================================
  // HANDLER: Open Add Subject Modal
  // ============================================================================
  /**
   * Initialize and open "Add Subject" modal.
   * Default subject class to teacher's assigned class.
   */
  const handleOpenAddSubject = () => {
    setNewSubjectName('');
    // Auto-fill subject class with teacher's assigned class
    setNewSubjectClass(assignedClass || '');
    setNewSubjectCode('');
    setShowAddSubjectModal(true);
  };

  // ============================================================================
  // HELPER: Generate Auto Course Code
  // ============================================================================
  /**
   * Generate a short deterministic course code from subject name + class.
   * 
   * Format: {3-letter initials}-{class code}-{timestamp suffix}
   * Example: "ENG-JSS1-A2B3"
   * 
   * @param {string} name - Subject name
   * @param {string} klass - Class name
   * @returns {string} Generated course code
   */
  function generateCourseCode(name = '', klass = '') {
    // Remove non-alphanumeric characters and convert to uppercase
    const clean = str =>
      String(str || '')
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .trim();
    const n = clean(name);
    const k = clean(klass);
    
    // Extract initials from subject name (max 3 letters)
    const initials = n
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w[0])
      .slice(0, 3)
      .join('');
    
    // Extract class code (alphanumeric characters, max 4)
    const classCode = (k.match(/[A-Z0-9]+/g) || []).join('').slice(0, 4);
    
    // Add short timestamp suffix for uniqueness
    const suffix = String(Date.now()).slice(-4);
    
    return `${initials || 'SUB'}-${classCode || 'CLS'}-${suffix}`;
  }

  // ============================================================================
  // HANDLER: Add New Subject
  // ============================================================================
  /**
   * Create a new subject via API and add to local state.
   * 
   * Validates input, sends POST request to /api/subjects, and updates UI.
   * Only adds to local list if subject class matches teacher's assigned class (or if admin).
   */
  const handleAddSubject = async () => {
    const name = newSubjectName.trim();
    const klass = newSubjectClass.trim();
    const code = newSubjectCode.trim();
    
    // Validation
    if (!name) return toast.error('Please enter a subject name');
    if (!klass) return toast.error('Please select a class');

    // Build request payload with teacher/staff identity
    const payload = {
      subjectName: name,
      // Ensure we submit the teacher's assigned class
      subjectClass: assignedClass || klass,
      subjectCode: code || null,
      // Attach current staff identity
      teacherUid: staffIdFromAuth || localStorage.getItem('uid') || null,
      teacherImg: currentUser?.photoURL || localStorage.getItem('img') || null,
      teachersName: staffNameFromAuth || localStorage.getItem('name') || null,
      staffId: staffIdFromAuth || localStorage.getItem('uid') || null,
      staffName: staffNameFromAuth || localStorage.getItem('name') || null
    };

    try {
      // POST to /api/subjects
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
      if (!assignedClass || String(newEntry.class).trim() === String(assignedClass).trim()) {
        setClassSubjects(prev => [...prev, newEntry]);
      }
      
      toast.success('Subject added');
      setShowAddSubjectModal(false);
    } catch (err) {
      console.error('Failed adding subject', err);
      toast.error('Could not add subject');
    }
  };

  // ============================================================================
  // HANDLER: Open Subject Details Modal
  // ============================================================================
  /**
   * Open modal to view/edit subject details.
   * Initialize edit fields from subject data.
   * Trigger animation on open.
   */
  const handleOpenSubjectModal = subject => {
    setModalSubject(subject);
    setEditName(subject.subjectName || subject.name || '');
    setEditClass(subject.subjectClass || subject.class || '');
    setEditCode(subject.subjectCode || subject.code || '');
    setIsEditingSubject(false);
    setShowSubjectModal(true);
    // Trigger enter animation after render
    setModalAnimateIn(false);
    setTimeout(() => setModalAnimateIn(true), 10);
  };

  // ============================================================================
  // HANDLER: Close Subject Details Modal
  // ============================================================================
  /**
   * Close subject modal with exit animation.
   * Resets all modal state.
   */
  const handleCloseSubjectModal = () => {
    // Play exit animation then close
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
  /**
   * Switch subject modal to edit mode.
   * Allows user to modify subject fields.
   */
  const handleStartEdit = () => {
    setIsEditingSubject(true);
  };

  // ============================================================================
  // HANDLER: Cancel Subject Edit
  // ============================================================================
  /**
   * Cancel subject editing and revert changes.
   * Resets edit fields to original values.
   */
  const handleCancelEdit = () => {
    // Reset edits to original values
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
  /**
   * Delete a subject via API (DELETE /api/subjects/:id).
   * Remove from local state on success.
   */
  const handleDeleteSubject = async (id) => {
    if (!id) return;
    try {
      const { res } = await fetchSubjects(`/${id}`, { method: 'DELETE' });
      if (res.ok) {
        // Remove from local state
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
    }
  };

  // ============================================================================
  // HANDLER: Save Subject Changes
  // ============================================================================
  /**
   * Update a subject via API (PUT /api/subjects/:id).
   * Update local state and modal on success.
   */
  const handleSaveSubject = async () => {
    if (!modalSubject) return;
    const id = modalSubject.id;
    
    // Build update payload
    const payload = {
      subjectName: editName.trim(),
      subjectClass: editClass.trim(),
      subjectCode: editCode.trim() || null
    };
    
    try {
      // PUT to /api/subjects/:id
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
      
      // Update local subjects list
      setClassSubjects(prev => prev.map(s => (String(s.id) === String(id) ? {
        id: updated.id || id,
        name: updated.subjectName || payload.subjectName,
        class: updated.subjectClass || payload.subjectClass,
        subjectCode: updated.subjectCode || payload.subjectCode,
        teacherUid: updated.teacherUid || s.teacherUid
      } : s)));
      
      toast.success('Subject updated');
      // Refresh modal content
      setModalSubject(prev => ({ ...prev, ...updated }));
      setIsEditingSubject(false);
    } catch (err) {
      console.error('Update network error', err);
      toast.error('Could not update subject');
    }
  };

  // ============================================================================
  // HELPER: Convert Image to Display Source
  // ============================================================================
  /**
   * Convert various image formats to displayable src.
   * Handles:
   * - data: URIs (already formatted)
   * - HTTP(S) URLs or site-relative paths
   * - Raw base64 strings (converts to data: URI)
   * - Objects with base64/data fields
   * - Mongo/Mongoose Buffer objects
   * - Uint8Array/ArrayBuffer (converts to object URL)
   * - Null/falsy values (returns default avatar)
   * 
   * @param {*} input - Image data in various formats
   * @param {string} mimeGuess - MIME type guess (default 'jpeg')
   * @returns {string} Valid image src URL
   */
  function getImageSrc(input, mimeGuess = 'jpeg') {
    if (input == null) return '/images/default-avatar.png';

    // Handle string input
    if (typeof input === 'string') {
      const s = input.trim();
      if (!s) return '/images/default-avatar.png';
      if (s.startsWith('data:')) return s;  // Already a data: URI
      if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;  // HTTP URL or site-relative path
      // Raw base64 string (no data: prefix) — convert to data: URI
      if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 50) {
        return `data:image/${mimeGuess};base64,${s}`;
      }
      return s;
    }

    // Handle object input
    if (typeof input === 'object') {
      // Check for URL-like fields
      if (typeof input.src === 'string' && input.src.trim()) return getImageSrc(input.src, mimeGuess);
      if (typeof input.url === 'string' && input.url.trim()) return getImageSrc(input.url, mimeGuess);

      // Check for { base64: '...' } or { data: '...' }
      if (typeof input.base64 === 'string' && input.base64.trim()) {
        const s = input.base64.trim();
        return s.startsWith('data:') ? s : `data:image/${mimeGuess};base64,${s}`;
      }
      if (typeof input.data === 'string' && input.data.trim()) {
        const s = input.data.trim();
        return s.startsWith('data:') ? s : `data:${input.type || `image/${mimeGuess}`};base64,${s}`;
      }

      // Mongo/Mongoose Buffer-like: { data: [num, ...] } or { buffer: { data: [...] } }
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

      // Handle Uint8Array or ArrayBuffer
      if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
        const blob = input instanceof ArrayBuffer 
          ? new Blob([input], { type: `image/${mimeGuess}` }) 
          : new Blob([input.buffer || input], { type: `image/${mimeGuess}` });
        return URL.createObjectURL(blob);
      }
    }

    // Fallback
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
        <p className="mt-1 text-xs sm:text-sm text-gray-500 truncate whitespace-nowrap max-w-[36rem]">Manage your class, students</p>
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
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add
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
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      View Details
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
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(modalSubject.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        Delete
                      </button>
                      <button
                        onClick={handleStartEdit}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300 text-xs sm:text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSubject}
                        className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs sm:text-sm"
                      >
                        Save
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
              <button type="button" onClick={() => setShowAddSubjectModal(false)} className="px-4 py-2 rounded border bg-white">
                Cancel
              </button>
              <button type="button" onClick={handleAddSubject} className="px-4 py-2 rounded bg-green-600 text-white">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Attendance Modal (not shown in current tabs) */}
      {showMarkAttendanceModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" />
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 truncate whitespace-nowrap">
                      Mark Attendance {assignedClass ? `- ${assignedClass}` : ''}
                    </h3>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <button
                          type="button"
                          onClick={() => handleDateOptionChange('today')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                            selectedDateOption === 'today' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-gray-100 text-gray-800 border border-gray-300'
                          }`}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDateOptionChange('yesterday')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                            selectedDateOption === 'yesterday' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-gray-100 text-gray-800 border border-gray-300'
                          }`}
                        >
                          Yesterday
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDateOptionChange('custom')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                            selectedDateOption === 'custom' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-gray-100 text-gray-800 border border-gray-300'
                          }`}
                        >
                          Custom Date
                        </button>
                      </div>
                      {selectedDateOption === 'custom' && (
                        <input
                          type="date"
                          id="attendanceDate"
                          value={attendanceDate}
                          onChange={e => setAttendanceDate(e.target.value)}
                          className="mt-1 mb-4 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      )}
                      <div className="text-sm text-gray-600 mb-4">
                        Marking attendance for:{' '}
                        <span className="font-medium">
                          {selectedDateOption === 'today'
                            ? 'Today'
                            : selectedDateOption === 'yesterday'
                            ? 'Yesterday'
                            : new Date(attendanceDate).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Students</h4>
                      <ul className="divide-y divide-gray-200">
                        {students.map(student => (
                          <li key={student.id} className="py-3 flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8">
                                <img className="h-8 w-8 rounded-full" src={getImageSrc(student.picture)} alt="" />
                              </div>
                              <div className="ml-3">
                                <p className="text-sm font-medium text-gray-900">{student.name}</p>
                                <p className="text-sm text-gray-500">{student.uid}</p>
                              </div>
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => toggleAttendance(student.id)}
                                className={`inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white ${
                                  attendance[student.id] ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                } focus:outline-none focus:ring-2 focus:ring-offset-2 ${attendance[student.id] ? 'focus:ring-green-500' : 'focus:ring-red-500'}`}
                              >
                                {attendance[student.id] ? (
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                ) : (
                                  <XIcon className="h-5 w-5" aria-hidden="true" />
                                )}
                              </button>
                              <span className="ml-2 text-sm text-gray-500">{attendance[student.id] ? 'Present' : 'Absent'}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer: Action Buttons */}
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  type="button"
                  className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-3 py-2 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={handleSaveAttendance}
                >
                  Save Attendance
                </button>
                <button
                  type="button"
                  className="w-full sm:w-auto mt-0 inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-3 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => setShowMarkAttendanceModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student History Modal (not shown in current tabs) */}
      {showStudentHistoryModal && selectedStudent && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" />
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10">
                    <img src={getImageSrc(selectedStudent.picture)} alt={selectedStudent.name} className="h-10 w-10 rounded-full" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 truncate whitespace-nowrap">{selectedStudent.name}'s Details</h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 truncate whitespace-nowrap">
                        Student ID: {selectedStudent.uid} | Class: {selectedStudent.class}
                      </p>
                      <p className="text-sm text-gray-500 mt-1 truncate whitespace-nowrap">
                        Overall Attendance: {Math.round((selectedStudent.attendance.present / selectedStudent.attendance.total) * 100)}% ({selectedStudent.attendance.present}/{selectedStudent.attendance.total} days)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Attendance</h4>
                  <ul className="divide-y divide-gray-200">
                    {selectedStudent.attendance.history.map((record, index) => (
                      <li key={index} className="py-3 flex justify-between items-center">
                        <div className="text-sm text-gray-900">
                          {new Date(record.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div>
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {record.status === 'present' ? 'Present' : 'Absent'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Academic Performance</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Average Grade:</span>
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">B+</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Last Assessment:</span>
                      <span className="text-sm text-gray-900">85% (Mathematics)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer: Action Buttons */}
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => setShowStudentHistoryModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Subject modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowAddSubjectModal(false)} />
          {/* modal */}
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
                      {/* <option>SSS 1</option>
                      <option>SSS 2</option> */}
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
              <button type="button" onClick={() => setShowAddSubjectModal(false)} className="px-4 py-2 rounded border bg-white">
                Cancel
              </button>
              <button type="button" onClick={handleAddSubject} className="px-4 py-2 rounded bg-green-600 text-white">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default TeacherClasses;