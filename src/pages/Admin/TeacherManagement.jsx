// src/pages/Admin/TeacherManagement.jsx
import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

// Add API base (use Vite env variable if present)
const API_BASE = import.meta.env.VITE_API_URL || ' https://yms-backend-a2x4.onrender.com';



// Provide a userRecord object (use real auth/user data in production)
const userRecord = (typeof window !== 'undefined' && window.userRecord) ? window.userRecord : { uid: 'system' };

// Nigerian states for datalist suggestions
const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River",
  "Delta","Ebonyi","Edo","Ekiti","Enugu","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina",
  "Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau",
  "Rivers","Sokoto","Taraba","Yobe","Zamfara","FCT"
];

const emptyTeacherTemplate = {
  id: null,
  name: '',
  uid: '',
  email: '',
  phone: '',
  dob: '',
  qualifications: '',
  stateOfOrigin: '',
  schoolAttended: '',
  yearsOfExperience: '',
  status: 'active',
  picture: '',
  dateJoined: '',
  address: '',
  nextOfKin: '',
  nextOfKinPhone: '',
  relationship: '',
  initPassword: "1234567890",
  subjects: [],          // 🔹 ALWAYS EMPTY ON CREATION
  createdAt: new Date(),
  authUid: userRecord.uid,
};

// --- updated admin template: use `phone` (matches typical backend) ---
const emptyAdminTemplate = {
  id: null,
  name: '',
  uid: '',
  email: '',
  phone: '',            
  adminUid: '',         
  password: '1234567890',
  picture: '',
  createdAt: new Date(),
  authUid: userRecord.uid,
};

