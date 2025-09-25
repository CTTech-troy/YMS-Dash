import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";
import Swal from "sweetalert2";

const Login = () => {
  const [tab, setTab] = useState("staff"); // "staff" or "student"
  const [formData, setFormData] = useState({
    uid: "",
    password: "",
    studentId: "",
    pin: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
      if (!formData.studentId) errs.studentId = "Student ID is required";
      if (!formData.pin) errs.pin = "PIN is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((s) => ({ ...s, [name]: value }));
  };

  const togglePasswordVisibility = () => setShowPassword((s) => !s);

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
        if (typeof studentLogin !== "function") {
          toast.error("Authentication service not available.");
          return;
        }
        const res = await studentLogin(formData.studentId, formData.pin);
        if (res?.success) {
          toast.success(`Welcome ${res.user.name}`);
          // show sweetalert for student results coming soon
          if (Swal && typeof Swal.fire === "function") {
            Swal.fire({ title: "Result coming soon", icon: "info" });
          } else {
            alert("Result coming soon");
          }
        } else {
          toast.error(res?.message || "Login failed");
        }
      }
    } catch (err) {
      toast.error(err?.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

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
              {tab === "student" ? (
                <>
                  <div>
                    <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-1">
                      Student ID
                    </label>
                    <input
                      type="text"
                      id="studentId"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleChange}
                      placeholder="Enter your student ID"
                      className={`pl-3 pr-4 py-3 w-full rounded-lg border ${errors.studentId ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-green-500`}
                    />
                    {errors.studentId && <p className="mt-1 text-sm text-red-600">{errors.studentId}</p>}
                  </div>

                  <div>
                    <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-1">
                      PIN
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="pin"
                        name="pin"
                        value={formData.pin}
                        onChange={handleChange}
                        placeholder="Enter your PIN"
                        className={`pl-3 pr-12 py-3 w-full rounded-lg border ${errors.pin ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-green-500`}
                      />
                      <button type="button" onClick={togglePasswordVisibility} aria-label={showPassword ? "Hide PIN" : "Show PIN"} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {errors.pin && <p className="mt-1 text-sm text-red-600">{errors.pin}</p>}
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
                      <button type="button" onClick={togglePasswordVisibility} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                  </div>
                </>
              )}

              <button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg disabled:opacity-60">
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </form>

            {/* Info Text */}
            <div className="mt-6 text-center text-sm text-gray-600">
              <p>
                {tab === "student"
                  ? "Parents: Contact the school office if your child needs access credentials."
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
