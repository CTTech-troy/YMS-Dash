import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";

const Login = () => {
  const [uid, setUid] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState("staff"); // toggle between staff/student
  const navigate = useNavigate();
  const { login, studentLogin } = useAuth();

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    const res = await login(uid, password);
    if (res.success) {
      toast.success(`Welcome ${res.user.name}`);
      if (res.user.role === "admin") navigate("/admin");
      else if (res.user.role === "teacher") navigate("/teacher");
      else toast.error("Unauthorized role");
    } else {
      toast.error(res.message);
    }
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    const res = await studentLogin(studentId, pin);
    if (res.success) {
      toast.success(`Welcome ${res.user.name}`);
      navigate("/student/results");
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white shadow p-6 rounded">
        <h2 className="text-xl font-bold text-center mb-4">
          {tab === "staff" ? "Staff Login" : "Student Login"}
        </h2>

        <div className="flex justify-center gap-4 mb-6">
          <button
            className={`px-4 py-2 rounded ${tab === "staff" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
            onClick={() => setTab("staff")}
          >
            Staff
          </button>
          <button
            className={`px-4 py-2 rounded ${tab === "student" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
            onClick={() => setTab("student")}
          >
            Student
          </button>
        </div>

        {tab === "staff" ? (
          <form onSubmit={handleStaffLogin}>
            <input
              type="text"
              placeholder="Staff UID"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              className="w-full p-2 border rounded mb-3"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded mb-3"
              required
            />
            <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded">
              Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleStudentLogin}>
            <input
              type="text"
              placeholder="Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full p-2 border rounded mb-3"
              required
            />
            <input
              type="password"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full p-2 border rounded mb-3"
              required
            />
            <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded">
              Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
