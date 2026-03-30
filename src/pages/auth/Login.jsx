import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import {
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  Search,
  ArrowRight,
  KeyRound,
  Ticket,
  Loader2,
  ShieldCheck,
  UserRound
} from "lucide-react";
import StudentDashboard from "../../pages/Student/StudentDashboard";
import { API_BASE } from "../../config/api.js";
import { Button } from "../../components/ui/Button";
import { Label, TextInput } from "../../components/ui/Field";
import {
  fetchPortalSettings,
  lookupStudentByNumber,
  loginStudentPassword,
  loginStudentScratch
} from "../../api/portalApi.js";

function pictureToSrc(p) {
  if (!p) return "/images/default-avatar.png";
  if (typeof p === "string") return p.startsWith("data:") || p.startsWith("http") ? p : "/images/default-avatar.png";
  if (p && p.mime && p.data) return `data:${p.mime};base64,${p.data}`;
  return "/images/default-avatar.png";
}

async function fetchNormalizedResults(studentUid) {
  const resultsResp = await fetch(
    `${API_BASE}/api/results?studentUid=${encodeURIComponent(studentUid)}`
  );
  if (!resultsResp.ok) return [];
  const resultsData = await resultsResp.json().catch(() => null);
  const rawResults = Array.isArray(resultsData)
    ? resultsData
    : resultsData?.data || resultsData?.results || [];
  return rawResults.map((r) => ({
    studentName: (r.studentName || r.name || r.fullName || "Unknown").trim(),
    studentClass: (r.studentClass || r.class || "N/A").trim(),
    studentUid: r.studentUid || r.studentuid || r.uid || null,
    studentId: r.studentId || r.id || null,
    teacherComment: r.teacherComment || r.comment || null,
    principalComment: r.principalComment || null,
    commentStatus: r.commentStatus,
    published: r.published,
    createdAt: r.createdAt || r.created_at,
    session: r.session || r.academicSession,
    term: r.term,
    subjects: Array.isArray(r.subjects) ? r.subjects : [],
    ...r
  }));
}

