import React, { useState } from "react";
import { auth, db, storage } from "../../../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDocs, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AdminDashboard from "../Admin/Dashboard";

const AdminRegister = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const generateStaffUid = async () => {
    const year = new Date().getFullYear().toString().slice(-2); // e.g. "25"
    const snapshot = await getDocs(collection(db, "admins"));
    const seq = String(snapshot.size + 1).padStart(2, "0");
    return `YMS-AD-${year}${seq}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // create auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      const staffUid = await generateStaffUid();

      // upload profile image
      let profileImageUrl = "";
      if (file) {
        const storageRef = ref(storage, `admins/${user.uid}/profile.jpg`);
        await uploadBytes(storageRef, file);
        profileImageUrl = await getDownloadURL(storageRef);
      }

      // save to Firestore
      await setDoc(doc(db, "admins", user.uid), {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        staffUid,
        profileImageUrl,
        createdAt: new Date(),
      });

      toast.success(`Admin created successfully: ${staffUid}`);
      // show the admin dashboard immediately after successful creation
      setCreated(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // If account was created, render admin dashboard immediately
  if (created) {
    return <AdminDashboard />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-2xl shadow-md w-96"
      >
        <h2 className="text-xl font-bold mb-4 text-center">
          Register New Admin
        </h2>

        <input
          type="text"
          name="name"
          placeholder="Full Name"
          className="w-full p-2 mb-3 border rounded"
          onChange={handleChange}
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          className="w-full p-2 mb-3 border rounded"
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="phoneNumber"
          placeholder="Phone Number"
          className="w-full p-2 mb-3 border rounded"
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          className="w-full p-2 mb-3 border rounded"
          onChange={handleChange}
          required
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0])}
          className="w-full p-2 mb-3 border rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </form>
    </div>
  );
};

export default AdminRegister;
