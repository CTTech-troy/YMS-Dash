import React, { useEffect, useRef, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { UserIcon, MailIcon, PhoneIcon, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || " https://yms-backend-a2x4.onrender.com";

const TeacherProfile = () => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [teacherId, setTeacherId] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [pictureFile, setPictureFile] = useState(null);
  const [originalData, setOriginalData] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    qualifications: "",
    stateOfOrigin: "",
    schoolAttended: "",
    yearsOfExperience: "",
    address: "",
    nextOfKin: "",
    nextOfKinPhone: "",
    relationship: "",
    assignedClass: "",
    uid: "",
    pictureSrc: "",
  });

  const [pwdForm, setPwdForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const normalize = (data) => {
      const picture = data.picture ?? data.profilePicture ?? data.pictureSrc ?? "";
      return {
        name: data.fullName ?? data.name ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        dob: data.dob ?? data.dateOfBirth ?? "",
        qualifications: data.qualifications ?? "",
        stateOfOrigin: data.stateOfOrigin ?? data.state ?? "",
        schoolAttended: data.schoolAttended ?? data.school ?? "",
        yearsOfExperience: data.yearsOfExperience ?? data.experience ?? "",
        address: data.address ?? "",
        nextOfKin: data.nextOfKin ?? data.emergencyContact ?? "",
        nextOfKinPhone: data.nextOfKinPhone ?? data.emergencyPhone ?? "",
        relationship: data.relationship ?? "",
        assignedClass: data.assignedClass ?? data.assignedClassName ?? "",
        uid: data.uid ?? data.staffId ?? "",
        pictureSrc: picture,
      };
    };

    const fetchProfile = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const uid = encodeURIComponent(currentUser.uid || currentUser.id || "");
        let res = await fetch(`${API_BASE}/api/teachers/${uid}`);
        let data = null;
        if (res.ok) {
          data = await res.json();
          if (Array.isArray(data) && data.length) data = data[0];
        } else {
          res = await fetch(`${API_BASE}/api/teachers`);
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) {
              data = list.find(
                (t) =>
                  ((t.uid ?? t.staffId ?? "") + "").toLowerCase() ===
                  ((currentUser.uid ?? "") + "").toLowerCase()
              );
            }
          }
        }

        if (!data) {
          toast.error("Teacher profile not found");
          setLoading(false);
          return;
        }

        const normalized = normalize(data);
        setFormData(normalized);
        setOriginalData(normalized);
        setAvatarPreview(normalized.pictureSrc || "");
        setTeacherId(data.id ?? data._id ?? null);
      } catch (err) {
        console.error("fetchProfile error", err);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser]);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    const val = type === "number" ? (value === "" ? "" : Number(value)) : value;
    setFormData((p) => ({ ...p, [name]: val }));
  };

  const handlePictureChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPictureFile(f);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!teacherId) {
      toast.error("Missing teacher id");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", formData.name || "");
      fd.append("fullName", formData.name || "");
      fd.append("email", formData.email || "");
      fd.append("phone", formData.phone || "");
      fd.append("dob", formData.dob || "");
      fd.append("qualifications", formData.qualifications || "");
      fd.append("stateOfOrigin", formData.stateOfOrigin || "");
      fd.append("schoolAttended", formData.schoolAttended || "");
      fd.append("yearsOfExperience", formData.yearsOfExperience ?? "");
      fd.append("address", formData.address || "");
      fd.append("nextOfKin", formData.nextOfKin || "");
      fd.append("nextOfKinPhone", formData.nextOfKinPhone || "");
      fd.append("relationship", formData.relationship || "");
      fd.append("assignedClass", formData.assignedClass || "");
      if (pictureFile) {
        fd.append("picture", pictureFile);
      }

      const res = await fetch(`${API_BASE}/api/teachers/${encodeURIComponent(teacherId)}`, {
        method: "PUT",
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Failed to update profile");
      } else {
        const updated = await res.json().catch(() => ({}));
        const merged = { ...formData, ...updated };
        setFormData(merged);
        setOriginalData(merged);
        setIsEditing(false);
        toast.success("Profile updated");
      }
    } catch (err) {
      console.error("update error", err);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    if (originalData) {
      setFormData(originalData);
      setAvatarPreview(originalData.pictureSrc || "");
      setPictureFile(null);
    }
    setIsEditing(false);
  };

  const handleChangePassword = async (e) => {
    e?.preventDefault();
    if (!teacherId) {
      toast.error("Missing teacher id");
      return;
    }
    if (!pwdForm.oldPassword || !pwdForm.newPassword) {
      toast.error("Enter both old and new password");
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      // Step 1: Change password through auth route
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: formData.uid || currentUser?.uid,
          oldPassword: pwdForm.oldPassword,
          newPassword: pwdForm.newPassword,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Failed to change password");
        return;
      }

      // Step 2: Update teacher profile with new "initialPassword"
      try {
        const putRes = await fetch(`${API_BASE}/api/teachers/${encodeURIComponent(teacherId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initialPassword: pwdForm.newPassword }),
        });

        if (putRes.ok) {
          const updated = await putRes.json().catch(() => ({}));
          // merge returned update into form state if present
          const merged = { ...formData, ...(updated || {}) };
          setFormData(merged);
          setOriginalData(merged);
        } else {
          // non-critical: backend didn't accept initialPassword update
          const err = await putRes.json().catch(() => ({}));
          console.warn("Failed to update teacher initialPassword:", err);
        }
      } catch (err) {
        console.error("Failed to PUT initialPassword", err);
      }

      toast.success("Password changed successfully");
      setShowChangePwd(false);
      setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error("change pwd error", err);
      toast.error("Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      title="My Profile"
      userProfile={{ name: formData.name, email: formData.email, pictureSrc: avatarPreview || formData.pictureSrc }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-blue-50">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Teacher Profile</h2>
              {!isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowChangePwd((s) => !s)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-blue-700 bg-white hover:bg-blue-50"
                  >
                    Change Password
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Edit Profile
                  </button>
                </div>
              )}
            </div>
          </div>

          {showChangePwd && (
            <form onSubmit={handleChangePassword} className="px-6 py-4 border-b">
              <h3 className="text-md font-medium text-gray-900 mb-3">Change Password</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="password"
                  placeholder="Old password"
                  value={pwdForm.oldPassword}
                  onChange={(e) => setPwdForm((p) => ({ ...p, oldPassword: e.target.value }))}
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm((p) => ({ ...p, newPassword: e.target.value }))}
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              <div className="mt-3 text-right">
                <button type="submit" disabled={loading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          )}

          {isEditing ? (
            <form onSubmit={handleSave}>
              <div className="px-6 py-4">
                <div className="flex items-center gap-6 mb-6">
                  <div>
                    <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-100">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                      ) : formData.pictureSrc ? (
                        <img
                        src={ formData.pictureSrc ? formData.pictureSrc.startsWith("data:") ? formData.pictureSrc : `data:image/jpeg;base64,${formData.pictureSrc}` : "/images/default-avatar.png"}alt="avatar"className="h-full w-full object-cover"/>
                      ) : (
                        <div className="flex items-center justify-center h-full w-full text-gray-400">
                          <UserIcon />
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <button type="button" className="text-sm text-blue-600 underline" onClick={() => fileInputRef.current?.click()}>
                        Change photo
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePictureChange} />
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Full name</label>
                        <input name="name" value={formData.name} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input name="email" type="email" value={formData.email} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <input name="phone" value={formData.phone} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date of birth</label>
                        <input name="dob" type="date" value={formData.dob ?? ""} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Qualifications</label>
                    <input name="qualifications" value={formData.qualifications} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">School Attended</label>
                    <input name="schoolAttended" value={formData.schoolAttended} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Years of experience</label>
                    <input name="yearsOfExperience" type="number" value={formData.yearsOfExperience ?? ""} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Assigned class</label>
                    <input name="assignedClass" value={formData.assignedClass} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <input name="address" value={formData.address} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">State of Origin</label>
                    <input name="stateOfOrigin" value={formData.stateOfOrigin} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Next of kin</label>
                    <input name="nextOfKin" value={formData.nextOfKin} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Next of kin phone</label>
                    <input name="nextOfKinPhone" value={formData.nextOfKinPhone} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Relationship</label>
                    <select
                      name="relationship"
                      value={formData.relationship || ""}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border-gray-300 rounded-md"
                    >
                      <option value="">Select</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 bg-gray-50 text-right">
                <button type="button" onClick={handleCancelEdit} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white mr-3">Cancel</button>
                <button type="submit" disabled={loading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600">
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <div className="px-6 py-4">
              <div className="flex items-start gap-6 mb-6">
                <div>
                  <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-100">
                    {formData.pictureSrc ? (
<img
  src={
    formData.pictureSrc
      ? formData.pictureSrc.startsWith("data:")
        ? formData.pictureSrc // already a full data URL
        : `data:image/jpeg;base64,${formData.pictureSrc}` // raw base64 from backend
      : "/images/default-avatar.png" // fallback
  }
  alt="avatar"
  className="h-full w-full object-cover"
/>
                    ) : (
                      <div className="flex items-center justify-center h-full w-full text-gray-400">
                        <UserIcon />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">{formData.name || "—"}</h3>
                  <p className="text-sm text-gray-500">{formData.uid ? `Staff ID: ${formData.uid}` : ""}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="flex items-start">
                  <div className="flex-shrink-0"><UserIcon className="h-5 w-5 text-gray-400" /></div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-500">Name</h4>
                    <p className="mt-1 text-sm text-gray-900">{formData.name}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0"><CalendarIcon className="h-5 w-5 text-gray-400" /></div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-500">Date of Birth</h4>
                    <p className="mt-1 text-sm text-gray-900">{formData.dob ? new Date(formData.dob).toLocaleDateString() : "—"}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0"><MailIcon className="h-5 w-5 text-gray-400" /></div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-500">Email</h4>
                    <p className="mt-1 text-sm text-gray-900">{formData.email}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0"><PhoneIcon className="h-5 w-5 text-gray-400" /></div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-500">Phone</h4>
                    <p className="mt-1 text-sm text-gray-900">{formData.phone}</p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-medium text-gray-900 mb-4 border-t border-gray-200 pt-4">Professional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Qualifications</h4>
                  <p className="mt-1 text-sm text-gray-900">{formData.qualifications}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">School Attended</h4>
                  <p className="mt-1 text-sm text-gray-900">{formData.schoolAttended}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Years of Experience</h4>
                  <p className="mt-1 text-sm text-gray-900">{formData.yearsOfExperience}</p>
                </div>
              </div>

              <h3 className="text-lg font-medium text-gray-900 mb-4 border-t border-gray-200 pt-4">Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Next of Kin</h4>
                  <p className="mt-1 text-sm text-gray-900">{formData.nextOfKin}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Next of Kin Phone</h4>
                  <p className="mt-1 text-sm text-gray-900">{formData.nextOfKinPhone}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Relationship</h4>
                  <p className="mt-1 text-sm text-gray-900">{formData.relationship}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Address</h4>
                  <p className="mt-1 text-sm text-gray-900">{formData.address}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherProfile;