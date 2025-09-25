import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/auth/Login';
import AdminRegister from './pages/auth/admin';
import AdminDashboard from './pages/Admin/Dashboard';
import TeacherDashboard from './pages/Teacher/Dashboard';
import TeacherManagement from './pages/Admin/TeacherManagement';
import StudentManagement from './pages/Admin/StudentManagement';
import SubjectManagement from './pages/Admin/SubjectManagement';
import ResultManagement from './pages/Admin/ResultManagement';
import ScratchCardManagement from './pages/Admin/ScratchCardManagement';
import ClassAssignment from './pages/Admin/ClassAssignment';
import TeacherClasses from './pages/Teacher/Classes';
import TeacherResults from './pages/Teacher/Results';
import Attendance from './pages/Teacher/Attendance';
import TeacherProfile from './pages/Teacher/Profile';
import ResultChecker from './pages/Student/ResultChecker';
import { Toaster } from 'sonner';
// Protected route component that checks user authentication and role
const ProtectedRoute = ({
  children,
  allowedRoles
}) => {
  const {
    currentUser,
    userRole
  } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on role
    if (userRole === 'admin') return <Navigate to="/admin" />;
    if (userRole === 'teacher') return <Navigate to="/teacher" />;
    if (userRole === 'student') return <Navigate to="/student/results" />;
    return <Navigate to="/login" />;
  }
  return children;
};
function App() {
  return <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin/register" element={<AdminRegister />} />
          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>} />
          <Route path="/admin/teachers" element={<ProtectedRoute allowedRoles={['admin']}>
                <TeacherManagement />
              </ProtectedRoute>} />
          <Route path="/admin/students" element={<ProtectedRoute allowedRoles={['admin']}>
                <StudentManagement />
              </ProtectedRoute>} />
          <Route path="/admin/subjects" element={<ProtectedRoute allowedRoles={['admin']}>
                <SubjectManagement />
              </ProtectedRoute>} />
          <Route path="/admin/results" element={<ProtectedRoute allowedRoles={['admin']}>
                <ResultManagement />
              </ProtectedRoute>} />
          <Route path="/admin/scratch-cards" element={<ProtectedRoute allowedRoles={['admin']}>
                <ScratchCardManagement />
              </ProtectedRoute>} />
          <Route path="/admin/class-assignment" element={<ProtectedRoute allowedRoles={['admin']}>
                <ClassAssignment />
              </ProtectedRoute>} />
          {/* Teacher Routes */}
          <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher']}>
                <TeacherDashboard />
              </ProtectedRoute>} />
          <Route path="/teacher/classes" element={<ProtectedRoute allowedRoles={['teacher']}>
                <TeacherClasses />
              </ProtectedRoute>} />
          <Route path="/teacher/results" element={<ProtectedRoute allowedRoles={['teacher']}>
                <TeacherResults />
              </ProtectedRoute>} />
          <Route path="/teacher/attendance" element={<ProtectedRoute allowedRoles={['teacher']}>
                <Attendance />
              </ProtectedRoute>} />
          <Route path="/teacher/profile" element={<ProtectedRoute allowedRoles={['teacher']}>
                <TeacherProfile />
              </ProtectedRoute>} />
          {/* Student Routes */}
          <Route path="/student/results" element={<ProtectedRoute allowedRoles={['student']}>
                <ResultChecker />
              </ProtectedRoute>} />
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/student" element={<Navigate to="/student/results" />} />
        </Routes>
      </Router>
    </AuthProvider>;
}
export default App;