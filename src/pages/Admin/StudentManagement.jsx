// src/pages/Admin/StudentManagement.jsx
import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL;

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editableStudent, setEditableStudent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef(null);

  // separate file input for the view/edit modal
  const editFileInputRef = useRef(null);

  // keep simple file selection (no drag/drop)
  const handleEditFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Select an image file.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result is a data URL (data:<mime>;base64,...)
      setEditableStudent(prev => ({ ...prev, picture: reader.result }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // --- Edit-Modal guardian helpers (were missing and caused render errors) ---
  const editGuardianChange = (index, field, value) => {
    setEditableStudent(prev => {
      if (!prev) return prev;
      const g = prev.guardians ? [...prev.guardians] : [{ name: '', phone: '', email: '', relationship: 'Father' }];
      g[index] = { ...g[index], [field]: value };
      return { ...prev, guardians: g };
    });
  };

  const addEditableGuardian = () => {
    setEditableStudent(prev => {
      const g = prev?.guardians ? [...prev.guardians] : [];
      if (g.length >= 3) { toast.error('Maximum of 3 guardians allowed.'); return prev; }
      g.push({ name: '', phone: '', email: '', relationship: 'Father' });
      return { ...prev, guardians: g };
    });
  };

  const removeEditableGuardian = idx => {
    setEditableStudent(prev => {
      if (!prev || !prev.guardians) return prev;
      const g = [...prev.guardians];
      g.splice(idx, 1);
      if (g.length === 0) g.push({ name: '', phone: '', email: '', relationship: 'Father' });
      return { ...prev, guardians: g };
    });
  };
  // -----------------------------------------------------------------------

  const emptyForm = {
    name: '',
    linNumber: '',
    dob: '',
    gender: 'Male',
    class: '',
    stateOfOrigin: '',
    lga: '',
    address: '',
    guardians: [{ name: '', phone: '', email: '', relationship: 'Father' }],
    picture: '',
    bloodGroup: '',
    allergies: '',
    medicalConditions: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    joinDate: '',
    subjects: [],
    religion: ''
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (showAddModal || showViewModal) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev || ''; };
  }, [showAddModal, showViewModal]);

  // safer guardian extraction to avoid precedence bugs / runtime errors
  const normalizeStudent = raw => {
    if (!raw) return raw;
    let guardians = [];
    if (Array.isArray(raw.guardians) && raw.guardians.length) guardians = raw.guardians;
    else if (raw.guardian && typeof raw.guardian === 'object') guardians = [raw.guardian];

    // Map boolean gender from DB to display string
    let genderStr = raw.gender;
    if (typeof raw.gender === 'boolean') genderStr = raw.gender ? 'Male' : 'Female';
    else if (!raw.gender) genderStr = 'Male'; // default if missing

    let picture = '';
    if (!raw.picture) picture = '';
    else if (typeof raw.picture === 'string') picture = raw.picture; // legacy plain url or data URL
    else if (typeof raw.picture === 'object' && raw.picture.mime && raw.picture.data) {
      picture = `data:${raw.picture.mime};base64,${raw.picture.data}`;
    }

    return {
      ...raw,
      guardians,
      picture,
      uid: raw.uid || raw.id || raw.studentId || '',
      gender: genderStr,
      religion: raw.religion || ''
    };
  };

  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/students`);
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const payload = await res.json();
        // backend returns { success: true, data: students }
        const list = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
        setStudents(list.map(normalizeStudent));
      } catch (err) {
        console.error(err);
        toast.error('Could not load students from server.');
        setStudents([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGuardianChange = (index, field, value) => {
    setFormData(prev => {
      const g = prev.guardians ? [...prev.guardians] : [];
      g[index] = { ...g[index], [field]: value };
      return { ...prev, guardians: g };
    });
  };

  const addGuardian = () => {
    setFormData(prev => {
      const g = prev.guardians ? [...prev.guardians] : [];
      if (g.length >= 3) {
        toast.error('Maximum of 3 guardians allowed.');
        return prev;
      }
      g.push({ name: '', phone: '', email: '', relationship: 'Father' });
      return { ...prev, guardians: g };
    });
  };

  const removeGuardian = idx => {
    setFormData(prev => {
      const g = prev.guardians ? [...prev.guardians] : [];
      g.splice(idx, 1);
      if (g.length === 0) g.push({ name: '', phone: '', email: '', relationship: 'Father' });
      return { ...prev, guardians: g };
    });
  };

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Select an image file.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // store data URL (will be parsed by backend)
      setFormData(prev => ({ ...prev, picture: reader.result }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePictureClick = () => fileInputRef.current?.click();

  const handleSubmit = async e => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      linNumber: formData.linNumber,
      dob: formData.dob,
      // send boolean to backend: true = Male, false = Female
      gender: typeof formData.gender === 'boolean' ? formData.gender : (String(formData.gender).toLowerCase() === 'male'),
      class: formData.class,
      stateOfOrigin: formData.stateOfOrigin,
      lga: formData.lga,
      address: formData.address,
      guardians: formData.guardians,
      picture: formData.picture,
      bloodGroup: formData.bloodGroup,
      allergies: formData.allergies,
      medicalConditions: formData.medicalConditions,
      emergencyContactName: formData.emergencyContactName,
      emergencyContactPhone: formData.emergencyContactPhone,
      subjects: formData.subjects || [],
      religion: formData.religion || ''
    };

    try {
      const res = await fetch(`${API_BASE}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `Server ${res.status}`);
      }
      const created = await res.json();
      const studentRecord = created?.data || created;
      setStudents(prev => [...prev, normalizeStudent(studentRecord)]);
      setFormData(emptyForm);
      setShowAddModal(false);
      toast.success('Student added.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add student.');
    }
  };

  const handleViewStudent = student => {
    setSelectedStudent(student);
    setEditableStudent({
      ...student,
      // Ensure gender is a display string in the edit modal
      gender: typeof student.gender === 'boolean' ? (student.gender ? 'Male' : 'Female') : (student.gender || 'Male'),
      guardians: student.guardians || (student.guardian ? [student.guardian] : [{ name: '', phone: '', email: '', relationship: 'Father' }])
    });
    setIsEditing(false);
    setShowViewModal(true);
  };


  const handleCancelEdit = () => {
    if (!selectedStudent) {
      setEditableStudent(null);
      setIsEditing(false);
      setShowViewModal(false);
      return;
    }
    setEditableStudent({
      ...selectedStudent,
      guardians: selectedStudent.guardians || (selectedStudent.guardian ? [selectedStudent.guardian] : [{ name: '', phone: '', email: '', relationship: 'Father' }])
    });
    setIsEditing(false);
    toast('Edit cancelled');
  };

  const handleSave = async () => {
    if (!editableStudent) return;
    setIsSaving(true);
    try {
      const payload = { ...editableStudent };
      payload.guardians = payload.guardians || (payload.guardian ? [payload.guardian] : []);
      // normalize gender to boolean for backend
      if (payload.gender === true || payload.gender === false) {
        // already boolean
      } else {
        payload.gender = String(payload.gender).toLowerCase() === 'male';
      }
      const method = payload.id ? 'PUT' : 'POST';
      const url = payload.id ? `${API_BASE}/api/students/${payload.id}` : `${API_BASE}/api/students`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `Server ${res.status}`);
      }
      const saved = await res.json();
      const savedRecord = saved?.data || saved;
      if (method === 'PUT') setStudents(prev => prev.map(s => (s.id === savedRecord.id ? normalizeStudent(savedRecord) : s)));
      else setStudents(prev => [normalizeStudent(savedRecord), ...prev]);
      setIsEditing(false);
      setShowViewModal(false);
      setSelectedStudent(null);
      setEditableStudent(null);
      toast.success('Saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStudent = async idOrUid => {
    if (!confirm('Delete this student?')) return;
    const student = students.find(s => s.id === idOrUid || s.uid === idOrUid);
    const idToUse = student?.id || idOrUid;
    try {
      const res = await fetch(`${API_BASE}/api/students/${idToUse}`, { method: 'DELETE' });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `Delete failed ${res.status}`);
      }
      setStudents(prev => prev.filter(s => s.id !== idToUse && s.uid !== idToUse));
      toast.success('Deleted');
    } catch (err) {
      console.error(err);
      toast.error('Delete failed');
    }
  };

  const generateStudentId = () => {
    const last = students.length ? students[students.length - 1] : null;
    const lastNum = last && last.uid ? parseInt((String(last.uid).split('-')[2] || '0'), 10) || (last.id || 0) : 0;
    const newId = lastNum + 1;
    return `YMS-${String(newId).padStart(3, '0')}`;
  };

  return (
    <DashboardLayout title="Student Management">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
        <button type="button" onClick={() => { setFormData(emptyForm); setShowAddModal(true); }} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Student
        </button>
      </div>

      <div className="flex flex-col">
        {isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="text-gray-600 font-medium">Loading…</div>
          </div>
        ) : (
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guardian</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">No students found.</td>
                      </tr>
                    ) : students.map((student, idx) => (
                      <tr key={student.id || student.uid || idx}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <img className="h-10 w-10 rounded-full object-cover" src={student.picture || '/placeholder.png'} alt="" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-sm text-gray-500">{student.dob} | {student.gender} | {student.age} Year's</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{student.uid || generateStudentId()}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.class}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(student.guardians && student.guardians[0]) ? `${student.guardians[0].name} (${student.guardians[0].relationship})` : '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => handleViewStudent(student)} className="text-blue-600 hover:text-blue-900 mr-3"><EyeIcon className="h-5 w-5" /></button>
                          <button onClick={() => { handleViewStudent(student); setIsEditing(true); }} className="text-indigo-600 hover:text-indigo-900 mr-3"><PencilIcon className="h-5 w-5" /></button>
                          <button onClick={() => handleDeleteStudent(student.id || student.uid)} className="text-red-600 hover:text-red-900"><TrashIcon className="h-5 w-5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add modal simplified (keeps same layout previously used) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowAddModal(false)} />
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            <div className="relative z-50 inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-4xl w-full" onClick={e => e.stopPropagation()}>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-6 py-5 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="flex items-center space-x-4 md:col-span-1">
                      <div onClick={handlePictureClick} className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center cursor-pointer overflow-hidden">
                        {formData.picture ? <img src={formData.picture} alt="profile" className="h-full w-full object-cover" /> : <PlusIcon className="h-6 w-6 text-blue-600" />}
                      </div>
                      <div className="flex-1 text-left">
                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input required name="name" value={formData.name} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                      </div>
                    </div>
                    <div className="md:col-span-2 flex space-x-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700">LIN Number</label>
                        <input name="linNumber" value={formData.linNumber} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                      </div>
                      <div className="w-40">
                        <label className="block text-sm font-medium text-gray-700">Class</label>
                        <select name="class" required value={formData.class} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1">
                          <option value="">Select</option>
                          <option>Creche</option>
                          <option>KG 1</option>
                          <option>KG 2</option>
                          <option>Nursery 1</option>
                          <option>Nursery 2</option>
                          <option>Primary 1</option>
                          <option>Primary 2</option>
                          <option>Primary 3</option>
                          <option>Primary 4</option>
                          <option>Primary 6</option>
                          <option>JSS1</option>
                          <option>JSS2</option>
                          {/* <option>JSS3</option>
                          <option>SS1</option>
                          <option>SS2</option>
                          <option>SS3</option> */}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="col-span-1 p-3 rounded-md">
                      <h4 className="text-sm font-semibold mb-2">Personal</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-600">Date of Birth</label>
                          <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Gender</label>
                          <select name="gender" value={formData.gender} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1">
                            <option>Male</option>
                            <option>Female</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">religion</label>
                          <select name="religion" value={formData.religion} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1">
                            <option value="">Select</option>
                            <option value="Christian">Christian</option>
                            <option value="Muslim">Muslim</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">State of Origin</label>
                          <input name="stateOfOrigin" value={formData.stateOfOrigin} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Local Government Area (LGA)</label>
                          <input name="lga" value={formData.lga} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Address</label>
                          <input name="address" value={formData.address} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        </div>
                      </div>
                    </div>

                    <div className="col-span-1 p-3 rounded-md">
                      <h4 className="text-sm font-semibold mb-2">Family / Guardians</h4>
                      <div className="space-y-3">
                        {formData.guardians.map((g, i) => (
                          <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-4 items-end">
                            <div>
                              <label className="text-xs text-gray-600">Name</label>
                              <input value={g.name} onChange={e => handleGuardianChange(i, 'name', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Phone</label>
                              <input value={g.phone} onChange={e => handleGuardianChange(i, 'phone', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Email</label>
                              <input value={g.email} onChange={e => handleGuardianChange(i, 'email', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Relation</label>
                              <select value={g.relationship} onChange={e => handleGuardianChange(i, 'relationship', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1">
                                <option>Father</option>
                                <option>Mother</option>
                                <option>Guardian</option>
                                <option>Other</option>
                              </select>
                              <div className="mt-1">
                                {formData.guardians.length > 1 && <button type="button" onClick={() => removeGuardian(i)} className="text-xs text-red-600 hover:underline">Remove</button>}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div>
                          <button type="button" onClick={addGuardian} className="inline-flex items-center px-3 py-1 border border-transparent rounded-md shadow-sm text-sm text-white bg-blue-600 hover:bg-blue-700">Add guardian</button>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-1 p-3 rounded-md">
                      <h4 className="text-sm font-semibold mb-2">Medical / Emergency</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-600">Blood Group</label>
                          <input name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Allergies</label>
                          <input name="allergies" value={formData.allergies} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Medical Conditions</label>
                          <input name="medicalConditions" value={formData.medicalConditions} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Emergency Contact</label>
                          <input name="emergencyContactName" value={formData.emergencyContactName} onChange={handleInputChange} placeholder="Name" className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                          <input name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleInputChange} placeholder="Phone" className="mt-2 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        </div>
                      </div>
                    </div>
                  </div>

                  

                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm">Add Student</button>
                  <button type="button" onClick={() => setShowAddModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View / Edit Student Modal - full preview + editable when isEditing */}
      {showViewModal && editableStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => { setShowViewModal(false); setIsEditing(false); setEditableStudent(null); }} />
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            <div className="relative z-50 inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-4xl w-full" onClick={e => e.stopPropagation()}>
              <input ref={editFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditFileChange} />

              <div className="bg-white px-6 py-5 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="flex items-center space-x-4 md:col-span-1">
                    <div
                      onClick={() => (isEditing ? editFileInputRef.current?.click() : null)}
                      className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center cursor-pointer overflow-hidden"
                      title={isEditing ? 'Click to change picture' : 'Profile picture'}
                    >
                      {editableStudent.picture ? (
                        <img src={editableStudent.picture} alt="profile" className="h-full w-full object-cover" />
                      ) : (
                        <PlusIcon className="h-6 w-6 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      {isEditing ? (
                        <>
                          <label className="block text-sm font-medium text-gray-700">Full Name</label>
                          <input value={editableStudent.name || ''} onChange={e => setEditableStudent(prev => ({ ...prev, name: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        </>
                      ) : (
                        <div>
                          <div className="text-lg font-medium text-gray-900">{editableStudent.name || 'No name'}</div>
                          <div className="text-sm text-gray-500">Student ID: {editableStudent.uid || editableStudent.id || '—'}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 flex space-x-4">
                    <div className="flex-1">
                      <label className="text-xs text-gray-600">LIN Number</label>
                      {isEditing ? (
                        <input value={editableStudent.linNumber || ''} onChange={e => setEditableStudent(prev => ({ ...prev, linNumber: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                      ) : (
                        <div className="mt-1 text-sm text-gray-700">{editableStudent.linNumber || '—'}</div>
                      )}
                    </div>
                    <div className="w-40">
                      <label className="text-xs text-gray-600">Class</label>
                      {isEditing ? (
                        <select value={editableStudent.class || ''} onChange={e => setEditableStudent(prev => ({ ...prev, class: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1">
                          <option value="">Select</option>
                          <option>Creche</option>
                          <option>KG 1</option>
                          <option>KG 2</option>
                          <option>Nursery 1</option>
                          <option>Nursery 2</option>
                          <option>Primary 1</option>
                          <option>Primary 2</option>
                          <option>Primary 3</option>
                          <option>Primary 4</option>
                          <option>Primary 6</option>
                          <option>JSS1</option>
                          <option>JSS2</option>
                          {/* <option>JSS3</option>
                          <option>SS1</option>
                          <option>SS2</option>
                          <option>SS3</option> */}
                        </select>
                      ) : (
                        <div className="mt-1 text-sm text-gray-700">{editableStudent.class || '—'}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Personal */}
                  <div className="col-span-1 p-3 rounded-md">
                    <h4 className="text-sm font-semibold mb-2">Personal</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600">Date of Birth</label>
                        {isEditing ? (
                          <input type="date" value={editableStudent.dob || ''} onChange={e => setEditableStudent(prev => ({ ...prev, dob: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.dob || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Gender</label>
                        {isEditing ? (
                          <select value={editableStudent.gender || 'Male'} onChange={e => setEditableStudent(prev => ({ ...prev, gender: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1">
                            <option>Male</option>
                            <option>Female</option>
                          </select>
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.gender || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Religion</label>
                        {isEditing ? (
                          <select value={editableStudent.religion || ''} onChange={e => setEditableStudent(prev => ({ ...prev, religion: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1">
                            <option value="">Select</option>
                            <option value="Christian">Christian</option>
                            <option value="Muslim">Muslim</option>
                            <option value="Other">Other</option>
                          </select>
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.religion || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">State of Origin</label>
                        {isEditing ? (
                          <input value={editableStudent.stateOfOrigin || ''} onChange={e => setEditableStudent(prev => ({ ...prev, stateOfOrigin: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.stateOfOrigin || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">LGA</label>
                        {isEditing ? (
                          <input value={editableStudent.lga || ''} onChange={e => setEditableStudent(prev => ({ ...prev, lga: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.lga || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Address</label>
                        {isEditing ? (
                          <input value={editableStudent.address || ''} onChange={e => setEditableStudent(prev => ({ ...prev, address: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.address || '—'}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Family */}
                  <div className="col-span-1 p-3 rounded-md">
                    <h4 className="text-sm font-semibold mb-2">Family / Guardians</h4>
                    <div className="space-y-3">
                      {(editableStudent.guardians || []).map((g, i) => (
                        <div key={i} className="mb-3">
                          {isEditing ? (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <input value={g.name || ''} onChange={e => editGuardianChange(i, 'name', e.target.value)} className="border rounded px-2 py-1" placeholder="Name" />
                              <input value={g.phone || ''} onChange={e => editGuardianChange(i, 'phone', e.target.value)} className="border rounded px-2 py-1" placeholder="Phone" />
                              <input value={g.email || ''} onChange={e => editGuardianChange(i, 'email', e.target.value)} className="border rounded px-2 py-1" placeholder="Email" />
                              <select value={g.relationship || 'Father'} onChange={e => editGuardianChange(i, 'relationship', e.target.value)} className="border rounded px-2 py-1">
                                <option>Father</option>
                                <option>Mother</option>
                                <option>Guardian</option>
                                <option>Other</option>
                              </select>
                            </div>
                          ) : (
                            <div>{g.name || '—'} {g.relationship ? `(${g.relationship})` : ''} — {g.phone || ''} {g.email ? `| ${g.email}` : ''}</div>
                          )}
                          {isEditing && (editableStudent.guardians || []).length > 1 && (
                            <div className="mt-1"><button type="button" onClick={() => removeEditableGuardian(i)} className="text-xs text-red-600 hover:underline">Remove</button></div>
                          )}
                        </div>
                      ))}
                      {isEditing && (editableStudent.guardians || []).length < 3 && (
                        <div>
                          <button type="button" onClick={addEditableGuardian} className="inline-flex items-center px-3 py-1 border border-transparent rounded-md shadow-sm text-sm text-white bg-blue-600 hover:bg-blue-700">Add guardian</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Medical */}
                  <div className="col-span-1 p-3 rounded-md">
                    <h4 className="text-sm font-semibold mb-2">Medical / Emergency</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600">Blood Group</label>
                        {isEditing ? (
                          <input value={editableStudent.bloodGroup || ''} onChange={e => setEditableStudent(prev => ({ ...prev, bloodGroup: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.bloodGroup || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Allergies</label>
                        {isEditing ? (
                          <input value={editableStudent.allergies || ''} onChange={e => setEditableStudent(prev => ({ ...prev, allergies: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.allergies || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Medical Conditions</label>
                        {isEditing ? (
                          <input value={editableStudent.medicalConditions || ''} onChange={e => setEditableStudent(prev => ({ ...prev, medicalConditions: e.target.value }))} className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.medicalConditions || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Emergency Contact</label>
                        {isEditing ? (
                          <>
                            <input value={editableStudent.emergencyContactName || ''} onChange={e => setEditableStudent(prev => ({ ...prev, emergencyContactName: e.target.value }))} placeholder="Name" className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1" />
                            <input value={editableStudent.emergencyContactPhone || ''} onChange={e => setEditableStudent(prev => ({ ...prev, emergencyContactPhone: e.target.value }))} placeholder="Phone" className="mt-2 block w-full border border-gray-300 rounded-md px-2 py-1" />
                          </>
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">{editableStudent.emergencyContactName || '—'} {editableStudent.emergencyContactPhone ? `| ${editableStudent.emergencyContactPhone}` : ''}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* drag/drop removed — avatar click still opens file selector */}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {isEditing ? (
                  <>
                    <button type="button" onClick={handleSave} disabled={isSaving} className={`w-full inline-flex items-center justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm ${isSaving ? 'opacity-80 cursor-not-allowed' : ''}`}>{isSaving ? 'Saving...' : 'Save'}</button>
                    <button type="button" onClick={handleCancelEdit} disabled={isSaving} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setIsEditing(true)} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm">Edit Student</button>
                    <button type="button" onClick={() => { setShowViewModal(false); setEditableStudent(null); setIsEditing(false); }} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Close</button>
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

export default StudentManagement;