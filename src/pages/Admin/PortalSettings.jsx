import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Label } from '../../components/ui/Field';
import { toast } from 'sonner';
import { fetchPortalSettings, updatePortalSettings } from '../../api/portalApi';

const PortalSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('both');
  const [scratchEnabled, setScratchEnabled] = useState(true);
  const [hasGeneralPassword, setHasGeneralPassword] = useState(false);
  const [generalPwd, setGeneralPwd] = useState('');
  const [generalPwd2, setGeneralPwd2] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchPortalSettings();
        if (!cancelled) {
          setMode(s.studentResultAccessMode || 'both');
          setScratchEnabled(s.scratchCardLoginEnabled !== false);
          setHasGeneralPassword(s.hasStudentPortalPassword === true);
        }
      } catch {
        if (!cancelled) toast.error('Could not load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    const payload = {
      studentResultAccessMode: mode,
      scratchCardLoginEnabled: scratchEnabled
    };
    const p1 = generalPwd.trim();
    const p2 = generalPwd2.trim();
    if (p1 || p2) {
      if (p1 !== p2) {
        toast.error('General password fields do not match');
        return;
      }
      if (p1.length < 6) {
        toast.error('General password must be at least 6 characters');
        return;
      }
      payload.newStudentPortalPassword = p1;
    }

    setSaving(true);
    try {
      const out = await updatePortalSettings(payload);
      toast.success('Settings saved');
      setGeneralPwd('');
      setGeneralPwd2('');
      if (typeof out?.hasStudentPortalPassword === 'boolean') {
        setHasGeneralPassword(out.hasStudentPortalPassword);
      } else {
        setHasGeneralPassword(true);
      }
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeGeneralPassword = async () => {
    if (!confirm('Remove the school-wide student portal password? Students will not be able to sign in with a password until a new one is set.')) {
      return;
    }
    setSaving(true);
    try {
      const out = await updatePortalSettings({ clearStudentPortalPassword: true });
      toast.success('General student password removed');
      setGeneralPwd('');
      setGeneralPwd2('');
      setHasGeneralPassword(out?.hasStudentPortalPassword === true);
    } catch (e) {
      toast.error(e.message || 'Failed to remove password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Result portal settings">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Student result access</h1>
          <p className="mt-1 text-sm text-slate-500">
            Control how students sign in to view published results. The same password can be shared with all students
            when using password login.
          </p>
        </div>

        <Card className="border-slate-200/90 p-6 shadow-[var(--shadow-card)]">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="space-y-6">
              <div>
                <Label htmlFor="access-mode">Login method</Label>
                <select
                  id="access-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="password_only">Password only</option>
                  <option value="scratch_only">Scratch card only</option>
                  <option value="both">Password and scratch card</option>
                </select>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-sm font-medium text-slate-900">General student portal password</p>
                <p className="mt-1 text-xs text-slate-500">
                  Set one password for the whole school. Give it to students together with their student number. Stored
                  securely (hashed). Leave blank below to keep the current password unchanged.
                </p>
                {hasGeneralPassword && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">A general password is currently set.</p>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="gen-pwd">New password</Label>
                    <input
                      id="gen-pwd"
                      type="password"
                      autoComplete="new-password"
                      value={generalPwd}
                      onChange={(e) => setGeneralPwd(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder={hasGeneralPassword ? '••••••••' : 'Min. 6 characters'}
                    />
                  </div>
                  <div>
                    <Label htmlFor="gen-pwd2">Confirm password</Label>
                    <input
                      id="gen-pwd2"
                      type="password"
                      autoComplete="new-password"
                      value={generalPwd2}
                      onChange={(e) => setGeneralPwd2(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Repeat"
                    />
                  </div>
                </div>
                {hasGeneralPassword && (
                  <button
                    type="button"
                    onClick={removeGeneralPassword}
                    disabled={saving}
                    className="mt-3 text-sm font-medium text-red-700 hover:text-red-800 disabled:opacity-50"
                  >
                    Remove general password
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Enable scratch card login</p>
                  <p className="text-xs text-slate-500">
                    When off, students cannot sign in with a scratch card even if “Scratch card only” or “Both” is
                    selected.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={scratchEnabled}
                  onClick={() => setScratchEnabled((v) => !v)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    scratchEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                      scratchEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <Button type="button" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PortalSettings;
