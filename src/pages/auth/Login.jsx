import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";
import Swal from "sweetalert2";
import StudentDashboard from "../../pages/Student/StudentDashboard";

const API_BASE = import.meta.env.VITE_API_URL || 'https://yms-backend-a2x4.onrender.com';

const Login = () => {
  const [tab, setTab] = useState("staff"); // "staff" or "student"
  const [formData, setFormData] = useState({
    uid: "",
    password: "",
    studentUid: "",
    studentPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [studentDashboardData, setStudentDashboardData] = useState(null);
  const [studentPreview, setStudentPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // defensively get auth and avoid destructuring from null
  const auth = useAuth();
  const login = auth?.login;
  const studentLogin = auth?.studentLogin;

  const validate = () => {
    const errs = {};
    if (tab === "staff") {
      if (!formData.uid) errs.uid = "UID is required";
      if (!formData.password) errs.password = "Password is required";
    } else {
      if (!formData.studentUid) errs.studentUid = "Student UID is required";
      if (!formData.studentPassword) errs.studentPassword = "Password is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((s) => ({ ...s, [name]: value }));
  };

  const togglePasswordVisibility = () => setShowPassword((s) => !s);

  // ========================================
  // HELPER: Normalize student UID
  // ========================================
  const normalizeUid = (uid) => {
    return uid.trim().replace(/\s+/g, '');
  };

  // Fetch a preview of student info from results API when UID is provided (on blur)
  const fetchStudentPreview = async (rawUid) => {
    const normalizedUid = normalizeUid(rawUid || '');
    if (!normalizedUid) {
      setStudentPreview(null);
      return;
    }

    setPreviewLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'https://yms-backend-a2x4.onrender.com';
      const resp = await fetch(`${API_BASE}/api/results?studentUid=${encodeURIComponent(normalizedUid)}`);
      if (!resp.ok) {
        setStudentPreview(null);
        return;
      }
      const data = await resp.json().catch(() => null);
      const results = Array.isArray(data) ? data : (data?.data || data?.results || []);
      if (!results || results.length === 0) {
        setStudentPreview(null);
        return;
      }

      const first = results[0];
      const preview = {
        uid: normalizedUid,
        name: (first?.studentName || first?.studentname || first?.name || 'Unknown').trim(),
        class: (first?.studentClass || first?.studentclass || first?.class || 'N/A').trim(),
        session: first?.session || first?.academicSession || null,
        term: first?.term || first?.academicTerm || null,
      };
      setStudentPreview(preview);
    } catch (e) {
      console.error('Preview fetch failed', e);
      setStudentPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      if (tab === "staff") {
        if (typeof login !== "function") {
          toast.error("Authentication service not available.");
          return;
        }
        const res = await login(formData.uid, formData.password);
        if (res?.success) {
          toast.success(`Welcome ${res.user.name}`);
          // external redirects for admin/teacher
          if (res.user.role === "admin") {
            window.location.href = "/admin";
            return;
          } else if (res.user.role === "teacher") {
            window.location.href = "/teacher";
            return;
          } else {
            toast.error("Unauthorized role");
          }
        } else {
          toast.error(res?.message || "Login failed");
        }
      } else {
        // Student login flow:
        // 1) Normalize student UID
        // 2) Fetch results from API
        // 3) Extract student data
        // 4) Validate password
        // 5) Login and display dashboard

        try {
          const normalizedUid = normalizeUid(formData.studentUid);
          console.log('=== STUDENT LOGIN PROCESS STARTED ===');
          console.log('Normalized UID:', normalizedUid);

          // ========================================
          // STEP 1: Fetch results first to get student data
          // ========================================
          console.log(`STEP 1: Fetching results from ${API_BASE}/api/results?studentUid=${normalizedUid}`);
          
          let resultsResp;
          try {
            resultsResp = await fetch(
              `${API_BASE}/api/results?studentUid=${encodeURIComponent(normalizedUid)}`
            );
            console.log('Results API Response Status:', resultsResp.status, resultsResp.statusText);
          } catch (fetchError) {
            console.error('Network error while fetching results:', fetchError);
            toast.error(`Network error: ${fetchError.message}`);
            return;
          }

          if (!resultsResp.ok) {
            const errorText = await resultsResp.text().catch(() => 'No error details');
            console.error('Results API Error Response:', {
              status: resultsResp.status,
              statusText: resultsResp.statusText,
              body: errorText
            });
            toast.error(`Failed to fetch results (HTTP ${resultsResp.status}). Check console for details.`);
            return;
          }

          let resultsData;
          try {
            resultsData = await resultsResp.json();
            console.log('Results API Response Data:', resultsData);
          } catch (parseError) {
            console.error('Error parsing results JSON:', parseError);
            toast.error('Invalid response from results API');
            return;
          }

          const rawResults = Array.isArray(resultsData) 
            ? resultsData 
            : (resultsData.data || resultsData.results || []);

          // Normalize each result record to canonical keys we use in the UI/state
          const normalizedResults = rawResults.map(r => ({
            // identity
            studentName: (r.studentName || r.studentname || r.name || r.fullName || r.student || 'Unknown').trim(),
            studentClass: (r.studentClass || r.studentclass || r.class || 'N/A').trim(),
            studentUid: r.studentUid || r.studentuid || r.uid || null,
            studentId: r.studentId || r.studentid || r.id || null,
            // comments & meta
            teacherComment: r.teacherComment || r.teacher_comment || r.comment || r.teacherRemark || null,
            principalComment: r.principalComment || r.principal_comment || null,
            teacherUid: r.teacherUid || r.teacher_uid || r.teacher || null,
            // commentStatus: try to preserve truthy meaning for strings like 'true'/'yes'
            commentStatus: (() => {
              const v = r.commentStatus ?? r.comment_status ?? r.commentsAvailable;
              if (typeof v === 'boolean') return v;
              if (typeof v === 'string') return ['true','yes','1'].includes(v.toLowerCase());
              return Boolean(v);
            })(),
            // published: keep as 'yes'/'no' strings so UI matches backend values
            published: (() => {
              const v = r.published ?? (r.isPublished === true ? 'yes' : (r.isPublished === false ? 'no' : undefined));
              if (typeof v === 'boolean') return v ? 'yes' : 'no';
              if (typeof v === 'string') return ['yes','true','1'].includes(v.toLowerCase()) ? 'yes' : 'no';
              return r.published || (r.isPublished ? 'yes' : 'no');
            })(),
            createdAt: r.createdAt || r.created_at || r.created || null,
            publishedAt: r.publishedAt || r.published_at || r.publishedAt || null,
            session: r.session || r.academicSession || null,
            term: r.term || r.academicTerm || null,
            subjects: r.subjects || r.subject_list || r.subjectsArray || [],
            // keep original payload for any other fields
            ...r,
          }));

          const results = normalizedResults;

          console.log('Parsed Results:', {
            isArray: Array.isArray(resultsData),
            resultsCount: results.length,
            firstResult: results[0] ? {
              studentName: results[0]?.studentName,
              studentClass: results[0]?.studentClass,
              studentUid: results[0]?.studentUid,
              session: results[0]?.session,
              term: results[0]?.term
            } : null
          });

          if (!results || results.length === 0) {
            console.warn('No results found for UID:', normalizedUid);
            toast.error("No results found for this UID. Please verify your UID is correct.");
            return;
          }

          console.log('✓ Results fetched successfully:', results.length, 'result(s) found');

          // ========================================
          // STEP 2: Extract student data from results API
          // ========================================
          console.log('STEP 2: Extracting student data from results');
          
          const first = results[0];
          const studentData = {
            uid: first?.studentUid || normalizedUid,
            studentUid: first?.studentUid || normalizedUid,
            studentId: first?.studentId || first?.id || null,
            name: (first?.studentName || 'Unknown').trim(),
             studentName: (first?.studentName || 'Unknown').trim(),
            class: (first?.studentClass || 'N/A').trim(),
             studentClass: (first?.studentClass || 'N/A').trim(),
            session: first?.session || null,
            term: first?.term || null,
            picture: first?.studentPhoto || '/images/default-avatar.png',
            fees: first?.fees || { total: 0, paid: 0, pending: 0 },
            // include common meta so dashboard receives API data
            commentStatus: first?.commentStatus,
            createdAt: first?.createdAt,
            principalComment: first?.principalComment,
            published: first?.published,
            publishedAt: first?.publishedAt,
            teacherComment: first?.teacherComment,
            teacherUid: first?.teacherUid,
          };

          console.log('✓ Student data extracted:', studentData);

          // ========================================
          // STEP 3: Validate password
          // ========================================
          console.log('STEP 3: Validating password');
          
          if (!formData.studentPassword) {
            console.warn('Password field is empty');
            toast.error('Password is required');
            return;
          }

          if (formData.studentPassword !== 'student123') {
            console.warn('Password validation failed for UID:', normalizedUid);
            toast.error("Invalid password. Default password is 'student123'");
            return;
          }

          console.log('✓ Password validated successfully');

          // ========================================
          // STEP 4: Login student using context
          // ========================================
          console.log('STEP 4: Logging in student via AuthContext');
          
          if (typeof studentLogin !== "function") {
            console.error('studentLogin function not available');
            toast.error("Authentication service not available");
            return;
          }

          const loginResult = await studentLogin(normalizedUid, formData.studentPassword, studentData);
          console.log('Login Result:', loginResult);

          if (!loginResult?.success) {
            console.error('Student login failed:', loginResult?.message);
            toast.error(loginResult?.message || "Login failed");
            return;
          }

          console.log('✓ Student logged in successfully');

          // ========================================
          // STEP 5: Prepare dashboard data
          // ========================================
          console.log('STEP 5: Preparing dashboard data');
          
          const updatedStudentData = {
            ...studentData,
            uid: first?.studentUid || normalizedUid,
            studentUid: first?.studentUid || normalizedUid,
            name: (first?.studentName || 'Unknown').trim(),
            studentName: (first?.studentName || 'Unknown').trim(),
            class: (first?.studentClass || 'N/A').trim(),
            studentClass: (first?.studentClass || 'N/A').trim(),
            picture: first?.studentPhoto || '/images/default-avatar.png',
          };

          const dashboardData = {
            student: updatedStudentData,
            allResults: results,
          };

          console.log('✓ Dashboard data prepared:', {
            studentName: updatedStudentData.name,
            studentClass: updatedStudentData.class,
            totalResults: results.length
          });

          console.log('=== LOGGED IN STUDENT DETAILS ===');
          console.log('Name:', updatedStudentData.name);
          console.log('UID:', updatedStudentData.studentUid);
          console.log('Class:', updatedStudentData.class);
          console.log('Full student data:', updatedStudentData);
          console.log('==============================');

          setStudentDashboardData(dashboardData);
          try {
            const storageKey = `yms_student_dashboard_${first?.studentUid || normalizedUid}`;
            localStorage.setItem(storageKey, JSON.stringify(dashboardData));
          } catch (err) {
            console.error('Failed to persist student dashboard data', err);
          }
          
          console.log('=== STUDENT LOGIN PROCESS COMPLETED SUCCESSFULLY ===');
          toast.success(`Welcome ${updatedStudentData.name || 'Student'}!`);
        } catch (outerErr) {
          console.error('=== STUDENT LOGIN PROCESS FAILED ===');
          console.error('Error Type:', outerErr.constructor.name);
          console.error('Error Message:', outerErr.message);
          console.error('Error Stack:', outerErr.stack);
          console.error('Full Error:', outerErr);
          
          toast.error(outerErr?.message || "An unexpected error occurred. Check browser console for details.");
        }
      }
    } catch (err) {
      toast.error(err?.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================
  // HANDLERS: StudentDashboard actions
  // ========================================
  const handleDashboardLogout = () => {
    try {
      const uid = studentDashboardData?.student?.uid || studentDashboardData?.student?.studentUid;
      if (uid) {
        const storageKey = `yms_student_dashboard_${uid}`;
        localStorage.removeItem(storageKey);
      }
    } catch (e) {
      console.error('Failed to remove persisted dashboard data', e);
    }
    setStudentDashboardData(null);
    setFormData({ uid: "", password: "", studentUid: "", studentPassword: "" });
  };

  // Restore persisted student dashboard state (if any) when component mounts
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('schoolUser');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.role === 'student' && parsed.uid) {
          const storageKey = `yms_student_dashboard_${parsed.uid}`;
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const parsedDashboard = JSON.parse(saved);
            if (parsedDashboard) setStudentDashboardData(parsedDashboard);
          }
        }
      }
    } catch (err) {
      console.error('Failed to restore persisted dashboard state', err);
    }
  }, []);

  // Show StudentDashboard if data exists
  if (studentDashboardData) {
    return (
      <StudentDashboard
        student={studentDashboardData.student}
        results={studentDashboardData.allResults}
        onLogout={handleDashboardLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Main */}
      <main className="flex-grow flex items-center justify-center p-4 w-full">
        <div className="flex w-full max-w-7xl rounded-lg shadow-lg overflow-hidden bg-white">
          <div className="hidden md:block md:w-1/2 flex-shrink-0 overflow-hidden">
            <img
              src="https://i.pinimg.com/736x/79/a1/bb/79a1bb0767ecbeb4a3d8157455c14d2c.jpg"
              alt="School"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Right Side Form */}
          <div className="w-full md:w-1/2 py-12 px-8 md:px-12">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <Lock size={48} className="text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-800">Results Portal</h1>
              <p className="mt-2 text-gray-600">Access your academic records and performance metrics</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                className={`flex-1 py-2 text-center font-medium ${
                  tab === "student" ? "text-green-700 border-b-2 border-green-700" : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => {
                  setTab("student");
                  setErrors({});
                }}
                type="button"
              >
                Student Login
              </button>
              <button
                className={`flex-1 py-2 text-center font-medium ${
                  tab === "staff" ? "text-green-700 border-b-2 border-green-700" : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => {
                  setTab("staff");
                  setErrors({});
                }}
                type="button"
              >
                Staff Login
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Preview box */}
                    {previewLoading && (
                      <p className="mt-2 text-sm text-gray-500">Checking UID...</p>
                    )}
                    {studentPreview && !previewLoading && (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded">
                        <p className="text-sm text-gray-600">Found student</p>
                        <p className="font-medium text-gray-900">{studentPreview.name}</p>
                        <p className="text-xs text-gray-600">Class: {studentPreview.class} • UID: {studentPreview.uid}</p>
                        {studentPreview.session && <p className="text-xs text-gray-500 mt-1">Session: {studentPreview.session} • Term: {studentPreview.term || 'N/A'}</p>}
                      </div>
                    )}
              {tab === "student" ? (
                <>
                  <div>
                    <label htmlFor="studentUid" className="block text-sm font-medium text-gray-700 mb-1">
                      Student UID
                    </label>
                    <input
                      type="text"
                      id="studentUid"
                      name="studentUid"
                      value={formData.studentUid}
                      onChange={(e) => {
                        // keep raw input but normalize on blur/preview
                        handleChange(e);
                      }}
                      onBlur={(e) => {
                        const normalized = normalizeUid(e.target.value || '');
                        // update field with normalized value for consistency
                        setFormData(s => ({ ...s, studentUid: normalized }));
                        // fetch preview info
                        fetchStudentPreview(normalized);
                      }}
                      placeholder="Enter your student UID"
                      className={`pl-3 pr-4 py-3 w-full rounded-lg border ${errors.studentUid ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-green-500`}
                    />
                    {errors.studentUid && <p className="mt-1 text-sm text-red-600">{errors.studentUid}</p>}

                    
                  </div>

                  <div>
                    <label htmlFor="studentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="studentPassword"
                        name="studentPassword"
                        value={formData.studentPassword}
                        onChange={handleChange}
                        placeholder="Enter your password"
                        className={`pl-3 pr-12 py-3 w-full rounded-lg border ${errors.studentPassword ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-green-500`}
                      />
                      <button 
                        type="button" 
                        onClick={togglePasswordVisibility} 
                        aria-label={showPassword ? "Hide password" : "Show password"} 
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {errors.studentPassword && <p className="mt-1 text-sm text-red-600">{errors.studentPassword}</p>}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="uid" className="block text-sm font-medium text-gray-700 mb-1">
                      UID
                    </label>
                    <input
                      type="text"
                      id="uid"
                      name="uid"
                      value={formData.uid}
                      onChange={handleChange}
                      placeholder="Enter your UID"
                      className={`pl-3 pr-4 py-3 w-full rounded-lg border ${errors.uid ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-green-500`}
                    />
                    {errors.uid && <p className="mt-1 text-sm text-red-600">{errors.uid}</p>}
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter your password"
                        className={`pl-3 pr-12 py-3 w-full rounded-lg border ${errors.password ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-green-500`}
                      />
                      <button 
                        type="button" 
                        onClick={togglePasswordVisibility} 
                        aria-label={showPassword ? "Hide password" : "Show password"} 
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                  </div>
                </>
              )}

              <button 
                type="submit" 
                disabled={isLoading} 
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg disabled:opacity-60"
              >
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </form>

            {/* Info Text */}
            <div className="mt-6 text-center text-sm text-gray-600">
              <p>
                {tab === "student"
                  ? "Enter your UID to view your academic results and performance. Initial password: student123"
                  : "Staff: Contact the IT department if you need assistance with your account."}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;