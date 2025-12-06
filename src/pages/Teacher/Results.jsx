import React, { useEffect, useState, useRef, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { PlusIcon, EyeIcon, PencilIcon, TrashIcon, MessageCircleIcon, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AuthContext';

/**
 * ========================================
 * MODAL COMPONENT
 * ========================================
 * Reusable modal dialog with:
 * - Backdrop overlay (closes on click)
 * - ESC key support
 * - Focus management
 * - Body overflow hidden on open
 */
const Modal = ({ open, title, onClose, children, className = '' }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    // Prevent body scroll when modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // ESC key closes modal
    const esc = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    // Auto-focus first focusable element
    requestAnimationFrame(() => {
      const node = ref.current;
      if (node) (node.querySelector('button, input, select, textarea') || node).focus();
    });
    // Cleanup
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', esc);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" aria-modal="true" role="dialog">
      {/* Backdrop overlay - click closes modal */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      {/* Modal content */}
      <div ref={ref} onClick={e => e.stopPropagation()} tabIndex={-1}
        className={`relative bg-white rounded-lg shadow-xl max-h-[90vh] w-full sm:max-w-4xl overflow-auto p-6 z-10 ${className}`}>
        {/* Header with title and close button */}
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close modal">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        {/* Modal body */}
        <div>{children}</div>
      </div>
    </div>
  );
};

/**
 * ========================================
 * UTILITY FUNCTIONS
 * ========================================
 */

/**
 * Normalize class name: trim, lowercase, no extra spaces
 * Used for comparing teacher's assignedClass with student's class
 */
const normalizeClass = v => (v ?? '').toString().trim().toLowerCase();

/**
 * Convert base64 picture to data URL with MIME type detection
 * Supports: JPEG, PNG, WebP, or falls back to default avatar
 * Handles: plain base64, data URLs, http(s) URLs, root-relative paths
 */
const normalizePicture = pic => {
  try {
    if (!pic || typeof pic !== 'string') return '/images/default-avatar.png';
    pic = pic.trim();
    // Already a data URL - return as-is
    if (pic.startsWith('data:')) return pic;
    // Already a URL (http, https, or root-relative) - return as-is
    if (/^https?:\/\//i.test(pic) || pic.startsWith('/')) return pic;
    // Plain base64 - detect MIME type by signature
    const safe = pic.replace(/\s+/g, '');
    // JPEG signature: /9j or ffd8 in hex
    if (safe.startsWith('/9j') || safe.startsWith('ffd8')) {
      return `data:image/jpeg;base64,${safe}`;
    }
    // PNG signature: iVBOR (RFC 4648 encoded)
    if (safe.startsWith('iVBOR')) {
      return `data:image/png;base64,${safe}`;
    }
    // WebP signature: UklGR
    if (safe.startsWith('UklGR')) {
      return `data:image/webp;base64,${safe}`;
    }
    // Fallback: if looks like base64 and is long enough, assume JPEG
    if (/^[A-Za-z0-9+/=]+$/.test(safe) && safe.length > 80) {
      return `data:image/jpeg;base64,${safe}`;
    }
    return '/images/default-avatar.png';
  } catch {
    return '/images/default-avatar.png';
  }
};

/**
 * Calculate letter grade from percentage
 * A+ (90+), A (75+), B (65+), C (55+), D (45+), E (40+), F (below 40)
 */
const calculateGrade = pct => 
  pct >= 90 ? 'A+' : 
  pct >= 75 ? 'A' : 
  pct >= 65 ? 'B' : 
  pct >= 55 ? 'C' : 
  pct >= 45 ? 'D' : 
  pct >= 40 ? 'E' : 'F';

/**
 * Calculate total score and percentage from test scores
 * Sum of 4 tests (max 100), then convert to percentage
 * @param {number} a - First test (max 10)
 * @param {number} b - Second test (max 10)
 * @param {number} c - Third test (max 10)
 * @param {number} d - Exam (max 70)
 * @returns {object} { total, percentage, grade }
 */
const calculateTotal = (a, b, c, d) => {
  const total = (a || 0) + (b || 0) + (c || 0) + (d || 0);
  const pct = total > 0 ? (total / 100) * 100 : 0;
  return { total, percentage: pct, grade: calculateGrade(pct) };
};

/**
 * ========================================
 * MAIN COMPONENT: TeacherResults
 * ========================================
 * Manages student results for a teacher's assigned class
 * Features:
 * - View all results for students in teacher's class
 * - Add new result entry
 * - Edit existing results
 * - Add/edit teacher comments
 * - Delete results
 * - Auto-load students on login (cached, append-only)
 */
const TeacherResults = () => {
  // ========================================
  // CONTEXT & AUTH
  // ========================================
  const { currentUser } = useAuth(); // Current logged-in teacher
  const { students: ctxStudents = [], results: ctxResults = [], subjects: ctxSubjects = [], loading: appLoading, reload } = useAppData();

  // ========================================
  // STATE: Results & Students
  // ========================================
  const [results, setResults] = useState([]); // All results from API
  const [students, setStudents] = useState([]); // Students in teacher's assigned class
  const [subjects, setSubjects] = useState([]); // Subjects taught by this teacher

  // ========================================
  // STATE: UI/Form
  // ========================================
  const [modals, setModals] = useState({ add: false, edit: false, view: false, comment: false }); // Modal visibility flags
  const [form, setForm] = useState({ 
    studentId: '', 
    session: '', 
    term: '', 
    subjects: [], // Array of { id, name, firstTest, secondTest, thirdTest, exam, total, percentage, grade }
    teacherComment: '' 
  });
  const [selected, setSelected] = useState({ 
    result: null, // Currently viewed/edited result
    student: null, // Currently selected student
    comment: '' // Comment being edited
  });

  // ========================================
  // STATE: Loading & Cache
  // ========================================
  const [loading, setLoading] = useState({ students: false, results: false });
  const [studentsCached, setStudentsCached] = useState(false); // Flag: students loaded from cache?

  // ========================================
  // STATE: Pagination & Filtering
  // ========================================
  const [pagination, setPagination] = useState({ 
    page: 1, 
    limit: 10, 
    total: results.length,
    filters: { session: '', term: '', studentId: '' } 
  });

  // ========================================
  // EFFECT: Map context data to local state
  // ========================================
  /**
   * When context updates (ctxStudents, ctxResults, ctxSubjects, currentUser):
   * 1. Convert results to local state
   * 2. Normalize students: convert pictures, extract class field
   * 3. Filter students by teacher's assignedClass
   * 4. Store in local state
   */
  useEffect(() => {
    // Map results directly from context
    setSubjects(Array.isArray(ctxSubjects) ? ctxSubjects : []);
    setResults(Array.isArray(ctxResults) ? ctxResults : []);

    // Normalize & filter students
    try {
      const normalized = (Array.isArray(ctxStudents) ? ctxStudents : []).map(s => {
        // Extract class (may be stored under different field names)
        const detectedClass = (s.class || s.studentClass || s.className || s.grade || s.classroom || '').toString();
        return {
          id: String(s.id || s._id || s.uid || ''),
          uid: String(s.uid || s.studentUid || s.id || ''),
          name: s.name || s.fullName || s.studentName || 'Unnamed',
          picture: normalizePicture(s.picture || s.avatar || s.image || ''),

          class: normalizeClass(detectedClass),
          raw: s
        };
      });

      // Filter by teacher's assigned class
      const assigned = normalizeClass(currentUser?.assignedClass || currentUser?.class || '');
      const filtered = assigned ? normalized.filter(st => st.class === assigned) : normalized;

      setStudents(filtered);
    } catch (err) {
      console.error('Failed to map ctx students', err);
      setStudents([]);
    }
  }, [ctxStudents, ctxResults, ctxSubjects, currentUser]);

  // ========================================
  // ROLE DETECTION
  // ========================================
  /**
   * Check if current user is a teacher or student
   * Used to conditionally show/hide UI elements
   */
  const isTeacher = currentUser?.role === 'teacher' || currentUser?.userType === 'teacher';
  const isStudent = currentUser?.role === 'student' || currentUser?.userType === 'student';

  // ========================================
  // API: Fetch Results
  // ========================================
  /**
   * Fetch all results from API
   * Called on mount and after adding/editing/deleting results
   */
  const fetchResults = async () => {
    setLoading(l => ({ ...l, results: true }));
    try {
      const res = await api.get('/api/results?limit=100');
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setResults(data);
    } catch (err) {
      console.error('Failed to load results:', err);
    } finally {
      setLoading(l => ({ ...l, results: false }));
    }
  };

  // ========================================
  // API: Fetch Students (Class-filtered)
  // ========================================
  /**
   * Fetch students from API filtered by teacher's assignedClass
   * Features:
   * - Uses cache (if available) to avoid repeated API calls
   * - Only fetches if teacher has an assignedClass
   * - Normalizes pictures to data URLs
   * - Stores result in localStorage for persistence
   * - Fallback to localStorage on API error
   */
  const fetchStudents = useCallback(async () => {
    setLoading(l => ({ ...l, students: true }));
    try {
      // 1) Extract teacher identity & assignedClass from auth or localStorage
      const uid = currentUser?.uid || currentUser?.id || localStorage.getItem('uid') || localStorage.getItem('userId') || null;
      let assignedClass = currentUser?.assignedClass || localStorage.getItem('assignedClass') || null;

      // 2) Try to get authoritative teacher record (GET /api/teachers/:uid)
      if (uid) {
        try {
          const tRes = await api.get(`/api/teachers/${encodeURIComponent(uid)}`);
          const tData = Array.isArray(tRes.data) ? tRes.data[0] : tRes.data;
          if (tData) {
            assignedClass = assignedClass || (tData.assignedClass || tData.classAssigned || tData.class || null);
          }
        } catch (e) {
          // non-fatal: keep existing assignedClass
          console.debug('Teacher record fetch failed, using auth/local fallback', e?.message || e);
        }
      }

      const assignedNorm = normalizeClass(assignedClass || '');
      const adminMode = ['admin', 'principal', 'headmaster', 'head'].includes(assignedNorm);

      // 3) Query students API (try server-side class filter when teacher)
      let studentsData = [];
      if (adminMode) {
        // admin -> fetch all students
        const sAll = await api.get('/api/students');
        studentsData = Array.isArray(sAll.data) ? sAll.data : (sAll.data?.data || sAll.data?.students || []);
      } else if (assignedNorm) {
        // teacher -> try server-side filter, fallback to fetching all and client filter
        try {
          const sRes = await api.get(`/api/students?class=${encodeURIComponent(assignedNorm)}`);
          studentsData = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.data || sRes.data?.students || []);
        } catch (e) {
          console.warn('Server-side class filter failed, fetching all students as fallback', e?.message || e);
          const sAll = await api.get('/api/students');
          studentsData = Array.isArray(sAll.data) ? sAll.data : (sAll.data?.data || sAll.data?.students || []);
        }
      } else {
        // No assigned class -> empty list
        studentsData = [];
      }

      // 4) Normalize student data into consistent shape
      const normalized = (Array.isArray(studentsData) ? studentsData : []).map(s => {
        const detectedClass = (s.class || s.studentClass || s.className || s.grade || s.classroom || '').toString();
        return {
          id: s.id || s._id || s.studentId || s.uid || '',
          uid: s.uid || s.studentUid || s.studentId || s.id || '',
          name: s.name || s.fullName || s.studentName || 'Unnamed',
          picture: normalizePicture(s.picture || s.avatar || s.image || ''),
          class: normalizeClass(detectedClass),
          raw: s
        };
      });

      // 5) Filter by assigned class (unless admin)
      const finalList = adminMode ? normalized : normalized.filter(st => st.class === assignedNorm);

      // 6) Update state + cache
      setStudents(finalList);
      setStudentsCached(true);
      try {
        localStorage.setItem('studentsCached', JSON.stringify({
          timestamp: Date.now(),
          students: finalList,
          assignedClass: assignedNorm
        }));
      } catch (_) {}

      console.debug(`Loaded ${finalList.length} students for class: ${assignedNorm || '(none)'} (adminMode=${adminMode})`);
    } catch (err) {
      console.error('Failed to load students:', err);
      // fallback: try to use cached data from localStorage
      const cached = localStorage.getItem('studentsCached');
      if (cached) {
        try {
          const { students: cachedStudents, assignedClass: cachedAssigned } = JSON.parse(cached);
          const assignedClassNormalized = normalizeClass(currentUser?.assignedClass || localStorage.getItem('assignedClass') || '');
          if (cachedAssigned === assignedClassNormalized) {
            setStudents(cachedStudents);
            setStudentsCached(true);
            console.debug('Using cached students from localStorage');
          } else {
            setStudents([]);
          }
        } catch (e) {
          console.error('Failed to parse cached students', e);
          setStudents([]);
        }
      } else {
        setStudents([]);
      }
    } finally {
      setLoading(l => ({ ...l, students: false }));
    }
  }, [currentUser]);

  // ========================================
  // EFFECT: Auto-fetch students on teacher login
  // ========================================
  /**
   * When teacher logs in (currentUser.uid changes):
   * - Auto-fetch students for their assigned class
   * - Only fetch if not already cached
   */
  useEffect(() => {
    if (isTeacher && currentUser?.uid && currentUser?.assignedClass) {
      fetchStudents();
    }
  }, [currentUser?.uid, currentUser?.assignedClass, isTeacher]);

  // ========================================
  // API: Fetch Subjects
  // ========================================
  /**
   * Fetch subjects taught by the current teacher
   * Filters subjects where createdBy/teacherUid matches current user
   */
  const fetchSubjects = async () => {
    try {
      const res = await api.get('/api/subjects');
      const arr = Array.isArray(res.data) ? res.data : (res.data.subjects || res.data.data || []);
      // Filter: only subjects created by this teacher
      setSubjects(arr.filter(s => 
        [currentUser?.uid, currentUser?.id, currentUser?.email].includes(String(s.createdBy || s.teacherUid || s.owner || s.creator))
      ).map(s => ({
        id: s.id || s._id || s.uid,
        name: s.name || s.title || s.subjectName || 'Unnamed'
      })));
    } catch {
      setSubjects([]);
    }
  };

  // ========================================
  // EFFECTS: Fetch data on mount & login
  // ========================================
  useEffect(() => { if (currentUser) fetchResults(); }, [currentUser]);
  useEffect(() => { if (currentUser) fetchStudents(); }, [currentUser, results, modals.add]);
  useEffect(() => { if (currentUser) fetchSubjects(); }, [modals.add, currentUser]);

  // ========================================
  // HELPER: Find student by ID
  // ========================================
  /**
   * Search student array by id or uid
   * Returns student object or create default entry from result data
   */
  const findStudent = id => {
    const found = students.find(s => String(s.id) === String(id) || String(s.uid) === String(id));
    if (found) return found;
    // Fallback: try to find in results to get student name/uid from result doc
    const resultWithStudent = results.find(r => String(r.studentId) === String(id));
    if (resultWithStudent) {
      return {
        id: String(id),
        uid: resultWithStudent.studentUid || id,
        name: resultWithStudent.studentName || 'Unknown',
        picture: normalizePicture(resultWithStudent.picture || ''),
        class: normalizeClass(resultWithStudent.studentClass || '')
      };
    }
    return { id: String(id), uid: id, name: 'Unknown', picture: '/images/default-avatar.png', class: '' };
  };

  // ========================================
  // MODAL HELPERS
  // ========================================
  /**
   * Open/close modals by type key
   * Types: 'add', 'edit', 'view', 'comment'
   */
  const openModal = (type, payload = {}) => setModals(m => ({ ...m, [type]: true }));
  const closeModal = type => setModals(m => ({ ...m, [type]: false }));

  /**
   * Reset form to initial state
   * Called after submit or cancel
   */
  const resetForm = () => setForm({ studentId: '', session: '', term: '', subjects: [], teacherComment: '' });

  // ========================================
  // FORM HANDLERS
  // ========================================
  /**
   * Update form field on input change
   */
  const handleFormChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  /**
   * When student selection changes:
   * - Update form studentId
   * - Lookup student object and store in selected state
   */
  const handleStudentChange = e => {
    const studentId = e.target.value;
    setForm(f => ({ ...f, studentId }));
    setSelected(s => ({ ...s, student: findStudent(studentId) }));
  };

  /**
   * Toggle subject selection (checkbox)
   * When checked: add subject to form.subjects with initial scores
   * When unchecked: remove subject from form.subjects
   */
  const handleSubjectToggle = id => setForm(f => {
    const exists = f.subjects.some(s => String(s.id) === String(id));
    return {
      ...f,
      subjects: exists 
        ? f.subjects.filter(s => String(s.id) !== String(id))
        : [...f.subjects, { 
            id, 
            name: subjects.find(s => String(s.id) === String(id))?.name, 
            firstTest: 0, 
            secondTest: 0, 
            thirdTest: 0, 
            exam: 0, 
            total: 0, 
            percentage: 0, 
            grade: 'F' 
          }]
    };
  });

  /**
   * Update individual test score for a subject
   * Recalculates: total, percentage, and grade
   * Test fields: firstTest (0-10), secondTest (0-10), thirdTest (0-10), exam (0-70)
   * Max total: 100 points
   */
  const handleScoreChange = (subjectId, field, value) => setForm(f => ({
    ...f,
    subjects: f.subjects.map(s => {
      if (String(s.id) !== String(subjectId)) return s;
      const updated = { ...s, [field]: parseInt(value) || 0 };
      // Recalculate total/percentage/grade if test score changed
      if (['firstTest', 'secondTest', 'thirdTest', 'exam'].includes(field)) {
        const { total, percentage, grade } = calculateTotal(
          field === 'firstTest' ? updated.firstTest : s.firstTest,
          field === 'secondTest' ? updated.secondTest : s.secondTest,
          field === 'thirdTest' ? updated.thirdTest : s.thirdTest,
          field === 'exam' ? updated.exam : s.exam
        );
        Object.assign(updated, { total, percentage, grade });
      }
      return updated;
    })
  }));

  // ========================================
  // SUBMIT HANDLERS
  // ========================================
  /**
   * Add new result entry
   * 1. Validate all required fields are filled
   * 2. Build payload with student, session, term, subjects, scores, comment
   * 3. POST to /api/results
   * 4. Update student's lastResult fields
   * 5. Refresh results & students, close modal
   */
  const handleSubmit = async e => {
    e.preventDefault();
    // Validate form
    if (!form.studentId || !form.session || !form.term || form.subjects.length === 0) {
      return toast.error('Fill all fields');
    }
    try {
      const student = findStudent(form.studentId);
      const payload = {
        studentId: form.studentId,
        studentUid: student.uid,
        session: form.session,
        term: form.term,
        subjects: form.subjects,
        teacherComment: form.teacherComment,
        teacherUid: currentUser?.uid
      };
      // Create result
      await api.post('/api/results', payload);
      // Update student's last result info
      await api.put(`/api/students/${encodeURIComponent(student.id)}`, { 
        lastResultSession: form.session, 
        lastResultTerm: form.term 
      });
      toast.success('Result added.');
      // Refresh UI
      fetchResults();
      fetchStudents();
      resetForm();
      closeModal('add');
    } catch (err) {
      toast.error('Failed to add result.');
    }
  };

  /**
   * Edit existing result
   * 1. Validate selected.result exists
   * 2. Build payload with updated scores/comment
   * 3. PUT to /api/results/:id
   * 4. Refresh results, close modal
   */
  const handleEdit = async e => {
    e.preventDefault();
    if (!selected.result?.id) return;
    try {
      const student = findStudent(form.studentId);
      const payload = {
        studentId: form.studentId,
        studentUid: student.uid,
        session: form.session,
        term: form.term,
        subjects: form.subjects,
        teacherComment: form.teacherComment
      };
      // Update result
      await api.put(`/api/results/${encodeURIComponent(selected.result.id)}`, payload);
      // Update student's last result info
      await api.put(`/api/students/${encodeURIComponent(student.id)}`, { 
        lastResultSession: form.session, 
        lastResultTerm: form.term 
      });
      toast.success('Result updated.');
      fetchResults();
      fetchStudents();
      resetForm();
      closeModal('edit');
    } catch {
      toast.error('Failed to update result.');
    }
  };

  /**
   * Delete result
   * 1. Show confirmation dialog
   * 2. DELETE /api/results/:id
   * 3. Refresh results list
   */
  const handleDelete = async id => {
    if (!window.confirm('Delete this result?')) return;
    try {
      await api.delete(`/api/results/${encodeURIComponent(id)}`);
      toast.success('Result deleted.');
      fetchResults();
    } catch {
      toast.error('Failed to delete result.');
    }
  };

  /**
   * Save teacher's comment on result
   * 1. PUT /api/results/:id with comment and commentStatus
   * 2. Refresh results
   * 3. Close modal
   */
  const handleCommentSave = async () => {
    if (!selected.result?.id) return;
    try {
      await api.put(`/api/results/${encodeURIComponent(selected.result.id)}`, {
        teacherComment: selected.comment,
        commentStatus: selected.comment.trim() !== ''
      });
      toast.success('Comment saved.');
      fetchResults();
      closeModal('comment');
    } catch {
      toast.error('Failed to save comment.');
    }
  };

  // ========================================
  // MODAL OPEN HANDLERS
  // ========================================
  /**
   * Open "View Result" modal
   * Displays read-only result card with scores and overall grade
   */
  const openView = result => {
    setSelected(s => ({ ...s, result }));
    openModal('view');
  };

  /**
   * Open "Edit Result" modal
   * Populates form with existing result data for editing
   */
  const openEdit = result => {
    setSelected(s => ({ ...s, result }));
    setForm({
      studentId: result.studentId,
      session: result.session,
      term: result.term,
      subjects: Array.isArray(result.subjects) ? result.subjects.map(s => ({
        ...s,
        id: s.id || s._id || s.subjectId,
        name: s.name || s.title || s.subjectName
      })) : [],
      teacherComment: result.teacherComment || ''
    });
    openModal('edit');
  };

  /**
   * Open "Add Comment" modal
   * Allows teacher to add/edit comment on result
   */
  const openComment = result => {
    setSelected(s => ({ ...s, result, comment: result.teacherComment || '' }));
    openModal('comment');
  };

  // ========================================
  // HELPER: Filter & Paginate Results
  // ========================================
  /**
   * Apply filters and pagination to results array
   * Filters: session, term, studentId
   * Returns: { filtered, paged, totalPages }
   */
  const getFilteredAndPaginatedResults = () => {
    // Step 1: Apply filters
    let filtered = results;
    if (pagination.filters.session) {
      filtered = filtered.filter(r => r.session === pagination.filters.session);
    }
    if (pagination.filters.term) {
      filtered = filtered.filter(r => r.term === pagination.filters.term);
    }
    if (pagination.filters.studentId) {
      filtered = filtered.filter(r => String(r.studentId) === String(pagination.filters.studentId));
    }

    // Step 2: Calculate pagination
    const totalPages = Math.ceil(filtered.length / pagination.limit);
    const start = (pagination.page - 1) * pagination.limit;
    const end = start + pagination.limit;
    const paged = filtered.slice(start, end);

    return { filtered, paged, totalPages, total: filtered.length };
  };

  // ========================================
  // HANDLERS: Pagination & Filtering
  // ========================================
  /**
   * Handle filter change (session, term, or student dropdown)
   * Reset to page 1 when filter changes
   */
  const handleFilterChange = (filterName, value) => {
    setPagination(p => ({
      ...p,
      page: 1, // Reset to first page
      filters: { ...p.filters, [filterName]: value }
    }));
  };

  /**
   * Change page number
   * Clamps to valid range [1, totalPages]
   */
  const handlePageChange = (newPage, totalPages) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPagination(p => ({ ...p, page: newPage }));
    }
  };

  /**
   * Change results per page
   * Reset to page 1
   */
  const handleLimitChange = e => {
    setPagination(p => ({
      ...p,
      limit: parseInt(e.target.value),
      page: 1
    }));
  };

  // Get filtered/paginated data
  const { filtered: filteredResults, paged: pageResults, totalPages, total: totalFiltered } = getFilteredAndPaginatedResults();

  // ========================================
  // RENDER
  // ========================================
  return (
    <DashboardLayout title="Results Management">
      {/* Header section with title and "Add Result" button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-lg sm:text-2xl font-semibold text-gray-900">Student Results</h1>
        <button type="button" className="inline-flex items-center px-3 py-2 text-sm rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          onClick={() => { resetForm(); openModal('add'); }}>
          <PlusIcon className="h-4 w-4 mr-2" /> Add Result
        </button>
      </div>

    
      
      {/* ========================================
          RESULTS TABLE
          ======================================== */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            {/* Table header */}
            <thead className="bg-gray-50">
              <tr>
                {/* <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pic</th> */}
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subjects</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Overall</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Comment</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            {/* Table body - results rows */}
            <tbody className="bg-white divide-y divide-gray-200">
              {loading.results ? (
                <tr><td colSpan="7" className="px-3 py-4 text-center text-blue-600">Loading results...</td></tr>
              ) : pageResults.length === 0 ? (
                <tr><td colSpan="7" className="px-3 py-4 text-center text-gray-500">
                  {results.length === 0 ? 'No results found.' : 'No results match your filters.'}
                </td></tr>
              ) : pageResults.map(result => {
                // Use result.studentName and result.studentUid directly from backend, with fallback to findStudent
                const studentName = result.studentName || findStudent(result.studentId).name || 'Unknown';
                const studentUid = result.studentUid || result.studentId || 'N/A';
                const studentClass = result.studentClass || findStudent(result.studentId).class || '';
                
                // Calculate overall percentage from all subjects
                const overall = (() => {
                  if (!Array.isArray(result.subjects) || result.subjects.length === 0) 
                    return { percentage: 0, grade: 'F' };
                  const totalPct = result.subjects.reduce((sum, s) => sum + (s.percentage || 0), 0);
                  const pct = totalPct / result.subjects.length;
                  return { percentage: pct, grade: calculateGrade(pct) };
                })();
                return (
                  <tr key={result.id}>
                    {/* Student picture */}
                    {/* <td className="px-3 py-3"><img src={student.picture} alt={student.name} className="h-8 w-8 rounded-full" /></td> */}
                    {/* Student name & ID */}
                    <td className="px-3 py-3">
                      <span className="font-medium">{studentName}</span>
                      <br />
                      <span className="text-xs text-gray-500">{studentUid}</span>
                    </td>
                    {/* Session & Term */}
                    <td className="px-3 py-3">
                      <span>{result.session}</span>
                      <br />
                      <span className="text-xs text-gray-500">{result.term}</span>
                    </td>
                    {/* Number of subjects */}
                    <td className="px-3 py-3">{Array.isArray(result.subjects) ? result.subjects.length : 0}</td>
                    {/* Overall percentage & grade */}
                    <td className="px-3 py-3">
                      <span>{overall.percentage.toFixed(1)}%</span>
                      <br />
                      <span className="text-xs font-semibold">{overall.grade}</span>
                    </td>
                    {/* Comment status badge */}
                    <td className="px-3 py-3">
                      <span className={`px-2 inline-flex text-xs rounded-full ${result.commentStatus ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {result.commentStatus ? 'Added' : 'Not Added'}
                      </span>
                    </td>
                    {/* Action buttons: View, Comment, Edit, Delete */}
                    <td className="px-3 py-3 text-right space-x-2">
                      <button onClick={() => openView(result)} className="text-blue-600 hover:text-blue-900 p-1" title="View"><EyeIcon className="h-4 w-4" /></button>
                      <button onClick={() => openComment(result)} className="text-green-600 hover:text-green-900 p-1" title="Add comment"><MessageCircleIcon className="h-4 w-4" /></button>
                      <button onClick={() => openEdit(result)} className="text-indigo-600 hover:text-indigo-900 p-1" title="Edit"><PencilIcon className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(result.id)} className="text-red-600 hover:text-red-900 p-1" title="Delete"><TrashIcon className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ========================================
            PAGINATION CONTROLS
            ======================================== */}
        {pageResults.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            {/* Left: Summary text */}
            <div className="text-xs text-gray-600">
              Page <strong>{pagination.page}</strong> of <strong>{totalPages}</strong>
              {' '}({pageResults.length} results)
            </div>

            {/* Right: Navigation buttons */}
            <div className="flex gap-2">
              {/* Previous button */}
              <button
                onClick={() => handlePageChange(pagination.page - 1, totalPages)}
                disabled={pagination.page === 1}
                className={`px-3 py-1 text-xs rounded border ${
                  pagination.page === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                ← Previous
              </button>

              {/* Page number input */}
              <input
                type="number"
                min="1"
                max={totalPages}
                value={pagination.page}
                onChange={e => handlePageChange(parseInt(e.target.value) || 1, totalPages)}
                className="w-12 px-2 py-1 text-xs border border-gray-300 rounded text-center"
              />

              {/* Next button */}
              <button
                onClick={() => handlePageChange(pagination.page + 1, totalPages)}
                disabled={pagination.page === totalPages}
                className={`px-3 py-1 text-xs rounded border ${
                  pagination.page === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================
          ADD RESULT MODAL
          ======================================== */}
      <Modal open={modals.add} title="Add New Result" onClose={() => closeModal('add')}>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Student, Session, Term selection */}
            <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-3">
              {/* Student dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Student</label>
                <select
                  name="studentId"
                  required
                  value={form.studentId}
                  onChange={handleStudentChange}
                  disabled={appLoading || loading.students}
                  className={`mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 rounded-md ${loading.students ? 'opacity-60 cursor-wait' : ''}`}
                >
                  {appLoading ? (
                    <option value="">Loading students...</option>
                  ) : (
                    <>
                      <option value="">Select a student</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.uid})</option>)}
                    </>
                  )}
                </select>
              </div>
              {/* Session dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Session</label>
                <select name="session" required value={form.session} onChange={handleFormChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 rounded-md">
                  <option value="">Select session</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                  <option value="2027/2028">2027/2028</option>
                </select>
              </div>
              {/* Term dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Term</label>
                <select name="term" required value={form.term} onChange={handleFormChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 rounded-md">
                  <option value="">Select term</option>
                  <option value="First Term">First Term</option>
                  <option value="Second Term">Second Term</option>
                  <option value="Third Term">Third Term</option>
                </select>
              </div>
            </div>

            {/* Subject selection checkboxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Subjects</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {subjects.map(sub => (
                  <div key={sub.id} className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={form.subjects.some(s => String(s.id) === String(sub.id))}
                      onChange={() => handleSubjectToggle(sub.id)} 
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded" 
                    />
                    <label className="ml-2 block text-sm text-gray-900">{sub.name}</label>
                  </div>
                ))}
              </div>

              {/* Score entry table (shown when subjects selected) */}
              {form.subjects.length > 0 && (
                <div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Subject</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">1st Test</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">2nd Test</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">3rd Test</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Exam</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.subjects.map(sub => (
                        <tr key={sub.id}>
                          <td className="px-3 py-2">{sub.name}</td>
                          {/* Test score inputs - auto-calc total & grade */}
                          {['firstTest', 'secondTest', 'thirdTest', 'exam'].map(field => (
                            <td key={field} className="px-3 py-2">
                              <input 
                                type="number" 
                                value={sub[field] ?? 0} 
                                min={0} 
                                max={field === 'exam' ? 70 : 10}
                                onChange={e => handleScoreChange(sub.id, field, e.target.value)}
                                className="w-16 border-gray-300 rounded-md" 
                              />
                            </td>
                          ))}
                          {/* Auto-calculated total & grade */}
                          <td className="px-3 py-2 font-semibold">{sub.total}</td>
                          <td className="px-3 py-2 font-semibold">{sub.grade}</td>
                        </tr>
                      ))}

                      {/* Optional debug row (rendered safely) */}
                      {false && form.subjects.length > 0 && (
                        <tr>
                          <td className="px-3 py-2 font-mono text-xs" colSpan="7">
                            <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(form.subjects, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Teacher comment textarea */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Teacher's Comment</label>
              <textarea 
                name="teacherComment" 
                rows={3} 
                value={form.teacherComment} 
                onChange={handleFormChange}
                className="mt-1 block w-full border-gray-300 rounded-md" 
                placeholder="Enter your comment" 
              />
            </div>

            {/* Modal footer - Cancel & Submit buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => closeModal('add')} className="px-3 py-2 rounded border bg-white text-sm">
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading.students} 
                className={`px-3 py-2 rounded text-white text-sm ${loading.students ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                Add Result
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ========================================
          EDIT RESULT MODAL
          ======================================== */}
      <Modal open={modals.edit} title="Edit Result" onClose={() => { closeModal('edit'); resetForm(); }}>
        <form onSubmit={handleEdit}>
          <div className="space-y-6">
            {/* Same as Add modal: Student, Session, Term */}
            <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Student</label>
                <select
                  name="studentId"
                  required
                  value={form.studentId}
                  onChange={handleStudentChange}
                  disabled={appLoading || loading.students}
                  className={`mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 rounded-md ${loading.students ? 'opacity-60 cursor-wait' : ''}`}
                >
                  {appLoading ? (
                    <option value="">Loading students...</option>
                  ) : (
                    <>
                      <option value="">Select a student</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.uid})</option>)}
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Session</label>
                <select name="session" required value={form.session} onChange={handleFormChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 rounded-md">
                  <option value="">Select session</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                  <option value="2027/2028">2027/2028</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Term</label>
                <select name="term" required value={form.term} onChange={handleFormChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 rounded-md">
                  <option value="">Select term</option>
                  <option value="First Term">First Term</option>
                  <option value="Second Term">Second Term</option>
                  <option value="Third Term">Third Term</option>
                </select>
              </div>
            </div>

            {/* Subjects & scores (same as Add modal) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Subjects</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {subjects.map(sub => (
                  <div key={sub.id} className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={form.subjects.some(s => String(s.id) === String(sub.id))}
                      onChange={() => handleSubjectToggle(sub.id)} 
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded" 
                    />
                    <label className="ml-2 block text-sm text-gray-900">{sub.name}</label>
                  </div>
                ))}
              </div>

              {form.subjects.length > 0 && (
                <div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Subject</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">1st</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">2nd</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">3rd</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Exam</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">%</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.subjects.map(sub => (
                        <tr key={sub.id}>
                          <td className="px-3 py-2">{sub.name}</td>
                          {['firstTest', 'secondTest', 'thirdTest', 'exam'].map(field => (
                            <td key={field} className="px-3 py-2">
                              <input 
                                type="number" 
                                value={sub[field]} 
                                min={0} 
                                max={field === 'exam' ? 70 : 10}
                                onChange={e => handleScoreChange(sub.id, field, e.target.value)}
                                className="w-16 border-gray-300 rounded-md" 
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 font-semibold">{sub.total}</td>
                          <td className="px-3 py-2">{sub.percentage.toFixed(1)}%</td>
                          <td className="px-3 py-2 font-semibold">{sub.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Teacher's Comment</label>
              <textarea 
                name="teacherComment" 
                rows={3} 
                value={form.teacherComment} 
                onChange={handleFormChange}
                className="mt-1 block w-full border-gray-300 rounded-md" 
                placeholder="Enter your comment" 
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => closeModal('edit')} className="px-3 py-2 rounded border bg-white text-sm">
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading.students} 
                className={`px-3 py-2 rounded text-white text-sm ${loading.students ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ========================================
          VIEW RESULT MODAL (Read-only)
          ======================================== */}
      <Modal open={modals.view} title="Result Card" onClose={() => closeModal('view')}>
        {selected.result && (
          <div>
            {/* Student info - use result data directly */}
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div><strong>Student:</strong> {selected.result.studentName || findStudent(selected.result.studentId).name}</div>
              <div><strong>ID:</strong> {selected.result.studentUid || selected.result.studentId}</div>
              <div><strong>Class:</strong> {selected.result.studentClass || findStudent(selected.result.studentId).class}</div>
              <div><strong>Session:</strong> {selected.result.session}</div>
              <div><strong>Term:</strong> {selected.result.term}</div>
            </div>

            {/* Scores table */}
            <table className="min-w-full divide-y divide-gray-200 mb-4">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Subject</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">1st</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">2nd</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">3rd</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Exam</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Grade</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(selected.result.subjects) && selected.result.subjects.map((sub, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{sub.name || sub.title || 'Unknown'}</td>
                    <td className="px-3 py-2">{sub.firstTest || 0}</td>
                    <td className="px-3 py-2">{sub.secondTest || 0}</td>
                    <td className="px-3 py-2">{sub.thirdTest || 0}</td>
                    <td className="px-3 py-2">{sub.exam || 0}</td>
                    <td className="px-3 py-2 font-semibold">{sub.total || 0}</td>
                    <td className="px-3 py-2 font-semibold">{sub.grade || 'F'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Overall calculation */}
            <div className="p-3 bg-blue-50 rounded mb-3">
              <strong>Overall: </strong>{(() => {
                const arr = selected.result.subjects;
                if (!arr || arr.length === 0) return '0% (F)';
                const pct = arr.reduce((sum, s) => sum + (s.percentage || 0), 0) / arr.length;
                return `${pct.toFixed(1)}% (${calculateGrade(pct)})`;
              })()}

            </div>

            {/* Teacher comment (if exists) */}
            {selected.result.teacherComment && (
              <div className="p-3 bg-yellow-50 rounded">
                <strong>Teacher's Comment:</strong>
                <p className="mt-2 text-sm">{selected.result.teacherComment}</p>
              </div>
            )}

            {/* Principal comment (if exists) */}
            {selected.result.principalComment && (
              <div className="p-3 bg-purple-50 rounded mt-3">
                <strong>Principal's Comment:</strong>
                <p className="mt-2 text-sm">{selected.result.principalComment}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ========================================
          COMMENT MODAL
          ======================================== */}
      {modals.comment && selected.result && (
        <Modal open={modals.comment} title="Add Teacher Comment" onClose={() => closeModal('comment')} className="sm:max-w-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                {/* Header */}
                <div className="flex justify-between items-center">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Add Teacher Comment</h3>
                </div>

                {/* Student/Result info - use result data directly */}
                <div className="mt-2">
                  <p className="text-sm text-gray-500 truncate whitespace-nowrap">
                    Student: {selected.result.studentName || 'Unknown'} | {selected.result.session} - {selected.result.term}
                  </p>
                </div>

                {/* Comment textarea */}
                <div className="mt-4">
                  <label htmlFor="teacherComment" className="block text-sm font-medium text-gray-700">Comment</label>
                  <textarea
                    id="teacherComment"
                    rows={4}
                    value={selected.comment || ''}
                    onChange={e => setSelected(s => ({ ...s, comment: e.target.value }))}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm text-sm border-gray-300 rounded-md"
                    placeholder="Enter your comment about the student's performance"
                  />
                </div>

                {/* Quick comment templates */}
                <div className="mt-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {/* Positive comment template */}
                    <button 
                      type="button" 
                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded text-white bg-green-600 hover:bg-green-700" 
                      onClick={() => setSelected(s => ({ ...s, comment: 'Excellent work! Keep up the high standards.' }))}
                    >
                      Positive
                    </button>
                    {/* Warning comment template */}
                    <button 
                      type="button" 
                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded text-white bg-yellow-600 hover:bg-yellow-700" 
                      onClick={() => setSelected(s => ({ ...s, comment: 'Needs to improve in some subjects. Work harder next term.' }))}
                    >
                      Warning
                    </button>
                    {/* General comment template */}
                    <button 
                      type="button" 
                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700" 
                      onClick={() => setSelected(s => ({ ...s, comment: 'Good progress. Keep it up!' }))}
                    >
                      General
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal footer - Save & Cancel buttons */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse space-y-2 sm:space-y-0 sm:space-x-3">
            <button 
              type="button" 
              className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-3 py-2 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 sm:ml-3" 
              onClick={handleCommentSave}
            >
              Save Comment
            </button>
            <button 
              type="button" 
              className="w-full sm:w-auto mt-0 inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-3 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50" 
              onClick={() => closeModal('comment')}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
};

export default TeacherResults;