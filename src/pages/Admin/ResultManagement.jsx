// src/pages/Admin/ResultManagement.jsx
import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { EyeIcon, CheckIcon, XIcon, MessageCircleIcon } from 'lucide-react';
import { toast } from 'sonner';

const Modal = ({ open, title, onClose, children, maxWidth = 'sm:max-w-4xl' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // lock scroll
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

// API base config: trim env var and provide a safe local fallback for dev.
const API_BASE = (import.meta?.env?.VITE_API_URL || '').trim();
const FALLBACK_LOCAL_API = 'https://yms-backend-a2x4.onrender.com'; // change port if your backend uses a different port
const API_HOST = API_BASE || FALLBACK_LOCAL_API;

// helper to build full backend URL (avoids double slashes)
const api = (path) => {
  const base = API_HOST.replace(/\/$/, '');
  if (!path) return base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return base + p;
};

const ResultManagement = () => {
  // removed sample data - load from API
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [teacherResultsEnabled, setTeacherResultsEnabled] = useState(true);
  const [principalComment, setPrincipalComment] = useState('');
  const [publishingIds, setPublishingIds] = useState([]); // track individual publish operations
  const [publishingAll, setPublishingAll] = useState(false);

  // View result details
  const handleViewResult = result => {
    setSelectedResult(result);
    setShowViewModal(true);
  };
  // Open comment modal
  const handleOpenCommentModal = result => {
    setSelectedResult(result);
    setPrincipalComment(result.principalComment || '');
    setShowCommentModal(true);
  };
  // Save principal comment
  const handleSaveComment = async () => {
    if (!selectedResult) return;
    const url = api(`/api/results/${selectedResult.id}`);
    console.debug('PUT', url);
    try {
      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principalComment })
      });
      const ct = resp.headers.get('content-type') || '';
      const txt = await resp.text();
      if (!resp.ok) {
        console.error('Save comment response', resp.status, ct, txt.slice(0,300));
        throw new Error(txt || `Failed to save comment (${resp.status})`);
      }
      if (!ct.includes('application/json')) {
        throw new Error(`Expected JSON but received "${ct}". Response snippet: ${txt.slice(0,300)}`);
      }
      const updated = JSON.parse(txt);
      const updatedResults = results.map(result => result.id === selectedResult.id ? {
        ...result,
        principalComment: updated.principalComment ?? principalComment
      } : result);

      setResults(updatedResults);
      setShowCommentModal(false);
      toast.success('Principal comment saved successfully!');
    } catch (err) {
      console.error('Save comment error:', err);
      toast.error('Failed to save principal comment: ' + (err.message || ''));
    }
  };

  // Publish a single result (calls backend)
  const handlePublishResult = async (id) => {
    if (!id) return;
    if (publishingIds.includes(id)) return;
    setPublishingIds(prev => [...prev, id]);
    const url = api(`/api/results/${id}`);
    console.debug('PUT', url);
    try {
      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: 'yes', publishedAt: new Date().toISOString() })
      });
      const ct = resp.headers.get('content-type') || '';
      const txt = await resp.text();
      if (!resp.ok) {
        console.error('Publish response', resp.status, ct, txt.slice(0,300));
        throw new Error(txt || `Failed to publish (${resp.status})`);
      }
      if (!ct.includes('application/json')) {
        throw new Error(`Expected JSON but received "${ct}". Response snippet: ${txt.slice(0,300)}`);
      }
      const updated = JSON.parse(txt);
      const updatedResults = results.map(r => r.id === id ? {
        ...r,
        status: (updated.published === 'yes' || updated.status === 'published') ? 'published' : r.status,
        lastUpdated: updated.publishedAt ?? updated.updatedAt ?? new Date().toISOString()
      } : r);
      setResults(updatedResults);
      toast.success('Result published successfully!');
    } catch (err) {
      console.error('Publish error:', err);
      toast.error('Failed to publish result: ' + (err.message || ''));
    } finally {
      setPublishingIds(prev => prev.filter(x => x !== id));
    }
  };

  // Publish all pending results (calls backend for each pending)
  const handlePublishAllResults = async () => {
    const pending = results.filter(r => r.status === 'pending');
    if (pending.length === 0) {
      setShowPublishModal(false);
      return;
    }
    setPublishingAll(true);
    try {
      const promises = pending.map(r => {
        const url = api(`/api/results/${r.id}`);
        console.debug('PUT', url);
        return fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: 'yes', publishedAt: new Date().toISOString() })
        }).then(async resp => {
          const ct = resp.headers.get('content-type') || '';
          const txt = await resp.text();
          if (!resp.ok) throw new Error(`Failed ${resp.status}: ${txt.slice(0,200)}`);
          if (!ct.includes('application/json')) throw new Error(`Expected JSON but got ${ct}`);
          return JSON.parse(txt);
        }).catch(err => ({ error: true, id: r.id, message: err.message || String(err) }));
      });

      const settled = await Promise.allSettled(promises);
      const successes = [];
      const failures = [];
      settled.forEach(s => {
        if (s.status === 'fulfilled') {
          const val = s.value;
          if (val && val.error) failures.push(val);
          else successes.push(val);
        } else {
          failures.push({ error: true, message: s.reason?.message || String(s.reason) });
        }
      });

      // Update local state for successful publishes
      const successIds = successes.map(s => s.id || s?.id).filter(Boolean);
      const updatedResults = results.map(r => successIds.includes(r.id) ? { ...r, status: 'published', lastUpdated: new Date().toISOString() } : r);
      setResults(updatedResults);

      if (failures.length > 0) {
        console.warn('Some publishes failed', failures);
        toast.error(`Published ${successes.length} / ${pending.length}. Some failed.`);
      } else {
        toast.success(`All ${pending.length} results published.`);
      }
    } catch (err) {
      console.error('Publish all error:', err);
      toast.error('Failed to publish all results');
    } finally {
      setPublishingAll(false);
      setShowPublishModal(false);
    }
  };

  // Toggle teacher results access (frontend toggle)
  const handleToggleTeacherResults = () => {
    setTeacherResultsEnabled(!teacherResultsEnabled);
    if (teacherResultsEnabled) {
      toast.success('Teacher results section has been disabled');
    } else {
      toast.success('Teacher results section has been enabled');
    }
  };

  // Filter results based on search query and filters
  const filteredResults = results.filter(result => {
    const matchesSearch = (result.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (result.studentId || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = filterClass ? result.class === filterClass : true;
    const matchesStatus = filterStatus ? result.status === filterStatus : true;
    return matchesSearch && matchesClass && matchesStatus;
  });

  // Get unique classes for filter
  const classes = [...new Set(results.map(result => result.class).filter(Boolean))];
  // Count pending results
  const pendingResultsCount = results.filter(result => result.status === 'pending').length;

  // Calculate overall grade for a result
  const calculateOverallGrade = subjects => {
    if (!Array.isArray(subjects) || subjects.length === 0) return {
      percentage: 0,
      grade: 'F'
    };
    const totalPercentage = subjects.reduce((sum, subject) => sum + (Number(subject.percentage) || 0), 0);
    const overallPercentage = totalPercentage / subjects.length;
    const grade = getGradeFromPercentage(overallPercentage);
    return {
      percentage: parseFloat(overallPercentage.toFixed(1)),
      grade
    };
  };
  // Get grade from percentage
  const getGradeFromPercentage = percentage => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 75) return 'A';
    if (percentage >= 65) return 'B';
    if (percentage >= 55) return 'C';
    if (percentage >= 45) return 'D';
    if (percentage >= 40) return 'E';
    return 'F';
  };

  // Fetch results from backend API on mount
  useEffect(() => {
    const controller = new AbortController();
    // try known endpoints (will work whether API_BASE is set or not)
    const tryUrls = [
      api('/api/results'),
      api('/results')
    ].filter(Boolean);

    const fetchResults = async () => {
      setLoadingResults(true);
      let lastErr = null;

      for (const url of tryUrls) {
        console.debug('[Results] trying', url);
        try {
          const resp = await fetch(url, { signal: controller.signal });
          const ct = resp.headers.get('content-type') || '';
          const text = await resp.text().catch(() => '');

          console.debug('[Results] response', { url, status: resp.status, contentType: ct, snippet: text.slice(0, 300) });

          if (!resp.ok) {
            lastErr = new Error(`Request to ${url} failed ${resp.status}`);
            continue; // try next url
          }

          if (!ct.includes('application/json')) {
            // server returned HTML (likely index.html or error page) — skip this URL
            lastErr = new Error(`Expected JSON from ${url} but received "${ct}". Response snippet: ${text.slice(0,200)}`);
            continue; // try next url
          }

          // parse JSON and map to UI shape
          const data = JSON.parse(text || '[]');
          const mapped = (Array.isArray(data) ? data : []).map(r => ({
            id: r.id,
            studentName: r.studentName || r.name || r.studentId || 'Unknown',
            studentId: r.studentId || r.id || '',
            class: r.class || r.className || '',
            session: r.session || '',
            term: r.term || '',
            subjects: Array.isArray(r.subjects) ? r.subjects : [],
            teacherComment: r.teacherComment || '',
            principalComment: r.principalComment || '',
            status: (r.published === 'yes') ? 'published' : (r.published === 'no' ? 'pending' : (r.status || 'pending')),
            lastUpdated: r.publishedAt || r.updatedAt || r.createdAt || '',
            picture: r.picture || ''
          }));

          setResults(mapped);
          lastErr = null;
          break; // success
        } catch (err) {
          if (err.name === 'AbortError') {
            lastErr = err;
            break;
          }
          lastErr = err;
          console.warn('[Results] attempt failed for', url, err.message || err);
          // try next url
        }
      }

      if (lastErr && lastErr.name !== 'AbortError') {
        console.error('Failed to load results:', lastErr);
        toast.error(`Failed to load results: ${String(lastErr.message).split('\n')[0]}`);
      }
      setLoadingResults(false);
    };

    fetchResults();
    return () => controller.abort();
  }, []);

  return <DashboardLayout title="Result Management">
      {loadingResults && <div className="mb-4 text-sm text-gray-600">Loading results...</div>}
      {/* Header with Add Result button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Student Results
        </h1>
        <div className="flex space-x-3">
          <button type="button" onClick={() => setShowPublishModal(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500" disabled={pendingResultsCount === 0 || publishingAll}>
            <CheckIcon className="h-5 w-5 mr-2" />
            {publishingAll ? 'Publishing...' : `Publish All Results (${pendingResultsCount})`}
          </button>
          <button type="button" onClick={handleToggleTeacherResults} className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${teacherResultsEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}>
            {teacherResultsEnabled ? <>
                <XIcon className="h-5 w-5 mr-2" />
                Disable Teacher Results
              </> : <>
                <CheckIcon className="h-5 w-5 mr-2" />
                Enable Teacher Results
              </>}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 gap-4">
          <div className="w-full sm:w-96">
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input id="search" name="search" className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Search by name or ID" type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor="filterClass" className="sr-only">
                Filter by Class
              </label>
              <select id="filterClass" name="filterClass" value={filterClass} onChange={e => setFilterClass(e.target.value)} className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                <option value="">All Classes</option>
                {classes.map(cls => <option key={cls} value={cls}>
                    {cls}
                  </option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filterStatus" className="sr-only">
                Filter by Status
              </label>
              <select id="filterStatus" name="filterStatus" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                <option value="">All Statuses</option>
                <option value="published">Published</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Results</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Class
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Session / Term
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subjects
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Average
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResults.map(result => {
              const {
                percentage,
                grade
              } = calculateOverallGrade(result.subjects);
              const isPublishing = publishingIds.includes(result.id);
              return <tr key={String(result.id)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img className="h-10 w-10 rounded-full" src={result.picture} alt="" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {result.studentName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {result.studentId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.class}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {result.session}
                      </div>
                      <div className="text-sm text-gray-500">{result.term}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.subjects.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {percentage}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${grade === 'A+' || grade === 'A' ? 'bg-green-100 text-green-800' : grade === 'B' ? 'bg-blue-100 text-blue-800' : grade === 'C' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${result.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {result.status === 'published' ? 'Published' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleViewResult(result)} className="text-blue-600 hover:text-blue-900 mr-3" title="View result">
                        <EyeIcon className="h-5 w-5" />
                      </button>
                      <button onClick={() => handleOpenCommentModal(result)} className="text-green-600 hover:text-green-900 mr-3" title="Add principal comment">
                        <MessageCircleIcon className="h-5 w-5" />
                      </button>
                      {result.status === 'pending' && <button onClick={() => handlePublishResult(result.id)} disabled={isPublishing} className="text-green-600 hover:text-green-900" title={isPublishing ? 'Publishing...' : 'Publish result'}>
                          <CheckIcon className="h-5 w-5" />
                        </button>}
                    </td>
                  </tr>;
            })}
              {filteredResults.length === 0 && <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500">
                    No results found matching your criteria.
                  </td>
                </tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Info */}
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          System Status
        </h3>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex-1 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className={`h-4 w-4 rounded-full ${teacherResultsEnabled ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
              <h4 className="text-sm font-medium text-gray-700">
                Teacher Results Access
              </h4>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {teacherResultsEnabled ? 'Teachers can currently add and edit results.' : 'Teachers cannot add or edit results. Results submission is closed.'}
            </p>
          </div>
          <div className="flex-1 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="h-4 w-4 rounded-full bg-yellow-500 mr-2"></div>
              <h4 className="text-sm font-medium text-gray-700">
                Pending Results
              </h4>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {pendingResultsCount} results are pending publication.
            </p>
          </div>
          <div className="flex-1 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="h-4 w-4 rounded-full bg-blue-500 mr-2"></div>
              <h4 className="text-sm font-medium text-gray-700">
                Published Results
              </h4>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {results.filter(r => r.status === 'published').length} results
              have been published.
            </p>
          </div>
        </div>
      </div>

      {/* View Result Modal (replaced) */}
      <Modal open={showViewModal && !!selectedResult} title="Result Review" onClose={() => setShowViewModal(false)}>
        {selectedResult && (
          <>
            {/* Header: avatar + student meta */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <img src={selectedResult.picture || '/placeholder-avatar.png'} alt={selectedResult.studentName} className="h-16 w-16 rounded-full object-cover" />
                <div>
                  <div className="text-sm text-gray-500">Student</div>
                  <div className="text-xl font-semibold text-gray-900">{selectedResult.studentName}</div>
                  <div className="text-sm text-gray-500">ID: {selectedResult.studentId}</div>
                  <div className="text-sm text-gray-500">{selectedResult.class}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Session / Term</div>
                <div className="text-sm font-medium text-gray-900">{selectedResult.session} • {selectedResult.term}</div>
                <div className="mt-2">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${selectedResult.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {selectedResult.status === 'published' ? 'Published' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Subjects table (main card) */}
            <div className="bg-white border rounded-md shadow-sm p-4 mb-4">
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
                    {selectedResult.subjects.map((subject, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{subject.name}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.firstTest ?? '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.secondTest ?? '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.thirdTest ?? '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.exam ?? '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{subject.total ?? '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${subject.grade === 'A+' || subject.grade === 'A' ? 'bg-green-100 text-green-800' : subject.grade === 'B' ? 'bg-blue-100 text-blue-800' : subject.grade === 'C' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                            {subject.grade || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary, actions */}
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-4">
              <div className="flex gap-6">
                <div>
                  <div className="text-sm text-gray-500">Overall Percentage</div>
                  <div className="text-lg font-medium text-gray-900">{calculateOverallGrade(selectedResult.subjects).percentage}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Overall Grade</div>
                  <div>
                    <span className={`px-2 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${calculateOverallGrade(selectedResult.subjects).grade === 'A+' || calculateOverallGrade(selectedResult.subjects).grade === 'A' ? 'bg-green-100 text-green-800' : calculateOverallGrade(selectedResult.subjects).grade === 'B' ? 'bg-blue-100 text-blue-800' : calculateOverallGrade(selectedResult.subjects).grade === 'C' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {calculateOverallGrade(selectedResult.subjects).grade}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenCommentModal(selectedResult)} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Add Principal Comment</button>
                {selectedResult.status === 'pending' && <button onClick={async () => { await handlePublishResult(selectedResult.id); setShowViewModal(false); }} className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-md text-sm">Publish Result</button>}
                <button onClick={() => setShowViewModal(false)} className="inline-flex items-center px-3 py-2 bg-white border rounded-md text-sm">Close</button>
              </div>
            </div>

            {/* Principal comment section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Principal's comment</h4>
                <span className={`text-xs font-medium ${selectedResult.principalComment ? 'text-green-700' : 'text-gray-500'}`}>
                  {selectedResult.principalComment ? 'Added' : 'Not added'}
                </span>
              </div>
              <div className="p-3 rounded border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-800 whitespace-pre-wrap min-h-[56px]">
                {selectedResult.principalComment ? selectedResult.principalComment : <span className="text-gray-500">No principal comment yet.</span>}
              </div>
            </div>

            {/* Teacher comment at bottom (standard result preview) */}
            <div className="mt-4">
              <div className="text-sm text-gray-600 mb-1">Teacher's comment</div>
              <div className="p-3 rounded border border-gray-200 bg-white text-sm text-gray-800 whitespace-pre-wrap">
                {selectedResult.teacherComment ? selectedResult.teacherComment : <span className="text-gray-500">No teacher comment provided.</span>}
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Principal Comment Modal (uses shared Modal) */}
      <Modal
        open={showCommentModal && !!selectedResult}
        title={`Add Principal Comment${selectedResult ? ` — ${selectedResult.studentName}` : ''}`}
        onClose={() => setShowCommentModal(false)}
        maxWidth="sm:max-w-lg"
      >
        {selectedResult && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Student: <strong>{selectedResult.studentName}</strong> — {selectedResult.session} / {selectedResult.term}
            </p>
            <label htmlFor="principalComment" className="block text-sm font-medium text-gray-700">
              Comment
            </label>
            <textarea
              id="principalComment"
              rows={5}
              value={principalComment}
              onChange={e => setPrincipalComment(e.target.value)}
              className="mt-2 w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter principal's comment about the student's performance"
            />
            <div className="mt-4 grid grid-cols-1 gap-y-2 gap-x-3 sm:grid-cols-3">
              <button type="button" className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700" onClick={() => setPrincipalComment('Excellent performance. Keep up the good work!')}>
                Excellent
              </button>
              <button type="button" className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700" onClick={() => setPrincipalComment('Good performance. Keep working hard.')}>
                Good
              </button>
              <button type="button" className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-yellow-600 hover:bg-yellow-700" onClick={() => setPrincipalComment('Needs improvement. Work harder next term.')}>
                Needs Improvement
              </button>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button type="button" className="inline-flex justify-center rounded-md px-4 py-2 bg-blue-600 text-white text-sm font-medium" onClick={handleSaveComment}>
                Save Comment
              </button>
              <button type="button" className="inline-flex justify-center rounded-md px-4 py-2 bg-white border text-sm font-medium" onClick={() => setShowCommentModal(false)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Publish All Results Confirmation Modal (uses shared Modal) */}
      <Modal open={showPublishModal} title="Publish All Results" onClose={() => setShowPublishModal(false)} maxWidth="sm:max-w-lg">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckIcon className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">Publish All Results</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to publish all <strong>{pendingResultsCount}</strong> pending results? This action will make the results visible to students and parents.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="inline-flex justify-center rounded-md px-4 py-2 bg-green-600 text-white text-sm font-medium" onClick={handlePublishAllResults} disabled={publishingAll}>
            {publishingAll ? 'Publishing...' : 'Publish All'}
          </button>
          <button type="button" className="inline-flex justify-center rounded-md px-4 py-2 bg-white border text-sm font-medium" onClick={() => setShowPublishModal(false)} disabled={publishingAll}>
            Cancel
          </button>
        </div>
      </Modal>
    </DashboardLayout>;
};
export default ResultManagement;