const Login = () => {
  const [tab, setTab] = useState("staff");
  const [formData, setFormData] = useState({
    uid: "",
    password: "",
    studentNumber: "",
    studentPassword: "",
    scratchPin: ""
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [studentDashboardData, setStudentDashboardData] = useState(null);
  const [portalSettings, setPortalSettings] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [verifiedStudent, setVerifiedStudent] = useState(null);

  const auth = useAuth();
  const login = auth?.login;
  const studentLogin = auth?.studentLogin;

  useEffect(() => {
    if (tab !== "student") return;
    let cancelled = false;
    (async () => {
      const s = await fetchPortalSettings();
      if (!cancelled) setPortalSettings(s);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const validateStaff = () => {
    const errs = {};
    if (!formData.uid) errs.uid = "UID is required";
    if (!formData.password) errs.password = "Password is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((s) => ({ ...s, [name]: value }));
  };

  const togglePasswordVisibility = () => setShowPassword((s) => !s);

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    if (!validateStaff()) return;
    setIsLoading(true);
    try {
      if (typeof login !== "function") {
        toast.error("Authentication service not available.");
        return;
      }
      const res = await login(formData.uid, formData.password);
      if (res?.success) {
        toast.success(`Welcome ${res.user.name}`);
        if (res.user.role === "admin") {
          window.location.href = "/admin";
          return;
        }
        if (res.user.role === "teacher") {
          window.location.href = "/teacher";
          return;
        }
        toast.error("Unauthorized role");
      } else {
        toast.error(res?.message || "Login failed");
      }
    } catch (err) {
      toast.error(err?.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const resetStudentFlow = useCallback(() => {
    setVerifiedStudent(null);
    setFormData((s) => ({ ...s, studentPassword: "", scratchPin: "" }));
    setErrors({});
  }, []);

  const handleLookupStudent = async () => {
    const num = String(formData.studentNumber || "").trim();
    if (!num) {
      toast.error("Enter your student number");
      return;
    }
    setLookupLoading(true);
    setVerifiedStudent(null);
    try {
      const res = await lookupStudentByNumber(num);
      if (!res.success || !res.student) {
        toast.error(res.message || "Student record not found");
        return;
      }
      setVerifiedStudent(res.student);
      toast.success("Student found");
    } catch {
      toast.error("Could not verify student. Try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const buildDashboardPayload = async (apiStudent) => {
    const uid = apiStudent.uid;
    const results = await fetchNormalizedResults(uid);
    const picture = pictureToSrc(apiStudent.picture);
    const studentData = {
      uid,
      studentUid: uid,
      studentId: apiStudent.id,
      name: apiStudent.name || uid,
      studentName: apiStudent.name || uid,
      class: apiStudent.class || "—",
      studentClass: apiStudent.class || "—",
      linNumber: apiStudent.linNumber || "",
      picture,
      fees: { total: 0, paid: 0, pending: 0 }
    };
    return { student: studentData, allResults: results };
  };

  const finalizeStudentSession = async (apiStudent) => {
    if (typeof studentLogin !== "function") {
      toast.error("Authentication service not available");
      return;
    }
    const picture = pictureToSrc(apiStudent.picture);
    const sessionPayload = {
      id: apiStudent.id,
      uid: apiStudent.uid,
      name: apiStudent.name,
      class: apiStudent.class,
      linNumber: apiStudent.linNumber,
      picture
    };
    const loginResult = studentLogin(sessionPayload);
    if (!loginResult?.success) {
      toast.error(loginResult?.message || "Login failed");
      return;
    }
    const dashboardData = await buildDashboardPayload(apiStudent);
    setStudentDashboardData(dashboardData);
    try {
      const storageKey = `yms_student_dashboard_${apiStudent.uid}`;
      localStorage.setItem(storageKey, JSON.stringify(dashboardData));
    } catch {
      /* ignore */
    }
    toast.success(`Welcome ${apiStudent.name || "Student"}!`);
  };

  const handlePasswordAuth = async (e) => {
    e.preventDefault();
    if (!verifiedStudent) return;
    const pw = formData.studentPassword;
    if (!pw) {
      toast.error("Enter your password");
      return;
    }
    setIsLoading(true);
    try {
      const num = String(formData.studentNumber).trim();
      const res = await loginStudentPassword(num, pw);
      if (!res.success) {
        toast.error(res.message || "Incorrect password");
        return;
      }
      await finalizeStudentSession(res.student);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScratchAuth = async (e) => {
    e.preventDefault();
    if (!verifiedStudent) return;
    const pin = formData.scratchPin;
    if (!pin || !String(pin).trim()) {
      toast.error("Enter your scratch card PIN");
      return;
    }
    setIsLoading(true);
    try {
      const num = String(formData.studentNumber).trim();
      const res = await loginStudentScratch(num, pin);
      if (!res.success) {
        toast.error(res.message || "Could not sign in");
        return;
      }
      await finalizeStudentSession(res.student);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("schoolUser");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.role === "student" && parsed.uid) {
          const storageKey = `yms_student_dashboard_${parsed.uid}`;
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const parsedDashboard = JSON.parse(saved);
            if (parsedDashboard) setStudentDashboardData(parsedDashboard);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleDashboardLogout = () => {
    try {
      const uid =
        studentDashboardData?.student?.uid || studentDashboardData?.student?.studentUid;
      if (uid) {
        localStorage.removeItem(`yms_student_dashboard_${uid}`);
      }
    } catch {
      /* ignore */
    }
    setStudentDashboardData(null);
    resetStudentFlow();
    setFormData((s) => ({ ...s, studentNumber: "", studentPassword: "", scratchPin: "" }));
    auth?.logout?.();
  };

  const mode = portalSettings?.studentResultAccessMode || "both";
  const scratchEnabled = portalSettings?.scratchCardLoginEnabled !== false;
  const showPasswordOption =
    mode === "password_only" || mode === "both";
  const showScratchOption =
    scratchEnabled && (mode === "scratch_only" || mode === "both");

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
    <div className="app-shell flex min-h-screen flex-col">
      <main className="flex w-full flex-1 items-center justify-center p-4 sm:p-6">
        <div className="flex w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-float)]">
          <div className="relative hidden min-h-[520px] flex-1 shrink-0 overflow-hidden md:block md:max-w-[46%]">
            <img
              src="https://i.pinimg.com/736x/79/a1/bb/79a1bb0767ecbeb4a3d8157455c14d2c.jpg"
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/80 via-indigo-900/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
              <p className="text-sm font-medium text-indigo-100">Yetland Management</p>
              <p className="mt-1 text-lg font-semibold leading-snug">Sign in to the school portal</p>
            </div>
          </div>

          <div className="flex w-full flex-1 flex-col justify-center px-6 py-10 sm:px-10 md:px-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 text-center md:text-left">
                <div className="mb-4 flex justify-center md:justify-start">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                    <Lock className="h-6 w-6" aria-hidden />
                  </span>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Results portal
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Access academic records and staff tools.
                </p>
              </div>

              <div className="mb-6 flex rounded-xl bg-slate-100/90 p-1">
                <button
                  className={`flex-1 rounded-lg py-2.5 text-center text-sm font-medium transition ${
                    tab === "student" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                  onClick={() => {
                    setTab("student");
                    setErrors({});
                  }}
                  type="button"
                >
                  Student
                </button>
                <button
                  className={`flex-1 rounded-lg py-2.5 text-center text-sm font-medium transition ${
                    tab === "staff" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                  onClick={() => {
                    setTab("staff");
                    setErrors({});
                  }}
                  type="button"
                >
                  Staff
                </button>
              </div>

              {tab === "staff" ? (
                <form onSubmit={handleStaffSubmit} className="space-y-5">
                  <div>
                    <Label htmlFor="uid">Staff UID</Label>
                    <TextInput
                      type="text"
                      id="uid"
                      name="uid"
                      value={formData.uid}
                      onChange={handleChange}
                      placeholder="Enter your UID"
                      className={errors.uid ? "border-rose-400" : ""}
                      autoComplete="username"
                    />
                    {errors.uid && <p className="mt-1 text-sm text-rose-600">{errors.uid}</p>}
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <TextInput
                        type={showPassword ? "text" : "password"}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter your password"
                        className={`pr-11 ${errors.password ? "border-rose-400" : ""}`}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-sm text-rose-600">{errors.password}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              ) : (
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="studentNumber">Student number</Label>
                    <TextInput
                      id="studentNumber"
                      name="studentNumber"
                      value={formData.studentNumber}
                      onChange={(e) => {
                        handleChange(e);
                        setVerifiedStudent(null);
                      }}
                      placeholder="School ID / LIN / registration number"
                      disabled={!!verifiedStudent}
                      autoComplete="username"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Use the number issued by your school (same as on your ID card).
                    </p>
                  </div>

                  {!verifiedStudent ? (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={handleLookupStudent}
                      disabled={lookupLoading || !String(formData.studentNumber).trim()}
                    >
                      {lookupLoading ? "Checking…" : "Continue"}
                    </Button>
                  ) : (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Your profile
                        </p>
                        <div className="mt-3 flex gap-3">
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-200">
                            <img
                              src={pictureToSrc(verifiedStudent.picture)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900">{verifiedStudent.name}</p>
                            <p className="text-sm text-slate-600">
                              Class: {verifiedStudent.class || "—"}
                            </p>
                            <p className="text-xs text-slate-500">
                              No.: {verifiedStudent.uid}
                              {verifiedStudent.linNumber ? ` · LIN: ${verifiedStudent.linNumber}` : ""}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                          onClick={resetStudentFlow}
                        >
                          Not you? Change student number
                        </button>
                      </div>

                      {showPasswordOption && (
                        <form onSubmit={handlePasswordAuth} className="space-y-3 rounded-xl border border-slate-100 p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                            <UserRound className="h-4 w-4 text-slate-500" />
                            Password login
                          </div>
                          <div className="relative">
                            <TextInput
                              type={showPassword ? "text" : "password"}
                              name="studentPassword"
                              value={formData.studentPassword}
                              onChange={handleChange}
                              placeholder="School portal password"
                              className="pr-11"
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              onClick={togglePasswordVisibility}
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
                              aria-label="Toggle password"
                            >
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500">
                            Use the same password the school gave you for all students (set under Admin → Portal access).
                          </p>
                          <Button type="submit" className="w-full" variant="secondary" disabled={isLoading}>
                            {isLoading ? "Signing in…" : "Sign in with password"}
                          </Button>
                        </form>
                      )}

                      {showScratchOption && (
                        <form onSubmit={handleScratchAuth} className="space-y-3 rounded-xl border border-slate-100 p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                            <GraduationCap className="h-4 w-4 text-slate-500" />
                            Scratch card login
                          </div>
                          <TextInput
                            name="scratchPin"
                            value={formData.scratchPin}
                            onChange={handleChange}
                            placeholder="Scratch card PIN"
                            autoComplete="off"
                          />
                          <Button type="submit" className="w-full" variant="secondary" disabled={isLoading}>
                            {isLoading ? "Signing in…" : "Sign in with scratch card"}
                          </Button>
                        </form>
                      )}

                      {!showPasswordOption && !showScratchOption && (
                        <p className="text-sm text-amber-800">
                          Result login is not available. Please contact the school.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="mt-6 text-center text-sm text-slate-500 md:text-left">
                <p>
                  {tab === "student"
                    ? "Enter your student number to find your record, then sign in with the method your school enabled."
                    : "Staff: Contact the IT department if you need assistance with your account."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
