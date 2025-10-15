// src/pages/Admin/StudentManagement.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, DownloadCloud } from 'lucide-react';
import { ArrowUpCircle } from "lucide-react";
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const StudentManagement = () => {
  // hydrate from last-session snapshot for instant UI
  const _cachedStudentsSnapshot = (() => {
    try { return JSON.parse(sessionStorage.getItem('studentsSnapshot') || 'null'); } catch { return null; }
  })();
  const [students, setStudents] = useState(() => (_cachedStudentsSnapshot?.students ?? []));
  const [isLoading, setIsLoading] = useState(true);
  // pagination / progressive load state
  const [nextPageToken, setNextPageToken] = useState(() => (_cachedStudentsSnapshot?.nextPageToken ?? null));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFetchingPage, setIsFetchingPage] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollDebounceRef = useRef(null);
  const PAGE_LIMIT = 10; // initial page size
  const cacheRef = useRef(Boolean(_cachedStudentsSnapshot));

  // persist snapshot helper
  const persistSnapshot = (arr, token = null) => {
    try {
      const snap = { students: arr, nextPageToken: token ?? nextPageToken };
      sessionStorage.setItem('studentsSnapshot', JSON.stringify(snap));
    } catch (e) {
      // ignore storage errors
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editableStudent, setEditableStudent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  const emptyForm = {
    name: '',
    linNumber: '',
    dob: '',
    gender: 'Male',
    class: '',
    stateOfOrigin: '',
    lga: '',
    address: '',
    guardians: [{ name: '', phone: '', email: '', relationship: 'Father' }],
    picture: '',
    bloodGroup: '',
    allergies: '',
    medicalConditions: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    subjects: [],
    religion: ''
  };
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (showAddModal || showViewModal) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev || ''; };
  }, [showAddModal, showViewModal]);

  const normalizeStudent = raw => {
    if (!raw) return raw;
    let guardians = [];
    if (Array.isArray(raw.guardians) && raw.guardians.length) guardians = raw.guardians;
    else if (raw.guardian && typeof raw.guardian === 'object') guardians = [raw.guardian];
    let genderStr = raw.gender;
    if (typeof raw.gender === 'boolean') genderStr = raw.gender ? 'Male' : 'Female';
    else if (!raw.gender) genderStr = 'Male';
    let picture = '';
    if (!raw.picture) picture = '';
    else if (typeof raw.picture === 'string') picture = raw.picture;
    else if (typeof raw.picture === 'object' && raw.picture.mime && raw.picture.data) {
      picture = `data:${raw.picture.mime};base64,${raw.picture.data}`;
    }
    return {
      ...raw,
      guardians,
      picture,
      uid: raw.uid || raw.id || raw.studentId || '',
      gender: genderStr,
      religion: raw.religion || ''
    };
  };

  const normalizePictureForSubmission = (p) => {
    if (!p) return "";
    if (typeof p === "string") return p;
    if (typeof p === "object" && p.mime && p.data) return `data:${p.mime};base64,${p.data}`;
    if (typeof p === "object" && (p.url || p.src)) return p.url || p.src || "";
    return "";
  };

  // progressive page loader using backend ?limit= & ?startAfter=
  useEffect(() => {
     let mounted = true;
     const ac = new AbortController();
     const AUTO_LOAD = true; // automatically fetch pages until server signals no more
     const PAUSE_MS = 150; // pause between pages to keep UI responsive

    // merge helper: append only new students (dedupe by id/uid)
    const mergeAndMap = (prev, rawList) => {
      const mapped = rawList.map(normalizeStudent);
      const existing = new Set(prev.map(s => (s.id || s.uid)));
      const toAdd = mapped.filter(m => !(existing.has(m.id || m.uid)));
      return [...prev, ...toAdd];
    };

    // fetch a single page and return token
    async function fetchPageOnce(startAfter = null, append = false) {
      if (!mounted) return { token: null, list: [] };
      setIsFetchingPage(true);
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_LIMIT));
        if (startAfter) params.set('startAfter', String(startAfter));
        const url = `${API_BASE}/api/students?${params.toString()}`;
        console.debug('[Students] fetch page', url);
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t || `Server ${res.status}`);
        }
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);

        // append vs replace; if we had a cache on load, prefer append to avoid replacing cached entries
        setStudents(prev => {
          if (append || cacheRef.current) {
            const merged = mergeAndMap(prev, list);
            // persist the merged snapshot
            persistSnapshot(merged, json?.nextPageToken ?? null);
            return merged;
          }
          const mapped = list.map(normalizeStudent);
          persistSnapshot(mapped, json?.nextPageToken ?? null);
          return mapped;
        });

        const token = json?.nextPageToken ?? null;
        setNextPageToken(token);
        setHasMore(Boolean(token));
        // mark that cache has been reconciled
        cacheRef.current = false;
        return { token, list };
      } catch (err) {
        if (err.name === 'AbortError') {
          console.debug('[Students] fetch aborted');
        } else {
          console.error('[Students] fetch page error', err);
          toast.error('Could not load students from server.');
        }
        return { token: null, list: [] };
      } finally {
        if (!ac.signal.aborted) {
          setIsFetchingPage(false);
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    }

    // sequentially auto-load pages (yields between pages)
    async function autoLoadAllPages() {
      try {
        // first page (replace)
        const first = await fetchPageOnce(null, false);
        if (!mounted) return;

        // show table as soon as first page is present
        setIsLoading(false);

        if (!AUTO_LOAD) return;

        // continue fetching while server provides a nextPageToken
        let token = first.token;
        while (mounted && token) {
          // yield to browser: use requestIdleCallback when available
          await new Promise((resolve) => {
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
              window.requestIdleCallback(resolve, { timeout: 200 });
            } else {
              setTimeout(resolve, PAUSE_MS);
            }
          });

          const nxt = await fetchPageOnce(token, true);
          if (!mounted) break;
          token = nxt.token;
        }
      } catch (err) {
        console.error('[Students] autoLoadAllPages error', err);
      }
    }

    // If we have a cached snapshot, do not replace it — start auto-loading pages and append
    if (cacheRef.current && _cachedStudentsSnapshot) {
      // UI already hydrated from cache; begin auto-load from cached token
      setIsLoading(false);
      // if cache provided a nextPageToken, continue from it; otherwise start from beginning to reconcile
      const startToken = _cachedStudentsSnapshot.nextPageToken ?? null;
      // auto-load will start by fetching first page (which will append due to cacheRef)
      autoLoadAllPages();
    } else {
      fetchPageOnce(null, false).then(() => {
        // start auto-load in background (non-blocking)
        autoLoadAllPages();
      });
    }

    return () => {
      mounted = false;
      ac.abort();
    };
  }, []);

  // fetch next page (used by scroll or button)
  const loadMore = async () => {
    if (!hasMore || isFetchingPage) return;
    setIsFetchingPage(true);
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_LIMIT));
      if (nextPageToken) params.set('startAfter', String(nextPageToken));
      const url = `${API_BASE}/api/students?${params.toString()}`;
      console.debug('[Students] loadMore', url);
      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `Server ${res.status}`);
      }
      const json = await res.json().catch(() => null);
      const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
      setStudents(prev => [...prev, ...list.map(normalizeStudent)]);
      const token = json?.nextPageToken ?? null;
      setNextPageToken(token);
      setHasMore(Boolean(token));
    } catch (err) {
      console.error('[Students] loadMore error', err);
      toast.error('Failed to load more students.');
    } finally {
      setIsFetchingPage(false);
      setIsLoadingMore(false);
    }
  };

  // infinite scroll near-bottom with debounce (still triggers manual loadMore if needed)
  useEffect(() => {
    const onScroll = () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
      scrollDebounceRef.current = setTimeout(() => {
        const nearBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 350);
        if (nearBottom && hasMore && !isFetchingPage) loadMore();
      }, 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    };
  }, [hasMore, isFetchingPage, nextPageToken]);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Select an image file.'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => setFormData(prev => ({ ...prev, picture: reader.result }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const handlePictureClick = () => fileInputRef.current?.click();

  const handleSubmit = async e => {
    e.preventDefault();
    setIsAdding(true);
    const payload = {
      name: formData.name,
      linNumber: formData.linNumber,
      dob: formData.dob,
      gender: typeof formData.gender === 'boolean' ? formData.gender : (String(formData.gender).toLowerCase() === 'male'),
      class: formData.class,
      stateOfOrigin: formData.stateOfOrigin,
      lga: formData.lga,
      address: formData.address,
      guardians: formData.guardians,
      picture: normalizePictureForSubmission(formData.picture),
      bloodGroup: formData.bloodGroup,
      allergies: formData.allergies,
      medicalConditions: formData.medicalConditions,
      emergencyContactName: formData.emergencyContactName,
      emergencyContactPhone: formData.emergencyContactPhone,
      subjects: formData.subjects || [],
      religion: formData.religion || ''
    };
    try {
      const res = await fetch(`${API_BASE}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `Server ${res.status}`);
      }
      const created = await res.json();
      const studentRecord = created?.data || created;
      setStudents(prev => {
        const mapped = normalizeStudent(studentRecord);
        const existing = new Set(prev.map(s => s.id || s.uid));
        const next = existing.has(mapped.id || mapped.uid) ? prev : [...prev, mapped];
        persistSnapshot(next, nextPageToken);
        return next;
      });
      setFormData(emptyForm);
      setShowAddModal(false);
      toast.success('Student added.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add student.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleViewStudent = student => {
    setSelectedStudent(student);
    setEditableStudent({
      ...student,
      gender: typeof student.gender === 'boolean' ? (student.gender ? 'Male' : 'Female') : (student.gender || 'Male'),
      guardians: student.guardians || (student.guardian ? [student.guardian] : [{ name: '', phone: '', email: '', relationship: 'Father' }])
    });
    setIsEditing(false);
    setShowViewModal(true);
  };

  const handleSave = async () => {
    if (!editableStudent) return;
    setIsSaving(true);
    try {
      const payload = { ...editableStudent };
      payload.guardians = payload.guardians || (payload.guardian ? [payload.guardian] : []);
      if (!(payload.gender === true || payload.gender === false)) {
        payload.gender = String(payload.gender).toLowerCase() === 'male';
      }
      payload.picture = normalizePictureForSubmission(payload.picture);
      const method = payload.id ? 'PUT' : 'POST';
      const url = payload.id ? `${API_BASE}/api/students/${payload.id}` : `${API_BASE}/api/students`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `Server ${res.status}`);
      }
      const saved = await res.json();
      const savedRecord = saved?.data || saved;
      if (method === 'PUT') {
        setStudents(prev => {
          const updated = prev.map(s => (s.id === savedRecord.id ? normalizeStudent(savedRecord) : s));
          persistSnapshot(updated, nextPageToken);
          return updated;
        });
      } else {
        setStudents(prev => {
          const mapped = normalizeStudent(savedRecord);
          const next = [(mapped), ...prev.filter(s => (s.id || s.uid) !== (mapped.id || mapped.uid))];
          persistSnapshot(next, nextPageToken);
          return next;
        });
      }
      setIsEditing(false);
      setShowViewModal(false);
      setSelectedStudent(null);
      setEditableStudent(null);
      toast.success('Saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStudent = async idOrUid => {
    if (!confirm('Delete this student?')) return;
    const student = students.find(s => s.id === idOrUid || s.uid === idOrUid);
    const idToUse = student?.id || idOrUid;
    try {
      const res = await fetch(`${API_BASE}/api/students/${idToUse}`, { method: 'DELETE' });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `Delete failed ${res.status}`);
      }
      setStudents(prev => {
        const next = prev.filter(s => s.id !== idToUse && s.uid !== idToUse);
        persistSnapshot(next, nextPageToken);
        return next;
      });
      toast.success('Deleted');
    } catch (err) {
      console.error(err);
      toast.error('Delete failed');
    }
  };

  const generateStudentId = () => {
    const last = students.length ? students[students.length - 1] : null;
    const lastNum = last && last.uid ? parseInt((String(last.uid).split('-')[2] || '0'), 10) || (last.id || 0) : 0;
    const newId = lastNum + 1;
    return `YMS-${String(newId).padStart(3, '0')}`;
  };

  const handleDownloadPdf = () => {
    if (!students || students.length === 0) {
      toast.error('No students to export');
      return;
    }
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'A4' });
      doc.setFontSize(16);
      doc.text('Students', 40, 40);
      const head = [['Full name', 'Class', 'LIN Number', 'UID']];
      const body = students.map(s => [s.name || '', s.class || '', s.linNumber || '', s.uid || s.id || '']);
      const tableOptions = { startY: 70, head, body, theme: 'striped', styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [37, 99, 235] } };
      if (typeof doc.autoTable === 'function') doc.autoTable(tableOptions);
      else if (typeof autoTable === 'function') autoTable(doc, tableOptions);
      else throw new Error('autoTable not available');
      doc.save('students.pdf');
    } catch (err) {
      console.error('Export PDF failed', err);
      toast.error('Failed to generate PDF');
    }
  };

  // Filtering + alphabetical sort
  const q = (searchQuery || '').trim().toLowerCase();

  // keep students sorted alphabetically by name for all displays
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const na = (a?.name || '').toString().toLowerCase();
      const nb = (b?.name || '').toString().toLowerCase();
      return na.localeCompare(nb);
    });
  }, [students]);

  const filteredStudents = q ? sortedStudents.filter(s => {
    const fields = [
      s.name, s.uid, s.linNumber, s.class,
      (s.guardians && s.guardians[0] && s.guardians[0].name) || '',
      (s.guardians && s.guardians[0] && s.guardians[0].phone) || '',
      (s.guardians && s.guardians[0] && s.guardians[0].email) || ''
    ].map(v => (v || '').toString().toLowerCase());
    return fields.some(f => f.includes(q));
  }) : sortedStudents;

  // Pagination state and helpers
  const [currentPage, setCurrentPage] = useState(1);
  // fixed rows per page (10)
  const [pageSize] = useState(10);

  // reset page when filters or data change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, students]);

  const totalItems = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = Math.min(totalItems, (currentPage - 1) * pageSize);
  const endIndex = Math.min(totalItems, startIndex + pageSize);
  const displayedStudents = filteredStudents.slice(startIndex, endIndex);

  // Helper for editing guardian fields in editableStudent
  const editGuardianChange = (idx, field, value) => {
    setEditableStudent(prev => {
      const guardians = Array.isArray(prev.guardians) ? [...prev.guardians] : [];
      guardians[idx] = { ...guardians[idx], [field]: value };
      return { ...prev, guardians };
    });
  };

  // Helper for removing a guardian in editableStudent
  const removeEditableGuardian = (idx) => {
    setEditableStudent(prev => {
      const guardians = Array.isArray(prev.guardians) ? [...prev.guardians] : [];
      guardians.splice(idx, 1);
      return { ...prev, guardians };
    });
  };

  // Helper for adding a guardian in editableStudent
  // (removed unused addEditableGuardian function)

  // Add this handler near other handlers (e.g. after handleDownloadPdf)
  const handlePromoteAll = async () => {
    if (!confirm('Promote all students to the next class?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/students/promote`, { method: 'POST' });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `Server ${res.status}`);
      }
      const payload = await res.json();
      const list = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      setStudents(list.map(normalizeStudent));
      toast.success('Promotion completed');
    } catch (err) {
      console.error(err);
      toast.error('Promotion failed');
    }
  };

  return (
    <DashboardLayout title="Student Management">
      <div className="flex justify-between items-center mb-2" id='mainbash'>
        <h1 className="text-lg font-semibold text-gray-900">Students</h1>
        <div className="flex items-center space-x-3">
          <button type="button" onClick={() => { setFormData(emptyForm); setShowAddModal(true); }} className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
            <PlusIcon className="h-5 w-5 mr-2" /> Add Student
          </button>

          <button type="button" onClick={handleDownloadPdf} disabled={students.length === 0} className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-60">
            <DownloadCloud className="h-5 w-5 mr-2" /> Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-5 mb-6">
  <div className="w-full flex items-center justify-between gap-3">
    {/* Search box */}
    <div className="relative flex-1 max-w-sm">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg
          className="h-5 w-5 text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 
              3.476l4.817 4.817a1 1 0 01-1.414 
              1.414l-4.816-4.816A6 6 0 012 8z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <input
        id="search"
        name="search"
        type="search"
        placeholder="Search by name, ID or email"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 text-sm"
      />
    </div>

    {/* Promote All */}
   <div className="flex items-center gap-2 flex-wrap">
     <button
       type="button"
       onClick={handlePromoteAll}
       disabled={students.length === 0}
       className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60"
     >
       <ArrowUpCircle className="w-4 h-4" />
       Promote All
     </button>

     {/* <button
       type="button"
       onClick={loadMore}
       disabled={!hasMore || isFetchingPage}
       aria-disabled={!hasMore || isFetchingPage}
       className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md shadow-sm text-white 
         ${isFetchingPage || isLoadingMore ? 'bg-gray-400 cursor-wait' : (hasMore ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-200 text-gray-600')} `}
     >
       <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 3v2a5 5 0 015 5h2a7 7 0 00-7-7zM4.22 4.22l1.42 1.42A7 7 0 0010 17v-2a5 5 0 01-5-5H3a7 7 0 001.22-5.78zM10 13a3 3 0 100-6 3 3 0 000 6z"/></svg>
       {isLoadingMore || isFetchingPage ? 'Loading…' : (hasMore ? 'Load more' : 'All loaded')}
     </button> */}
   </div>
  </div>

      <div className="flex flex-col mb-10"> {/* increased bottom margin so fixed pagination doesn't never cover content */}
        {isLoading ? (
          <div className="py-12 flex items-center justify-center"><div className="text-gray-600 font-medium">Loading…</div></div>
        ) : (
          <div className="-my-5 overflow-x-auto pb-1">
            <div className="py-2">
              {/* table container - wider and centered */}
              <div className="w-full mt-12 mx-auto px-4 sm:px-6 lg:px-8">


                {/* Mobile: stacked cards */}
                <div className="space-y-4 md:hidden">
                  {displayedStudents.length === 0 ? (
                    <div className="bg-white shadow rounded-lg p-4 text-center text-sm text-gray-500">
                      {students.length === 0 ? 'No students found.' : 'No students match your search.'}
                    </div>
                  ) : displayedStudents.map((student, idx) => (
                    <div key={student.id || student.uid || idx} className="bg-white shadow rounded-lg p-4 flex items-start justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <img
                          className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                          src={
                            student.picture ||
                            `https://source.unsplash.com/random/300x300?sig=${encodeURIComponent(student.uid || student.id || idx)}`
                          }
                          alt=""
                        />
                       <div className="min-w-0">
                         <div className="text-sm font-semibold text-gray-900 truncate">{student.name}</div>
                         <div className="text-xs text-gray-500 truncate">{student.uid || generateStudentId()}</div>
                         <div className="text-xs text-gray-500 truncate">{student.class} · {student.linNumber || '—'}</div>
                       </div>
                     </div>
                     <div className="flex items-center ml-3 space-x-2">
                       <button onClick={() => handleViewStudent(student)} className="p-2 text-blue-600 hover:text-blue-900"><EyeIcon className="h-5 w-5" /></button>
                       <button onClick={() => { handleViewStudent(student); setIsEditing(true); }} className="p-2 text-indigo-600 hover:text-indigo-900"><PencilIcon className="h-5 w-5" /></button>
                       <button onClick={() => handleDeleteStudent(student.id || student.uid)} className="p-2 text-red-600 hover:text-red-900"><TrashIcon className="h-5 w-5" /></button>
                     </div>
                   </div>
                  ))}
                </div>

                {/* Desktop / Tablet: table */}
                <div className="hidden md:block">
                  <div className="shadow sm:rounded-lg">
                    <div className="w-full overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 table-fixed">
                        {/* stable column sizing helps responsiveness */}
                        <colgroup>
                          <col className="w-2/5" />
                          <col className="w-1/5" />
                          <col className="w-1/5" />
                          <col className="w-1/5" />
                          <col style={{width: '1%'}} />
                        </colgroup>
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">Student</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">UID</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">Class</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">LIN Number</th>
                            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {displayedStudents.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                                {students.length === 0 ? 'No students found.' : 'No students match your search.'}
                              </td>
                            </tr>
                          ) : displayedStudents.map((student, idx) => (
                            <tr key={student.id || student.uid || idx}>
                              <td className="px-6 py-4 align-top">
                                <div className="flex items-start">
                                  <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden">
                                    <img
                                      className="h-full w-full object-cover"
                                      src={student.picture || `https://source.unsplash.com/random/300x300?sig=${encodeURIComponent(student.uid || student.id || idx)}`}
                                      alt=""/>
                                  </div>
                                  <div className="ml-4 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{student.name}</div>
                                    <div className="text-xs text-gray-500 truncate">{student.dob} · {student.gender} · {student.age ? `${student.age} yrs` : '—'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 align-top">
                                <div className="text-sm text-gray-900 max-w-[140px] truncate">{student.uid || generateStudentId()}</div>
                              </td>
                              <td className="px-6 py-4 align-top">
                                <div className="text-sm text-gray-500 max-w-[140px] truncate">{student.class}</div>
                              </td>
                              <td className="px-6 py-4 align-top">
                                <div className="text-sm text-gray-500 max-w-[140px] truncate">{student.linNumber || '—'}</div>
                              </td>
                              <td className="px-6 py-4 text-right align-top whitespace-nowrap">
                                <button onClick={() => handleViewStudent(student)} className="text-blue-600 hover:text-blue-900 mr-3"><EyeIcon className="h-5 w-5" /></button>
                                <button onClick={() => { handleViewStudent(student); setIsEditing(true); }} className="text-indigo-600 hover:text-indigo-900 mr-3"><PencilIcon className="h-5 w-5" /></button>
                                <button onClick={() => handleDeleteStudent(student.id || student.uid)} className="text-red-600 hover:text-red-900"><TrashIcon className="h-5 w-5" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
         )}
       </div>
      </div>

      {/* Fixed Pagination at bottom (always shows 10 rows per page)
          Adjusted to avoid overlapping with a left sidebar.
          On medium/large screens the left offset matches common sidebar widths (md:left-64, lg:left-72).
          Also constrained with a centered max width so it sits inside the main content area. */}
      <div className="fixed bottom-4 left-4 right-4 md:left-64 lg:left-72 z-30 pointer-events-none mt-10">
        <div className="mx-auto max-w-7xl px-6 pointer-events-auto">
          <div className="bg-white shadow-md rounded-lg px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-700 mb-2 sm:mb-0">
              Showing {totalItems === 0 ? 0 : startIndex + 1} to {startIndex + displayedStudents.length}
              
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Prev
              </button>

              <div className="px-3 text-sm font-medium text-gray-700">Page {currentPage} / {totalPages}</div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>

              {/* Load more button for progressive backend pagination */}
              
            </div>
          </div>
        </div>
      </div>

      {/* Add Modal - full detailed add student form */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowAddModal(false)} />
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            <div
              className="relative z-50 inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-3xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 py-4 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    {/* Avatar + basic name */}
                    <div className="md:col-span-1 flex items-start space-x-3">
                      <div onClick={handlePictureClick} className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center cursor-pointer overflow-hidden">
                        {formData.picture ? (
                          <img src={formData.picture} alt="profile" className="h-full w-full object-cover" />
                        ) : (
                          <PlusIcon className="h-6 w-6 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700">Full Name</label>
                        <input
                          required
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                        <label className="block text-xs font-medium text-gray-700 mt-3">LIN Number</label>
                        <input
                          name="linNumber"
                          value={formData.linNumber}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                      </div>
                    </div>

                    {/* Class, DOB, gender */}
                    <div className="md:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Class</label>
                        <select
                          name="class"
                          required
                          value={formData.class}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                        >
                          <option value="">Select</option>
                          <option>Creche</option>
                          <option>Nursery 1</option>
                          <option>Nursery 2</option>
                          <option>KG 1</option>
                          <option>KG 2</option>
                          <option>Primary 1</option>
                          <option>Primary 2</option>
                          <option>Primary 3</option>
                          <option>Primary 4</option>
                          <option>Primary 6</option>
                          <option>JSS1</option>
                          <option>JSS2</option>
                          <option>Graduate</option>
                          <option>Left</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700">Date of Birth</label>
                        <input
                          type="date"
                          name="dob"
                          value={formData.dob}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700">Gender</label>
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                        >
                        <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700">Religion</label>
                        <select
                          name="religion"
                          value={formData.religion}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                        >
                          <option value="">Select</option>
                          <option value="Christian">Christian</option>
                          <option value="Muslim">Muslim</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Address / state / lga */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">State of Origin</label>
                      <input
                        name="stateOfOrigin"
                        value={formData.stateOfOrigin}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">LGA</label>
                      <input
                        name="lga"
                        value={formData.lga}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Address</label>
                      <input
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                      />
                    </div>
                  </div>

                  {/* Guardians */}
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Guardians</h4>
                    <div className="space-y-2">
                      {(formData.guardians || []).map((g, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                          <input
                            placeholder="Name"
                            value={g.name || ''}
                            onChange={e => setFormData(prev => {
                              const guardians = Array.isArray(prev.guardians) ? [...prev.guardians] : [];
                              guardians[i] = { ...guardians[i], name: e.target.value };
                              return { ...prev, guardians };
                            })}
                            className="border rounded px-2 py-1 text-sm"
                          />
                          <input
                            placeholder="Phone"
                            value={g.phone || ''}
                            onChange={e => setFormData(prev => {
                              const guardians = Array.isArray(prev.guardians) ? [...prev.guardians] : [];
                              guardians[i] = { ...guardians[i], phone: e.target.value };
                              return { ...prev, guardians };
                            })}
                            className="border rounded px-2 py-1 text-sm"
                          />
                          <input
                            placeholder="Email"
                            value={g.email || ''}
                            onChange={e => setFormData(prev => {
                              const guardians = Array.isArray(prev.guardians) ? [...prev.guardians] : [];
                              guardians[i] = { ...guardians[i], email: e.target.value };
                              return { ...prev, guardians };
                            })}
                            className="border rounded px-2 py-1 text-sm"
                          />
                          <div className="flex items-center space-x-2">
                            <select
                              value={g.relationship || 'Father'}
                              onChange={e => setFormData(prev => {
                                const guardians = Array.isArray(prev.guardians) ? [...prev.guardians] : [];
                                guardians[i] = { ...guardians[i], relationship: e.target.value };
                                return { ...prev, guardians };
                              })}
                              className="border rounded px-2 py-1 text-sm"
                            >
                              <option>Father</option>
                              <option>Mother</option>
                              <option>Guardian</option>
                              <option>Other</option>
                            </select>
                            { (formData.guardians || []).length > 1 && (
                              <button type="button" onClick={() => setFormData(prev => {
                                const guardians = Array.isArray(prev.guardians) ? [...prev.guardians] : [];
                                guardians.splice(i,1);
                                return { ...prev, guardians };
                              })} className="text-xs text-red-600 hover:underline">Remove</button>
                            )}
                          </div>
                        </div>
                      ))}
                      {(formData.guardians || []).length < 3 && (
                        <div>
                          <button type="button" onClick={() => setFormData(prev => ({ ...prev, guardians: [...(prev.guardians || []), { name: '', phone: '', email: '', relationship: 'Father' }] }))} className="inline-flex items-center px-3 py-1 mt-2 rounded-md bg-blue-600 text-white text-sm">Add guardian</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Medical / Emergency */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Blood Group</label>
                      <input name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Allergies</label>
                      <input name="allergies" value={formData.allergies} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Medical Conditions</label>
                      <input name="medicalConditions" value={formData.medicalConditions} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-xs text-gray-600">Emergency Contact Name</label>
                    <input name="emergencyContactName" value={formData.emergencyContactName} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm" />
                    <label className="text-xs text-gray-600 mt-2">Emergency Contact Phone</label>
                    <input name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm" />
                  </div>

                  {/* Subjects (simple comma-separated) */}
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" disabled={isAdding} className={`w-full inline-flex items-center justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm ${isAdding ? 'opacity-80 cursor-not-allowed' : ''}`}>
                    {isAdding ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle></svg>
                        Adding...
                      </>
                    ) : 'Add Student'}
                  </button>
                  <button type="button" onClick={() => setShowAddModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 bg-white text-base text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View / Edit Modal */}
      {showViewModal && editableStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => { setShowViewModal(false); setIsEditing(false); setEditableStudent(null); }} />
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            <div className="relative z-50 inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-3xl w-full" onClick={e => e.stopPropagation()}>
              <input ref={editFileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setEditableStudent(prev => ({ ...prev, picture: reader.result }));
                reader.readAsDataURL(file);
                e.target.value = '';
              }} />

              <div className="bg-white px-4 py-4 sm:p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  <div className="flex items-center space-x-3 md:col-span-1">
                    <div onClick={() => (isEditing ? editFileInputRef.current?.click() : null)} className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center cursor-pointer overflow-hidden">
                      {editableStudent.picture ? <img src={editableStudent.picture} alt="profile" className="h-full w-full object-cover" /> : <PlusIcon className="h-6 w-6 text-blue-600" />}
                    </div>
                    <div className="flex-1 text-left">
                      {isEditing ? (
                        <input
                          value={editableStudent.name || ''}
                          onChange={e => setEditableStudent(prev => ({ ...prev, name: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1"
                        />
                      ) : (
                        <>
                          <div className="text-lg font-medium text-gray-900">{editableStudent.name || 'No name'}</div>
                          <div className="text-sm text-gray-500">Student ID: {editableStudent.uid || editableStudent.id || '—'}</div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 flex space-x-3">
                    <div className="flex-1">
                      {isEditing ? <input
                        value={editableStudent.linNumber || ''}
                        onChange={e => setEditableStudent(prev => ({ ...prev, linNumber: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1"
                      /> : <div className="mt-1 text-sm text-gray-700">{editableStudent.linNumber || '—'}</div>}
                    </div>
                    <div className="w-40">
                      {isEditing ? (
                        <select
                          value={editableStudent.class || ''}
                          onChange={e => setEditableStudent(prev => ({ ...prev, class: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1"
                        >
                          <option value="">Select</option>
                          <option>Creche</option>
                          <option>Nursery 1</option>
                          <option>Nursery 2</option>
                          <option>KG 1</option>
                          <option>KG 2</option>
                          <option>Primary 1</option>
                          <option>Primary 2</option>
                          <option>Primary 3</option>
                          <option>Primary 4</option>
                          <option>Primary 6</option>
                          <option>JSS1</option>
                          <option>JSS2</option>
                          <option>Graduate</option>
                          <option>Left</option>
                        </select>
                      ) : <div className="mt-1 text-sm text-gray-700">{editableStudent.class || '—'}</div>}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Personal */}
                  <div className="col-span-1 p-3 rounded-md">
                    <h4 className="text-sm font-semibold mb-2">Personal</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600">Date of Birth</label>
                        {isEditing ? (
                          <input type="date" value={editableStudent.dob || ''} onChange={e => setEditableStudent(prev => ({ ...prev, dob: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.dob || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Gender</label>
                        {isEditing ? (
                          <select value={editableStudent.gender || 'Male'} onChange={e => setEditableStudent(prev => ({ ...prev, gender: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1">
                            <option>Male</option>
                            <option>Female</option>
                          </select>
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.gender || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Religion</label>
                        {isEditing ? (
                          <select value={editableStudent.religion || ''} onChange={e => setEditableStudent(prev => ({ ...prev, religion: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1">
                            <option value="">Select</option>
                            <option value="Christian">Christian</option>
                            <option value="Muslim">Muslim</option>
                            <option value="Other">Other</option>
                          </select>
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.religion || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">State of Origin</label>
                        {isEditing ? (
                          <input value={editableStudent.stateOfOrigin || ''} onChange={e => setEditableStudent(prev => ({ ...prev, stateOfOrigin: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.stateOfOrigin || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">LGA</label>
                        {isEditing ? (
                          <input value={editableStudent.lga || ''} onChange={e => setEditableStudent(prev => ({ ...prev, lga: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.lga || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Address</label>
                        {isEditing ? (
                          <input value={editableStudent.address || ''} onChange={e => setEditableStudent(prev => ({ ...prev, address: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.address || '—'}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Family */}
                  <div className="col-span-1 p-3 rounded-md">
                    <h4 className="text-sm font-semibold mb-2">Family / Guardians</h4>
                    <div className="space-y-3">
                      {(editableStudent.guardians || []).map((g, i) => (
                        <div key={i} className="mb-3">
                          {isEditing ? (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <input value={g.name || ''} onChange={e => editGuardianChange(i, 'name', e.target.value)} className="border rounded px-2 py-1" placeholder="Name" />
                              <input value={g.phone || ''} onChange={e => editGuardianChange(i, 'phone', e.target.value)} className="border rounded px-2 py-1" placeholder="Phone" />
                              <input value={g.email || ''} onChange={e => editGuardianChange(i, 'email', e.target.value)} className="border rounded px-2 py-1" placeholder="Email" />
                              <select value={g.relationship || 'Father'} onChange={e => editGuardianChange(i, 'relationship', e.target.value)} className="border rounded px-2 py-1">
                                <option>Father</option>
                                <option>Mother</option>
                                <option>Guardian</option>
                                <option>Other</option>
                              </select>
                            </div>
                          ) : (
                            <div>{g.name || '—'} {g.relationship ? `(${g.relationship})` : ''} — {g.phone || ''} {g.email ? `| ${g.email}` : ''}</div>
                          )}
                          {isEditing && (editableStudent.guardians || []).length > 1 && (
                            <div className="mt-1">
                              <button type="button" onClick={() => removeEditableGuardian(i)} className="text-xs text-red-600 hover:underline">Remove</button>
                            </div>
                          )}
                        </div>
                      ))}

                    </div>
                  </div>
                  {/* Medical */}
                  <div className="col-span-1 p-3 rounded-md">
                    <h4 className="text-sm font-semibold mb-2">Medical / Emergency</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600">Blood Group</label>
                        {isEditing ? (
                          <input value={editableStudent.bloodGroup || ''} onChange={e => setEditableStudent(prev => ({ ...prev, bloodGroup: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.bloodGroup || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Allergies</label>
                        {isEditing ? (
                          <input value={editableStudent.allergies || ''} onChange={e => setEditableStudent(prev => ({ ...prev, allergies: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.allergies || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Medical Conditions</label>
                        {isEditing ? (
                          <input value={editableStudent.medicalConditions || ''} onChange={e => setEditableStudent(prev => ({ ...prev, medicalConditions: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.medicalConditions || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Emergency Contact</label>
                        {isEditing ? (
                          <>
                            <input value={editableStudent.emergencyContactName || ''} onChange={e => setEditableStudent(prev => ({ ...prev, emergencyContactName: e.target.value }))} placeholder="Name" className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                            <input value={editableStudent.emergencyContactPhone || ''} onChange={e => setEditableStudent(prev => ({ ...prev, emergencyContactPhone: e.target.value }))} placeholder="Phone" className="mt-2 block w-full border border-gray-300 rounded-md px-2 py-1" />
                          </>
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.emergencyContactName || '—'} {editableStudent.emergencyContactPhone ? `| ${editableStudent.emergencyContactPhone}` : ''}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* drag/drop removed — avatar click still opens file selector */}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {isEditing ? (
                  <>
                    <button type="button" onClick={handleSave} disabled={isSaving} className={`w-full inline-flex items-center justify-center rounded-md px-4 py-2 bg-blue-600 text-white sm:ml-3 sm:w-auto sm:text-sm ${isSaving ? 'opacity-80' : ''}`}>{isSaving ? 'Saving...' : 'Save'}</button>
                    <button type="button" onClick={() => { setIsEditing(false); setEditableStudent(selectedStudent); }} disabled={isSaving} className="mt-3 w-full inline-flex justify-center rounded-md px-4 py-2 bg-white text-gray-700 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setIsEditing(true)} className="w-full inline-flex justify-center rounded-md px-4 py-2 bg-blue-600 text-white sm:ml-3 sm:w-auto sm:text-sm">Edit Student</button>
                    <button type="button" onClick={() => { setShowViewModal(false); setEditableStudent(null); setIsEditing(false); }} className="mt-3 w-full inline-flex justify-center rounded-md px-4 py-2 bg-white text-gray-700 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Close</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default StudentManagement;