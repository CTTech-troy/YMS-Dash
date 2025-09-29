// src/pages/Teacher/Attendance.jsx
import React, { useState, useEffect } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { CheckIcon, XIcon, CalendarIcon, ClipboardListIcon } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Attendance = () => {
  const { currentUser } = useAuth(); // Logged-in teacher
  const [students, setStudents] = useState([]);
  const [showMarkAttendanceModal, setShowMarkAttendanceModal] = useState(false);
  const [showStudentHistoryModal, setShowStudentHistoryModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [attendance, setAttendance] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDateOption, setSelectedDateOption] = useState("today");
  const [teacherClass, setTeacherClass] = useState("");

  // ✅ Helper function (declare once only)
  const normalize = (str) => {
    if (str === null || str === undefined) return "";
    return String(str).toLowerCase().trim();
  };

  // Unified class normalizer (Unicode + trim + NBSP collapse + lower)
  const normalizeClass = (v) =>
    (v ?? "")
      .toString()
      .normalize("NFKC")        // unify unicode forms
      .replace(/\u00A0/g, " ") 
      .toLowerCase();

  // ✅ Fetch teacher info and students in assigned class
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        if (!currentUser) return;

        // 1) determine assigned class: prefer currentUser, then teacher record fallback
        let assignedClass = currentUser.assignedClass || currentUser.assignedClassName || localStorage.getItem('assignedClass') || "";
        try {
          const tRes = await axios.get(`${API_BASE}/api/teachers/${encodeURIComponent(currentUser.uid)}`);
          const tData = tRes.data;
          const teacher = Array.isArray(tData) ? tData[0] : tData;
          assignedClass = teacher?.assignedClass || teacher?.assignedClassName || teacher?.class || assignedClass;
        } catch (e) {
          // non-fatal: keep already-known assignedClass
          console.debug('Teacher fetch failed (using currentUser/local fallback):', e?.message);
        }
        setTeacherClass(assignedClass || "");

        // normalize assigned class once
        const assignedClassNorm = normalizeClass(assignedClass || "");

        // 2) fetch students (handle array or { students: [...] } shapes)
        const sRes = await axios.get(`${API_BASE}/api/students`);
        const raw = sRes.data;
        const studentsArray = Array.isArray(raw) ? raw : (Array.isArray(raw.students) ? raw.students : (Array.isArray(raw.data) ? raw.data : []));
        console.log('Raw students count:', studentsArray.length);

        // 3) map -> normalize fields like Classes.jsx, then filter by class using same normalizer
        const mapped = studentsArray.map(s => {
          const detectedClass = (s.class || s.studentClass || s.className || s.grade || s.classroom || "").toString();
          return {
            raw: s,
            id: s.id || s._id || s.uid || Math.random().toString(36).slice(2,9),
            name: s.name || s.fullName || s.studentName || 'Unnamed',
            uid: s.uid || s.studentUid || s.id || '',
            class: detectedClass,
            picture: s.picture || s.avatar || '/images/default-avatar.png',
            attendance: s.attendance || { present: 0, absent: 0, total: 0, history: [] }
          };
        });

        const filteredStudents = assignedClass
          ? mapped.filter(ms => normalizeClass(ms.class) === assignedClassNorm)
          : mapped;

        if (assignedClass && filteredStudents.length === 0) {
          console.warn(`No students matched assigned class "${assignedClass}"`);
          // helpful debug: show first few normalized classes
          console.debug('Sample student classes:', mapped.slice(0,8).map(m => ({ id: m.id, classRaw: m.class, classNorm: normalizeClass(m.class) })));
          toast.info(`No students found for ${assignedClass}`);
        }

        setStudents(filteredStudents);
      } catch (err) {
        console.error("Error fetching students for teacher:", err);
        toast.error("Failed to load students");
        setStudents([]);
      }
    };

    fetchStudents();
  }, [currentUser]);

  // helper: load attendance for current attendanceDate and populate `attendance` map
  const loadAttendanceForDate = async (dateStr) => {
    try {
      const map = {};
      if (!students || students.length === 0) {
        setAttendance({});
        return;
      }
      // query backend per student for that date (uses ?date=YYYY-MM-DD)
      const promises = students.map(async (s) => {
        const sid = s.id || s._id || s.uid;
        if (!sid) return;
        try {
          const res = await axios.get(`${API_BASE}/api/attendance/${encodeURIComponent(sid)}?date=${encodeURIComponent(dateStr)}`);
          const records = Array.isArray(res.data) ? res.data : [];
          // if record exists, set present/absent based on latest record.status
          if (records.length > 0) {
            const latest = records[0];
            map[sid] = latest.status === 'present';
          } else {
            // default to absent — teacher should mark present explicitly
            map[sid] = false;
          }
        } catch (err) {
          // treat 404 as no record
          if (err?.response?.status === 404) {
            map[sid] = false;
          } else {
            console.warn('Attendance fetch failed for id=', sid, err?.message || err);
            map[sid] = false; // fallback default absent
          }
        }
      });
      await Promise.all(promises);
      setAttendance(map);
    } catch (err) {
      console.error('Failed to load attendance for date', err);
    }
  };

  // ✅ Mark attendance modal
  // Initialize attendance when opening modal
  const handleOpenAttendanceModal = async () => {
    console.debug('Opening attendance modal, students count:', students.length);
    setSelectedDateOption('today');
    setAttendanceDate(new Date().toISOString().split("T")[0]);
    setShowMarkAttendanceModal(true);
    // wait a tick for attendanceDate state to be set then load
    const today = new Date().toISOString().split("T")[0];
    await loadAttendanceForDate(today);
  };

  const toggleAttendance = (studentId) => {
    setAttendance((prev) => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  // ✅ Handle date options
  const handleDateOptionChange = async (option) => {
    setSelectedDateOption(option);
    let date = new Date();
    if (option === "yesterday") date.setDate(date.getDate() - 1);
    if (option !== "custom") {
      const dStr = date.toISOString().split("T")[0];
      setAttendanceDate(dStr);
      if (showMarkAttendanceModal) {
        await loadAttendanceForDate(dStr);
      }
      return;
    }
    // custom will keep date input; user will change attendanceDate input — use effect to reload if needed
  };

  // when the custom date input changes, if modal open reload attendance map
  useEffect(() => {
    if (showMarkAttendanceModal && attendanceDate) {
      loadAttendanceForDate(attendanceDate);
    }
  }, [attendanceDate, showMarkAttendanceModal, students]);

  // ✅ Save attendance
  const handleSaveAttendance = async () => {
    try {
      // build list of student ids to save (use students list to ensure order / presence)
      const toSave = students.map(s => s.id || s._id || s.uid).filter(Boolean);
      if (toSave.length === 0) {
        console.warn('No students to save attendance for');
        return;
      }

      // get optional auth token if using protected backend
      let token = null;
      if (currentUser && typeof currentUser.getIdToken === 'function') {
        try { token = await currentUser.getIdToken(); } catch (e) { console.warn('Failed to get auth token', e); }
      }

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const datePayload = attendanceDate || new Date().toISOString().split('T')[0];

      const results = [];
      for (const sid of toSave) {
        const status = attendance[sid] ? 'present' : 'absent';
        try {
          const res = await axios.post(
            `${API_BASE}/api/attendance/mark/${encodeURIComponent(sid)}`,
            { status, date: datePayload },
            { headers }
          );
          results.push({ sid, ok: true, data: res.data });
        } catch (err) {
          // show full server response for debugging
          console.error('Failed to save attendance for', sid, {
            status: err.response?.status,
            data: err.response?.data,
            message: err.message,
          });
          results.push({ sid, ok: false, error: err.response?.data || err.message });
        }
      }

      console.debug('Attendance save results', results);
      // optionally check results for failures and show UI feedback
      const failed = results.filter(r => !r.ok);
      if (failed.length === 0) {
        // success
        setShowMarkAttendanceModal(false);
      } else {
        // keep modal open and surface an error
        alert(`Failed to save attendance for ${failed.length} student(s). Check console for details.`);
      }
    } catch (err) {
      console.error('handleSaveAttendance unexpected error', err);
      alert('Unexpected error saving attendance — check console.');
    }
  };

  // ✅ View student attendance history (defensive, normalize response)
  const handleViewStudentHistory = async (student) => {
    try {
      const candidates = Array.from(
        new Set([student.id, student._id, student.uid, student.raw?.id].filter(Boolean))
      );

      if (candidates.length === 0) {
        console.warn('Attempted to fetch attendance for student without id/uid', student);
        toast.error('Cannot fetch attendance: student id missing');
        return;
      }

      let lastError = null;
      for (const candidate of candidates) {
        try {
          console.debug('Requesting attendance for candidate id:', candidate);
          const res = await axios.get(
            `${API_BASE}/api/attendance/${encodeURIComponent(candidate)}${attendanceDate ? `?date=${encodeURIComponent(attendanceDate)}` : ''}`
          );
          const data = res.data;

          // Normalize response to an array of records
          let records = [];
          if (Array.isArray(data)) {
            records = data;
          } else if (Array.isArray(data.records)) {
            records = data.records;
          } else if (Array.isArray(data.attendance)) {
            records = data.attendance;
          } else if (data && data.error) {
            // backend responded with an error object — surface to user but do not assign it as attendance
            toast.error(data.error);
            records = [];
          } else if (data && typeof data === 'object') {
            // unexpected but safe: log and treat as empty
            console.debug('Unexpected attendance response shape:', data);
            records = [];
          }

          // produce a normalized attendance object expected by UI
          const attendanceObj = {
            present: records.reduce((acc, r) => acc + (r.status === 'present' ? 1 : 0), 0),
            total: records.length,
            absent: records.reduce((acc, r) => acc + (r.status === 'absent' ? 1 : 0), 0),
            history: records
          };

          setSelectedStudent({ ...student, attendance: attendanceObj });
          setShowStudentHistoryModal(true);
          return;
        } catch (err) {
          lastError = err;
          console.warn(`Attendance fetch failed for id=${candidate}`, err?.response?.data || err.message || err);
          // try next candidate
        }
      }

      console.error('All attendance lookups failed. Last error:', lastError);
      const serverMsg =
        lastError?.response?.data?.error ||
        lastError?.response?.data?.message ||
        lastError?.message;
      toast.error(serverMsg || 'Failed to fetch attendance history (see console)');
    } catch (err) {
      console.error('Unexpected error fetching attendance:', err);
      toast.error('Failed to fetch attendance history (unexpected error)');
    }
  };

  // ✅ Search filter applied on already class-filtered students
  const q = normalize(searchQuery);
  const filteredStudents = students.filter(
    (student) =>
      normalize(student.name).includes(q) ||
      normalize(student.uid).includes(q)
  );


  return (
    <DashboardLayout title="Attendance Management">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Student Attendance
        </h1>
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={handleOpenAttendanceModal}
        >
          <ClipboardListIcon className="h-5 w-5 mr-2" />
          Mark Today's Attendance
        </button>
      </div>

      {/* Search and Info */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="w-full sm:w-96">
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                id="search"
                name="search"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search by name or ID"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex space-x-4">
            <div className="text-sm text-gray-700">
              <span className="font-medium">Class:</span> {teacherClass || "Loading..."}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Total Students:</span>{/* fixed: show count only */}
              {" "}{students.length}
            </div>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Students</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {filteredStudents.map((student) => {
            const sid = student.id || student._id || student.uid;
            return (
            <li key={sid} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <img
                      className="h-10 w-10 rounded-full"
                      src={student.picture || "/images/default-avatar.png"}
                      alt=""
                    />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {student.name}
                    </div>
                    <div className="text-sm text-gray-500">{student.uid}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Attendance Rate:</span>{" "}
                    {Math.round(
                      (student.attendance?.present || 0) /
                        (student.attendance?.total || 1) *
                        100
                    )}
                    %
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {student.attendance?.present || 0} /{" "}
                      {student.attendance?.total || 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleViewStudentHistory(student)}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    History
                  </button>
                </div>
              </div>
            </li>
          );
          })}
          {filteredStudents.length === 0 && (
            <li className="px-6 py-4 text-center text-gray-500">
              No students found matching your search.
            </li>
          )}
        </ul>
      </div>

      {/* Mark Attendance Modal */}
      {showMarkAttendanceModal && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    {/* Backdrop */}
    <div className="fixed inset-0 bg-gray-700/60" aria-hidden="true"></div>
    {/* Panel */}
    <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-h-[90vh]">
       <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
         <div className="sm:flex sm:items-start">
           <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
             <h3 className="text-lg leading-6 font-semibold text-gray-900">
               Mark Attendance - {teacherClass || "N/A"}
             </h3>
             <div className="mt-4">
               <label className="block text-sm font-semibold text-gray-700 mb-2">
                 Select Date
               </label>
               <div className="flex flex-wrap gap-2 mb-4">
                 {["today", "yesterday", "custom"].map((option) => (
                   <button
                     key={option}
                     type="button"
                     onClick={() => handleDateOptionChange(option)}
                     className={`px-3 py-1.5 text-sm font-semibold rounded-md ${
                       selectedDateOption === option
                         ? "bg-blue-100 text-blue-800 border border-blue-300"
                         : "bg-gray-100 text-gray-800 border border-gray-300"
                     }`}
                   >
                     {option.charAt(0).toUpperCase() + option.slice(1)}
                   </button>
                 ))}
               </div>
               {selectedDateOption === "custom" && (
                 <input
                   type="date"
                   id="attendanceDate"
                   value={attendanceDate}
                   onChange={(e) => setAttendanceDate(e.target.value)}
                   className="mt-1 mb-4 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md font-semibold"
                 />
               )}
               <div className="text-sm font-medium text-gray-800 mb-4">
                 Marking attendance for:{" "}
                 <span className="font-semibold">
                   {selectedDateOption === "today"
                     ? "Today"
                     : selectedDateOption === "yesterday"
                     ? "Yesterday"
                     : new Date(attendanceDate).toLocaleDateString("en-US", {
                         weekday: "long",
                         year: "numeric",
                         month: "long",
                         day: "numeric",
                       })}
                 </span>
               </div>
             </div>
             <div className="mt-4">
               <h4 className="text-sm font-semibold text-gray-700 mb-2">Students</h4>
               <ul className="divide-y divide-gray-200 max-h-[45vh] overflow-y-auto">
                 {students.map((student) => {
                   const sid = student.id || student._id || student.uid;
                   return (
                     <li key={sid} className="py-3 flex items-center justify-between">
                       <div className="flex items-center">
                         <div className="flex-shrink-0 h-8 w-8">
                           <img
                             className="h-8 w-8 rounded-full"
                             src={student.picture || "/images/default-avatar.png"}
                             alt=""
                           />
                         </div>
                         <div className="ml-3">
                           <p className="text-sm font-semibold text-gray-900">{student.name}</p>
                           <p className="text-sm font-medium text-gray-700">{student.uid}</p>
                         </div>
                       </div>
                       <div>
                         <button
                           type="button"
                           onClick={() => toggleAttendance(sid)}
                           className={`inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white ${
                             attendance[sid]
                               ? "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                               : "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                           } focus:outline-none focus:ring-2 focus:ring-offset-2`}
                         >
                           {attendance[sid] ? (
                             <CheckIcon className="h-5 w-5" aria-hidden="true" />
                           ) : (
                             <XIcon className="h-5 w-5" aria-hidden="true" />
                           )}
                         </button>
                         <span className="ml-2 text-sm font-medium text-gray-700">
                           {attendance[sid] ? "Present" : "Absent"}
                         </span>
                       </div>
                     </li>
                   );
                 })}
               </ul>
             </div>
           </div>
         </div>
       </div>
       <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
         <button
           type="button"
           className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
           onClick={handleSaveAttendance}
         >
           Save Attendance
         </button>
         <button
           type="button"
           className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
           onClick={() => setShowMarkAttendanceModal(false)}
         >
           Cancel
         </button>
       </div>
     </div>
  </div>
)}

      {/* Student Attendance History Modal */}
      {showStudentHistoryModal && selectedStudent && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    {/* Backdrop */}
    <div className="fixed inset-0 bg-gray-700/60" aria-hidden="true"></div>

    {/* Panel */}
    <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg overflow-hidden shadow-xl transform transition-all max-h-[90vh]">
      <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
        <div className="sm:flex sm:items-start">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10">
            <img
              src={selectedStudent.picture || "/images/default-avatar.png"}
              alt={selectedStudent.name}
              className="h-10 w-10 rounded-full"
            />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {selectedStudent.name} - Attendance History
            </h3>
            <div className="mt-2">
              <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                {(() => {
                  // normalize different shapes: array, { history: [] }, { attendance: [] }
                  const records = Array.isArray(selectedStudent.attendance)
                    ? selectedStudent.attendance
                    : Array.isArray(selectedStudent.attendance?.history)
                    ? selectedStudent.attendance.history
                    : Array.isArray(selectedStudent.attendance?.attendance)
                    ? selectedStudent.attendance.attendance
                    : [];

                  if (records.length === 0) {
                    return (
                      <li className="py-2 text-gray-500 text-center">
                        No attendance records found
                      </li>
                    );
                  }

                  return records.map((record, idx) => {
                    const key = record.id || record._id || `${record.date || idx}-${record.status || 'unknown'}`;
                    const dateStr = record.date ? new Date(record.date).toLocaleDateString() : 'Unknown date';
                    const status = (record.status || '').toString().toLowerCase();
                    return (
                      <li key={key} className="py-2 flex justify-between items-center">
                        <span>{dateStr}</span>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            status === "present" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {status || 'unknown'}
                        </span>
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
        <button
          type="button"
          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
          onClick={() => setShowStudentHistoryModal(false)}
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}
    </DashboardLayout>
  );
};

export default Attendance;
