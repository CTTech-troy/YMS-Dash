import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { toast } from 'sonner';
import AdminDashboard from '../Admin/Dashboard';

async function generateStaffUid() {
  const year = new Date().getFullYear().toString().slice(-2);
  const { data: n, error } = await supabase.rpc('next_admin_sequence');
  if (error || n == null) {
    return `YMS-AD-${year}${String(Date.now()).slice(-6)}`;
  }
  return `YMS-AD-${year}${String(n).padStart(4, '0')}`;
}

const AdminRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: ''
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.');
      return;
    }
    setLoading(true);

    try {
      const { data: authData, error: signErr } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password
      });
      if (signErr) throw signErr;
      const user = authData.user;
      if (!user?.id) {
        throw new Error('Account was not created. Check email confirmation settings in Supabase.');
      }

      const staffUid = await generateStaffUid();
      const passwordHash = await bcrypt.hash(formData.password, 10);

      let profileImageUrl = '';
      if (file) {
        const path = `${user.id}/profile.jpg`;
        const { error: upErr } = await supabase.storage.from('admin-avatars').upload(path, file, {
          upsert: true,
          contentType: file.type || 'image/jpeg'
        });
        if (upErr) {
          console.warn('Storage upload:', upErr);
          toast.warning('Profile image upload failed; account was still created.');
        } else {
          const { data: pub } = supabase.storage.from('admin-avatars').getPublicUrl(path);
          profileImageUrl = pub?.publicUrl || '';
        }
      }

      const { error: insErr } = await supabase.from('admins').insert({
        id: user.id,
        admin_uid: staffUid,
        staff_uid: staffUid,
        name: formData.name,
        email: formData.email,
        phone_number: formData.phoneNumber,
        password_hash: passwordHash,
        picture: profileImageUrl || null,
        profile_image_url: profileImageUrl || null
      });

      if (insErr) throw insErr;

      toast.success(`Admin created successfully: ${staffUid}`);
      setCreated(true);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return <AdminDashboard />;
  }

  return (
    <div className="app-shell flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[var(--shadow-float)] sm:p-8"
      >
        <h2 className="text-center text-xl font-semibold tracking-tight text-slate-900">Register new admin</h2>
        <p className="mt-1 text-center text-sm text-slate-500">Requires Supabase configuration</p>

        <div className="mt-6 space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Full name"
            className="input-yms"
            onChange={handleChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="input-yms"
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="phoneNumber"
            placeholder="Phone number"
            className="input-yms"
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="input-yms"
            onChange={handleChange}
            required
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-yms-primary mt-6 w-full disabled:opacity-60"
        >
          {loading ? 'Creating…' : 'Create admin'}
        </button>
      </form>
    </div>
  );
};

export default AdminRegister;