const TeacherManagement = () => {
  // start with empty list (no demo)
  const [teachers, setTeachers] = useState([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [editableTeacher, setEditableTeacher] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // new: loading state for Save button
  const [isSaving, setIsSaving] = useState(false);

  // new: whether modal is for teacher or admin
  const [entityType, setEntityType] = useState('teacher'); // 'teacher' | 'admin'

  const pictureFileRef = useRef(null); // <-- store compressed file blob here
  const fileInputRef = useRef(null);

  // Admins state + loading
  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);

  // prevent background scroll when modal open
  useEffect(() => {
    if (showViewModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev || ''; };
    }
    return undefined;
  }, [showViewModal]);

  // Fetch teachers from backend on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/teachers`);
        if (!res.ok) throw new Error(`Failed to fetch teachers (${res.status})`);
        const data = await res.json();
        // map backend reply to include initPassword for display (use initPassword or password field if present)
        const mapped = Array.isArray(data) ? data.map(t => ({
          ...t,
          initPassword: t.initPassword ?? t.password ?? '',
        })) : [];
        setTeachers(sortByName(mapped));
      } catch (err) {
        console.error(err);
        toast.error('Could not load teachers from server.');
      }
    })();
  }, []);

  // Admins fetching logic (improved: map backend shape to UI fields)
  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admins`);
      const rawText = await res.text().catch(() => '');
      // log raw HTTP response body for debugging
      console.log('GET /api/admins raw response:', res.status, rawText);

      if (!res.ok) {
        throw new Error(rawText || `Failed to fetch admins (${res.status})`);
      }

      // try parse JSON (some backends may return text)
      let data;
      try { data = rawText ? JSON.parse(rawText) : []; } catch { data = rawText; }

      // Normalize shapes into array
      let rawAdmins = [];
      if (Array.isArray(data)) rawAdmins = data;
      else if (data && Array.isArray(data.admins)) rawAdmins = data.admins;
      else if (data && data.admin) rawAdmins = [data.admin];
      else rawAdmins = [];

      console.log('Normalized admins array (length):', rawAdmins.length, rawAdmins);

      const mapped = rawAdmins.map(a => ({
        id: a.id || a.uid || a._id || a.AdminUid || a.adminUid || '',
        uid: a.uid || a.id || '',
        name: a.name || a.displayName || a.fullName || '',
        email: a.email || '',
        phone: a.phoneNumber || a.phone || '',
        AdminUid: a.AdminUid || a.adminUid || a.uid || '',
        img: a.img || a.picture || a.photo || '',
        status: a.status || 'active',
        // keep raw for editing
        raw: a,
      }));

      setAdmins(mapped);
    } catch (err) {
      console.error("Failed to load admins:", err);
      setAdmins([]);
      toast.error('Could not load admins from server.');
    } finally {
      setAdminsLoading(false);
    }
  };

  // load admins on mount
  useEffect(() => {
    fetchAdmins();
  }, []);

  // Handle teacher deletion (backend)
  const handleDeleteTeacher = async id => {
    if (!confirm('Are you sure you want to delete this teacher?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/teachers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setTeachers(prev => prev.filter(teacher => teacher.id !== id));
      toast.success('Teacher deleted successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete teacher.');
    }
  };

  // Delete admin helper
  const handleDeleteAdmin = async (id) => {
    if (!id) return;
    // confirm deletion
    if (!window.confirm("Are you sure you want to delete this admin? This action cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admins/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Delete failed (${res.status})`);
      }
      toast.success("Admin deleted");
      // refresh admins table
      fetchAdmins();
      // also refresh combined list if you merge admins into teachers list
      // re-fetch teachers if needed
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to delete admin.");
    }
  };

  // View teacher details (accept optional edit flag)
  const handleViewTeacher = (teacher, edit = false) => {
    setSelectedTeacher(teacher);
    // show the password value from server (initPassword or password)
    setEditableTeacher({ ...teacher, initPassword: teacher.initPassword ?? teacher.password ?? '' });
    setIsEditing(edit);
    setShowViewModal(true);
    setShowPassword(false);
    if (edit) toast.success('Editing enabled — make changes and click Save');
  };

  // Open modal to add new teacher (empty editable form)
  const handleAddTeacher = () => {
    setSelectedTeacher(null);
    setEditableTeacher({ ...emptyTeacherTemplate });
    setIsEditing(true);
    setEntityType('teacher');
    setShowViewModal(true);
    setShowPassword(true); // show default for new so user can see it
    toast.success('Add new teacher — fill details and click Save');
  };

  // helper to create a short Admin Uid when adding
  const generateAdminUid = () => `ADM${Math.random().toString(36).slice(2,8).toUpperCase()}`;

  // Open modal to add new admin (same modal UI but a smaller set of fields)
  const handleAddAdmin = () => {
    setSelectedTeacher(null);
    // ensure password and adminUid are present before sending
    setEditableTeacher({ ...emptyAdminTemplate, password: '1234567890', adminUid: generateAdminUid() });
    setIsEditing(true);
    setEntityType('admin');
    setShowViewModal(true);
    setShowPassword(true);
    toast.success('Add new admin — fill details and click Save');
  };

  // Start editing (legacy)
  const handleEditClick = () => {
    setIsEditing(true);
    toast.success('Editing enabled — make changes and click Save');
  };

  // Handle input changes while editing
  const handleEditableChange = (field, value) => {
    setEditableTeacher(prev => ({ ...prev, [field]: value }));
  };

  // trigger file picker when avatar area clicked
  const handlePictureClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  };

  // helper: convert Blob to dataURL
  const blobToDataURL = blob => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  // helper: create compressed Blob from File using canvas
  const compressImageFile = async (file, maxWidth = 800, maxBytes = 900000) => {
    // create image element
    const dataUrl = await new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onload = () => resolve(rd.result);
      rd.onerror = reject;
      rd.readAsDataURL(file);
    });

    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });

    const ratio = Math.min(1, maxWidth / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // iterative quality reduction to meet size requirement
    let quality = 0.9;
    let blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    while (blob && blob.size > maxBytes && quality > 0.35) {
      quality -= 0.15;
      blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    }

    // if still too large, attempt one more downscale
    if (blob && blob.size > maxBytes) {
      const downRatio = 0.75;
      const canvas2 = document.createElement('canvas');
      canvas2.width = Math.max(100, Math.round(canvas.width * downRatio));
      canvas2.height = Math.max(100, Math.round(canvas.height * downRatio));
      const ctx2 = canvas2.getContext('2d');
      ctx2.drawImage(canvas, 0, 0, canvas2.width, canvas2.height);
      blob = await new Promise(res => canvas2.toBlob(res, 'image/jpeg', 0.6));
    }

    // return blob as well
    if (!blob) throw new Error('Failed to compress image');
    const compressedDataUrl = await blobToDataURL(blob);
    return { dataUrl: compressedDataUrl, size: blob.size, type: blob.type, blob };
  };

  // read selected image, compress it and set as data URL preview
  const handleFileChange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      e.target.value = '';
      return;
    }

    try {
      toast('Compressing image...');
      const { dataUrl, size, blob } = await compressImageFile(file, 900, 900000); // ~900 KB limit
      pictureFileRef.current = new File([blob], file.name.replace(/\s+/g, '_'), { type: blob.type });
      setEditableTeacher(prev => ({ ...prev, picture: dataUrl }));
      toast.success(`Picture selected (≈ ${(size/1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error('Image compression failed', err);
      toast.error('Could not compress image; try a smaller file.');
      pictureFileRef.current = null;
    } finally {
      e.target.value = '';
    }
  };

  // Save edits back to backend (create or update)
  const handleSave = async () => {
    if (!editableTeacher) return;
    setIsSaving(true);

    try {
      const fields = { ...editableTeacher };
      delete fields.id;
      if (!fields.phone && fields.phoneNumber) fields.phone = fields.phoneNumber;

      // log payload once when Save clicked (useful to inspect what's being sent)
      if (entityType === 'admin') {
        console.log('Admin payload (to be sent):', fields);
      } else {
        console.log('Payload (to be sent):', fields);
      }

      // front-end validation to avoid backend 400s
      if (entityType === 'admin') {
        if (!fields.name || !String(fields.name).trim()) {
          setIsSaving(false);
          toast.error('Name is required for admins.');
          return;
        }
        if (!fields.email || !String(fields.email).trim()) {
          setIsSaving(false);
          toast.error('Email is required for admins.');
          return;
        }
        if (!fields.phone || !String(fields.phone).trim()) {
          toast.warning('No phone provided for admin. You can add it later.');
        }
        if (!fields.password) fields.password = '1234567890';
        if (!fields.adminUid) fields.adminUid = generateAdminUid();
      }

      const baseEndpoint = entityType === 'admin' ? `${API_BASE}/api/admins/` : `${API_BASE}/api/teachers`;

      // ---- IMPORTANT: single request path ----
      // Decide update vs create once and perform exactly one HTTP call below.
      if (editableTeacher.id) {
        // Updating existing record
        if (pictureFileRef.current) {
          const form = new FormData();
          Object.entries(fields).forEach(([k, v]) => {
            if (v === undefined || v === null) return;
            form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          });
          form.append('picture', pictureFileRef.current, pictureFileRef.current.name);

          const res = await fetch(`${baseEndpoint}/${editableTeacher.id}`, { method: 'PUT', body: form });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Update failed (${res.status}) ${text}`);
          }
          const updated = await res.json();
          const mappedUpdated = { ...updated, initPassword: updated.initPassword ?? updated.password ?? '' };
          if (entityType === 'teacher') setTeachers(prev => sortByName(prev.map(t => (t.id === mappedUpdated.id ? mappedUpdated : t))));
          else await fetchAdmins(); // refresh admins after admin update
        } else {
          const res = await fetch(`${baseEndpoint}/${editableTeacher.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields)
          });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Update failed (${res.status}) ${text}`);
          }
          const updated = await res.json();
          const mappedUpdated = { ...updated, initPassword: updated.initPassword ?? updated.password ?? '' };
          if (entityType === 'teacher') setTeachers(prev => sortByName(prev.map(t => (t.id === mappedUpdated.id ? mappedUpdated : t))));
          else await fetchAdmins();
        }
        toast.success('Teacher updated successfully!');
      } else {
        // Creating new record (single create request)
        if (pictureFileRef.current) {
          const form = new FormData();
          Object.entries(fields).forEach(([k, v]) => {
            if (v === undefined || v === null) return;
            form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          });
          form.append('picture', pictureFileRef.current, pictureFileRef.current.name);

          const res = await fetch(baseEndpoint, { method: 'POST', body: form });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Create failed (${res.status}) ${text}`);
          }
          const created = await res.json();
          const mappedCreated = { ...created, initPassword: created.initPassword ?? created.password ?? '' };
          if (entityType === 'teacher') {
            setTeachers(prev => sortByName([mappedCreated, ...prev]));
            toast.success('New teacher added successfully!');
          } else {
            toast.success('New admin added successfully!');
            await fetchAdmins();
          }
        } else {
          const res = await fetch(baseEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields)
          });
          if (!res.ok) {
            const json = await res.json().catch(() => null);
            const text = json ? JSON.stringify(json) : await res.text().catch(()=>'');
            throw new Error(`Create failed (${res.status}) ${text}`);
          }
          const created = await res.json();
          const mappedCreated = { ...created, initPassword: created.initPassword ?? created.password ?? '' };
          if (entityType === 'teacher') {
            setTeachers(prev => sortByName([mappedCreated, ...prev]));
            toast.success('New teacher added successfully!');
          } else {
            toast.success('New admin added successfully!');
            await fetchAdmins();
          }
        }
      }

      // reset UI state
      setIsEditing(false);
      setShowViewModal(false);
      setSelectedTeacher(null);
      setEditableTeacher(null);
      setShowPassword(false);
      pictureFileRef.current = null;

    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save teacher.');
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel edits and revert (close if adding)
  const handleCancelEdit = () => {
    if (!selectedTeacher) {
      // adding new -> close modal and reset
      setEditableTeacher(null);
      setIsEditing(false);
      setShowViewModal(false);
      toast('Add cancelled');
      return;
    }
    setEditableTeacher({ ...selectedTeacher, initPassword: selectedTeacher.initPassword ?? selectedTeacher.password ?? '' });
    setIsEditing(false);
    toast('Edit cancelled');
  };

  // Filter teachers based on search query and filter
  const filteredTeachers = teachers.filter(teacher => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = teacher.name.toLowerCase().includes(q) || (teacher.uid || '').toLowerCase().includes(q) || (teacher.email || '').toLowerCase().includes(q);
    const matchesStatus = filterStatus ? teacher.status === filterStatus : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout title="Teacher Management">
      {/* Header with Add Teacher button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Teachers</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={handleAddTeacher} className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2 border border-transparent text-sm sm:text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            Add Teacher
          </button>
        </div>
      </div>

      {/* Search/Filter (unchanged) */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="w-full sm:w-96">
            <label htmlFor="search" className="sr-only">Search</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input id="search" name="search" className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Search by name, ID or email" type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="filterStatus" className="sr-only">Filter by Status</label>
            <select id="filterStatus" name="filterStatus" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Teacher Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {/* make table horizontally scrollable on small devices */}
        <div className="w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                <th className="px-4 py-2 text-left text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-2 text-left text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Qualifications</th>
                <th className="px-4 py-2 text-left text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2 text-right text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTeachers.map(teacher => (
                <tr key={teacher.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="relative flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 relative">
                        <img
                          className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover"
                          src={teacher.picture ? (teacher.picture.startsWith('data:') ? teacher.picture : `data:image/jpeg;base64,${teacher.picture}`) : "/placeholder.png"}
                          alt=""
                        />
                        {/* Status dot */}
                        <span
                          className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white ${teacher.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}
                          title={teacher.status === 'active' ? 'Online' : 'Offline'}
                        />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                        <div className="text-sm text-gray-500">{teacher.uid}</div>
                        {/* Show timestamp if online */}
                        {teacher.status === 'active' && teacher.lastLogin && (
                          <div className="text-xs text-green-600 mt-1">
                            Logged in: {new Date(teacher.lastLogin).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{teacher.email}</div>
                    <div className="text-sm text-gray-500">{teacher.phone}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{teacher.qualifications}</div>
                    <div className="text-sm text-gray-500">{teacher.yearsOfExperience} years</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${teacher.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {teacher.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleViewTeacher(teacher)} className="text-blue-600 hover:text-blue-900" aria-label="View">
                        <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <button onClick={() => handleViewTeacher(teacher, true)} className="text-indigo-600 hover:text-indigo-900" aria-label="Edit">
                        <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <button onClick={() => handleDeleteTeacher(teacher.id)} className="text-red-600 hover:text-red-900" aria-label="Delete">
                        <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTeachers.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-4 text-center text-sm text-gray-500">No teachers found matching your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div> {/* end teachers table wrapper */}

      {/* Admins table — also wrapped for horizontal scrolling */}
      <div className="mt-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="w-full overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin UID</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {adminsLoading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">Loading admins…</td>
                  </tr>
                ) : admins.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">No admins found.</td>
                  </tr>
                ) : (
                  admins.map(a => (
                    <tr key={a.uid || a.id || a.AdminUid}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <img className="h-10 w-10 rounded-full object-cover" src={a.img ? (a.img.startsWith('data:') ? a.img : `data:image/jpeg;base64,${a.img}`) : "/placeholder.png"} alt="" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{a.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{a.email}</div>
                        <div className="text-sm text-gray-500">{a.phoneNumber || a.phone || '—'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{a.AdminUid || a.adminUid || '—'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => { setEntityType('admin'); handleViewTeacher(a); }} className="text-blue-600 hover:text-blue-900 mr-3" aria-label="View">
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button onClick={() => { setEntityType('admin'); handleViewTeacher(a, true); }} className="text-indigo-600 hover:text-indigo-900 mr-3" aria-label="Edit">
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button onClick={() => handleDeleteAdmin(a.uid || a.id)} className="text-red-600 hover:text-red-900" aria-label="Delete">
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View / Edit / Add Teacher Modal */}
      {showViewModal && editableTeacher && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="teacher-view-title">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity z-40" onClick={() => { setShowViewModal(false); setIsEditing(false); setEditableTeacher(null); setShowPassword(false); }} />
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            <div className="relative z-50 inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* hidden file input */}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div
                    className="mx-auto flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 cursor-pointer sm:mx-0 sm:h-12 sm:w-12"
                    onClick={handlePictureClick}
                    title={editableTeacher.picture ? 'Change picture' : 'Add picture'}
                  >
                    {editableTeacher.picture ? (
<img
  src={
    editableTeacher.picture
      ? editableTeacher.picture.startsWith("data:")
        ? editableTeacher.picture // already a dataURL (when you pick a new file)
        : `data:image/jpeg;base64,${editableTeacher.picture}` // from backend
      : "/placeholder.png"
  }
  alt={editableTeacher.name || "Profile"}
  className="h-16 w-16 rounded-full object-cover"
/>
                    ) : (
                      <PlusIcon className="h-6 w-6 text-blue-600" />
                    )}
                  </div>

                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    {/* Name */}
                    {isEditing ? (
                      <input type="text" value={editableTeacher.name} onChange={e => handleEditableChange('name', e.target.value)} placeholder="Full name" className="block w-full border border-gray-300 rounded-md px-2 py-1 text-lg font-medium text-gray-900" />
                    ) : (
                      <h3 id="teacher-view-title" className="text-lg leading-6 font-medium text-gray-900">{editableTeacher.name || 'No name'}</h3>
                    )}

                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {/* Teacher ID: {editableTeacher.uid || '—'} | Status: */}
                        {isEditing ? (
                          <select value={editableTeacher.status} onChange={e => handleEditableChange('status', e.target.value)} className="ml-2 border rounded px-1">
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        ) : (
                          <span className={`ml-1 ${editableTeacher.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>{editableTeacher.status === 'active' ? 'Active' : 'Inactive'}</span>
                        )}
                      </p>
                    </div>

                    {/* Admin-only: show only email, phone and auto-generated password (no Admin UID input shown) */}
                    {entityType === 'admin' && (
                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <div>
                          <h5 className="text-sm font-medium text-gray-500">Email</h5>
                          {isEditing ? (
                            <input type="email" value={editableTeacher.email || ''} onChange={e => handleEditableChange('email', e.target.value)} placeholder="Email" className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                          ) : (
                            <p className="text-sm text-gray-900">{editableTeacher.email || '—'}</p>
                          )}
                        </div>

                        <div>
                          <h5 className="text-sm font-medium text-gray-500">Phone</h5>
                          {isEditing ? (
                            <input type="text" value={editableTeacher.phone || ''} onChange={e => handleEditableChange('phone', e.target.value)} placeholder="Phone number" className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                          ) : (
                            <p className="text-sm text-gray-900">{editableTeacher.phone || '—'}</p>
                          )}
                        </div>

                        <div>
                          <h5 className="text-sm font-medium text-gray-500">Password</h5>
                          <div className="flex items-center">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={editableTeacher.password || '1234567890'}
                              readOnly
                              className="text-sm text-gray-900 border rounded px-2 py-1 w-full"
                            />
                            <button type="button" onClick={() => setShowPassword(p => !p)} className="ml-2 text-gray-500" title={showPassword ? 'Hide password' : 'Show password'}>
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Admin initial password is auto-generated as 1234567890 (read-only).</p>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* only show full personal / professional / emergency sections for teachers */}
                {entityType === 'teacher' && (
                  <div className="mt-5">
                    {/* Personal Information */}
                    <h4 className="text-md font-medium text-gray-900 mb-3 border-b border-gray-200 pb-2">Personal Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Date of Birth</h5>
                        {isEditing ? (
                          <input type="date" value={editableTeacher.dob} onChange={e => handleEditableChange('dob', e.target.value)} className="text-sm text-gray-900 border rounded px-2 py-1" />
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.dob ? new Date(editableTeacher.dob).toLocaleDateString() : '—'}</p>
                        )}
                      </div>

                      <div>
                        <h5 className="text-sm font-medium text-gray-500">State of Origin</h5>
                        {isEditing ? (
                          <>
                            <input
                              list="nigerian-states"
                              type="text"
                              value={editableTeacher.stateOfOrigin || ''}
                              onChange={e => handleEditableChange('stateOfOrigin', e.target.value)}
                              placeholder="State of Origin"
                              className="text-sm text-gray-900 border rounded px-2 py-1 w-full"
                            />
                            <datalist id="nigerian-states">
                              {NIGERIAN_STATES.map(s => <option key={s} value={s} />)}
                            </datalist>
                          </>
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.stateOfOrigin || '—'}</p>
                        )}
                      </div>

                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Email</h5>
                        {isEditing ? (
                          <input type="email" value={editableTeacher.email} onChange={e => handleEditableChange('email', e.target.value)} placeholder="Email" className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.email || '—'}</p>
                        )}
                      </div>

                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Phone</h5>
                        {isEditing ? (
                          <input type="text" value={editableTeacher.phone} onChange={e => handleEditableChange('phone', e.target.value)} placeholder="Phone number" className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.phone || '—'}</p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <h5 className="text-sm font-medium text-gray-500">Address</h5>
                        {isEditing ? (
                          <textarea value={editableTeacher.address} onChange={e => handleEditableChange('address', e.target.value)} placeholder="Address" className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.address || '—'}</p>
                        )}
                      </div>

                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Date Joined</h5>
                        {isEditing ? (
                          <input type="date" value={editableTeacher.dateJoined} onChange={e => handleEditableChange('dateJoined', e.target.value)} className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.dateJoined ? new Date(editableTeacher.dateJoined).toLocaleDateString() : '—'}</p>
                        )}
                      </div>

                      {/* Initial password (read-only display) */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Initial Password</h5>
                        <div className="flex items-center">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={editableTeacher.initPassword || ''}
                            readOnly
                            placeholder={editableTeacher.initPassword ? '' : '—'}
                            className="text-sm text-gray-900 border rounded px-2 py-1 w-full"
                          />
                          <button type="button" onClick={() => setShowPassword(p => !p)} className="ml-2 text-gray-500" title={showPassword ? 'Hide password' : 'Show password'}>
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          The initial password is displayed as provided by the server. This field is read-only.
                        </p>
                      </div>
                    </div>

                    {/* Professional Information */}
                    <h4 className="text-md font-medium text-gray-900 mb-3 border-b border-gray-200 pb-2">Professional Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Qualifications</h5>
                        {isEditing ? (
                          <input type="text" value={editableTeacher.qualifications} onChange={e => handleEditableChange('qualifications', e.target.value)} placeholder="Qualifications" className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.qualifications || '—'}</p>
                        )}
                      </div>

                      <div>
                        <h5 className="text-sm font-medium text-gray-500">School Attended</h5>
                        {isEditing ? (
                          <input type="text" value={editableTeacher.schoolAttended} onChange={e => handleEditableChange('schoolAttended', e.target.value)} placeholder="School attended" className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.schoolAttended || '—'}</p>
                        )}
                      </div>

                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Years of Experience</h5>
                        {isEditing ? (
                          <input type="number" value={editableTeacher.yearsOfExperience} onChange={e => handleEditableChange('yearsOfExperience', e.target.value)} placeholder="Years" className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.yearsOfExperience ? `${editableTeacher.yearsOfExperience} years` : '—'}</p>
                        )}
                      </div>
                    </div>

                    {/* Emergency Contact */}
                    <h4 className="text-md font-medium text-gray-900 mb-3 border-b border-gray-200 pb-2">Emergency Contact</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Next of Kin</h5>
                        {isEditing ? (
                          <input type="text" value={editableTeacher.nextOfKin} onChange={e => handleEditableChange('nextOfKin', e.target.value)} placeholder="Next of kin" className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.nextOfKin || '—'}</p>
                        )}
                      </div>
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Next of Kin Phone</h5>
                        {isEditing ? (
                          <input type="text" value={editableTeacher.nextOfKinPhone} onChange={e => handleEditableChange('nextOfKinPhone', e.target.value)} placeholder="Next of kin phone" className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.nextOfKinPhone || '—'}</p>
                        )}
                      </div>
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Relationship</h5>
                        {isEditing ? (
                          <input type="text" value={editableTeacher.relationship} onChange={e => handleEditableChange('relationship', e.target.value)} placeholder="Relationship" className="text-sm text-gray-900 border rounded px-2 py-1 w-full" />
                        ) : (
                          <p className="text-sm text-gray-900">{editableTeacher.relationship || '—'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className={`w-full sm:auto inline-flex items-center justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm ${isSaving ? 'opacity-80 cursor-not-allowed' : ''}`}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="mt-3 w-full sm:mt-0 sm:ml-3 sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={handleEditClick} className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:text-sm">Edit Teacher</button>
                    <button type="button" className="mt-3 w-full sm:mt-0 sm:ml-3 sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50" onClick={() => { setShowViewModal(false); setIsEditing(false); setEditableTeacher(null); setShowPassword(false); }}>Close</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default TeacherManagement;

// Helper: stable case-insensitive sort by name
const sortByName = (arr = []) => {
  return arr.slice().sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
  );
};