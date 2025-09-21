// src/pages/Admin/ResultManagement.jsx
import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { EyeIcon, CheckIcon, XIcon, MessageCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
// Sample results data
const initialResults = [{
  id: 1,
  studentName: 'Alex Johnson',
  studentId: 'YMS-001',
  class: 'Class 4B',
  session: '2022/2023',
  term: 'First Term',
  subjects: [{
    id: 1,
    name: 'Mathematics',
    firstTest: 25,
    secondTest: 18,
    thirdTest: 28,
    exam: 65,
    total: 136,
    percentage: 68,
    grade: 'B'
  }, {
    id: 2,
    name: 'English Language',
    firstTest: 27,
    secondTest: 20,
    thirdTest: 25,
    exam: 70,
    total: 142,
    percentage: 71,
    grade: 'B'
  }, {
    id: 3,
    name: 'Science',
    firstTest: 28,
    secondTest: 22,
    thirdTest: 29,
    exam: 75,
    total: 154,
    percentage: 77,
    grade: 'A'
  }, {
    id: 4,
    name: 'Social Studies',
    firstTest: 26,
    secondTest: 19,
    thirdTest: 27,
    exam: 68,
    total: 140,
    percentage: 70,
    grade: 'B'
  }],
  teacherComment: 'Alex is a diligent student. Needs to improve in some areas but shows great potential.',
  principalComment: 'Good performance. Keep working hard.',
  status: 'published',
  lastUpdated: '2023-06-15',
  picture: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
}, {
  id: 2,
  studentName: 'Sarah Brown',
  studentId: 'YMS-004',
  class: 'Class 3A',
  session: '2022/2023',
  term: 'First Term',
  subjects: [{
    id: 1,
    name: 'Mathematics',
    firstTest: 22,
    secondTest: 15,
    thirdTest: 20,
    exam: 60,
    total: 117,
    percentage: 58.5,
    grade: 'C'
  }, {
    id: 2,
    name: 'English Language',
    firstTest: 24,
    secondTest: 18,
    thirdTest: 22,
    exam: 65,
    total: 129,
    percentage: 64.5,
    grade: 'C'
  }],
  teacherComment: 'Sarah needs to work harder on her Mathematics.',
  principalComment: '',
  status: 'pending',
  lastUpdated: '2023-06-14',
  picture: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
}, {
  id: 3,
  studentName: 'Emily Davis',
  studentId: 'YMS-002',
  class: 'Class 5A',
  session: '2022/2023',
  term: 'First Term',
  subjects: [{
    id: 1,
    name: 'Mathematics',
    firstTest: 28,
    secondTest: 25,
    thirdTest: 29,
    exam: 80,
    total: 162,
    percentage: 81,
    grade: 'A'
  }, {
    id: 2,
    name: 'English Language',
    firstTest: 27,
    secondTest: 26,
    thirdTest: 28,
    exam: 85,
    total: 166,
    percentage: 83,
    grade: 'A'
  }],
  teacherComment: 'Emily is an excellent student with consistent performance.',
  principalComment: 'Outstanding performance. Keep it up!',
  status: 'published',
  lastUpdated: '2023-06-15',
  picture: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
}, {
  id: 4,
  studentName: 'Michael Wilson',
  studentId: 'YMS-003',
  class: 'Class 5A',
  session: '2022/2023',
  term: 'First Term',
  subjects: [{
    id: 1,
    name: 'Mathematics',
    firstTest: 29,
    secondTest: 28,
    thirdTest: 30,
    exam: 90,
    total: 177,
    percentage: 88.5,
    grade: 'A'
  }, {
    id: 2,
    name: 'English Language',
    firstTest: 26,
    secondTest: 25,
    thirdTest: 27,
    exam: 85,
    total: 163,
    percentage: 81.5,
    grade: 'A'
  }],
  teacherComment: 'Michael shows exceptional abilities in Mathematics.',
  principalComment: '',
  status: 'pending',
  lastUpdated: '2023-06-13',
  picture: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
}];
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

const ResultManagement = () => {
  const [results, setResults] = useState(initialResults);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [teacherResultsEnabled, setTeacherResultsEnabled] = useState(true);
  const [principalComment, setPrincipalComment] = useState('');
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
  const handleSaveComment = () => {
    if (!selectedResult) return;
    const updatedResults = results.map(result => {
      if (result.id === selectedResult.id) {
        return {
          ...result,
          principalComment: principalComment
        };
      }
      return result;
    });
    setResults(updatedResults);
    setShowCommentModal(false);
    toast.success('Principal comment added successfully!');
  };
  // Publish a single result
  const handlePublishResult = id => {
    const updatedResults = results.map(result => {
      if (result.id === id) {
        return {
          ...result,
          status: 'published'
        };
      }
      return result;
    });
    setResults(updatedResults);
    toast.success('Result published successfully!');
  };
  // Publish all pending results
  const handlePublishAllResults = () => {
    const updatedResults = results.map(result => {
      if (result.status === 'pending') {
        return {
          ...result,
          status: 'published'
        };
      }
      return result;
    });
    setResults(updatedResults);
    setShowPublishModal(false);
    toast.success('All pending results published successfully!');
  };
  // Toggle teacher results access
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
    const matchesSearch = result.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || result.studentId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = filterClass ? result.class === filterClass : true;
    const matchesStatus = filterStatus ? result.status === filterStatus : true;
    return matchesSearch && matchesClass && matchesStatus;
  });
  // Get unique classes for filter
  const classes = [...new Set(results.map(result => result.class))];
  // Count pending results
  const pendingResultsCount = results.filter(result => result.status === 'pending').length;
  // Calculate overall grade for a result
  const calculateOverallGrade = subjects => {
    if (subjects.length === 0) return {
      percentage: 0,
      grade: 'F'
    };
    const totalPercentage = subjects.reduce((sum, subject) => sum + subject.percentage, 0);
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
  return <DashboardLayout title="Result Management">
      {/* Header with Add Result button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Student Results
        </h1>
        <div className="flex space-x-3">
          <button type="button" onClick={() => setShowPublishModal(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500" disabled={pendingResultsCount === 0}>
            <CheckIcon className="h-5 w-5 mr-2" />
            Publish All Results ({pendingResultsCount})
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
              return <tr key={result.id}>
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
                      <button onClick={() => handleViewResult(result)} className="text-blue-600 hover:text-blue-900 mr-3">
                        <EyeIcon className="h-5 w-5" />
                      </button>
                      <button onClick={() => handleOpenCommentModal(result)} className="text-green-600 hover:text-green-900 mr-3">
                        <MessageCircleIcon className="h-5 w-5" />
                      </button>
                      {result.status === 'pending' && <button onClick={() => handlePublishResult(result.id)} className="text-green-600 hover:text-green-900">
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
      <Modal open={showViewModal && !!selectedResult} title="Result Card" onClose={() => setShowViewModal(false)}>
        {selectedResult && (
          <>
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-sm text-gray-500">Student</div>
                <div className="text-lg font-medium text-gray-900">{selectedResult.studentName}</div>
                <div className="text-sm text-gray-500">{selectedResult.studentId}</div>
              </div>
              <div className="text-right">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${selectedResult.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {selectedResult.status === 'published' ? 'Published' : 'Pending'}
                </span>
              </div>
            </div>

            {/* Subjects table */}
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
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">%</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedResult.subjects.map((subject, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">{subject.name}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{subject.firstTest}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{subject.secondTest}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{subject.thirdTest}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{subject.exam}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{subject.total}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{(subject.percentage || 0).toFixed(1)}%</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${subject.grade === 'A+' || subject.grade === 'A' ? 'bg-green-100 text-green-800' : subject.grade === 'B' ? 'bg-blue-100 text-blue-800' : subject.grade === 'C' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {subject.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary and actions */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div className="flex items-end justify-end space-x-2">
                <button onClick={() => handleOpenCommentModal(selectedResult)} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Add Principal Comment</button>
                {selectedResult.status === 'pending' && <button onClick={() => { handlePublishResult(selectedResult.id); setShowViewModal(false); }} className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-md text-sm">Publish Result</button>}
                <button onClick={() => setShowViewModal(false)} className="inline-flex items-center px-3 py-2 bg-white border rounded-md text-sm">Close</button>
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
          <button type="button" className="inline-flex justify-center rounded-md px-4 py-2 bg-green-600 text-white text-sm font-medium" onClick={handlePublishAllResults}>
            Publish All
          </button>
          <button type="button" className="inline-flex justify-center rounded-md px-4 py-2 bg-white border text-sm font-medium" onClick={() => setShowPublishModal(false)}>
            Cancel
          </button>
        </div>
      </Modal>
    </DashboardLayout>;
};
export default ResultManagement;