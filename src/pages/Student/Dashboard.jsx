import React, { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { BookOpenIcon, ClipboardListIcon, CalendarIcon, CreditCardIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
// Sample data
const studentInfo = {
  id: 1,
  name: 'Alex Johnson',
  uid: 'YMS-001',
  class: 'Class 4B',
  subjects: ['Mathematics', 'Science', 'English', 'History', 'Art'],
  attendance: 92,
  fees: {
    total: 5000,
    paid: 4000,
    pending: 1000,
    dueDate: '2023-08-15'
  }
};
const upcomingEvents = [{
  id: 1,
  title: 'Math Quiz',
  date: '2023-07-15',
  type: 'exam'
}, {
  id: 2,
  title: 'Science Project Due',
  date: '2023-07-20',
  type: 'assignment'
}, {
  id: 3,
  title: 'School Sports Day',
  date: '2023-07-25',
  type: 'event'
}];
const recentActivities = [{
  id: 1,
  type: 'result',
  description: 'Term 1 results published',
  time: '2 days ago'
}, {
  id: 2,
  type: 'resource',
  description: 'New study material for Science uploaded',
  time: '1 week ago'
}, {
  id: 3,
  type: 'fee',
  description: 'Fee payment received',
  time: '2 weeks ago'
}];
const StudentDashboard = () => {
  const [showScratchCardModal, setShowScratchCardModal] = useState(false);
  const [scratchCardPin, setScratchCardPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showResults, setShowResults] = useState(false);
  // Mock function to validate scratch card
  const validateScratchCard = pin => {
    // This is a mock validation - in a real app, this would check against the database
    if (pin === '1234567890') {
      return true;
    }
    return false;
  };
  const handlePinSubmit = e => {
    e.preventDefault();
    setPinError('');
    if (scratchCardPin.length !== 10) {
      setPinError('PIN must be 10 digits');
      return;
    }
    if (validateScratchCard(scratchCardPin)) {
      setShowResults(true);
      setShowScratchCardModal(false);
    } else {
      setPinError('Invalid or already used PIN');
    }
  };
  return <DashboardLayout title="Student Dashboard">
      {/* Student Profile Card */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xl">
                {studentInfo.name.charAt(0)}
              </span>
            </div>
            <div className="ml-5">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {studentInfo.name}
              </h3>
              <p className="text-sm text-gray-500">
                Student ID: {studentInfo.uid} | Class: {studentInfo.class}
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Subjects</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {studentInfo.subjects.join(', ')}
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Attendance</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <div className="flex items-center">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${studentInfo.attendance >= 90 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {studentInfo.attendance}%
                  </span>
                </div>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Fee Status</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <div className="flex flex-col">
                  <div className="flex justify-between mb-1">
                    <span>Paid: ${studentInfo.fees.paid}</span>
                    <span>Pending: ${studentInfo.fees.pending}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{
                    width: `${studentInfo.fees.paid / studentInfo.fees.total * 100}%`
                  }}></div>
                  </div>
                  <div className="text-xs mt-1 text-gray-500">
                    Due date:{' '}
                    {new Date(studentInfo.fees.dueDate).toLocaleDateString()}
                  </div>
                </div>
              </dd>
            </div>
          </dl>
        </div>
      </div>
      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <button className="bg-white overflow-hidden shadow rounded-lg hover:bg-gray-50 p-4" onClick={() => setShowScratchCardModal(true)}>
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <CreditCardIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">
                  View Results
                </h3>
              </div>
            </div>
          </button>
          <button className="bg-white overflow-hidden shadow rounded-lg hover:bg-gray-50 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <ClipboardListIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">
                  Attendance Record
                </h3>
              </div>
            </div>
          </button>
          <button className="bg-white overflow-hidden shadow rounded-lg hover:bg-gray-50 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                <BookOpenIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">
                  Study Materials
                </h3>
              </div>
            </div>
          </button>
          <button className="bg-white overflow-hidden shadow rounded-lg hover:bg-gray-50 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                <div className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">Pay Fees</h3>
              </div>
            </div>
          </button>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Upcoming Events */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">
              Upcoming Events
            </h2>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {upcomingEvents.map(event => <li key={event.id} className="px-4 py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {event.type === 'exam' && <ClipboardListIcon className="h-6 w-6 text-red-500" />}
                      {event.type === 'assignment' && <BookOpenIcon className="h-6 w-6 text-blue-500" />}
                      {event.type === 'event' && <CalendarIcon className="h-6 w-6 text-green-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {event.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {new Date(event.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </li>)}
            </ul>
          </div>
        </div>
        {/* Recent Activities */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">
              Recent Activities
            </h2>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {recentActivities.map(activity => <li key={activity.id} className="px-4 py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {activity.type === 'result' && <ClipboardListIcon className="h-6 w-6 text-blue-500" />}
                      {activity.type === 'resource' && <BookOpenIcon className="h-6 w-6 text-purple-500" />}
                      {activity.type === 'fee' && <div className="h-6 w-6 text-green-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.description}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                </li>)}
            </ul>
          </div>
        </div>
      </div>
      {/* Results Section */}
      {showResults && <div className="mt-8">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">
                Term 1 Results (2023)
              </h2>
              <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Download PDF
              </button>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Test Score (30)
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exam Score (70)
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total (100)
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Mathematics
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      25
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      60
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      85
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        A
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Science
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      28
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      65
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      93
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        A+
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      English
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      22
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      58
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      80
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        A
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      History
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      20
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      52
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      72
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        B
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Art
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      27
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      65
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      92
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        A+
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-6 border-t border-gray-200 pt-6">
                <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 gap-x-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Total Score
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      422/500 (84.4%)
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Overall Grade
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">A</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-900">
                  Teacher's Comments
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Alex has shown excellent progress this term. Particularly
                  strong in Science and Art. Should focus more on History to
                  improve grades further. Keep up the good work!
                </p>
              </div>
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-900">
                  Principal's Comments
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Well done on your excellent results, Alex! You're showing
                  great academic potential.
                </p>
              </div>
            </div>
          </div>
        </div>}
      {/* Scratch Card Modal */}
      {showScratchCardModal && <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handlePinSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                      <CreditCardIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Enter Scratch Card PIN
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Please enter your 10-digit scratch card PIN to access
                          your results.
                        </p>
                        <div className="mt-4">
                          <input type="text" className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="Enter 10-digit PIN" value={scratchCardPin} onChange={e => setScratchCardPin(e.target.value)} maxLength={10} />
                          {pinError && <p className="mt-2 text-sm text-red-600">
                              {pinError}
                            </p>}
                          <p className="mt-2 text-xs text-gray-500">
                            For demo, use: 1234567890
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm">
                    Submit
                  </button>
                  <button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" onClick={() => setShowScratchCardModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>}
    </DashboardLayout>;
};
export default StudentDashboard;