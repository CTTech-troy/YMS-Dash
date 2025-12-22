import React, { useEffect, useRef, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { PlusIcon, EyeIcon, PencilIcon, TrashIcon, MessageCircleIcon, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

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

const initialResults = [];

const TeacherResults = () => {
  const [results, setResults] = useState(initialResults);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { currentUser } = useAuth();
  const [classStudents, setClassStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
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

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [loadingDeleteId, setLoadingDeleteId] = useState(null);
  const [loadingComment, setLoadingComment] = useState(false);

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

  const handleEditClick = async (result) => {
    if (!result) return;
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

    const resolvedStudent = findStudentById(studentId) || findStudentById(studentuid) || null;
    if (resolvedStudent) setSelectedStudent(resolvedStudent);

    // Keep reference to the selected result being edited
    setSelectedResult(result || null);

    setEditingId(String(result.id || result._id || ''));
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const targetId = editingId || selectedResult?.id || selectedResult?._id || selectedResult?.resultId || '';
    if (!targetId) {
      toast.error('Missing result id for edit.');
      return;
    }
    // Allow editing without re-selecting student: prefer formData.studentId, then formData.studentuid,
    // then selectedStudent, then selectedResult.studentId/Uid as fallback.
    const studentIdFallback = formData.studentId || formData.studentuid || selectedStudent?.id || selectedResult?.studentId || selectedResult?.studentUid || selectedResult?.studentuid || '';
    setLoadingEdit(true);
    try {
      const payload = {
        studentId: studentIdFallback,
        studentuid: formData.studentuid || studentIdFallback,
        studentUid: formData.studentuid || studentIdFallback,
        session: formData.session,
        term: formData.term,
        subjects: formData.subjects,
        teacherComment: formData.teacherComment || ''
      };
      const res = await api.put(`/api/results/${encodeURIComponent(targetId)}`, payload);
      const updated = res?.data || { id: targetId, ...payload };
      const updatedNormalized = { ...updated, id: updated.id || updated._id || targetId };
      setResults(prev => prev.map(r => (String(r.id || r._id) === String(targetId) ? { ...r, ...updatedNormalized } : r)));
      toast.success('Result updated.');
      setShowEditModal(false);
      resetForm();
      await loadResults();
      try {
        const resolvedStudent = selectedStudent || findStudentById(formData.studentId) || findStudentById(selectedResult?.studentId) || findStudentById(selectedResult?.studentUid);
        const studentIdOrUid = resolvedStudent?.uid || resolvedStudent?.id || formData.studentuid || formData.studentId;
        await api.put(`/api/students/${encodeURIComponent(studentIdOrUid)}`, {
          lastResultSession: formData.session,
          lastResultTerm: formData.term
        }).catch(() => {});
      } catch {}
    } catch (err) {
      console.error('Failed to update result', err, err?.response?.data);
      const msg = err?.response?.data?.message || 'Failed to update result.';
      toast.error(msg);
    } finally {
      setLoadingEdit(false);
    }
  };

  const isTeacher = currentUser && (currentUser.role === 'teacher' || currentUser.userType === 'teacher');
  const isStudent = currentUser && (currentUser.role === 'student' || currentUser.userType === 'student');

  const findStudentById = id => {
    if (id == null) return null;
    const sid = String(id);

    const fromAll = allStudents.find(s => String(s.id) === sid || String(s.uid) === sid);
    if (fromAll) return fromAll;

    const fromClass = classStudents.find(s => String(s.id) === sid || String(s.uid) === sid);
    if (fromClass) return fromClass;

    const matchedResult = results.find(r => String(r.studentId) === sid);
    if (matchedResult) {
      const byId = allStudents.find(s => String(s.id) === String(matchedResult.studentId) || String(s.uid) === String(matchedResult.studentId));
      if (byId) return byId;
    }

    return { id: sid, uid: sid, name: 'Unknown student', picture: '/images/default-avatar.png', class: '' };
  };

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
          throw new Error('Invalid response.');
        }
        const arr = Array.isArray(raw)
          ? raw
          : (Array.isArray(raw.data) ? raw.data : (Array.isArray(raw.subjects) ? raw.subjects : []));

        const ownerKeys = ['createdBy','creator','owner','teacherUid','teacherId','staffId','userId','created_by'];
        const userIds = [
          currentUser?.uid,
          currentUser?.id,
          currentUser?.email
        ].filter(Boolean).map(String);

        const filteredByOwner = arr.filter(s =>
          ownerKeys.some(k => s[k] && userIds.includes(String(s[k])))
        );

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
        setSubjects([]);
        toast.error('Unable to load subjects from server.');
      }
    };

    fetchSubjects();
  }, [showAddModal, currentUser]);

  const calculateGrade = percentage => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 45) return 'D';
    if (percentage >= 40) return 'E';
    return 'F';
  };

  const calculateTotal = (firstTest, secondTest, thirdTest, exam) => {
    const total = (firstTest || 0) + (secondTest || 0) + (thirdTest || 0) + (exam || 0);
    const percentage = total > 0 ? (total / 100) * 100 : 0;
    return {
      total,
      percentage,
      grade: calculateGrade(percentage)
    };
  };

  // ============================================================================
  // EFFECT: Load Students from Backend on Mount
  // Fetch teacher record for accurate assignedClass
  // Fetch all students and filter by teacher's class
  // ============================================================================
  useEffect(() => {
    if (!currentUser) return;
    let mounted = true;
    const cacheKey = `yms_students_cache_${currentUser.uid || currentUser.id || 'anon'}`;

    const loadCache = () => {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    const saveCache = (all, classList) => {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ allStudents: all, classStudents: classList, ts: Date.now() }));
      } catch {}
    };

    (async () => {
      setLoadingStudents(true);
      setLoadingProgress(0);

      const cached = loadCache();
      if (cached && mounted) {
        setAllStudents(cached.allStudents || []);
        setClassStudents(cached.classStudents || []);
        setLoadingProgress(50);
      }

      try {
        // ====================================
        // FETCH TEACHER RECORD TO GET ACCURATE assignedClass
        // ====================================
        let assignedClass = currentUser.assignedClass || currentUser.class || '';
        if (currentUser?.uid) {
          try {
            const tRes = await api.get(`/api/teachers/${encodeURIComponent(currentUser.uid)}`);
            const tData = tRes.data;
            const teacher = Array.isArray(tData) ? tData[0] : tData;
            assignedClass = teacher?.assignedClass || teacher?.classAssigned || teacher?.class || assignedClass;
            console.debug('Fetched teacher assigned class:', { assignedClass, uid: currentUser.uid });
          } catch (err) {
            console.debug('Could not fetch teacher record, using currentUser value:', { assignedClass });
          }
        }

        // ====================================
        // FETCH CLASS-FILTERED STUDENTS (server-side filter, cursor pagination)
        // This reduces Firestore reads by filtering on the backend
        // ====================================
        let allStudentsArray = [];
        let nextToken = null;
        let hasMore = true;
        let pageCount = 0;

        try {
          // Fetch ONLY the teacher's class students to reduce Firestore reads
          const classParam = assignedNorm ? `&class=${encodeURIComponent(assignedClass)}` : '';
          
          while (hasMore && pageCount < 10) { // limit to 10 pages max per class
            let url = `/api/students?limit=25${classParam}`;
            if (nextToken) {
              url += `&startAfter=${encodeURIComponent(nextToken)}`;
            }

            const sRes = await api.get(url);
            const raw = sRes.data;
            if (typeof raw === 'string' && raw.trim().startsWith('<')) {
              console.error('Students API returned HTML');
              break;
            }

            const pageData = Array.isArray(raw) 
              ? raw 
              : (Array.isArray(raw.data) ? raw.data : (Array.isArray(raw.students) ? raw.students : []));
            
            if (Array.isArray(pageData) && pageData.length > 0) {
              allStudentsArray = allStudentsArray.concat(pageData);
              console.debug('Loaded class students page:', {
                pageNum: pageCount + 1,
                pageCount: pageData.length,
                totalSoFar: allStudentsArray.length
              });
            }

            nextToken = raw?.nextPageToken || null;
            hasMore = raw?.hasMore === true;
            pageCount++;

            if (!hasMore) {
              console.debug('Pagination complete:', { totalPages: pageCount, totalCount: allStudentsArray.length });
              break;
            }
          }
        } catch (err) {
          console.error('Network error fetching students', err);
          toast.error('Could not load students from server. Please try again later.');
          setLoadingStudents(false);
          return;
        }

        // ====================================
        // NORMALIZE STUDENTS DATA
        // ====================================
        const normalized = allStudentsArray.map(s => {
          const detectedClass = (s.class || s.studentClass || s.className || s.grade || s.classroom || '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
        
          return {
            id: String(s.id || s._id || s.uid || Math.random().toString(36).slice(2, 9)),
            uid: String(s.uid || s.studentUid || s.id || ''),
            name: s.name || s.fullName || s.studentName || 'Unnamed',
            class: detectedClass,
            picture: normalizeStudentPicture(s.picture || s.avatar || s.image || ''),
            raw: s
          };
        });

        if (!mounted) return;
        setAllStudents(normalized);

        // ====================================
        // FILTER: If student class == assigned teacher's class, display all matching students
        // ====================================
        const assignedNorm = normalizeClass(assignedClass);
        const matched = assignedNorm 
          ? normalized.filter(st => normalizeClass(st.class || '') === assignedNorm) 
          : normalized;

        console.debug('Filtered students by class:', { 
          assignedClass,
          assignedNorm,
          totalFetched: normalized.length,
          matchedCount: matched.length 
        });

        // Exclude students already in results to avoid duplicate adds
        const filteredExcludingAdded = matched.filter(fs => !results.some(r => String(r.studentId) === String(fs.id) || String(r.studentId) === String(fs.uid)));
        setClassStudents(filteredExcludingAdded);

        saveCache(normalized, filteredExcludingAdded);
        setLoadingProgress(100);
      } catch (err) {
        console.error('Failed to load students', err);
        if (mounted) {
          setAllStudents(prev => prev || []);
          setClassStudents(prev => prev || []);
          toast.error('Unable to load students from server.');
        }
      } finally {
        setLoadingStudents(false);
      }
    })();

    return () => { mounted = false; };
  }, [currentUser, results, showAddModal]);

  useEffect(() => {
    if (currentUser) return;
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('yms_students_cache_')) localStorage.removeItem(k);
      });
    } catch {}
  }, [currentUser]);

  const loadResults = async () => {
    try {
      const res = await api.get('https://yms-backend-a2x4.onrender.com/api/results');
      const raw = res.data;
      if (typeof raw === 'string' && raw.trim().startsWith('<')) {
        throw new Error('Results API returned HTML.');
      }

      const allRaw = Array.isArray(raw)
        ? raw
        : (Array.isArray(raw.data) ? raw.data : (Array.isArray(raw.results) ? raw.results : []));

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

      if (isTeacher && currentUser?.uid) {
        const uid = String(currentUser.uid);
        const filtered = all.filter(r => String(r.teacherUid || r.staffuid || r.staffUid || '') === uid);
        setResults(filtered.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
        return;
      }

      if (isStudent) {
        const published = all.filter(r => r.published === true || String(r.published) === 'true' || r.published === 1);
        setResults(published);
        return;
      }

      const published = all.filter(r => r.published === true || String(r.published) === 'true' || String(r.published) === 'yes' || r.published === 'yes');
      setResults(published.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (err) {
      console.error('Failed to load results', err);
      toast.error('Failed to load results. Check server.');
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    loadResults();
  }, [currentUser]);

  const calculateOverallGrade = subjectsArr => {
    if (!subjectsArr || subjectsArr.length === 0) return { percentage: 0, grade: 'F' };

    // Sum total marks obtained across all subjects. Support multiple field names.
    const totalObtained = subjectsArr.reduce((sum, subject) => {
      const sTotal = subject?.total ?? (
        (subject?.firstTest || subject?.first || 0) +
        (subject?.secondTest || subject?.second || 0) +
        (subject?.thirdTest || subject?.third || 0) +
        (subject?.exam || subject?.examScore || 0)
      );
      return sum + (Number(sTotal) || 0);
    }, 0);

    const maxPerSubject = 100; // fallback per-subject maximum
    const totalMarksObtainable = (subjectsArr.length || 0) * maxPerSubject;

    const overallPercentage = totalMarksObtainable > 0
      ? (totalObtained / totalMarksObtainable) * 100
      : 0;

    const rounded = parseFloat(overallPercentage.toFixed(1));
    const overallGrade = calculateGrade(rounded);
    return { percentage: rounded, grade: overallGrade };
  };

  const normalizeStudentPicture = (pic) => {
    if (!pic || typeof pic !== 'string') return '/images/default-avatar.png';
    const trimmed = pic.trim();
    if (trimmed.startsWith('http') || trimmed.startsWith('/')) return trimmed;
    return '/images/default-avatar.png';
  };

  const normalizeClass = (v) =>
    (v ?? "")
      .toString()
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .toLowerCase();

  const fetchStudentById = async (id) => {
    if (!id) return null;
    try {
      const res = await api.get(`/api/students/${encodeURIComponent(id)}`);
      const raw = res.data;
      const student = Array.isArray(raw) ? raw[0] : raw;
      if (!student) return null;
      return {
        id: String(student.id || student._id || student.uid || ''),
        uid: String(student.uid || student.studentUid || student.student_id || student.id || ''),
        name: student.name || student.fullName || student.studentName || 'Unnamed',
        class: student.class || student.studentClass || student.className || '',
        raw: student
      };
    } catch {
      const fromAll = allStudents.find(s => String(s.id) === String(id) || String(s.uid) === String(id));
      if (fromAll) return fromAll;
      const fromClass = classStudents.find(s => String(s.id) === String(id) || String(s.uid) === String(id));
      if (fromClass) return fromClass;
      return null;
    }
  };

  const handleStudentChange = e => {
    const studentId = e.target.value;
    setFormData(prev => ({ ...prev, studentId }));

    const sourceList = isTeacher ? classStudents : allStudents;
    const localFound = sourceList.find(s => String(s.id) === String(studentId) || String(s.uid) === String(studentId));
    if (localFound) {
      setSelectedStudent(localFound);
      setFormData(prev => ({ ...prev, studentuid: localFound.uid || String(studentId) }));
    } else {
      setSelectedStudent(null);
      setFormData(prev => ({ ...prev, studentuid: '' }));
    }

    (async () => {
      const fetched = await fetchStudentById(studentId);
      if (fetched) {
        setSelectedStudent(fetched);
        setFormData(prev => ({ ...prev, studentuid: fetched.uid || String(studentId) }));
      }
    })();
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubjectToggle = subjectId => {
    setFormData(prevData => {
      const isSelected = prevData.subjects.some(s => String(s.id) === String(subjectId));
      if (isSelected) {
        return {
          ...prevData,
          subjects: prevData.subjects.filter(s => String(s.id) !== String(subjectId))
        };
      } else {
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

    const teacherUid = currentUser?.uid || currentUser?.id || localStorage.getItem('uid') || null;

    const resolvedStudent = selectedStudent || findStudentById(formData.studentId);
    const studentUid = resolvedStudent?.uid || resolvedStudent?.studentUid || resolvedStudent?.id || String(formData.studentId);

    const payload = {
      studentId: formData.studentId,
      studentuid: studentUid,
      studentUid: studentUid,
      session: formData.session,
      term: formData.term,
      subjects: formData.subjects,
      teacherComment: formData.teacherComment || '',
      teacherUid
    };

    setLoadingSubmit(true);
    try {
      await api.post('/api/results', payload);
      toast.success('Result saved.');

      (async () => {
        const studentIdOrUid = resolvedStudent?.id || resolvedStudent?.uid || formData.studentId;
        try {
          await api.put(`/api/students/${encodeURIComponent(studentIdOrUid)}`, {
            lastResultSession: formData.session,
            lastResultTerm: formData.term
          });
        } catch {}

        setAllStudents(prev => prev.map(s => (String(s.id) === String(studentIdOrUid) || String(s.uid) === String(studentIdOrUid)) ? { ...s, lastResultSession: formData.session, lastResultTerm: formData.term } : s));
        setClassStudents(prev => prev.map(s => (String(s.id) === String(studentIdOrUid) || String(s.uid) === String(studentIdOrUid)) ? { ...s, lastResultSession: formData.session, lastResultTerm: formData.term } : s));
        try {
          const cacheKey = `yms_students_cache_${currentUser.uid || currentUser.id || 'anon'}`;
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.allStudents)) {
              parsed.allStudents = parsed.allStudents.map(s => (String(s.id) === String(studentIdOrUid) || String(s.uid) === String(studentIdOrUid)) ? { ...s, lastResultSession: formData.session, lastResultTerm: formData.term } : s);
              localStorage.setItem(cacheKey, JSON.stringify(parsed));
            }
          }
        } catch {}
      })();

      await loadResults();

      setClassStudents(prev => prev.filter(s => String(s.id) !== String(formData.studentId) && String(s.uid) !== String(formData.studentId) && String(s.uid) !== String(studentUid)));
      setAllStudents(prev => prev.filter(s => String(s.id) !== String(formData.studentId) && String(s.uid) !== String(formData.studentId) && String(s.uid) !== String(studentUid)));

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
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to save result.';
      toast.error(msg);
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleDeleteResult = async (id) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this result?')) return;

    setLoadingDeleteId(id);
    try {
      await api.delete(`/api/results/${encodeURIComponent(id)}`);
      setResults(prev => prev.filter(result => String(result.id) !== String(id)));
      toast.success('Result deleted successfully!');
    } catch (err) {
      console.error('Failed to delete result', err);
      const msg = err?.response?.data?.message || 'Failed to delete result.';
      toast.error(msg);
    } finally {
      setLoadingDeleteId(null);
    }
  };

  const handleViewResult = result => {
    setSelectedResult(result);
    setShowViewModal(true);
  };

  const handleOpenCommentModal = result => {
    setSelectedResult(result);
    setComment(result.teacherComment || '');
    setShowCommentModal(true);
  };

  const handleSaveComment = async () => {
    if (!selectedResult) return;
    setLoadingComment(true);
    try {
      const id = selectedResult.id || selectedResult._id;
      if (!id) throw new Error('Result id missing');

      const payload = {
        teacherComment: comment,
        commentStatus: comment.trim() !== ''
      };

      const res = await api.put(`/api/results/${encodeURIComponent(id)}`, payload);
      const updatedResult = res?.data || { ...selectedResult, ...payload };

      setResults(prev => prev.map(r => (String(r.id || r._id) === String(id) ? { ...r, ...updatedResult } : r)));
      setSelectedResult(prev => (prev && (String(prev.id || prev._id) === String(id))) ? { ...prev, ...updatedResult } : prev);

      setShowCommentModal(false);
      toast.success('Comment saved successfully!');
    } catch (err) {
      console.error('Failed to save comment', err);
      const msg = err?.response?.data?.message || 'Failed to update comment.';
      toast.error(msg);
    } finally {
      setLoadingComment(false);
    }
  };

  const getDisplaySubjects = (result) => {
    if (!result || !Array.isArray(result.subjects)) return [];
    const rTeacherUid = result.teacherUid || result.teacherId || result.teacher || null;
    return result.subjects.filter(sub => {
      if (!rTeacherUid) return true;
      if (sub.teacherUid && String(sub.teacherUid) === String(rTeacherUid)) return true;
      if (sub.registeredBy && String(sub.registeredBy) === String(rTeacherUid)) return true;
      if (sub.teacherId && String(sub.teacherId) === String(rTeacherUid)) return true;
      return !sub.teacherUid && !sub.registeredBy && !sub.teacherId;
    });
  };

  const getSelectedResultDisplaySubjects = (result) => {
    if (!result) return [];
    if (isStudent) return getDisplaySubjects(result);
    return Array.isArray(result.subjects) ? result.subjects : [];
  };

  return (
    <DashboardLayout title="Results Management">
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

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* <th className="px-3 py-2 text-left text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Pic</th> */}
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
                const studentRecord = findStudentById(result.studentId) || findStudentById(result.studentUid) || { name: 'Unknown student', uid: result.studentUid || result.studentId || '' };
                {/* const avatarSrc = normalizeStudentPicture(studentRecord?.picture); */}
                const { percentage, grade } = calculateOverallGrade(result.subjects);

                return (
                  <tr key={result.id || idx} onClick={() => handleEditClick(result)} className="align-top cursor-pointer hover:bg-gray-50">
                    {/* <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <img
                          src={avatarSrc || '/images/default-avatar.png'}
                          alt={studentRecord.name || 'student'}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      </div>
                    </td> */}

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
                      <button onClick={(e) => { e.stopPropagation(); handleViewResult(result); }} className="text-blue-600 hover:text-blue-900 p-1" aria-label="View result">
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleOpenCommentModal(result); }} className="text-green-600 hover:text-green-900 p-1" aria-label="Add comment">
                        <MessageCircleIcon className="h-4 w-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleEditClick(result); }} className="text-indigo-600 hover:text-indigo-900 p-1" aria-label="Edit result">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteResult(result.id); }} disabled={loadingDeleteId === (result.id || result._id)} className="text-red-600 hover:text-red-900 p-1" aria-label="Delete result">
                        {loadingDeleteId === (result.id || result._id) ? (
                          <span className="text-sm text-red-600">Deleting...</span>
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
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

      <Modal open={showAddModal} title="Add New Result" onClose={() => setShowAddModal(false)} className="sm:max-w-4xl">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-3">
              <div>
                <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">Student</label>
                <select 
                  id="studentId" 
                  name="studentId" 
                  required 
                  value={formData.studentId} 
                  onChange={handleStudentChange} 
                  disabled={loadingStudents}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">{loadingStudents ? 'Loading students...' : 'Select a student'}</option>
                  {(isTeacher ? classStudents : allStudents).map(student => (
                    <option key={student.id} value={String(student.id)}>
                      {student.name} ({student.uid || student.id})
                    </option>
                  ))}
                </select>
                {(isTeacher ? classStudents : allStudents).length === 0 && !loadingStudents && (
                  <p className="mt-2 text-sm text-gray-500">No students available</p>
                )}
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
                              {/* <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">%</th> */}
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
                                {/* <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{(subject.percentage || 0).toFixed(1)}%</td> */}
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
              <button type="submit" disabled={loadingSubmit} className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-60">
                {loadingSubmit ? 'Loading...' : 'Add Result'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={showEditModal} title="Edit Result" onClose={() => { setShowEditModal(false); resetForm(); }} className="sm:max-w-4xl">
        <form onSubmit={handleEditSubmit}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-3">
              <div>
                <label htmlFor="studentId_edit" className="block text-sm font-medium text-gray-700">Student</label>
                <div className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                  {selectedStudent?.name || findStudentById(formData.studentId)?.name || 'Unknown Student'} 
                  <span className="text-gray-500 text-xs ml-1">({selectedStudent?.uid || findStudentById(formData.studentId)?.uid || formData.studentId})</span>
                </div>
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
              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Overall Percentage</h4>
                  <p className="mt-1 text-lg font-medium text-gray-900">{calculateOverallGrade(formData.subjects).percentage}%</p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="teacherComment_edit" className="block text-sm font-medium text-gray-700">Teacher's Comment</label>
              <textarea id="teacherComment_edit" name="teacherComment" rows={3} value={formData.teacherComment} onChange={e => setFormData(prev => ({ ...prev, teacherComment: e.target.value }))} className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm text-sm border-gray-300 rounded-md" />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => { setShowEditModal(false); resetForm(); }} className="px-3 py-2 rounded border bg-white text-sm">Cancel</button>
              <button type="submit" disabled={loadingEdit} className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-60">
                {loadingEdit ? 'Loading...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

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