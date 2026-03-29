import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { EyeIcon, CheckIcon, XIcon, MessageCircleIcon, PencilIcon } from 'lucide-react';
import { toast } from 'sonner';
import { classesMatch } from '../../utils/schoolClass';

const Modal = ({ open, title, onClose, children, maxWidth = 'sm:max-w-4xl' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-white rounded-lg shadow-xl overflow-auto w-full ${maxWidth} max-h-[90vh] z-10`}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <h3 id="modal-title" className="text-lg font-medium text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close modal">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

const API_BASE = (import.meta?.env?.VITE_API_URL || '').trim();
const FALLBACK_API = 'https://yms-backend-a2x4.onrender.com';
const API_HOST = API_BASE || FALLBACK_API;

const apiUrl = (path) => {
  const base = API_HOST.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base + p;
};

const PAGE_SIZE = 40;

const TERM_OPTIONS = [
  { value: '', label: 'All terms' },
  { value: 'First Term', label: '1st Term' },
  { value: 'Second Term', label: '2nd Term' },
  { value: 'Third Term', label: '3rd Term' }
];

const CLASS_OPTIONS = [
  'Creche', 'Nursery 1', 'Nursery 2', 'KG 1', 'KG 2',
  'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'
];

function academicYearOptions() {
  const out = [{ value: '', label: 'All years' }];
  const start = new Date().getFullYear();
  for (let y = start + 1; y >= start - 6; y--) {
    const label = `${y - 1}/${y}`;
    out.push({ value: label, label });
  }
  return out;
}

function normalizeTermKey(t) {
  if (t == null || t === '') return '';
  const raw = String(t).trim().toLowerCase().replace(/\s+/g, ' ');
  if (raw.includes('first') || raw === '1' || raw === '1st') return 'first';
  if (raw.includes('second') || raw === '2' || raw === '2nd') return 'second';
  if (raw.includes('third') || raw === '3' || raw === '3rd') return 'third';
  return raw;
}

function termOrder(key) {
  const k = normalizeTermKey(key);
  if (k === 'first') return 1;
  if (k === 'second') return 2;
  if (k === 'third') return 3;
  return 50;
}

function classSortRank(label) {
  const s = (label || '—').trim();
  if (s === '—') return 9999;
  let m = /^jss\s*(\d+)/i.exec(s);
  if (m) return 300 + parseInt(m[1], 10);
  m = /^ss\s*(\d+)/i.exec(s);
  if (m) return 400 + parseInt(m[1], 10);
  m = /^primary\s*(\d+)/i.exec(s);
  if (m) return 100 + parseInt(m[1], 10);
  m = /^nursery\s*(\d+)/i.exec(s);
  if (m) return 50 + parseInt(m[1], 10);
  m = /^kg\s*(\d+)/i.exec(s);
  if (m) return 70 + parseInt(m[1], 10);
  if (/^creche/i.test(s)) return 10;
  return 2000 + s.charCodeAt(0);
}

function yearSortKey(y) {
  const m = String(y || '').match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

function normalizeSessionKey(s) {
  return (s ?? '').toString().trim().replace(/\s+/g, '');
}

function mapRawResult(r) {
  const id = r.id || r._id || r.resultId || '';
  const publishedRaw = r.published;
  const isPublished =
    publishedRaw === true ||
    publishedRaw === 'yes' ||
    publishedRaw === 'published' ||
    String(publishedRaw).toLowerCase() === 'true';
  return {
    id,
    studentId: r.student_id ?? r.studentId ?? r.student ?? '',
    classId: r.class_id ?? r.classId ?? '',
    academicYear: (r.academic_year ?? r.academicYear ?? r.session ?? '').toString().trim(),
    studentName: (r.studentName ?? r.name ?? r.fullName ?? '') || 'Unknown',
    studentUid: r.studentUid ?? r.student_uid ?? '',
    studentNumber: r.studentNumber ?? r.linNumber ?? r.admissionNumber ?? '',
    studentClass: (r.studentClass ?? r.class ?? r.className ?? r.class_label ?? '').toString().trim(),
    session: (r.session ?? r.academic_year ?? r.academicYear ?? '').toString().trim(),
    term: (r.term ?? '').toString().trim(),
    subjects: Array.isArray(r.subjects) ? r.subjects : [],
    teacherComment: r.teacherComment ?? r.comment ?? '',
    principalComment: r.principalComment ?? '',
    published: publishedRaw,
    status: isPublished ? 'published' : 'pending',
    createdAt: r.createdAt ?? r.publishedAt ?? r.updatedAt ?? '',
    lastUpdated: r.publishedAt ?? r.updatedAt ?? r.createdAt ?? '',
    picture: r.picture ?? '',
    raw: r
  };
}

function parseListResponse(raw) {
  if (Array.isArray(raw)) {
    return { items: raw, nextPageToken: null, hasMore: false };
  }
  if (!raw || typeof raw !== 'object') {
    return { items: [], nextPageToken: null, hasMore: false };
  }
  const items = Array.isArray(raw.data)
    ? raw.data
    : (Array.isArray(raw.results) ? raw.results : []);
  return {
    items: Array.isArray(items) ? items : [],
    nextPageToken: raw.nextPageToken ?? raw.nextCursor ?? raw.next_page_token ?? null,
    hasMore: raw.hasMore === true || raw.has_next === true || raw.hasMore === 'true'
  };
}

function groupResults(items) {
  const tree = new Map();
  for (const r of items) {
    const c = r.studentClass || '—';
    const y = r.session || '—';
    const tKey = r.term || '—';
    if (!tree.has(c)) tree.set(c, new Map());
    const byY = tree.get(c);
    if (!byY.has(y)) byY.set(y, new Map());
    const byT = byY.get(y);
    if (!byT.has(tKey)) byT.set(tKey, []);
    byT.get(tKey).push(r);
  }

  const classes = [...tree.keys()].sort((a, b) => classSortRank(a) - classSortRank(b));
  return classes.map((cls) => {
    const byY = tree.get(cls);
    const years = [...byY.keys()].sort((a, b) => yearSortKey(b) - yearSortKey(a));
    return {
      className: cls,
      years: years.map((year) => {
        const byT = byY.get(year);
        const terms = [...byT.keys()].sort((a, b) => termOrder(a) - termOrder(b));
        return {
          year,
          terms: terms.map((term) => ({
            term,
            results: byT.get(term)
          }))
        };
      })
    };
  });
}

const ResultManagement = () => {
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const fetchGen = useRef(0);

  const [filterClass, setFilterClass] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showViewModal, setShowViewModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [teacherResultsEnabled, setTeacherResultsEnabled] = useState(true);
  const [principalComment, setPrincipalComment] = useState('');
  const [publishingIds, setPublishingIds] = useState([]);
  const [publishingAll, setPublishingAll] = useState(false);

  const yearOptions = useMemo(() => academicYearOptions(), []);

  const buildQueryParams = useCallback((forToken, resultOffset) => {
    const p = new URLSearchParams();
    p.set('limit', String(PAGE_SIZE));
    if (filterClass) {
      p.append('class', filterClass);
      p.append('studentClass', filterClass);
    }
    if (filterYear) {
      p.append('session', filterYear);
      p.append('academicYear', filterYear);
    }
    if (filterTerm) {
      p.append('term', filterTerm);
    }
    if (forToken) {
      p.set('startAfter', forToken);
    } else if (resultOffset != null && resultOffset > 0) {
      p.set('offset', String(resultOffset));
    }
    return p;
  }, [filterClass, filterYear, filterTerm]);

  const fetchJson = async (url, signal) => {
    const resp = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    const ct = resp.headers.get('content-type') || '';
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`Request failed (${resp.status}): ${text.slice(0, 120)}`);
    }
    if (!ct.includes('application/json')) {
      throw new Error(`Expected JSON from server`);
    }
    return JSON.parse(text || '{}');
  };

  const loadPage = useCallback(async (opts) => {
    const { token, offset, signal } = opts;
    const url = apiUrl(`/api/results?${buildQueryParams(token, offset).toString()}`);
    try {
      const raw = await fetchJson(url, signal);
      const { items, nextPageToken: nextTok, hasMore: hm } = parseListResponse(raw);
      const mapped = items.map(mapRawResult).filter((x) => x.id);
      const more =
        hm === true ||
        (mapped.length >= PAGE_SIZE && (nextTok != null && nextTok !== '')) ||
        (mapped.length >= PAGE_SIZE && hm !== false);
      return { mapped, nextTok, hasMore: more };
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw e;
    }
  }, [buildQueryParams]);

  useEffect(() => {
    const gen = ++fetchGen.current;
    const ac = new AbortController();
    (async () => {
      setLoadingResults(true);
      setResults([]);
      setNextPageToken(null);
      setHasMore(false);
      try {
        const { mapped, nextTok, hasMore: hm } = await loadPage({ token: null, offset: null, signal: ac.signal });
        if (gen !== fetchGen.current) return;
        setResults(mapped);
        setNextPageToken(nextTok || null);
        setHasMore(hm);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Failed to load results:', err);
        toast.error(`Failed to load results: ${String(err.message).split('\n')[0]}`);
      } finally {
        if (gen === fetchGen.current) setLoadingResults(false);
      }
    })();
    return () => ac.abort();
  }, [filterClass, filterYear, filterTerm, loadPage]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const useOffset = !nextPageToken;
      const { mapped, nextTok, hasMore: hm } = await loadPage({
        token: nextPageToken || null,
        offset: useOffset ? results.length : null,
        signal: undefined
      });
      setResults((prev) => {
        const seen = new Set(prev.map((r) => String(r.id)));
        const add = mapped.filter((r) => !seen.has(String(r.id)));
        return [...prev, ...add];
      });
      setNextPageToken(nextTok || null);
      setHasMore(hm);
    } catch (err) {
      console.error(err);
      toast.error('Could not load more results.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleViewResult = (result) => {
    setSelectedResult(result);
    setShowViewModal(true);
  };

  const handleOpenCommentModal = (result) => {
    setSelectedResult(result);
    setPrincipalComment(result.principalComment || '');
    setShowCommentModal(true);
  };

  const mergeResult = (id, patch) => {
    setResults((prev) => prev.map((r) => (String(r.id) === String(id) ? { ...r, ...patch } : r)));
  };

  const handleSaveComment = async () => {
    if (!selectedResult) return;
    const url = apiUrl(`/api/results/${selectedResult.id}`);
    try {
      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principalComment })
      });
      const ct = resp.headers.get('content-type') || '';
      const txt = await resp.text();
      if (!resp.ok) throw new Error(txt || `Failed (${resp.status})`);
      if (!ct.includes('application/json')) throw new Error('Invalid response');
      const updated = JSON.parse(txt);
      mergeResult(selectedResult.id, { principalComment: updated.principalComment ?? principalComment });
      setShowCommentModal(false);
      toast.success('Principal comment saved successfully!');
    } catch (err) {
      console.error('Save comment error:', err);
      toast.error('Failed to save principal comment: ' + (err.message || ''));
    }
  };

  const handlePublishResult = async (id) => {
    if (!id || publishingIds.includes(id)) return;
    setPublishingIds((prev) => [...prev, id]);
    const url = apiUrl(`/api/results/${id}`);
    try {
      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: 'yes', publishedAt: new Date().toISOString() })
      });
      const ct = resp.headers.get('content-type') || '';
      const txt = await resp.text();
      if (!resp.ok) throw new Error(txt || `Failed (${resp.status})`);
      if (!ct.includes('application/json')) throw new Error('Invalid response');
      const updated = JSON.parse(txt);
      const pub = updated.published === 'yes' || updated.status === 'published';
      mergeResult(id, {
        status: pub ? 'published' : 'pending',
        lastUpdated: updated.publishedAt ?? updated.updatedAt ?? new Date().toISOString()
      });
      toast.success('Result published successfully!');
    } catch (err) {
      console.error('Publish error:', err);
      toast.error('Failed to publish result: ' + (err.message || ''));
    } finally {
      setPublishingIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handlePublishAllResults = async () => {
    const pending = filteredForActions.filter((r) => r.status === 'pending');
    if (pending.length === 0) {
      setShowPublishModal(false);
      return;
    }
    setPublishingAll(true);
    try {
      const promises = pending.map((r) =>
        fetch(apiUrl(`/api/results/${r.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: 'yes', publishedAt: new Date().toISOString() })
        }).then(async (resp) => {
          const ct = resp.headers.get('content-type') || '';
          const txt = await resp.text();
          if (!resp.ok) throw new Error(`Failed ${resp.status}`);
          if (!ct.includes('application/json')) throw new Error('Expected JSON');
          return JSON.parse(txt);
        }).catch((err) => ({ error: true, id: r.id, message: err.message }))
      );

      const settled = await Promise.allSettled(promises);
      const successIds = [];
      settled.forEach((s, i) => {
        if (s.status === 'fulfilled' && !s.value?.error) {
          successIds.push(pending[i].id);
        }
      });
      successIds.forEach((rid) => mergeResult(rid, { status: 'published', lastUpdated: new Date().toISOString() }));

      const failCount = pending.length - successIds.length;
      if (failCount > 0) toast.error(`Published ${successIds.length} / ${pending.length}.`);
      else toast.success(`All ${pending.length} results published.`);
    } catch (err) {
      console.error('Publish all error:', err);
      toast.error('Failed to publish all results');
    } finally {
      setPublishingAll(false);
      setShowPublishModal(false);
    }
  };

  const handleToggleTeacherResults = () => {
    setTeacherResultsEnabled(!teacherResultsEnabled);
    toast.success(teacherResultsEnabled ? 'Teacher results section has been disabled' : 'Teacher results section has been enabled');
  };

  const calculateOverallGrade = (subjects) => {
    if (!Array.isArray(subjects) || subjects.length === 0) return { percentage: 0, grade: 'F' };
    const totalPercentage = subjects.reduce((sum, subject) => sum + (Number(subject.percentage) || 0), 0);
    const overallPercentage = totalPercentage / subjects.length;
    const grade = getGradeFromPercentage(overallPercentage);
    return { percentage: parseFloat(overallPercentage.toFixed(1)), grade };
  };

  const getGradeFromPercentage = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 45) return 'D';
    if (percentage >= 40) return 'E';
    return 'F';
  };

  const filteredBySearchAndStatus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return results.filter((result) => {
      const matchesSearch =
        !q ||
        (result.studentName || '').toLowerCase().includes(q) ||
        (result.studentUid || '').toLowerCase().includes(q) ||
        (result.studentNumber || '').toLowerCase().includes(q);
      const matchesStatus = filterStatus ? result.status === filterStatus : true;
      if (!matchesSearch || !matchesStatus) return false;
      if (filterClass && !classesMatch(result.studentClass, filterClass)) {
        return false;
      }
      if (filterYear && normalizeSessionKey(result.session) !== normalizeSessionKey(filterYear)) {
        return false;
      }
      if (filterTerm && normalizeTermKey(result.term) !== normalizeTermKey(filterTerm)) {
        return false;
      }
      return true;
    });
  }, [results, searchQuery, filterStatus, filterClass, filterYear, filterTerm]);

  const filteredForActions = filteredBySearchAndStatus;

  const grouped = useMemo(() => groupResults(filteredBySearchAndStatus), [filteredBySearchAndStatus]);

  const pendingResultsCount = filteredForActions.filter((r) => r.status === 'pending').length;

  const clearFilters = () => {
    setFilterClass('');
    setFilterYear('');
    setFilterTerm('');
  };

  return (
    <DashboardLayout title="Result Management">
      {loadingResults && (
        <div className="mb-4 text-sm text-gray-600">Loading results…</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Student Results</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowPublishModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-60"
            disabled={pendingResultsCount === 0 || publishingAll}
          >
            <CheckIcon className="h-5 w-5 mr-2" />
            {publishingAll ? 'Publishing…' : `Publish pending (${pendingResultsCount})`}
          </button>
          <button
            type="button"
            onClick={handleToggleTeacherResults}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${teacherResultsEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {teacherResultsEnabled ? (
              <>
                <XIcon className="h-5 w-5 mr-2" />
                Disable Teacher Results
              </>
            ) : (
              <>
                <CheckIcon className="h-5 w-5 mr-2" />
                Enable Teacher Results
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="filterClass" className="block text-xs font-medium text-gray-500 mb-1">Class</label>
            <select
              id="filterClass"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="block w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All classes</option>
              {CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filterYear" className="block text-xs font-medium text-gray-500 mb-1">Academic year</label>
            <select
              id="filterYear"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="block w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {yearOptions.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filterTerm" className="block text-xs font-medium text-gray-500 mb-1">Term</label>
            <select
              id="filterTerm"
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              className="block w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {TERM_OPTIONS.map((o) => (
                <option key={o.value || 'allt'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filterStatus" className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              id="filterStatus"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All</option>
              <option value="published">Published</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="search" className="sr-only">Search</label>
            <input
              id="search"
              type="search"
              placeholder="Search by student name, ID, or number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
          >
            Clear class / year / term
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Results load in pages of {PAGE_SIZE}. Use filters to narrow what the server returns. Groups below show loaded data by class, year, and term.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {grouped.length === 0 && !loadingResults && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-sm text-gray-500">
            No results in the current view. Adjust filters or load more if available.
          </div>
        )}

        {grouped.map((block) => (
            <section key={block.className} className="bg-white shadow rounded-lg overflow-hidden border border-gray-100">
              <div className="px-4 py-3 bg-slate-50 border-b border-gray-200">
                <span className="text-base font-semibold text-gray-900">{block.className}</span>
              </div>
                <div className="p-4 space-y-6">
                  {block.years.map((yr) => (
                    <div key={`${block.className}-${yr.year}`}>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">
                        Academic year: {yr.year}
                      </h3>
                      <div className="space-y-4 ml-0 sm:ml-2">
                        {yr.terms.map((tm) => (
                          <div key={`${yr.year}-${tm.term}`}>
                            <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                              {tm.term}
                            </h4>
                            <div className="overflow-x-auto rounded-md border border-gray-200">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subjects</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Average</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {tm.results.map((result) => {
                                    const { percentage, grade } = calculateOverallGrade(result.subjects);
                                    const isPublishing = publishingIds.includes(result.id);
                                    return (
                                      <tr key={String(result.id)}>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          <div className="text-sm font-medium text-gray-900">{result.studentName}</div>
                                          <div className="text-xs text-gray-500">
                                            {result.studentNumber || result.studentUid || '—'}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-600">{result.subjects?.length || 0}</td>
                                        <td className="px-3 py-2 text-sm text-gray-900">{percentage}%</td>
                                        <td className="px-3 py-2">
                                          <span className={`px-2 inline-flex text-xs font-semibold rounded-full ${grade === 'A+' || grade === 'A' ? 'bg-green-100 text-green-800' : grade === 'B' ? 'bg-blue-100 text-blue-800' : grade === 'C' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                            {grade}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className={`px-2 inline-flex text-xs font-semibold rounded-full ${result.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {result.status === 'published' ? 'Published' : 'Pending'}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-right text-sm">
                                          <button type="button" onClick={() => handleViewResult(result)} className="text-blue-600 hover:text-blue-900 p-1 mr-1" title="View result">
                                            <EyeIcon className="h-4 w-4 inline" />
                                          </button>
                                          <button type="button" onClick={() => handleViewResult(result)} className="text-indigo-600 hover:text-indigo-900 p-1 mr-1" title="Review / edit details">
                                            <PencilIcon className="h-4 w-4 inline" />
                                          </button>
                                          <button type="button" onClick={() => handleOpenCommentModal(result)} className="text-green-600 hover:text-green-900 p-1 mr-1" title="Principal comment">
                                            <MessageCircleIcon className="h-4 w-4 inline" />
                                          </button>
                                          {result.status === 'pending' && (
                                            <button type="button" onClick={() => handlePublishResult(result.id)} disabled={isPublishing} className="text-green-600 hover:text-green-900 p-1" title="Publish">
                                              <CheckIcon className="h-4 w-4 inline" />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
            </section>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mb-8">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore || loadingResults}
            className="inline-flex items-center px-5 py-2.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more results'}
          </button>
        </div>
      )}

      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex-1 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className={`h-4 w-4 rounded-full ${teacherResultsEnabled ? 'bg-green-500' : 'bg-red-500'} mr-2`} />
              <h4 className="text-sm font-medium text-gray-700">Teacher Results Access</h4>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {teacherResultsEnabled ? 'Teachers can currently add and edit results.' : 'Teachers cannot add or edit results.'}
            </p>
          </div>
          <div className="flex-1 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="h-4 w-4 rounded-full bg-yellow-500 mr-2" />
              <h4 className="text-sm font-medium text-gray-700">Pending (this view)</h4>
            </div>
            <p className="mt-2 text-sm text-gray-600">{pendingResultsCount} pending in filtered list.</p>
          </div>
          <div className="flex-1 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="h-4 w-4 rounded-full bg-blue-500 mr-2" />
              <h4 className="text-sm font-medium text-gray-700">Loaded rows</h4>
            </div>
            <p className="mt-2 text-sm text-gray-600">{results.length} result records loaded.</p>
          </div>
        </div>
      </div>

      <Modal open={showViewModal && !!selectedResult} title="Result Review" onClose={() => setShowViewModal(false)}>
        {selectedResult && (
          <>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <img src={selectedResult.picture || '/placeholder-avatar.png'} alt="" className="h-16 w-16 rounded-full object-cover" />
                <div>
                  <div className="text-sm text-gray-500">Student</div>
                  <div className="text-xl font-semibold text-gray-900">{selectedResult.studentName}</div>
                  <div className="text-sm text-gray-500">ID: {selectedResult.studentUid || '—'}</div>
                  {selectedResult.studentNumber && (
                    <div className="text-sm text-gray-500">No.: {selectedResult.studentNumber}</div>
                  )}
                  <div className="text-sm text-gray-500">{selectedResult.studentClass || '—'}</div>
                  <div className="text-sm text-gray-500">Created: {selectedResult.createdAt ? new Date(selectedResult.createdAt).toLocaleString() : '—'}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Session / Term</div>
                <div className="text-sm font-medium text-gray-900">{selectedResult.session} • {selectedResult.term}</div>
                <div className="mt-2">
                  <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${selectedResult.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {selectedResult.status === 'published' ? 'Published' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-md shadow-sm p-4 mb-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">1st</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">2nd</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">3rd</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(selectedResult.subjects || []).map((subject, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{subject.name}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.firstTest ?? '—'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.secondTest ?? '—'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.thirdTest ?? '—'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.exam ?? '—'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{subject.total ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 inline-flex text-xs font-semibold rounded-full ${subject.grade === 'A+' || subject.grade === 'A' ? 'bg-green-100 text-green-800' : subject.grade === 'B' ? 'bg-blue-100 text-blue-800' : subject.grade === 'C' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                            {subject.grade || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-4">
              <div className="flex gap-6">
                <div>
                  <div className="text-sm text-gray-500">Overall</div>
                  <div className="text-lg font-medium text-gray-900">{calculateOverallGrade(selectedResult.subjects).percentage}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Grade</div>
                  <span className={`px-2 py-1 inline-flex text-sm font-semibold rounded-full ${calculateOverallGrade(selectedResult.subjects).grade === 'A+' || calculateOverallGrade(selectedResult.subjects).grade === 'A' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                    {calculateOverallGrade(selectedResult.subjects).grade}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleOpenCommentModal(selectedResult)} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Principal comment</button>
                {selectedResult.status === 'pending' && (
                  <button type="button" onClick={async () => { await handlePublishResult(selectedResult.id); setShowViewModal(false); }} className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-md text-sm">Publish</button>
                )}
                <button type="button" onClick={() => setShowViewModal(false)} className="inline-flex items-center px-3 py-2 bg-white border rounded-md text-sm">Close</button>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Principal&apos;s comment</h4>
                <span className={`text-xs font-medium ${selectedResult.principalComment ? 'text-green-700' : 'text-gray-500'}`}>
                  {selectedResult.principalComment ? 'Added' : 'Not added'}
                </span>
              </div>
              <div className="p-3 rounded border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-800 whitespace-pre-wrap min-h-[56px]">
                {selectedResult.principalComment ? selectedResult.principalComment : <span className="text-gray-500">No principal comment yet.</span>}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm text-gray-600 mb-1">Teacher&apos;s comment</div>
              <div className="p-3 rounded border border-gray-200 bg-white text-sm text-gray-800 whitespace-pre-wrap">
                {selectedResult.teacherComment ? selectedResult.teacherComment : <span className="text-gray-500">No teacher comment.</span>}
              </div>
            </div>
          </>
        )}
      </Modal>

      <Modal open={showCommentModal && !!selectedResult} title={`Principal comment${selectedResult ? ` — ${selectedResult.studentName}` : ''}`} onClose={() => setShowCommentModal(false)} maxWidth="sm:max-w-lg">
        {selectedResult && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{selectedResult.studentName}</strong> — {selectedResult.session} / {selectedResult.term}
            </p>
            <label htmlFor="principalComment" className="block text-sm font-medium text-gray-700">Comment</label>
            <textarea
              id="principalComment"
              rows={5}
              value={principalComment}
              onChange={(e) => setPrincipalComment(e.target.value)}
              className="mt-2 w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="mt-4 grid grid-cols-1 gap-y-2 gap-x-3 sm:grid-cols-3">
              <button type="button" className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700" onClick={() => setPrincipalComment('Excellent performance. Keep up the good work!')}>Excellent</button>
              <button type="button" className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700" onClick={() => setPrincipalComment('Good performance. Keep working hard.')}>Good</button>
              <button type="button" className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded text-white bg-yellow-600 hover:bg-yellow-700" onClick={() => setPrincipalComment('Needs improvement. Work harder next term.')}>Needs improvement</button>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button type="button" className="rounded-md px-4 py-2 bg-blue-600 text-white text-sm font-medium" onClick={handleSaveComment}>Save</button>
              <button type="button" className="rounded-md px-4 py-2 bg-white border text-sm font-medium" onClick={() => setShowCommentModal(false)}>Cancel</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={showPublishModal} title="Publish pending results" onClose={() => setShowPublishModal(false)} maxWidth="sm:max-w-lg">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckIcon className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div>
            <p className="mt-2 text-sm text-gray-500">
              Publish all <strong>{pendingResultsCount}</strong> pending results in the current filters and search? Students will see published records.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-md px-4 py-2 bg-green-600 text-white text-sm font-medium" onClick={handlePublishAllResults} disabled={publishingAll}>
            {publishingAll ? 'Publishing…' : 'Publish all'}
          </button>
          <button type="button" className="rounded-md px-4 py-2 bg-white border text-sm font-medium" onClick={() => setShowPublishModal(false)} disabled={publishingAll}>Cancel</button>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default ResultManagement;
