import React, { useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import {
  PlusIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  MessageCircleIcon,
  X as XIcon,
  Search,
  Download,
  ClipboardList,
  Loader2
} from 'lucide-react';
import { GradeBadge } from '../../components/ui/GradeBadge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Label, SelectInput, TextInput } from '../../components/ui/Field';
import { toast } from 'sonner';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import {
  normalizeClassLabel,
  canonicalClassKey,
  classesMatch,
  resolveClassFromRecord
} from '../../utils/schoolClass';

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
        className={`relative z-10 flex max-h-[min(92vh,900px)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-float)] sm:max-w-4xl ${className}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
};

const initialResults = [];

function normalizeSessionKey(s) {
  return (s ?? '').toString().trim().replace(/\s+/g, '');
}

function normalizeTermKey(t) {
  if (t == null || t === '') return '';
  const raw = String(t).trim().toLowerCase().replace(/\s+/g, ' ');
  if (raw.includes('first') || raw === '1' || raw === '1st') return 'first term';
  if (raw.includes('second') || raw === '2' || raw === '2nd') return 'second term';
  if (raw.includes('third') || raw === '3' || raw === '3rd') return 'third term';
  return raw;
}

const PRESET_ACADEMIC_SESSIONS = ['2025/2026', '2026/2027', '2027/2028', '2028/2029'];
const PRESET_TERM_LABELS = ['First Term', 'Second Term', 'Third Term'];

function mergeUniqueSorted(existing, presets) {
  const set = new Set([...(existing || []), ...presets].filter(Boolean).map((s) => String(s).trim()));
  return [...set].sort((a, b) => a.localeCompare(b));
}

function extractStudentListFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.students)) return data.students;
  return [];
}

function idLooksLikeDocUid(cid) {
  const s = String(cid || '').trim();
  if (s.length < 20) return false;
  return /^[a-zA-Z0-9]+$/.test(s);
}

async function fetchStudentByListParams(apiClient, cid) {
  const paramSets = [
    { linNumber: cid },
    { studentNumber: cid },
    { admissionNumber: cid },
    { uid: cid },
    { search: cid, limit: 25 }
  ];
  for (const params of paramSets) {
    try {
      const res = await apiClient.get('/api/students', { params });
      const list = extractStudentListFromResponse(res.data);
      const match = list.find((s) => {
        const cand = [s.linNumber, s.studentNumber, s.admissionNumber, s.uid, s.id, s.studentUid, s._id]
          .filter((k) => k != null && k !== '')
          .map((k) => String(k));
        return cand.some((k) => k === cid);
      });
      const st = match || (list.length === 1 ? list[0] : null);
      if (st && (st.name || st.fullName || st.studentName)) return st;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchStudentRecordFlexible(apiClient, idsInOrder) {
  const ids = [...new Set((idsInOrder || []).filter(Boolean).map((x) => String(x).trim()))];
  if (ids.length === 0) return null;

  for (const cid of ids) {
    if (!idLooksLikeDocUid(cid)) {
      const fromList = await fetchStudentByListParams(apiClient, cid);
      if (fromList) return fromList;
    }
  }

  for (const cid of ids) {
    if (!idLooksLikeDocUid(cid)) continue;
    try {
      const res = await apiClient.get(`/api/students/${encodeURIComponent(cid)}`);
      const raw = res.data;
      const st = Array.isArray(raw) ? raw[0] : raw;
      if (st && (st.name || st.fullName || st.studentName)) return st;
    } catch (e) {
      const status = e?.response?.status;
      if (status != null && status !== 404) return null;
    }
  }

  for (const cid of ids) {
    if (!idLooksLikeDocUid(cid)) continue;
    const fromList = await fetchStudentByListParams(apiClient, cid);
    if (fromList) return fromList;
  }
  return null;
}

function mapSubjectsFromResult(result) {
  if (!result || !Array.isArray(result.subjects)) return [];
  return result.subjects.map((s) => ({
    id: s.id || s._id || s.subjectId || (s.name ? String(s.name).toLowerCase().replace(/\s+/g, '-') : Math.random().toString(36).slice(2, 8)),
    name: s.name || s.title || s.subjectName || '',
    firstTest: s.firstTest ?? s.first ?? 0,
    secondTest: s.secondTest ?? s.second ?? 0,
    thirdTest: s.thirdTest ?? s.third ?? 0,
    exam: s.exam ?? s.examScore ?? 0,
    total: s.total ?? 0,
    percentage: s.percentage ?? 0,
    grade: s.grade ?? ''
  }));
}

function findMatchingResult(student, session, term, list) {
  if (!student || !session || !term || !Array.isArray(list)) return null;
  const ids = new Set([String(student.id), String(student.uid)].filter(Boolean));
  return list.find((r) => {
    const rSid = String(r.studentId ?? '');
    const rUid = String(r.studentUid ?? '');
    const okStudent = [...ids].some((id) => id && (id === rSid || id === rUid));
    return (
      okStudent &&
      normalizeSessionKey(r.session) === normalizeSessionKey(session) &&
      normalizeTermKey(r.term) === normalizeTermKey(term)
    );
  });
}

function getSchoolUserUidFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const s = localStorage.getItem('schoolUser');
    if (!s) return null;
    const p = JSON.parse(s);
    return p?.uid || p?.id || null;
  } catch {
    return null;
  }
}

function readCachedStudentsForTeacher(uid) {
  if (!uid) return { allStudents: [], classStudents: [] };
  try {
    const raw = localStorage.getItem(`yms_students_cache_${uid}`);
    if (!raw) return { allStudents: [], classStudents: [] };
    const p = JSON.parse(raw);
    return {
      allStudents: Array.isArray(p.allStudents) ? p.allStudents : [],
      classStudents: Array.isArray(p.classStudents) ? p.classStudents : []
    };
  } catch {
    return { allStudents: [], classStudents: [] };
  }
}

const TeacherResults = () => {
  const [results, setResults] = useState(initialResults);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { currentUser } = useAuth();
  const [classStudents, setClassStudents] = useState(() => readCachedStudentsForTeacher(getSchoolUserUidFromStorage()).classStudents);
  const [allStudents, setAllStudents] = useState(() => readCachedStudentsForTeacher(getSchoolUserUidFromStorage()).allStudents);
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

  const [loadingStudents, setLoadingStudents] = useState(() => {
    const c = readCachedStudentsForTeacher(getSchoolUserUidFromStorage());
    return !(c.classStudents.length > 0 || c.allStudents.length > 0);
  });
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [loadingDeleteId, setLoadingDeleteId] = useState(null);
  const [loadingComment, setLoadingComment] = useState(false);
  const [existingResultIdForAdd, setExistingResultIdForAdd] = useState(null);
  const prevAddTripleRef = useRef('');
  const [resolvedStudentNames, setResolvedStudentNames] = useState({});
  const [loadingResults, setLoadingResults] = useState(true);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterSession, setFilterSession] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [deleteTarget, setDeleteTarget] = useState(null);

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
    setExistingResultIdForAdd(null);
    prevAddTripleRef.current = '';
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

    const listSt = findStudentById(studentId) || findStudentById(studentuid);
    if (listSt) {
      setSelectedStudent(listSt);
    } else {
      const r = resolveStudentForResult(result);
      setSelectedStudent({
        name: r.name,
        uid: r.subTitle !== 'Loading…' && r.subTitle ? r.subTitle : r.uid,
        class: r.class,
        id: String(studentId),
        raw: {}
      });
    }

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
        const resolvedStudent =
          selectedStudent ||
          findStudentById(formData.studentId) ||
          findStudentById(selectedResult?.studentId) ||
          findStudentById(selectedResult?.studentUid);
        const studentIdOrUid =
          resolvedStudent?.uid ||
          resolvedStudent?.id ||
          formData.studentuid ||
          formData.studentId ||
          selectedResult?.studentUid ||
          selectedResult?.studentId;
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

  const getStudentFromLists = React.useCallback((id) => {
    if (id == null || id === '') return null;
    const sid = String(id).trim();
    const match = (s) => {
      const keys = [
        s.id,
        s.uid,
        s.raw?.id,
        s.raw?._id,
        s.raw?.uid,
        s.raw?.studentId,
        s.raw?.studentUid,
        s.raw?.student_id
      ].filter(Boolean).map((x) => String(x).trim());
      return keys.some((k) => k === sid);
    };
    return allStudents.find(match) || classStudents.find(match) || null;
  }, [allStudents, classStudents]);

  const findStudentById = React.useCallback((id) => {
    const found = getStudentFromLists(id);
    if (found) return found;
    if (id == null || id === '') return null;
    const sid = String(id).trim();
    const mr = results.find((r) => String(r.studentId) === sid || String(r.studentUid) === sid);
    if (mr) {
      return getStudentFromLists(mr.studentId) || getStudentFromLists(mr.studentUid) || null;
    }
    return null;
  }, [getStudentFromLists, results]);

  const resolveStudentForResult = React.useCallback((result) => {
    if (!result) return { name: '—', uid: '', subTitle: '', class: '', picture: '/images/default-avatar.png' };
    const ids = [result.studentUid, result.studentId].filter(Boolean).map(String);
    const shortRef = (s) => {
      const t = s != null ? String(s).trim() : '';
      if (!t) return '';
      if (t.length <= 22 && !/^[a-zA-Z0-9]{20,}$/.test(t)) return t;
      return '';
    };
    for (const id of ids) {
      const rec = getStudentFromLists(id);
      if (rec?.name) {
        const num =
          rec.raw?.linNumber ||
          rec.raw?.studentNumber ||
          rec.raw?.admissionNumber ||
          shortRef(rec.uid) ||
          shortRef(id);
        return {
          name: rec.name,
          uid: rec.uid || id,
          subTitle: num || 'Student',
          class: rec.class || '',
          picture: rec.picture || '/images/default-avatar.png'
        };
      }
    }
    for (const id of ids) {
      const extra = resolvedStudentNames[id];
      if (extra?.name) {
        const num = extra.uid || extra.studentNumber;
        return {
          name: extra.name,
          uid: extra.uid || id,
          subTitle: shortRef(num) || shortRef(extra.uid) || 'Student',
          class: extra.class || '',
          picture: '/images/default-avatar.png'
        };
      }
    }
    const embedded =
      result.studentName ||
      result.student_name ||
      result.fullName ||
      result.studentFullName ||
      (result.data && (result.data.studentName || result.data.name));
    if (embedded && String(embedded).trim()) {
      const num = result.studentNumber || result.linNumber || shortRef(result.studentUid) || shortRef(result.studentId);
      return {
        name: String(embedded).trim(),
        uid: result.studentUid || result.studentId || '',
        subTitle: num || 'Student',
        class: result.studentClass || '',
        picture: '/images/default-avatar.png'
      };
    }
    const fallbackId = ids[0] || '';
    return {
      name: 'Student',
      uid: fallbackId,
      subTitle: result.studentNumber || result.linNumber || 'Loading…',
      class: '',
      picture: '/images/default-avatar.png'
    };
  }, [getStudentFromLists, resolvedStudentNames]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seenPair = new Set();
      const additions = {};
      let n = 0;
      for (const r of results) {
        if (r.studentName || r.student_name || r.fullName) continue;
        const ids = [r.studentUid, r.studentId].filter(Boolean).map(String);
        if (ids.length === 0) continue;
        if (ids.some((id) => getStudentFromLists(id))) continue;
        const dedupe = [...new Set(ids)].sort().join('\0');
        if (seenPair.has(dedupe)) continue;
        seenPair.add(dedupe);
        if (n >= 40) break;
        n += 1;
        try {
          const st = await fetchStudentRecordFlexible(api, [r.studentUid, r.studentId]);
          if (!st) continue;
          const name = st.name || st.fullName || st.studentName;
          if (!name) continue;
          const num = st.uid || st.studentUid || st.linNumber || st.studentNumber || ids[0];
          const payload = {
            name: String(name),
            uid: String(num),
            studentNumber: st.linNumber || st.studentNumber || '',
            class: st.class || ''
          };
          const keys = [
            ...ids,
            st.uid,
            st.id,
            st.studentUid,
            st._id,
            st.linNumber,
            st.studentNumber
          ].filter(Boolean).map(String);
          for (const k of [...new Set(keys)]) {
            if (!additions[k]?.name) additions[k] = payload;
          }
        } catch {
          /* ignore */
        }
      }
      if (!cancelled && Object.keys(additions).length > 0) {
        setResolvedStudentNames((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const [k, v] of Object.entries(additions)) {
            if (!next[k]?.name) {
              next[k] = v;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
    })();
    return () => { cancelled = true; };
  }, [results, allStudents, classStudents, getStudentFromLists]);

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
      setLoadingProgress(0);

      const cached = loadCache();
      const hadRosterCache = cached && ((cached.classStudents?.length > 0) || (cached.allStudents?.length > 0));
      if (cached && mounted) {
        setAllStudents(cached.allStudents || []);
        setClassStudents(cached.classStudents || []);
        setLoadingProgress(30);
      }
      if (!hadRosterCache) {
        setLoadingStudents(true);
      }

      try {
        const uid = currentUser.uid || currentUser.id;
        let assignedClassRaw = currentUser.assignedClass || currentUser.class || '';

        if (uid) {
          try {
            let tRes = await api.get(`/api/teachers/${encodeURIComponent(uid)}`);
            let tData = tRes.data;
            if (!tData || (Array.isArray(tData) && tData.length === 0)) {
              tRes = await api.get(`/api/teachers`, { params: { uid } });
              tData = tRes.data;
            }
            const teacher = Array.isArray(tData) ? tData[0] : tData;
            assignedClassRaw = teacher?.assignedClass || teacher?.classAssigned || teacher?.class || assignedClassRaw;
          } catch {
            /* use currentUser */
          }
        }

        const teacherClassKey = canonicalClassKey(assignedClassRaw);
        const adminLike = ['admin', 'principal', 'headmaster', 'head'].includes(teacherClassKey);

        let allStudentsArray = [];
        let nextToken = null;
        let hasMore = true;
        let pageCount = 0;

        while (hasMore && pageCount < 200) {
          let url = '/api/students?limit=25';
          if (nextToken) url += `&startAfter=${encodeURIComponent(nextToken)}`;

          const sRes = await api.get(url);
          const raw = sRes.data;
          if (typeof raw === 'string' && raw.trim().startsWith('<')) {
            console.error('Students API returned HTML');
            break;
          }

          const pageData = Array.isArray(raw)
            ? raw
            : (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw?.students) ? raw.students : []));

          if (Array.isArray(pageData) && pageData.length > 0) {
            allStudentsArray = allStudentsArray.concat(pageData);
          }

          nextToken = raw?.nextPageToken || null;
          hasMore = raw?.hasMore === true;
          pageCount += 1;
          if (!hasMore) break;
        }

        const normalized = allStudentsArray.map((s) => {
          const detectedClass = normalizeClassLabel(resolveClassFromRecord(s));
          const classKey = canonicalClassKey(s);
          return {
            id: String(s.id || s._id || s.uid || Math.random().toString(36).slice(2, 9)),
            uid: String(s.uid || s.studentUid || s.id || ''),
            name: s.name || s.fullName || s.studentName || 'Unnamed',
            class: detectedClass,
            classKey,
            picture: normalizeStudentPicture(s.picture || s.avatar || s.image || ''),
            raw: s
          };
        });

        if (!mounted) return;
        setAllStudents(normalized);

        let matched = [];
        if (adminLike) {
          matched = normalized;
        } else if (teacherClassKey) {
          matched = normalized.filter(
            (st) => (st.classKey ?? canonicalClassKey(st.raw || st)) === teacherClassKey
          );
        } else {
          matched = [];
        }

        setClassStudents(matched);
        saveCache(normalized, matched);
        setLoadingProgress(100);

        if (!adminLike && teacherClassKey && matched.length === 0 && normalized.length > 0) {
          toast.error('No students match your assigned class. Ask admin to check class names match your assignment.');
        }
      } catch (err) {
        console.error('Failed to load students', err);
        if (mounted) {
          const msg = String(err?.message || '');
          const net = err?.code === 'ERR_NETWORK' || msg.includes('Network Error');
          if (hadRosterCache) {
            toast.warning('Could not refresh students from the server. Showing your last saved class list.');
          } else if (net) {
            toast.error('Cannot reach the API (e.g. localhost:5000). Start the backend locally or set VITE_API_URL to your deployed API in .env.');
          } else {
            toast.error('Unable to load students from server.');
          }
        }
      } finally {
        if (mounted) setLoadingStudents(false);
      }
    })();

    return () => { mounted = false; };
  }, [currentUser?.uid, currentUser?.assignedClass]);

  useEffect(() => {
    if (currentUser) return;
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('yms_students_cache_')) localStorage.removeItem(k);
      });
    } catch {}
  }, [currentUser]);

  const loadResults = async () => {
    setLoadingResults(true);
    try {
      const res = await api.get('/api/results');
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
        studentName: r.studentName || r.student_name || r.fullName || r.studentFullName || (r.data && (r.data.studentName || r.data.name)) || '',
        studentNumber: r.studentNumber || r.linNumber || r.studentLin || r.admissionNumber || '',
        session: r.session || r.academicSession || '',
        term: r.term || '',
        subjects: Array.isArray(r.subjects) ? r.subjects : (Array.isArray(r.data?.subjects) ? r.data.subjects : []),
        teacherUid: r.teacherUid || r.teacherUid || r.teacher || r.staffuid || r.staffUid || r.createdBy || '',
        commentStatus: !!r.commentStatus || !!r.teacherComment,
        teacherComment: r.teacherComment || r.comment || '',
        published: r.published,
        createdAt: r.createdAt || r.created_at || r.created || '',
        data: r.data
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
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setLoadingResults(false);
      return;
    }
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

  function normalizeStudentPicture(pic) {
    if (!pic || typeof pic !== 'string') return '/images/default-avatar.png';
    const trimmed = pic.trim();
    if (trimmed.startsWith('http') || trimmed.startsWith('/')) return trimmed;
    return '/images/default-avatar.png';
  }

  const fetchStudentById = async (id) => {
    if (!id) return null;
    const fromAll = allStudents.find(s => String(s.id) === String(id) || String(s.uid) === String(id));
    if (fromAll) return fromAll;
    const fromClass = classStudents.find(s => String(s.id) === String(id) || String(s.uid) === String(id));
    if (fromClass) return fromClass;
    const student = await fetchStudentRecordFlexible(api, [id]);
    if (!student) return null;
    return {
      id: String(student.id || student._id || student.uid || ''),
      uid: String(student.uid || student.studentUid || student.student_id || student.id || ''),
      name: student.name || student.fullName || student.studentName || 'Unnamed',
      class: student.class || student.studentClass || student.className || '',
      raw: student
    };
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

  useEffect(() => {
    if (!showAddModal || !isTeacher) return;
    if (!formData.studentId || !formData.session || !formData.term) {
      setExistingResultIdForAdd(null);
      return;
    }
    const triple = `${formData.studentId}|${formData.session}|${formData.term}`;
    const st =
      classStudents.find((s) => String(s.id) === String(formData.studentId) || String(s.uid) === String(formData.studentId)) ||
      allStudents.find((s) => String(s.id) === String(formData.studentId) || String(s.uid) === String(formData.studentId)) ||
      findStudentById(formData.studentId);
    if (!st) return;

    const existing = findMatchingResult(st, formData.session, formData.term, results);
    const tripleChanged = prevAddTripleRef.current !== triple;
    if (tripleChanged) prevAddTripleRef.current = triple;

    if (existing?.id || existing?._id) {
      const eid = String(existing.id || existing._id);
      setExistingResultIdForAdd(eid);
      setFormData((prev) => {
        if (!tripleChanged && prev.subjects.length > 0) return prev;
        return {
          ...prev,
          subjects: mapSubjectsFromResult(existing),
          teacherComment: existing.teacherComment || existing.comment || prev.teacherComment
        };
      });
    } else {
      setExistingResultIdForAdd(null);
      if (tripleChanged) {
        setFormData((prev) => ({ ...prev, subjects: [], teacherComment: '' }));
      }
    }
  }, [showAddModal, formData.studentId, formData.session, formData.term, results, isTeacher, classStudents, allStudents]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.session || !formData.term) {
      toast.error('Please select academic year and term');
      return;
    }
    if (!formData.studentId) {
      toast.error('Please select a student');
      return;
    }
    if (formData.subjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }

    const teacherUid = currentUser?.uid || currentUser?.id || localStorage.getItem('uid') || null;

    const resolvedStudent =
      selectedStudent ||
      findStudentById(formData.studentId) ||
      { id: formData.studentId, uid: formData.studentId };
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

    const existingForSubmit = findMatchingResult(resolvedStudent, formData.session, formData.term, results);
    const targetId = existingResultIdForAdd || existingForSubmit?.id || existingForSubmit?._id;

    setLoadingSubmit(true);
    try {
      if (targetId) {
        await api.put(`/api/results/${encodeURIComponent(targetId)}`, payload);
        toast.success('Result updated.');
      } else {
        await api.post('/api/results', payload);
        toast.success('Result saved.');
      }

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

      resetForm();
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to save result', err, err?.response?.data);
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to save result.';
      toast.error(msg);
    } finally {
      setLoadingSubmit(false);
    }
  };

  const openDeleteConfirm = (result) => {
    const id = result?.id || result?._id;
    if (!id) return;
    const st = resolveStudentForResult(result);
    setDeleteTarget({
      id: String(id),
      label: `${st.name} · ${result.session || '—'} · ${result.term || '—'}`
    });
  };

  const confirmDeleteResult = async () => {
    if (!deleteTarget?.id) return;
    const id = deleteTarget.id;
    setLoadingDeleteId(id);
    try {
      await api.delete(`/api/results/${encodeURIComponent(id)}`);
      setResults((prev) =>
        prev.filter((result) => String(result.id || result._id) !== String(id))
      );
      setDeleteTarget(null);
      toast.success('Result deleted successfully!');
    } catch (err) {
      console.error('Failed to delete result', err);
      const msg = err?.response?.data?.message || 'Failed to delete result.';
      toast.error(msg);
    } finally {
      setLoadingDeleteId(null);
    }
  };

  const clearFilters = () => {
    setFilterSearch('');
    setFilterClass('');
    setFilterSubject('');
    setFilterTerm('');
    setFilterSession('');
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

  const openAddModalForRosterStudent = (student) => {
    if (!student || !filterSession || !filterTerm) return;
    const existing = findMatchingResult(student, filterSession, filterTerm, results);
    const triple = `${String(student.id)}|${filterSession}|${filterTerm}`;
    prevAddTripleRef.current = triple;
    setExistingResultIdForAdd(existing?.id || existing?._id ? String(existing.id || existing._id) : null);
    setFormData({
      studentId: String(student.id),
      studentuid: String(student.uid || ''),
      session: filterSession,
      term: filterTerm,
      subjects: existing ? mapSubjectsFromResult(existing) : [],
      teacherComment: existing?.teacherComment || existing?.comment || '',
      published: ''
    });
    setSelectedStudent(student);
    setShowAddModal(true);
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

  const filterOptions = useMemo(() => {
    const sessions = new Set();
    const terms = new Set();
    const classes = new Set();
    const subjectNames = new Set();
    for (const r of results) {
      if (r.session) sessions.add(String(r.session).trim());
      if (r.term) terms.add(String(r.term).trim());
      const cl = resolveStudentForResult(r).class;
      if (cl) classes.add(String(cl).trim());
      if (Array.isArray(r.subjects)) {
        for (const s of r.subjects) {
          const n = s.name || s.title || s.subjectName;
          if (n) subjectNames.add(String(n).trim());
        }
      }
    }
    if (isTeacher) {
      for (const s of classStudents) {
        if (s.class) classes.add(String(s.class).trim());
      }
      for (const s of subjects) {
        const n = s.name || s.title || s.subjectName;
        if (n) subjectNames.add(String(n).trim());
      }
    }
    return {
      sessions: mergeUniqueSorted([...sessions], PRESET_ACADEMIC_SESSIONS),
      terms: mergeUniqueSorted([...terms], PRESET_TERM_LABELS),
      classes: [...classes].sort((a, b) => a.localeCompare(b)),
      subjects: [...subjectNames].sort((a, b) => a.localeCompare(b))
    };
  }, [results, resolveStudentForResult, isTeacher, classStudents, subjects]);

  const gradeRank = (g) => {
    const order = ['F', 'E', 'D', 'C', 'B', 'A', 'A+'];
    const s = String(g || '').trim();
    const i = order.indexOf(s);
    return i >= 0 ? i : -1;
  };

  const firstSubjectSortKey = (result) => {
    if (!result || !Array.isArray(result.subjects) || result.subjects.length === 0) return '';
    const names = result.subjects
      .map((s) => (s.name || s.title || s.subjectName || '').toString().trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return names[0] || '';
  };

  const filteredAndSortedResults = useMemo(() => {
    let list = [...results];
    const q = filterSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const st = resolveStudentForResult(r);
        const hay = [
          st.name,
          st.subTitle,
          st.uid,
          String(r.studentId || ''),
          String(r.studentUid || ''),
          r.studentNumber,
          r.linNumber,
          r.studentName
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (filterClass) {
      list = list.filter(
        (r) => classesMatch(resolveStudentForResult(r).class, filterClass)
      );
    }
    if (filterSubject) {
      list = list.filter((r) => {
        if (!Array.isArray(r.subjects)) return false;
        return r.subjects.some((s) => {
          const n = (s.name || s.title || s.subjectName || '').toString().trim();
          return n === filterSubject;
        });
      });
    }
    if (filterTerm) {
      list = list.filter((r) => normalizeTermKey(r.term) === normalizeTermKey(filterTerm));
    }
    if (filterSession) {
      list = list.filter((r) => normalizeSessionKey(r.session) === normalizeSessionKey(filterSession));
    }

    const cmp = (a, b) => {
      const sa = resolveStudentForResult(a);
      const sb = resolveStudentForResult(b);
      const pa = calculateOverallGrade(a.subjects).percentage;
      const pb = calculateOverallGrade(b.subjects).percentage;
      const ga = calculateOverallGrade(a.subjects).grade;
      const gb = calculateOverallGrade(b.subjects).grade;
      switch (sortBy) {
        case 'name_asc':
          return (sa.name || '').localeCompare(sb.name || '');
        case 'name_desc':
          return (sb.name || '').localeCompare(sa.name || '');
        case 'score_desc':
          return pb - pa;
        case 'score_asc':
          return pa - pb;
        case 'grade_desc':
          return gradeRank(gb) - gradeRank(ga);
        case 'grade_asc':
          return gradeRank(ga) - gradeRank(gb);
        case 'class_asc':
          return (sa.class || '').localeCompare(sb.class || '');
        case 'subject_asc':
          return firstSubjectSortKey(a).localeCompare(firstSubjectSortKey(b));
        case 'date_asc':
          return (a.createdAt || '').localeCompare(b.createdAt || '');
        case 'date_desc':
        default:
          return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
    };
    list.sort(cmp);
    return list;
  }, [
    results,
    filterSearch,
    filterClass,
    filterSubject,
    filterTerm,
    filterSession,
    sortBy,
    resolveStudentForResult
  ]);

  const rosterEntryMode = Boolean(isTeacher && filterSession && filterTerm);

  const rosterRows = useMemo(() => {
    if (!rosterEntryMode) return [];
    let list = [...classStudents];
    const q = filterSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const hay = [s.name, s.uid, String(s.id || '')].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    if (filterClass) {
      list = list.filter(
        (s) => classesMatch(s.class, filterClass)
      );
    }
    let pairs = list.map((student) => ({
      student,
      result: findMatchingResult(student, filterSession, filterTerm, results)
    }));
    if (filterSubject) {
      pairs = pairs.filter(({ result }) => {
        if (!result || !Array.isArray(result.subjects)) return true;
        return result.subjects.some((sub) => {
          const n = (sub.name || sub.title || sub.subjectName || '').toString().trim();
          return n === filterSubject;
        });
      });
    }
    const rosterCmp = (a, b) => {
      const sa = a.student;
      const sb = b.student;
      const ra = a.result;
      const rb = b.result;
      const pa = ra ? calculateOverallGrade(ra.subjects).percentage : 0;
      const pb = rb ? calculateOverallGrade(rb.subjects).percentage : 0;
      const ga = ra ? calculateOverallGrade(ra.subjects).grade : 'F';
      const gb = rb ? calculateOverallGrade(rb.subjects).grade : 'F';
      switch (sortBy) {
        case 'name_asc':
          return (sa.name || '').localeCompare(sb.name || '');
        case 'name_desc':
          return (sb.name || '').localeCompare(sa.name || '');
        case 'score_desc':
          return pb - pa;
        case 'score_asc':
          return pa - pb;
        case 'grade_desc':
          return gradeRank(gb) - gradeRank(ga);
        case 'grade_asc':
          return gradeRank(ga) - gradeRank(gb);
        case 'class_asc':
          return (sa.class || '').localeCompare(sb.class || '');
        case 'subject_asc':
          return firstSubjectSortKey(ra || {}).localeCompare(firstSubjectSortKey(rb || {}));
        case 'date_asc':
          return (ra?.createdAt || '').localeCompare(rb?.createdAt || '');
        case 'date_desc':
        default:
          return (rb?.createdAt || '').localeCompare(ra?.createdAt || '');
      }
    };
    pairs.sort(rosterCmp);
    return pairs;
  }, [
    rosterEntryMode,
    classStudents,
    filterSearch,
    filterClass,
    filterSubject,
    filterSession,
    filterTerm,
    results,
    sortBy
  ]);

  const tableRows = useMemo(() => {
    if (rosterEntryMode) {
      return rosterRows.map(({ student, result }, idx) => ({
        kind: 'roster',
        student,
        result,
        key: `roster-${String(student.uid || student.id)}-${idx}`
      }));
    }
    return filteredAndSortedResults.map((result, idx) => ({
      kind: 'result',
      result,
      key: String(result.id || result._id || idx)
    }));
  }, [rosterEntryMode, rosterRows, filteredAndSortedResults]);

  const resultSummary = useMemo(() => {
    if (rosterEntryMode) {
      const list = rosterRows;
      if (list.length === 0) return { count: 0, avgScore: 0, savedCount: 0 };
      const withRes = list.filter((p) => p.result);
      if (withRes.length === 0) {
        return { count: list.length, avgScore: 0, savedCount: 0 };
      }
      let sum = 0;
      for (const { result } of withRes) {
        sum += calculateOverallGrade(result.subjects).percentage;
      }
      return {
        count: list.length,
        savedCount: withRes.length,
        avgScore: parseFloat((sum / withRes.length).toFixed(1))
      };
    }
    const list = filteredAndSortedResults;
    if (list.length === 0) return { count: 0, avgScore: 0, savedCount: 0 };
    let sum = 0;
    for (const r of list) {
      sum += calculateOverallGrade(r.subjects).percentage;
    }
    return {
      count: list.length,
      savedCount: list.length,
      avgScore: list.length ? parseFloat((sum / list.length).toFixed(1)) : 0
    };
  }, [rosterEntryMode, rosterRows, filteredAndSortedResults]);

  const exportFilteredCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Student', 'Class', 'Session', 'Term', 'Subject count', 'Score %', 'Grade', 'Comment added', 'Recorded'];
    const lines = [header.join(',')];
    if (rosterEntryMode) {
      for (const { student, result } of rosterRows) {
        const st = resolveStudentForResult(
          result || { studentUid: student.uid, studentId: student.id, subjects: [] }
        );
        const r = result;
        const { percentage, grade } = r ? calculateOverallGrade(r.subjects) : { percentage: '', grade: '' };
        const n = r && Array.isArray(r.subjects) ? r.subjects.length : 0;
        lines.push(
          [
            esc(st.name),
            esc(st.class),
            esc(r?.session || filterSession),
            esc(r?.term || filterTerm),
            n,
            r ? percentage : '',
            esc(r ? grade : ''),
            r ? (r.commentStatus ? 'Yes' : 'No') : '',
            esc(r?.createdAt || '')
          ].join(',')
        );
      }
    } else {
      for (const r of filteredAndSortedResults) {
        const st = resolveStudentForResult(r);
        const { percentage, grade } = calculateOverallGrade(r.subjects);
        const n = Array.isArray(r.subjects) ? r.subjects.length : 0;
        lines.push(
          [
            esc(st.name),
            esc(st.class),
            esc(r.session),
            esc(r.term),
            n,
            percentage,
            esc(grade),
            r.commentStatus ? 'Yes' : 'No',
            esc(r.createdAt || '')
          ].join(',')
        );
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported filtered results');
  };

  const availableStudents = isTeacher ? classStudents : allStudents;

  const hasActiveFilters =
    Boolean(filterSearch.trim()) ||
    Boolean(filterClass) ||
    Boolean(filterSubject) ||
    Boolean(filterTerm) ||
    Boolean(filterSession);

  return (
    <DashboardLayout title="Results Management">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Student results</h1>
            <p className="mt-1 text-sm text-slate-500">
              {rosterEntryMode ? (
                <>
                  Class roster for <span className="font-medium text-slate-700">{filterSession}</span> ·{' '}
                  <span className="font-medium text-slate-700">{filterTerm}</span>. Showing                   {rosterRows.length} student
                  {rosterRows.length === 1 ? '' : 's'} ({resultSummary.savedCount} with saved results).
                </>
              ) : (
                <>
                  Search, filter, and manage scores. Showing {filteredAndSortedResults.length} of {results.length}{' '}
                  record{results.length === 1 ? '' : 's'}.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="gap-2"
              onClick={exportFilteredCsv}
              disabled={rosterEntryMode ? rosterRows.length === 0 : filteredAndSortedResults.length === 0}
            >
              <Download className="h-4 w-4 shrink-0" />
              Export CSV
            </Button>
            <Button
              type="button"
              size="md"
              className="gap-2"
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
            >
              <PlusIcon className="h-4 w-4 shrink-0" />
              Add result
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-slate-200/90 p-4 shadow-[var(--shadow-card)]">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Filtered count</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{resultSummary.count}</p>
          </Card>
          <Card className="border-slate-200/90 p-4 shadow-[var(--shadow-card)]">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {rosterEntryMode ? 'Avg. score (saved rows)' : 'Avg. score (filtered)'}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{resultSummary.avgScore}%</p>
          </Card>
          <Card className="border-slate-200/90 p-4 shadow-[var(--shadow-card)]">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sort</p>
            <div className="mt-2">
              <Label htmlFor="sort-results" className="sr-only">
                Sort
              </Label>
              <SelectInput
                id="sort-results"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="date_desc">Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="name_asc">Student A–Z</option>
                <option value="name_desc">Student Z–A</option>
                <option value="score_desc">Score high → low</option>
                <option value="score_asc">Score low → high</option>
                <option value="grade_desc">Grade best → lowest</option>
                <option value="grade_asc">Grade lowest → best</option>
                <option value="class_asc">Class A–Z</option>
                <option value="subject_asc">Subject A–Z</option>
              </SelectInput>
            </div>
          </Card>
        </div>

        <Card padding={false} className="overflow-hidden border-slate-200/90 shadow-[var(--shadow-card)]">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="relative min-w-0 flex-1 lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <TextInput
                  type="search"
                  placeholder="Search name, ID, or registration…"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="pl-10"
                  aria-label="Search results"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={!hasActiveFilters}>
                  Clear filters
                </Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <div>
                <Label htmlFor="filter-class">Class</Label>
                <SelectInput
                  id="filter-class"
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                >
                  <option value="">All classes</option>
                  {filterOptions.classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <Label htmlFor="filter-subject">Subject</Label>
                <SelectInput
                  id="filter-subject"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                >
                  <option value="">All subjects</option>
                  {filterOptions.subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <Label htmlFor="filter-term">Term</Label>
                <SelectInput
                  id="filter-term"
                  value={filterTerm}
                  onChange={(e) => setFilterTerm(e.target.value)}
                >
                  <option value="">All terms</option>
                  {filterOptions.terms.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <Label htmlFor="filter-session">Session</Label>
                <SelectInput
                  id="filter-session"
                  value={filterSession}
                  onChange={(e) => setFilterSession(e.target.value)}
                >
                  <option value="">All sessions</option>
                  {filterOptions.sessions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SelectInput>
              </div>
            </div>
          </div>

          {rosterEntryMode && rosterRows.length > 0 && !rosterRows.some(({ result }) => result) && (
            <div className="border-b border-sky-100 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 sm:px-5">
              No saved results found for this session and term. You can now add results for all students.
            </div>
          )}

          {loadingResults ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 py-16 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" aria-hidden />
              <p className="text-sm">Loading results…</p>
            </div>
          ) : rosterEntryMode && loadingStudents && classStudents.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 py-16 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" aria-hidden />
              <p className="text-sm">Loading class roster…</p>
            </div>
          ) : tableRows.length === 0 ? (
            <div className="px-4 py-12 sm:px-6">
              <EmptyState
                icon={ClipboardList}
                title={
                  rosterEntryMode
                    ? classStudents.length === 0 && !loadingStudents
                      ? 'No students in your class'
                      : 'No students match'
                    : results.length === 0
                      ? 'No results yet'
                      : 'No matches'
                }
                description={
                  rosterEntryMode
                    ? classStudents.length === 0 && !loadingStudents
                      ? 'Ask an administrator to assign students to your class.'
                      : 'Try adjusting class or search filters.'
                    : results.length === 0
                      ? 'Add a result to get started, or check back after scores are entered.'
                      : 'Try adjusting search or filters to see more records.'
                }
                action={
                  !rosterEntryMode && results.length === 0 ? (
                    <Button type="button" onClick={() => { resetForm(); setShowAddModal(true); }}>
                      Add result
                    </Button>
                  ) : hasActiveFilters ? (
                    <Button type="button" variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgb(226_232_240)]">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Student</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Class</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Session / term</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Subjects</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Score</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Grade</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Comment</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Recorded</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableRows.map((row) => {
                      if (row.kind === 'roster') {
                        const { student, result } = row;
                        const studentRecord = resolveStudentForResult(
                          result || { studentUid: student.uid, studentId: student.id, subjects: [] }
                        );
                        const subjN = result && Array.isArray(result.subjects) ? result.subjects.length : 0;
                        const { percentage, grade } = result
                          ? calculateOverallGrade(result.subjects)
                          : { percentage: 0, grade: 'F' };
                        const sess = result?.session || filterSession;
                        const termLbl = result?.term || filterTerm;
                        return (
                          <tr
                            key={row.key}
                            className="cursor-pointer transition hover:bg-slate-50/90"
                            onClick={() =>
                              result ? handleEditClick(result) : openAddModalForRosterStudent(student)
                            }
                          >
                            <td className="max-w-[14rem] px-4 py-3 align-top">
                              <div className="truncate font-medium text-slate-900">{studentRecord.name}</div>
                              <div className="truncate text-xs text-slate-500">{studentRecord.subTitle}</div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top text-slate-700">
                              {studentRecord.class || '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top">
                              <div className="text-slate-900">{sess || '—'}</div>
                              <div className="text-xs text-slate-500">{termLbl || '—'}</div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top tabular-nums text-slate-700">
                              {subjN} subject{subjN === 1 ? '' : 's'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top font-medium tabular-nums text-slate-900">
                              {result ? `${percentage}%` : <span className="font-normal text-slate-400">—</span>}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top">
                              {result ? (
                                <GradeBadge grade={grade} />
                              ) : (
                                <span className="text-sm text-slate-400">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top">
                              {result ? (
                                <span
                                  className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                                    result.commentStatus
                                      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/60'
                                      : 'bg-rose-50 text-rose-800 ring-rose-200/60'
                                  }`}
                                >
                                  {result.commentStatus ? 'Added' : 'Missing'}
                                </span>
                              ) : (
                                <span className="text-sm text-slate-400">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-500">
                              {result?.createdAt
                                ? (() => {
                                    try {
                                      const d = new Date(result.createdAt);
                                      return Number.isNaN(d.getTime()) ? String(result.createdAt) : d.toLocaleDateString();
                                    } catch {
                                      return String(result.createdAt);
                                    }
                                  })()
                                : '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right align-top">
                              <div className="inline-flex items-center justify-end gap-0.5">
                                {result ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewResult(result);
                                      }}
                                      className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50"
                                      aria-label="View result"
                                    >
                                      <EyeIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCommentModal(result);
                                      }}
                                      className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                                      aria-label="Comment"
                                    >
                                      <MessageCircleIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditClick(result);
                                      }}
                                      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                                      aria-label="Edit result"
                                    >
                                      <PencilIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDeleteConfirm(result);
                                      }}
                                      disabled={loadingDeleteId === (result.id || result._id)}
                                      className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                      aria-label="Delete result"
                                    >
                                      {loadingDeleteId === (result.id || result._id) ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <TrashIcon className="h-4 w-4" />
                                      )}
                                    </button>
                                  </>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openAddModalForRosterStudent(student);
                                    }}
                                  >
                                    Add result
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      const result = row.result;
                      const studentRecord = resolveStudentForResult(result);
                      const { percentage, grade } = calculateOverallGrade(result.subjects);
                      const rid = result.id || result._id || row.key;
                      const subjN = Array.isArray(result.subjects) ? result.subjects.length : 0;
                      return (
                        <tr
                          key={row.key}
                          className="cursor-pointer transition hover:bg-slate-50/90"
                          onClick={() => handleEditClick(result)}
                        >
                          <td className="max-w-[14rem] px-4 py-3 align-top">
                            <div className="truncate font-medium text-slate-900">{studentRecord.name}</div>
                            <div className="truncate text-xs text-slate-500">{studentRecord.subTitle}</div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top text-slate-700">
                            {studentRecord.class || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top">
                            <div className="text-slate-900">{result.session || '—'}</div>
                            <div className="text-xs text-slate-500">{result.term || '—'}</div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top tabular-nums text-slate-700">
                            {subjN} subject{subjN === 1 ? '' : 's'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top font-medium tabular-nums text-slate-900">
                            {percentage}%
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top">
                            <GradeBadge grade={grade} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top">
                            <span
                              className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                                result.commentStatus
                                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/60'
                                  : 'bg-rose-50 text-rose-800 ring-rose-200/60'
                              }`}
                            >
                              {result.commentStatus ? 'Added' : 'Missing'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-500">
                            {result.createdAt
                              ? (() => {
                                  try {
                                    const d = new Date(result.createdAt);
                                    return Number.isNaN(d.getTime()) ? String(result.createdAt) : d.toLocaleDateString();
                                  } catch {
                                    return String(result.createdAt);
                                  }
                                })()
                              : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right align-top">
                            <div className="inline-flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewResult(result);
                                }}
                                className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50"
                                aria-label="View result"
                              >
                                <EyeIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCommentModal(result);
                                }}
                                className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                                aria-label="Comment"
                              >
                                <MessageCircleIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClick(result);
                                }}
                                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                                aria-label="Edit result"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteConfirm(result);
                                }}
                                disabled={loadingDeleteId === (result.id || result._id)}
                                className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                aria-label="Delete result"
                              >
                                {loadingDeleteId === (result.id || result._id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <TrashIcon className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 lg:hidden">
                {tableRows.map((row) => {
                  if (row.kind === 'roster') {
                    const { student, result } = row;
                    const studentRecord = resolveStudentForResult(
                      result || { studentUid: student.uid, studentId: student.id, subjects: [] }
                    );
                    const subjN = result && Array.isArray(result.subjects) ? result.subjects.length : 0;
                    const { percentage, grade } = result
                      ? calculateOverallGrade(result.subjects)
                      : { percentage: 0, grade: 'F' };
                    const sess = result?.session || filterSession;
                    const termLbl = result?.term || filterTerm;
                    return (
                      <div
                        key={row.key}
                        className="cursor-pointer px-4 py-4 transition hover:bg-slate-50/90"
                        onClick={() =>
                          result ? handleEditClick(result) : openAddModalForRosterStudent(student)
                        }
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (result) handleEditClick(result);
                            else openAddModalForRosterStudent(student);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{studentRecord.name}</p>
                            <p className="truncate text-xs text-slate-500">{studentRecord.subTitle}</p>
                            <p className="mt-1 text-xs text-slate-600">
                              {studentRecord.class ? `${studentRecord.class} · ` : ''}
                              {sess} · {termLbl}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {result ? (
                              <>
                                <p className="text-lg font-semibold tabular-nums text-slate-900">{percentage}%</p>
                                <div className="mt-1 flex justify-end gap-1">
                                  <GradeBadge grade={grade} />
                                </div>
                              </>
                            ) : (
                              <p className="text-sm font-medium text-slate-400">No result yet</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                            {subjN} subject{subjN === 1 ? '' : 's'}
                          </span>
                          {result ? (
                            <span
                              className={`rounded-md px-2 py-0.5 font-semibold ${
                                result.commentStatus ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                              }`}
                            >
                              Comment {result.commentStatus ? 'ok' : 'needed'}
                            </span>
                          ) : (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                              Pending entry
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {result ? (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewResult(result);
                                }}
                              >
                                View
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCommentModal(result);
                                }}
                              >
                                Comment
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteConfirm(result);
                                }}
                                disabled={loadingDeleteId === (result.id || result._id)}
                              >
                                Delete
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddModalForRosterStudent(student);
                              }}
                            >
                              Add result
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  const result = row.result;
                  const studentRecord = resolveStudentForResult(result);
                  const { percentage, grade } = calculateOverallGrade(result.subjects);
                  const rid = result.id || result._id || row.key;
                  const subjN = Array.isArray(result.subjects) ? result.subjects.length : 0;
                  return (
                    <div
                      key={rid}
                      className="cursor-pointer px-4 py-4 transition hover:bg-slate-50/90"
                      onClick={() => handleEditClick(result)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleEditClick(result);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{studentRecord.name}</p>
                          <p className="truncate text-xs text-slate-500">{studentRecord.subTitle}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {studentRecord.class ? `${studentRecord.class} · ` : ''}
                            {result.session} · {result.term}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-semibold tabular-nums text-slate-900">{percentage}%</p>
                          <div className="mt-1 flex justify-end gap-1">
                            <GradeBadge grade={grade} />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                          {subjN} subject{subjN === 1 ? '' : 's'}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 font-semibold ${
                            result.commentStatus ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                          }`}
                        >
                          Comment {result.commentStatus ? 'ok' : 'needed'}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewResult(result);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCommentModal(result);
                          }}
                        >
                          Comment
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteConfirm(result);
                          }}
                          disabled={loadingDeleteId === (result.id || result._id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      <Modal open={Boolean(deleteTarget)} title="Delete result?" onClose={() => setDeleteTarget(null)} className="sm:max-w-md">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              This will permanently remove this result record. This action cannot be undone.
            </p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
              {deleteTarget.label}
            </p>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-rose-600 hover:bg-rose-700"
                onClick={confirmDeleteResult}
                disabled={loadingDeleteId === deleteTarget.id}
              >
                {loadingDeleteId === deleteTarget.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showAddModal} title="Add or update result" onClose={() => { setShowAddModal(false); resetForm(); }} className="sm:max-w-4xl">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {existingResultIdForAdd && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-100">
                A result already exists for this student, year, and term. Saving will update it.
              </p>
            )}
            <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-3">
              <div>
                <label htmlFor="session" className="block text-sm font-medium text-gray-700">Academic year</label>
                <select id="session" name="session" required value={formData.session} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                  <option value="">Select year</option>
                  <option value="2024/2025">2024/2025</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                  <option value="2027/2028">2027/2028</option>
                  <option value="2028/2029">2028/2029</option>
                </select>
              </div>
              <div>
                <label htmlFor="term" className="block text-sm font-medium text-gray-700">Term</label>
                <select id="term" name="term" required value={formData.term} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                  <option value="">Select term</option>
                  <option value="First Term">1st Term</option>
                  <option value="Second Term">2nd Term</option>
                  <option value="Third Term">3rd Term</option>
                </select>
              </div>
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
                  <option value="">
                    {loadingStudents
                      ? 'Loading students...'
                      : (availableStudents.length === 0 ? 'No students in your class' : 'Select a student')}
                  </option>
                  {availableStudents.map(student => (
                    <option key={student.id} value={String(student.id)}>
                      {student.name} ({student.uid || student.id})
                    </option>
                  ))}
                </select>
                {!loadingStudents && isTeacher && availableStudents.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500">No students match your assigned class. Ask an administrator to verify your class assignment.</p>
                )}
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
              <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="px-3 py-2 rounded border bg-white text-sm">Cancel</button>
              <button type="submit" disabled={loadingSubmit} className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-60">
                {loadingSubmit ? 'Saving...' : (existingResultIdForAdd ? 'Update result' : 'Save result')}
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
                  {(() => {
                    const vr = selectedResult ? resolveStudentForResult(selectedResult) : null;
                    const name = selectedStudent?.name || vr?.name || 'Student';
                    const sub = selectedStudent?.uid || (vr?.subTitle !== 'Loading…' && vr?.subTitle ? vr.subTitle : vr?.uid) || formData.studentId;
                    return (
                      <>
                        {name}
                        <span className="text-gray-500 text-xs ml-1">({sub})</span>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div>
                <label htmlFor="session_edit" className="block text-sm font-medium text-gray-700">Session</label>
                <select id="session_edit" name="session" required value={formData.session} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                  <option value="">Select session</option>
                  <option value="2024/2025">2024/2025</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                  <option value="2027/2028">2027/2028</option>
                  <option value="2028/2029">2028/2029</option>
                </select>
              </div>
              <div>
                <label htmlFor="term_edit" className="block text-sm font-medium text-gray-700">Term</label>
                <select id="term_edit" name="term" required value={formData.term} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                  <option value="">Select term</option>
                  <option value="First Term">1st Term</option>
                  <option value="Second Term">2nd Term</option>
                  <option value="Third Term">3rd Term</option>
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
        {selectedResult && (() => {
          const vr = resolveStudentForResult(selectedResult);
          return (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Student Name</h4>
                <p className="text-sm text-gray-900 truncate whitespace-nowrap">{vr.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Student No.</h4>
                <p className="text-sm text-gray-900 truncate whitespace-nowrap">{vr.subTitle !== 'Loading…' ? vr.subTitle : '—'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Class</h4>
                <p className="text-sm text-gray-900 truncate whitespace-nowrap">{vr.class || '—'}</p>
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
          );
        })()}
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
                    Student: {resolveStudentForResult(selectedResult).name} | {selectedResult.session} - {selectedResult.term}
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