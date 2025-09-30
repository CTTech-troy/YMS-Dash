import React, { useEffect, useRef, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { PlusIcon, EyeIcon, PencilIcon, TrashIcon, MessageCircleIcon, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

// Reusable Modal component (handles backdrop, escape, focus, body scroll lock)
const Modal = ({ open, title, onClose, children, className = '' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    // focus first focusable element inside modal
    requestAnimationFrame(() => {
      const node = containerRef.current;
      if (!node) return;
      const focusable = node.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus();
      else node.focus();
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Note: removed misplaced student/teacher fetch logic from inside Modal.
  // Student/teacher fetching and subject filtering are handled in the TeacherResults component scope
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" aria-modal="true" role="dialog">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        className={`relative bg-white rounded-lg shadow-xl max-h-[90vh] w-full sm:max-w-4xl overflow-auto p-6 z-10 ${className}`}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close modal">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

// sample data removed — production code relies exclusively on API responses

const initialResults = []; // Start with an empty array or provide default results if needed

const TeacherResults = () => {
  const [results, setResults] = useState(initialResults);
  const [showEditModal, setShowEditModal] = useState(false); // new: edit modal flag
  const [editingId, setEditingId] = useState(null); // id of result being edited
  const { currentUser } = useAuth();
  // Reintroduced state to hold class students (filtered from Student API)
  const [classStudents, setClassStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]); // full fetched list for lookups
  const [teacherAssignedClass, setTeacherAssignedClass] = useState(''); // new state to share assigned class with subjects logic
  // Removed unused teacherClass state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [comment, setComment] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [formData, setFormData] = useState({
    studentId: '',
    studentuid: '',
    session: '',
    term: '',
    subjects: [],
    teacherComment: '',
    published:''
  });
  // helper: reset form to empty for create
  const resetForm = () => {
    setFormData({
      studentId: '',
      studentuid: '',
      session: '',
      term: '',
      subjects: [],
      teacherComment: '',
      published: ''
    });
    setSelectedStudent(null);
    setEditingId(null);
  };
  // Open edit modal and prefill form with selected result
  const handleEditClick = async (result) => {
    if (!result) return;
    // map backend result -> formData shape (best-effort)
    const studentId = result.studentId || result.studentIdRef || result.student || result.studentUid || '';
    const studentuid = result.studentUid || result.studentuid || result.student_uid || '';

    const subjectsPrefill = Array.isArray(result.subjects) ? result.subjects.map(s => ({
      id: s.id || s._id || s.subjectId || (s.name ? s.name.toLowerCase().replace(/\s+/g,'-') : Math.random().toString(36).slice(2,8)),
      name: s.name || s.title || s.subjectName || '',
      firstTest: s.firstTest ?? s.first ?? 0,
      secondTest: s.secondTest ?? s.second ?? 0,
      thirdTest: s.thirdTest ?? s.third ?? 0,
      exam: s.exam ?? s.examScore ?? 0,
      total: s.total ?? 0,
      percentage: s.percentage ?? 0,
      grade: s.grade ?? ''
    })) : [];

    setFormData({
      studentId: String(studentId),
      studentuid: String(studentuid),
      session: result.session || '',
      term: result.term || '',
      subjects: subjectsPrefill,
      teacherComment: result.teacherComment || '',
      published: result.published || ''
    });

    // try to resolve selectedStudent for nicer UI
    const resolvedStudent = findStudentById(studentId) || findStudentById(studentuid) || null;
    if (resolvedStudent) setSelectedStudent(resolvedStudent);

    setEditingId(String(result.id || result._id || ''));
    setShowEditModal(true);
  };
  // Save edited result
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingId) {
      toast.error('Missing result id for edit.');
      return;
    }
    if (!formData.studentId) {
      toast.error('Please select a student');
      return;
    }
    try {
      const payload = {
        studentId: formData.studentId,
        studentuid: formData.studentuid || formData.studentId,
        studentUid: formData.studentuid || formData.studentId,
        session: formData.session,
        term: formData.term,
        subjects: formData.subjects,
        teacherComment: formData.teacherComment || ''
      };
      const res = await api.put(`/api/results/${encodeURIComponent(editingId)}`, payload);
      const updated = res?.data || { id: editingId, ...payload };
      // Normalize id key
      const updatedNormalized = { ...updated, id: updated.id || updated._id || editingId };
      setResults(prev => prev.map(r => (String(r.id || r._id) === String(editingId) ? { ...r, ...updatedNormalized } : r)));
      toast.success('Result updated.');
      setShowEditModal(false);
      resetForm();
      // refresh list to ensure consistency
      await loadResults();
    } catch (err) {
      console.error('Failed to update result', err, err?.response?.data);
      const msg = err?.response?.data?.message || 'Failed to update result.';
      toast.error(msg);
    }
  };
  // role helpers
  const isTeacher = currentUser && (currentUser.role === 'teacher' || currentUser.userType === 'teacher');
  const isStudent = currentUser && (currentUser.role === 'student' || currentUser.userType === 'student');

  // Helper to find student info (prefer fetched students)
  const findStudentById = id => {
    if (id == null) return null;
    const sid = String(id);

    // 1) try full fetched students first
    const fromAll = allStudents.find(s => String(s.id) === sid || String(s.uid) === sid);
    if (fromAll) return fromAll;

    // 2) try classStudents (filtered subset)
    const fromClass = classStudents.find(s => String(s.id) === sid || String(s.uid) === sid);
    if (fromClass) return fromClass;

    // 3) try resolving from results if still not found
    const matchedResult = results.find(r => String(r.studentId) === sid);
    if (matchedResult) {
      const byId = allStudents.find(s => String(s.id) === String(matchedResult.studentId) || String(s.uid) === String(matchedResult.studentId));
      if (byId) return byId;
    }

    // final minimal fallback so UI doesn't crash
    return { id: sid, uid: sid, name: 'Unknown student', picture: '/images/default-avatar.png', class: '' };
  };

  // Fetch teacher's subjects from Subject API (display only subjects created by current user)
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!currentUser) {
        setSubjects([]);
        return;
      }

      try {
        const res = await api.get('/api/subjects');
        const raw = res.data;
        if (typeof raw === 'string' && raw.trim().startsWith('<')) {
          throw new Error('Invalid response from https://yms-backend-a2x4.onrender.com (HTML received).');
        }
        const arr = Array.isArray(raw)
          ? raw
          : (Array.isArray(raw.data) ? raw.data : (Array.isArray(raw.subjects) ? raw.subjects : []));

        // Identify possible owner fields and current user's identifiers
        const ownerKeys = ['createdBy','creator','owner','teacherUid','teacherId','staffId','userId','created_by'];
        const userIds = [
          currentUser?.uid,
          currentUser?.id,
          currentUser?.email
        ].filter(Boolean).map(String);

        // Keep only subjects that match one of the owner fields to the current user
        const filteredByOwner = arr.filter(s =>
          ownerKeys.some(k => s[k] && userIds.includes(String(s[k])))
        );

        // Format subjects and deduplicate (prefer unique by id, fallback to lowercased name)
        const formatted = filteredByOwner.map((s, index) => ({
          id: s.id || s._id || s.uid || index + 1,
          name: (s.name || s.title || s.subjectName || 'Unnamed Subject').toString(),
          raw: s
        }));

        const seen = new Set();
        const deduped = [];
        for (const sub of formatted) {
          const key = String(sub.id || sub.name).toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(sub);
          }
        }

        setSubjects(deduped);
      } catch (err) {
        console.error('Failed to load subjects from API', err);
        setSubjects([]); // no fallback
        toast.error('Unable to load subjects from server.');
      }
    };

    fetchSubjects();
  }, [showAddModal, currentUser]);

  // Calculate grade based on percentage
  const calculateGrade = percentage => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 75) return 'A';
    if (percentage >= 65) return 'B';
    if (percentage >= 55) return 'C';
    if (percentage >= 45) return 'D';
    if (percentage >= 40) return 'E';
    return 'F';
  };

  // Calculate total and percentage
  const calculateTotal = (firstTest, secondTest, thirdTest, exam) => {
    const total = (firstTest || 0) + (secondTest || 0) + (thirdTest || 0) + (exam || 0);
    // full marks = 100 (10+10+10+70) -> percentage = (total/100)*100
    const percentage = total > 0 ? (total / 100) * 100 : 0;
    return {
      total,
      percentage,
      grade: calculateGrade(percentage)
    };
  };

  // set teacherAssignedClass from currentUser once
  useEffect(() => {
    if (!currentUser) return;
    // adjust this field name if your user object uses a different key
    setTeacherAssignedClass(currentUser.assignedClass || currentUser.class || '');
  }, [currentUser]);

  // Fetch students list from backend and populate allStudents and classStudents (filtered by assigned class)
  useEffect(() => {
    if (!currentUser) return;
    let mounted = true;
    const fetchStudents = async () => {
      try {
        const res = await api.get('/api/students');
        const raw = res.data;
        if (typeof raw === 'string' && raw.trim().startsWith('<')) {
          throw new Error('Students API returned HTML (check server or baseURL).');
        }
        const data = Array.isArray(raw) ? raw : (Array.isArray(raw.data) ? raw.data : (Array.isArray(raw.students) ? raw.students : []));
        if (!mounted) return;
        setAllStudents(data || []);

        // If current user is a teacher, only keep students whose class matches the teacher's assigned class
        if (isTeacher && teacherAssignedClass) {
          const filtered = (data || []).filter(s => normalizeClass(s.class || '') === normalizeClass(teacherAssignedClass || ''));
          setClassStudents(filtered);
        } else {
          // admin and others can access full list (teacher Add Result UI will still restrict via isTeacher)
          setClassStudents(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch students', err);
        toast.error('Failed to load students. Check server/API base URL.');
      }
    };
    fetchStudents();
    return () => { mounted = false; };
  }, [currentUser, teacherAssignedClass, showAddModal]);

  // --- UPDATED: load results from explicit backend URL and filter strictly by staffuid === currentUser.uid ---
  const loadResults = async () => {
    try {
      // use the full URL you provided to avoid baseURL mismatch returning HTML
      const res = await api.get('https://yms-backend-a2x4.onrender.com/api/results');
      const raw = res.data;
      console.log("error rom the api", res)
      if (typeof raw === 'string' && raw.trim().startsWith('<')) {
        throw new Error('Results API returned HTML (check server or baseURL).');
      }

      const allRaw = Array.isArray(raw)
        ? raw
        : (Array.isArray(raw.data) ? raw.data : (Array.isArray(raw.results) ? raw.results : []));

        // normalize each result so the UI can rely on consistent fields
      const all = (allRaw || []).map(r => ({
        id: r.id || r._id || r.resultId || (r.ref && r.ref.id) || '',
        studentId: r.studentId || r.studentIdRef || r.student_id || r.student || '',
        studentUid: r.studentUid || r.studentuid || r.student_uid || r.studentUidFromBackend || '',
        session: r.session || r.academicSession || '',
        term: r.term || '',
        subjects: Array.isArray(r.subjects) ? r.subjects : (Array.isArray(r.data?.subjects) ? r.data.subjects : []),
        teacherUid: r.teacherUid || r.teacherUid || r.teacher || r.staffuid || r.staffUid || r.createdBy || '',
        commentStatus: !!r.commentStatus || !!r.teacherComment,
        teacherComment: r.teacherComment || r.comment || '',
        published: r.published,
        createdAt: r.createdAt || r.created_at || r.created || ''
      }));

        // teacher: show only results created by logged-in teacher (match staffuid/teacherUid)
      if (isTeacher && currentUser?.uid) {
        const uid = String(currentUser.uid);
        const filtered = all.filter(r => String(r.teacherUid || r.staffuid || r.staffUid || '') === uid);
        // newest first
        setResults(filtered.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
        return;
      }

      // Students: only published results
      if (isStudent) {
        const published = all.filter(r => r.published === true || String(r.published) === 'true' || r.published === 1);
        setResults(published);
        return;
      }
       const published = all.filter(r => r.published === true || String(r.published) === 'true' || String(r.published) === 'yes' || r.published === 'yes');
    setResults(published.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (err) {
      console.error('Failed to load results', err);
      toast.error('Failed to load results. Check server/API URL.');
    }
};

// call loader when user available (keeps real-time refresh after save because handleSubmit calls loadResults)
useEffect(() => {
  if (!currentUser) return;
  loadResults();
}, [currentUser]);

  // Calculate overall grade for a result
  const calculateOverallGrade = subjectsArr => {
    if (!subjectsArr || subjectsArr.length === 0) return { percentage: 0, grade: 'F' };
    const totalPercentage = subjectsArr.reduce((sum, subject) => sum + (subject.percentage || 0), 0);
    const overallPercentage = totalPercentage / subjectsArr.length;
    const overallGrade = calculateGrade(overallPercentage);
    return { percentage: parseFloat(overallPercentage.toFixed(1)), grade: overallGrade };
  };

  // small normalizers reused from Attendance page

  // Normalizes student picture to a valid image src or returns a default avatar
  const normalizeStudentPicture = (pic) => {
    if (!pic || typeof pic !== 'string') return '/images/default-avatar.png';
    const trimmed = pic.trim();

    // Already a data URI => use as-is
    if (trimmed.startsWith('data:image')) return trimmed;

    // If backend returned "image/jpeg;base64,XXXX..." (missing data: prefix) -> prefix it
    if (/^[a-zA-Z\-]+\/[a-zA-Z0-9\-\+]+;base64,/.test(trimmed)) {
      return `data:${trimmed}`;
    }

    // Raw base64 string (no mime) - detect likely image by common JPEG/PNG signatures and build data URI
    const base64Only = trimmed.replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(base64Only) && base64Only.length > 100) {
      // JPEG files often start with /9j/ in base64, PNG with iVBOR
      const prefix = base64Only.slice(0, 8);
      const mime = prefix.startsWith('/9j') ? 'image/jpeg' : (prefix.startsWith('iVBOR') ? 'image/png' : 'image/jpeg');
      return `data:${mime};base64,${base64Only}`;
    }

    // If it's a full URL or relative path use it
    if (trimmed.startsWith('http') || trimmed.startsWith('/')) return trimmed;

    // fallback
    return '/images/default-avatar.png';
  };

  const normalizeClass = (v) =>
    (v ?? "")
      .toString()
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .toLowerCase();

  // Fetch students for teacher's assigned class to display on this page (dropdown)
  useEffect(() => {
    const fetchClassStudents = async () => {
      try {
        // 1) Resolve assignedClass from currentUser fallback
        let assignedClass = (currentUser && (currentUser.assignedClass || currentUser.assignedClassName)) || localStorage.getItem('assignedClass') || '';

        // 2) Fetch teacher profile by UID and resolve assignedClass
        if (currentUser && currentUser.uid) {
          try {
            const tRes = await api.get(`/api/teachers/${encodeURIComponent(currentUser.uid)}`);
            const tData = tRes.data;
            const teacher = Array.isArray(tData) ? tData[0] : tData;
            console.debug('Teacher API response:', teacher);
            assignedClass = teacher?.assignedClass || teacher?.classAssigned || teacher?.class || assignedClass;
          } catch (err) {
            console.debug('Failed to fetch teacher profile, using fallback assignedClass', err?.message || err);
          }
        }

        // persist assigned class for other logic
        setTeacherAssignedClass(assignedClass || '');

        // normalizer: lowercase + trim
        const norm = v => (v ?? '').toString().toLowerCase().trim();
        const assignedNorm = norm(assignedClass);

        // 3) Fetch all students
        let studentsArray = [];
        try {
          const sRes = await api.get('/api/students');
          const raw = sRes.data;
          console.debug('Students API raw response:', raw);
          studentsArray = Array.isArray(raw) ? raw : (Array.isArray(raw.students) ? raw.students : (Array.isArray(raw.data) ? raw.data : []));
        } catch (err) {
          console.error('Failed to load students from API', err?.message || err);
          setAllStudents([]);
          setClassStudents([]);
          if (showAddModal) toast.error('Unable to load students from server. Please try again later.');
          return;
        }

        // 4) Normalize students into consistent shape and log each
        const normalized = studentsArray.map(s => {
          const detectedClass = (s.class || s.studentClass || s.className || s.grade || s.classroom || '').toString();
          const obj = {
            id: String(s.id || s._id || s.uid || Math.random().toString(36).slice(2,9)),
            uid: String(s.uid || s.studentUid || s.id || ''),
            name: s.name || s.fullName || s.studentName || 'Unnamed',
            // convert base64 or other picture values into a proper src
            picture: normalizeStudentPicture(s.picture || s.avatar || s.image || ''),
            class: detectedClass,
            raw: s
          };
          console.debug('Student from API:', { id: obj.id, name: obj.name, detectedClass: obj.class });
          return obj;
        });

        // keep full list for lookups
        setAllStudents(normalized);

        // 5) Filter by assignedClass (case-insensitive). If assignedClass empty -> show all students
        const matched = assignedNorm
          ? normalized.filter(st => norm(st.class) === assignedNorm)
          : normalized;

        // log students not in assigned class when assignedClass provided
        if (assignedNorm) {
          normalized.forEach(st => {
            if (norm(st.class) !== assignedNorm) {
              console.log('Student not in assigned class:', { id: st.id, name: st.name, detectedClass: st.class });
            }
          });
        }

        // 6) If no matches and teacher has assigned class, log + toast + clear displayed list
        if (assignedNorm && matched.length === 0) {
          console.warn(`No students found for assigned class "${assignedClass}"`);
          setClassStudents([]);
          toast.info(`No students found for your assigned class: ${assignedClass}`);
          return;
        }

        // Optionally exclude students that already have results (keeps existing behaviour)
        const filteredExcludingAdded = matched.filter(fs => !results.some(r => String(r.studentId) === String(fs.id) || String(r.studentId) === String(fs.uid)));

        // 7) Set displayed list
        setClassStudents(filteredExcludingAdded);
      } catch (err) {
        console.error('Unexpected error while fetching students', err);
        setAllStudents([]);
        setClassStudents([]);
        if (showAddModal) toast.error('Unable to load students. Please try again later.');
      }
    };

    fetchClassStudents();
  }, [currentUser, results, showAddModal]);

  // Helper: fetch a single student record from API by id or uid
  const fetchStudentById = async (id) => {
    if (!id) return null;
    try {
      // Try direct endpoint first (backend may accept id or uid)
      const res = await api.get(`/api/students/${encodeURIComponent(id)}`);
      const raw = res.data;
      if (typeof raw === 'string' && raw.trim().startsWith('<')) {
        throw new Error('Student API returned HTML (check server URL).');
      }
      // API may return object or array
      const student = Array.isArray(raw) ? raw[0] : raw;
      if (!student) return null;
      return {
        id: String(student.id || student._id || student.uid || ''),
        uid: String(student.uid || student.studentUid || student.student_id || student.id || ''),
        name: student.name || student.fullName || student.studentName || 'Unnamed',
        class: student.class || student.studentClass || student.className || '',
        raw: student
      };
    } catch (err) {
      // Fallback: try searching cached lists
      const fromAll = allStudents.find(s => String(s.id) === String(id) || String(s.uid) === String(id));
      if (fromAll) return fromAll;
      const fromClass = classStudents.find(s => String(s.id) === String(id) || String(s.uid) === String(id));
      if (fromClass) return fromClass;
      console.debug('fetchStudentById failed, returning null:', err?.message || err);
      return null;
    }
  };

  // Handle form input changes for student selection
  const handleStudentChange = e => {
    const studentId = e.target.value;
    setFormData(prev => ({ ...prev, studentId }));

    // Resolve selected student from local lists first for immediate UI response
    const sourceList = isTeacher ? classStudents : allStudents;
    const localFound = sourceList.find(s => String(s.id) === String(studentId) || String(s.uid) === String(studentId));
    if (localFound) {
      setSelectedStudent(localFound);
      setFormData(prev => ({ ...prev, studentuid: localFound.uid || String(studentId) }));
    } else {
      setSelectedStudent(null);
      setFormData(prev => ({ ...prev, studentuid: '' }));
    }

    // Fetch authoritative student record (UID) from API and update form data
    (async () => {
      const fetched = await fetchStudentById(studentId);
      if (fetched) {
        setSelectedStudent(fetched);
        setFormData(prev => ({ ...prev, studentuid: fetched.uid || String(studentId) }));
      }
    })();
  };

  // Handle form input changes for general fields
  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle subject selection
  const handleSubjectToggle = subjectId => {
    setFormData(prevData => {
      const isSelected = prevData.subjects.some(s => String(s.id) === String(subjectId));
      if (isSelected) {
        return {
          ...prevData,
          subjects: prevData.subjects.filter(s => String(s.id) !== String(subjectId))
        };
      } else {
        // Only use subjects loaded from the API. If the subject isn't found, ignore the toggle.
        const subject = subjects.find(s => String(s.id) === String(subjectId));
        if (!subject) {
          toast.error('Selected subject is not available.');
          return prevData;
        }
        return {
          ...prevData,
          subjects: [...prevData.subjects, {
            id: subject.id,
            name: subject.name,
            firstTest: 0,
            secondTest: 0,
            thirdTest: 0,
            exam: 0,
            total: 0,
            percentage: 0,
            grade: 'F'
          }]
        };
      }
    });
  };

  // Handle subject score changes
  const handleSubjectScoreChange = (subjectId, field, value) => {
    const numValue = parseInt(value) || 0;
    setFormData(prevData => {
      const updatedSubjects = prevData.subjects.map(subject => {
        if (String(subject.id) === String(subjectId)) {
          const updatedSubject = { ...subject, [field]: numValue };
          if (['firstTest', 'secondTest', 'thirdTest', 'exam'].includes(field)) {
            const { total, percentage, grade } = calculateTotal(
              field === 'firstTest' ? numValue : subject.firstTest,
              field === 'secondTest' ? numValue : subject.secondTest,
              field === 'thirdTest' ? numValue : subject.thirdTest,
              field === 'exam' ? numValue : subject.exam
            );
            updatedSubject.total = total;
            updatedSubject.percentage = percentage;
            updatedSubject.grade = grade;
          }
          return updatedSubject;
        }
        return subject;
      });
      return { ...prevData, subjects: updatedSubjects };
    });
  };

  // Handle form submission for adding a new result (saves to backend as unpublished)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.studentId) {
      toast.error('Please select a student');
      return;
    }
    if (formData.subjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }

    // ensure we always send a teacher identifier the backend expects
    const teacherUid = currentUser?.uid || currentUser?.id || localStorage.getItem('uid') || null;

    // Resolve student UID (e.g. "YMS-2501") to send to the backend
    const resolvedStudent = selectedStudent || findStudentById(formData.studentId);
    const studentUid = resolvedStudent?.uid || resolvedStudent?.studentUid || resolvedStudent?.id || String(formData.studentId);

    const payload = {
      studentId: formData.studentId,
      studentuid: studentUid,       // <-- ensure student's UID (YMS-2501) is saved to the DB
      studentUid: studentUid,       // <-- include common alternate key just in case backend expects camelCase
      session: formData.session,
      term: formData.term,
      subjects: formData.subjects,
      teacherComment: formData.teacherComment || '',
      teacherUid // <-- required by backend validation
      // Do not include `published` here; backend will set published: 'no' by default
    };

    // debug: log payload to browser console (check Network + Console)
    console.debug('Posting result payload:', payload);

    try {
      await api.post('/api/results', payload);
      // Publication is handled separately; just confirm save to the teacher
      toast.success('Result saved.');

      // Refresh results so the newly saved result appears immediately in the dashboard
      await loadResults();

      // Keep local UI behaviour: remove added student from selection lists so they can't be re-added in the UI
      setClassStudents(prev => prev.filter(s => String(s.id) !== String(formData.studentId) && String(s.uid) !== String(formData.studentId) && String(s.uid) !== String(studentUid)));
      setAllStudents(prev => prev.filter(s => String(s.id) !== String(formData.studentId) && String(s.uid) !== String(formData.studentId) && String(s.uid) !== String(studentUid)));

      // reset form and close modal
      setFormData({
        studentId: '',
        session: '',
        term: '',
        subjects: [],
        teacherComment: ''
      });
      setSelectedStudent(null);
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to save result', err, err?.response?.data);
      // show backend error message if present
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to save result. Check server connection.';
      toast.error(msg);
    }
  };

  // Handle result deletion
  const handleDeleteResult = async (id) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this result?')) return;

    try {
      await api.delete(`/api/results/${encodeURIComponent(id)}`);
      setResults(prev => prev.filter(result => String(result.id) !== String(id)));
      toast.success('Result deleted successfully!');
    } catch (err) {
      console.error('Failed to delete result', err);
      const msg = err?.response?.data?.message || 'Failed to delete result. Check server.';
      toast.error(msg);
    }
  };

  // View result details
  const handleViewResult = result => {
    setSelectedResult(result);
    setShowViewModal(true);
  };

  // Open comment modal
  const handleOpenCommentModal = result => {
    setSelectedResult(result);
    setComment(result.teacherComment || '');
    setShowCommentModal(true);
  };

  // Save teacher comment to backend and update local state
  const handleSaveComment = async () => {
    if (!selectedResult) return;
    try {
      const id = selectedResult.id || selectedResult._id;
      if (!id) throw new Error('Result id missing');

      const payload = {
        teacherComment: comment,
        commentStatus: comment.trim() !== ''
      };

      // Backend expects PUT for updateResult route — use PUT (not PATCH)
      const res = await api.put(`/api/results/${encodeURIComponent(id)}`, payload);
      const updatedResult = res?.data || { ...selectedResult, ...payload };

      // Update local results array and selectedResult with returned document
      setResults(prev => prev.map(r => (String(r.id || r._id) === String(id) ? { ...r, ...updatedResult } : r)));
      setSelectedResult(prev => (prev && (String(prev.id || prev._id) === String(id))) ? { ...prev, ...updatedResult } : prev);

      setShowCommentModal(false);
      toast.success('Comment saved successfully!');
    } catch (err) {
      console.error('Failed to save comment', err);
      const msg = err?.response?.data?.message || 'Failed to update comment. Check server.';
      toast.error(msg);
    }
  };

  // Helper: show only subjects registered by the teacher when a student views a result card
  const getDisplaySubjects = (result) => {
    if (!result || !Array.isArray(result.subjects)) return [];
    // if result includes a teacher identifier use it to trim subjects
    const rTeacherUid = result.teacherUid || result.teacherId || result.teacher || null;
    return result.subjects.filter(sub => {
      if (!rTeacherUid) return true;
      // common possible field names on subject entries
      if (sub.teacherUid && String(sub.teacherUid) === String(rTeacherUid)) return true;
      if (sub.registeredBy && String(sub.registeredBy) === String(rTeacherUid)) return true;
      if (sub.teacherId && String(sub.teacherId) === String(rTeacherUid)) return true;
      // fallback: include if no explicit owner field
      return !sub.teacherUid && !sub.registeredBy && !sub.teacherId;
    });
  };

  // compute display subjects for the selected result depending on viewer
  const getSelectedResultDisplaySubjects = (result) => {
    if (!result) return [];
    // students: only subjects registered by the teacher
    if (isStudent) return getDisplaySubjects(result);
    // teachers/admins: show all subjects on the result
    return Array.isArray(result.subjects) ? result.subjects : [];
  };

  return (
    <DashboardLayout title="Results Management">
      {/* Header with Add Result button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-lg sm:text-2xl font-semibold text-gray-900 truncate whitespace-nowrap">Student Results</h1>
        <button
          type="button"
          className="inline-flex items-center px-3 py-2 text-sm sm:text-sm rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={() => setShowAddModal(true)}
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Result
        </button>
      </div>

      {/* Results Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Pic</th>
                <th className="px-3 py-2 text-left text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-3 py-2 text-left text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Term</th>
                <th className="px-3 py-2 text-left text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Subjects</th>
                <th className="px-3 py-2 text-left text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Overall</th>
                <th className="px-3 py-2 text-left text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
                <th className="px-3 py-2 text-right text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((result, idx) => {
                // Prefer resolving by studentId, fallback to studentUid
                const studentRecord = findStudentById(result.studentId) || findStudentById(result.studentUid) || { name: 'Unknown student', uid: result.studentUid || result.studentId || '' };
                const avatarSrc = normalizeStudentPicture(studentRecord?.picture);
                const { percentage, grade } = calculateOverallGrade(result.subjects);

                return (
                  <tr key={result.id || idx} className="align-top">
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <img
                          src={avatarSrc || '/images/default-avatar.png'}
                          alt={studentRecord.name || 'student'}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      </div>
                    </td>

                    {/* Student name + UID */}
                    <td className="px-3 py-3 whitespace-nowrap max-w-[12rem]">
                      <div className="text-sm text-gray-900 truncate whitespace-nowrap">{studentRecord.name}</div>
                      <div className="text-xs text-gray-500 truncate whitespace-nowrap">{studentRecord.uid}</div>
                    </td>

                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900 truncate whitespace-nowrap">{result.session}</div>
                      <div className="text-sm text-gray-500 truncate whitespace-nowrap">{result.term}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                      {Array.isArray(result.subjects) ? result.subjects.length : 0} subject{(Array.isArray(result.subjects) && result.subjects.length !== 1) ? 's' : ''}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{percentage}%</div>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${grade === 'A+' || grade === 'A' ? 'bg-green-100 text-green-800' : grade === 'B' ? 'bg-blue-100 text-blue-800' : grade === 'C' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>Grade {grade}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${result.commentStatus ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {result.commentStatus ? 'Added' : 'Not Added'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button onClick={() => handleViewResult(result)} className="text-blue-600 hover:text-blue-900 p-1" aria-label="View result">
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleOpenCommentModal(result)} className="text-green-600 hover:text-green-900 p-1" aria-label="Add comment">
                        <MessageCircleIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleEditClick(result)} className="text-indigo-600 hover:text-indigo-900 p-1" aria-label="Edit result">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteResult(result.id)} className="text-red-600 hover:text-red-900 p-1" aria-label="Delete result">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {results.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-3 py-4 text-center text-sm text-gray-500">No results found. Click "Add Result" to add a new result.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Result Modal */}
      <Modal open={showAddModal} title="Add New Result" onClose={() => setShowAddModal(false)} className="sm:max-w-4xl">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-3">
              <div>
                <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">Student</label>
                <select id="studentId" name="studentId" required value={formData.studentId} onChange={handleStudentChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                  <option value="">Select a student</option>
                  { (isTeacher ? classStudents : allStudents).map(student => (
                      <option key={student.id} value={String(student.id)}>{student.name} ({student.uid || student.id})</option>
                    ))
                  }
                </select>
              </div>
              <div>
                <label htmlFor="session" className="block text-sm font-medium text-gray-700">Session</label>
                <select id="session" name="session" required value={formData.session} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                  <option value="">Select session</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                  <option value="2027/2028">2027/2028</option>
                </select>
              </div>
              <div>
                <label htmlFor="term" className="block text-sm font-medium text-gray-700">Term</label>
                <select id="term" name="term" required value={formData.term} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                  <option value="">Select term</option>
                  <option value="First Term">First Term</option>
                  <option value="Second Term">Second Term</option>
                  <option value="Third Term">Third Term</option>
                </select>
              </div>
            </div>

            { /* show subjects selection when modal is open — display teacher's subjects even if student not selected yet */ }
            {(selectedStudent || subjects.length > 0) && (
               <>
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-4">
                    Select Subjects {selectedStudent ? `for ${selectedStudent.name}` : '(choose student to personalise selection)'}
                  </h4>
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                     {subjects.map(subject => (
                       <div key={subject.id} className="flex items-center">
                         <input id={`subject-${subject.id}`} type="checkbox" checked={formData.subjects.some(s => String(s.id) === String(subject.id))} onChange={() => handleSubjectToggle(subject.id)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                         <label htmlFor={`subject-${subject.id}`} className="ml-2 block text-sm text-gray-900 truncate whitespace-nowrap">{subject.name}</label>
                       </div>
                     ))}
                   </div>

                  {formData.subjects.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Enter Scores</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">1st</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">2nd</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">3rd</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">%</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {formData.subjects.map(subject => (
                              <tr key={subject.id}>
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-[12rem]">{subject.name}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <input type="number"  value={subject.firstTest} onChange={e => handleSubjectScoreChange(subject.id, 'firstTest', e.target.value)} className="w-16 focus:ring-blue-500 focus:border-blue-500 block shadow-sm text-sm border-gray-300 rounded-md" />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <input type="number"  value={subject.secondTest} onChange={e => handleSubjectScoreChange(subject.id, 'secondTest', e.target.value)} className="w-16 focus:ring-blue-500 focus:border-blue-500 block shadow-sm text-sm border-gray-300 rounded-md" />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <input type="number"  value={subject.thirdTest} onChange={e => handleSubjectScoreChange(subject.id, 'thirdTest', e.target.value)} className="w-16 focus:ring-blue-500 focus:border-blue-500 block shadow-sm text-sm border-gray-300 rounded-md" />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <input type="number"  value={subject.exam} onChange={e => handleSubjectScoreChange(subject.id, 'exam', e.target.value)} className="w-16 focus:ring-blue-500 focus:border-blue-500 block shadow-sm text-sm border-gray-300 rounded-md" />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{subject.total}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{(subject.percentage || 0).toFixed(1)}%</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${subject.grade === 'A+' || subject.grade === 'A' ? 'bg-green-100 text-green-800' : subject.grade === 'B' ? 'bg-blue-100 text-blue-800' : subject.grade === 'C' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{subject.grade}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <label htmlFor="teacherComment" className="block text-sm font-medium text-gray-700">Teacher's Comment</label>
                    <textarea id="teacherComment" name="teacherComment" rows={3} value={formData.teacherComment} onChange={handleInputChange} className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm text-sm border-gray-300 rounded-md" placeholder="Enter your comment about the student's performance" />
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-2 rounded border bg-white text-sm">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white text-sm">Add Result</button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Result Modal */}
      <Modal open={showEditModal} title="Edit Result" onClose={() => { setShowEditModal(false); resetForm(); }} className="sm:max-w-4xl">
        <form onSubmit={handleEditSubmit}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-3">
              <div>
                <label htmlFor="studentId_edit" className="block text-sm font-medium text-gray-700">Student</label>
                <select id="studentId_edit" name="studentId" required value={formData.studentId} onChange={handleStudentChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                  <option value="">Select a student</option>
                  { (isTeacher ? classStudents : allStudents).map(student => (
                      <option key={student.id} value={String(student.id)}>{student.name} ({student.uid || student.id})</option>
                    ))
                  }
                </select>
              </div>
              <div>
                <label htmlFor="session_edit" className="block text-sm font-medium text-gray-700">Session</label>
                <select id="session_edit" name="session" required value={formData.session} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                  <option value="">Select session</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                  <option value="2027/2028">2027/2028</option>
                </select>
              </div>
              <div>
                <label htmlFor="term_edit" className="block text-sm font-medium text-gray-700">Term</label>
                <select id="term_edit" name="term" required value={formData.term} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                  <option value="">Select term</option>
                  <option value="First Term">First Term</option>
                  <option value="Second Term">Second Term</option>
                  <option value="Third Term">Third Term</option>
                </select>
              </div>
            </div>

            { /* Subjects selection and scores (prefilled from formData) */ }
            {(formData.subjects.length > 0 || subjects.length > 0) && (
              <>
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Edit Subjects & Scores</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">1st</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">2nd</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">3rd</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">%</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {formData.subjects.map(subject => (
                          <tr key={subject.id}>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{subject.name}</td>
                            <td className="px-3 py-2"><input type="number" value={subject.firstTest} onChange={e => {
                              handleSubjectScoreChange(subject.id, 'firstTest', e.target.value);
                            }} className="w-16 shadow-sm text-sm border-gray-300 rounded-md" /></td>
                            <td className="px-3 py-2"><input type="number" value={subject.secondTest} onChange={e => {
                              handleSubjectScoreChange(subject.id, 'secondTest', e.target.value);
                            }} className="w-16 shadow-sm text-sm border-gray-300 rounded-md" /></td>
                            <td className="px-3 py-2"><input type="number" value={subject.thirdTest} onChange={e => {
                              handleSubjectScoreChange(subject.id, 'thirdTest', e.target.value);
                            }} className="w-16 shadow-sm text-sm border-gray-300 rounded-md" /></td>
                            <td className="px-3 py-2"><input type="number" value={subject.exam} onChange={e => {
                              handleSubjectScoreChange(subject.id, 'exam', e.target.value);
                            }} className="w-16 shadow-sm text-sm border-gray-300 rounded-md" /></td>
                            <td className="px-3 py-2 text-sm text-gray-900">{subject.total}</td>
                            <td className="px-3 py-2 text-sm text-gray-900">{(subject.percentage || 0).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <div className="mt-4">
              <label htmlFor="teacherComment_edit" className="block text-sm font-medium text-gray-700">Teacher's Comment</label>
              <textarea id="teacherComment_edit" name="teacherComment" rows={3} value={formData.teacherComment} onChange={e => setFormData(prev => ({ ...prev, teacherComment: e.target.value }))} className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm text-sm border-gray-300 rounded-md" />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => { setShowEditModal(false); resetForm(); }} className="px-3 py-2 rounded border bg-white text-sm">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white text-sm">Save Changes</button>
            </div>
          </div>
        </form>
      </Modal>

      {/* View Result Modal */}
      <Modal open={showViewModal} title="Result Card" onClose={() => setShowViewModal(false)} className="sm:max-w-4xl">
        {selectedResult && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Student Name</h4>
                <p className="text-sm text-gray-900 truncate whitespace-nowrap">{findStudentById(selectedResult.studentId)?.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Student ID</h4>
                <p className="text-sm text-gray-900 truncate whitespace-nowrap">{findStudentById(selectedResult.studentId)?.uid}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Class</h4>
                <p className="text-sm text-gray-900 truncate whitespace-nowrap">{findStudentById(selectedResult.studentId)?.class || '—'}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Subject Results</h4>

              {/* If student views an unpublished result show a notice; still show only teacher-registered subjects */}
              {isStudent && !selectedResult.published && (
                <div className="mb-4 p-3 rounded bg-yellow-50 border border-yellow-200 text-yellow-800">
                  Result has not been published by the admin yet.
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">1st Test</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">2nd Test</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">3rd Test</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getSelectedResultDisplaySubjects(selectedResult).map((subject, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-[12rem]">{subject.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{subject.firstTest}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{subject.secondTest}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{subject.thirdTest}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{subject.exam}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{subject.total}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${subject.grade === 'A+' || subject.grade === 'A' ? 'bg-green-100 text-green-800' : subject.grade === 'B' ? 'bg-blue-100 text-blue-800' : subject.grade === 'C' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{subject.grade}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Overall Percentage</h4>
                  <p className="mt-1 text-lg font-medium text-gray-900">{calculateOverallGrade(selectedResult.subjects).percentage}%</p>
                </div>
              </div>

              {selectedResult.teacherComment && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-700">Teacher's Comment</h4>
                  <p className="mt-1 text-sm text-gray-900">{selectedResult.teacherComment}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Comment Modal */}
      {showCommentModal && selectedResult && (
        <Modal open={showCommentModal} title="Add Teacher Comment" onClose={() => setShowCommentModal(false)} className="sm:max-w-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Add Teacher Comment</h3>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 truncate whitespace-nowrap">
                    Student: {findStudentById(selectedResult.studentId)?.name} | {selectedResult.session} - {selectedResult.term}
                  </p>
                </div>
                <div className="mt-4">
                  <label htmlFor="teacherComment" className="block text-sm font-medium text-gray-700">Comment</label>
                  <textarea id="teacherComment" rows={4} value={comment} onChange={e => setComment(e.target.value)} className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm text-sm border-gray-300 rounded-md" placeholder="Enter your comment about the student's performance" />
                </div>
                <div className="mt-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button type="button" className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500" onClick={() => setComment('Excellent work! Keep up the high standards.')}>
                      Positive
                    </button>
                    <button type="button" className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500" onClick={() => setComment('Needs to improve in some subjects. Work harder next term.')}>
                      Warning
                    </button>
                    <button type="button" className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" onClick={() => setComment('Good progress. Keep it up!')}>
                      General
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse space-y-2 sm:space-y-0 sm:space-x-3">
            <button type="button" className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-3 py-2 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3" onClick={handleSaveComment}>
              Save Comment
            </button>
            <button type="button" className="w-full sm:w-auto mt-0 inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-3 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" onClick={() => setShowCommentModal(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
};
export default TeacherResults;