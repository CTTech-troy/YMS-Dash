/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useState, createContext, useContext } from "react";
import { db } from "../../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import bcrypt from "bcryptjs";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  // Removed unused isOffline state

  // Load saved user from localStorage
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Optional: make Firestore use long polling (helps behind some proxies/firewalls)
        try {
          const { getFirestore } = await import('firebase/firestore');
          const db = getFirestore();
          if (db && typeof db.settings === 'function') {
            db.settings({ experimentalForceLongPolling: true });
          }
        } catch {
          // ignore if modular import or settings not available
        }

        // Attempt to read user from live backend (Firestore / auth) if configured
        // If network is flaky this may throw (Firestore timeout); catch below.
        const saved = localStorage.getItem('schoolUser');
        if (saved && mounted) {
          try {
            const parsed = JSON.parse(saved);
            setCurrentUser(parsed);
            setUserRole(parsed?.role ?? null);
          } catch {
            // ignore parse errors
          }
        }

        // If you also do a realtime check against Firestore here, wrap it:
        // Example:
        // try { await someFirestoreCheck(); } catch(e) { throw e; }

        if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        // Firestore network/timeouts often surface as 'Could not reach Cloud Firestore backend' or code 'unavailable'
        console.warn('[AuthContext] Firestore connectivity issue:', err?.message || err);
        if (mounted) {
          setLoading(false);
          // keep any cached user loaded above; surface a small message to the user
          try { toast.info('Offline: unable to reach auth backend — running from cache.'); } catch (_) {}
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  /**
   * Staff login (Admin or Teacher)
   */
  const login = async (uid, password) => {
    try {
      // 🔹 1. Check Admins (using adminUid)
      const adminsRef = collection(db, "admins");
      const adminQ = query(adminsRef, where("adminUid", "==", uid));
      const adminSnap = await getDocs(adminQ);

      if (!adminSnap.empty) {
        const adminDoc = adminSnap.docs[0];
        const adminData = adminDoc.data();

        // password check
        if (adminData.passwordHash) {
          const passwordMatch = await bcrypt.compare(password, adminData.passwordHash);
          if (!passwordMatch) return { success: false, message: "Incorrect password" };
        } else if (adminData.password) {
          if (password !== adminData.password) return { success: false, message: "Incorrect password" };
        }

        const loggedInAdmin = {
          id: adminDoc.id,
          name: adminData.name,
          uid: adminData.adminUid,
          role: "admin",
          avatar: adminData.picture || null,
        };

        setCurrentUser(loggedInAdmin);
        setUserRole("admin");
        localStorage.setItem("schoolUser", JSON.stringify(loggedInAdmin));
        return { success: true, user: loggedInAdmin };
      }

      // 🔹 2. Check Teachers (using uid)
      const teachersRef = collection(db, "teachers");
      const teacherQ = query(teachersRef, where("uid", "==", uid));
      const teacherSnap = await getDocs(teacherQ);

      if (!teacherSnap.empty) {
        const teacherDoc = teacherSnap.docs[0];
        const teacherData = teacherDoc.data();

        // Prevent disabled teachers from logging in
        if (teacherData.status && String(teacherData.status).toLowerCase() === 'inactive') {
          return { success: false, message: 'Your account has been disabled. Contact the admin.' };
        }

        if (teacherData.passwordHash) {
          const passwordMatch = await bcrypt.compare(password, teacherData.passwordHash);
          if (!passwordMatch) return { success: false, message: "Incorrect password" };
        } else if (teacherData.password) {
          if (password !== teacherData.password) return { success: false, message: "Incorrect password" };
        }

        const loggedInTeacher = {
          id: teacherDoc.id,
          name: teacherData.name,
          uid: teacherData.uid,
          role: teacherData.role || "teacher",
          avatar: teacherData.avatar || null,
        };

        setCurrentUser(loggedInTeacher);
        setUserRole("teacher");
        localStorage.setItem("schoolUser", JSON.stringify(loggedInTeacher));
        return { success: true, user: loggedInTeacher };
      }

      // If not found
      return { success: false, message: "UID not found" };
    } catch (err) {
      console.error("Login error:", err);
      return { success: false, message: "Failed to login. Try again." };
    }
  };

  /**
   * Student login (studentId + pin)
   */
  const studentLogin = async (studentId, pin) => {
    try {
      const studentsRef = collection(db, "students");
      const q = query(studentsRef, where("studentId", "==", studentId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const studentDoc = snapshot.docs[0];
        const studentData = studentDoc.data();

        if (studentData.pinHash) {
          const pinMatch = await bcrypt.compare(pin, studentData.pinHash);
          if (!pinMatch) return { success: false, message: "Invalid PIN" };
        } else if (studentData.pin) {
          if (studentData.pin !== pin) return { success: false, message: "Invalid PIN" };
        }

        const loggedInStudent = {
          id: studentDoc.id,
          name: studentData.name,
          studentId: studentData.studentId,
          role: "student",
          class: studentData.class || null,
        };

        setCurrentUser(loggedInStudent);
        setUserRole("student");
        localStorage.setItem("schoolUser", JSON.stringify(loggedInStudent));
        return { success: true, user: loggedInStudent };
      }

      return { success: false, message: "Student not found" };
    } catch (err) {
      console.error("Student login error:", err);
      return { success: false, message: "Failed to login. Try again." };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setUserRole(null);
    localStorage.removeItem("schoolUser");
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userRole,
        login,
        studentLogin,
        logout,
        loading,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
