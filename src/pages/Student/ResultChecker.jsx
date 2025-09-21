import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { toast } from 'sonner';

const sampleResults = [
  {
    student: {
      id: 1,
      name: 'Alex Johnson',
      uid: 'YMS-001',
      class: 'Class 4B',
      picture:
        'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
    },
    cardNumber: '1234567890', // make PIN match login demo
    session: '2022/2023',
    term: 'First Term',
    subjects: [
      { id: 1, name: 'Mathematics', firstTest: 25, secondTest: 18, thirdTest: 28, exam: 65, total: 136, percentage: 68, grade: 'B' },
      { id: 2, name: 'English Language', firstTest: 27, secondTest: 20, thirdTest: 25, exam: 70, total: 142, percentage: 71, grade: 'B' },
      { id: 3, name: 'Science', firstTest: 28, secondTest: 22, thirdTest: 29, exam: 75, total: 154, percentage: 77, grade: 'A' },
      { id: 4, name: 'Social Studies', firstTest: 26, secondTest: 19, thirdTest: 27, exam: 68, total: 140, percentage: 70, grade: 'B' }
    ],
    teacherComment: 'Alex is a diligent student. Needs to improve in some areas but shows great potential.',
    principalComment: 'Good performance. Keep working hard.',
    attendance: { present: 45, absent: 3, total: 48 }
  },
  {
    student: { id: 2, name: 'Emily Davis', uid: 'YMS-002', class: 'Class 4B', picture: '' },
    cardNumber: 'CARD-5678',
    session: '2022/2023',
    term: 'First Term',
    subjects: [
      { id: 1, name: 'Mathematics', firstTest: 20, secondTest: 18, thirdTest: 22, exam: 60, total: 120, percentage: 60, grade: 'C' },
      { id: 2, name: 'English', firstTest: 22, secondTest: 19, thirdTest: 24, exam: 65, total: 130, percentage: 65, grade: 'B' }
    ],
    teacherComment: 'Good effort.',
    principalComment: 'Encourage improvement.',
    attendance: { present: 46, absent: 2, total: 48 }
  }
];

const getGradeFromPercentage = percentage => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 75) return 'A';
  if (percentage >= 65) return 'B';
  if (percentage >= 55) return 'C';
  if (percentage >= 45) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
};

const calculateOverall = subjects => {
  if (!subjects || subjects.length === 0) return { percentage: 0, grade: 'F' };
  const total = subjects.reduce((s, sub) => s + (sub.percentage || 0), 0);
  const avg = total / subjects.length;
  return { percentage: parseFloat(avg.toFixed(1)), grade: getGradeFromPercentage(avg) };
};

const ResultChecker = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [studentId, setStudentId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [result, setResult] = useState(null);

  // auto-check when navigated with state from Login or fallback to sessionStorage
  useEffect(() => {
    let sid;
    let card;

    if (location?.state?.studentId && location.state.cardNumber) {
      sid = location.state.studentId;
      card = location.state.cardNumber;
    } else {
      const stored = sessionStorage.getItem('studentResultLookup');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          sid = parsed.studentId;
          card = parsed.cardNumber;
        } catch {
          // ignore parse errors
        }
      }
    }

    if (sid && card) {
      setStudentId(sid);
      setCardNumber(card);
      const found = sampleResults.find(
        r =>
          r.student.uid.toLowerCase() === sid.trim().toLowerCase() &&
          r.cardNumber.toLowerCase() === card.trim().toLowerCase()
      );
      if (found) {
        setResult(found);
        toast.success('Result loaded');
        sessionStorage.removeItem('studentResultLookup'); // cleanup
      } else {
        setResult(null);
        toast.error('No result found for provided Student ID / PIN');
      }
    }
  }, [location]);

  const handleCheck = e => {
    e.preventDefault();
    if (!studentId.trim() || !cardNumber.trim()) {
      toast.error('Please enter both Student ID and Card Number');
      return;
    }
    const found = sampleResults.find(
      r =>
        r.student.uid.toLowerCase() === studentId.trim().toLowerCase() &&
        r.cardNumber.toLowerCase() === cardNumber.trim().toLowerCase()
    );
    if (!found) {
      setResult(null);
      toast.error('No result found for that Student ID and Card Number');
      return;
    }
    setResult(found);
    toast.success('Result found');
  };

  const overall = result ? calculateOverall(result.subjects) : { percentage: 0, grade: 'F' };

  return (
    <DashboardLayout title="Result Checker">
      <div className="max-w-4xl mx-auto space-y-6">
        <form onSubmit={handleCheck} className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Enter Student Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Student ID</label>
              <input
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g. YMS-001"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Card Number</label>
              <input
                value={cardNumber}
                onChange={e => setCardNumber(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g. CARD-1234"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">
              Check Result
            </button>
          </div>
        </form>

        {result && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-blue-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Student Result Card</h2>
                <div className="text-sm text-gray-600">{result.session} - {result.term}</div>
              </div>
              <div className="flex items-center">
                <span className="h-5 w-5 text-gray-500 mr-2" aria-hidden>👤</span>
                <div className="text-sm text-gray-700">{currentUser?.name || result.student.name}</div>
              </div>
            </div>

            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-4">
              <div className="flex-shrink-0 h-16 w-16">
                {result.student.picture ? (
                  <img className="h-16 w-16 rounded-full object-cover" src={result.student.picture} alt="" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">No</div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">{result.student.name}</h3>
                <div className="text-sm text-gray-500">ID: {result.student.uid} • Class: {result.student.class}</div>
              </div>
            </div>

            <div className="px-6 py-4">
              <h4 className="text-base font-medium text-gray-900 mb-4">Subject Results</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">1st Test</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">2nd Test</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">3rd Test</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">%</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.subjects.map(subject => (
                      <tr key={subject.id}>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{subject.name}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.firstTest}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.secondTest}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.thirdTest}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{subject.exam}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{subject.total}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{subject.percentage.toFixed(1)}%</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            subject.grade === 'A+' || subject.grade === 'A'
                              ? 'bg-green-100 text-green-800'
                              : subject.grade === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : subject.grade === 'C'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>{subject.grade}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Overall Percentage</h4>
                <p className="mt-1 text-lg font-medium text-gray-900">{overall.percentage}%</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Overall Grade</h4>
                <p className="mt-1">
                  <span className={`px-2 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
                    overall.grade === 'A+' || overall.grade === 'A'
                      ? 'bg-green-100 text-green-800'
                      : overall.grade === 'B'
                      ? 'bg-blue-100 text-blue-800'
                      : overall.grade === 'C'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>{overall.grade}</span>
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Attendance</h4>
                <p className="mt-1 text-sm text-gray-900">
                  Present: {result.attendance.present}/{result.attendance.total} days (
                  {Math.round((result.attendance.present / result.attendance.total) * 100)}%)
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Teacher's Comment</h4>
                  <p className="mt-1 text-sm text-gray-900">{result.teacherComment}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Principal's Comment</h4>
                  <p className="mt-1 text-sm text-gray-900">{result.principalComment}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-green-50">
              <div className="flex items-center">
                <span className="h-5 w-5 text-green-500 mr-2" aria-hidden>✅</span>
                <span className="text-sm font-medium text-green-700">
                  This result has been verified and published by the school
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ResultChecker;