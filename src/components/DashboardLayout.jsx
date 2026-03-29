import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  UserIcon,
  UsersIcon,
  BookOpenIcon,
  ClipboardListIcon,
  CreditCardIcon,
  ChevronDownIcon,
  MenuIcon,
  XIcon,
  LayoutDashboard,
  GraduationCap,
  BellIcon,
  ClipboardCheck,
  Lock
} from 'lucide-react';
import { API_BASE } from '../config/api.js';

function formatNotificationTime(ts) {
  if (!ts) return '';
  if (ts && typeof ts.toDate === 'function') {
    try { return ts.toDate().toLocaleString(); } catch { /* ignore */ }
  }
  if (typeof ts === 'number') {
    const ms = ts < 1e12 ? ts * 1000 : ts;
    return new Date(ms).toLocaleString();
  }
  const parsed = new Date(ts);
  if (!isNaN(parsed)) return parsed.toLocaleString();
  return '';
}

function normalizeNotificationsArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  for (const k of ['notifications', 'items', 'list']) {
    if (Array.isArray(payload[k])) return payload[k];
  }
  for (const v of Object.values(payload)) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

function detectNotificationVariant(n) {
  if (!n) return 'default';
  const text = ((n.title || n.message || n.body || n.text || '') + '').toLowerCase();
  const action = ((n.action || n.type || n.event || n.kind) + '').toLowerCase();
  const status = ((n.status || n.success || '') + '').toLowerCase();
  if (/failed|error|unsuccessful|not sent|not delivered/.test(status) || /fail|failed|error|unsuccessful|not sent|not delivered/.test(text + ' ' + action)) return 'failed';
  if (/delete|removed|deleted|remove/.test(action) || /delete|removed|deleted|remove/.test(text)) return 'delete';
  if (/create|created|added|new|joined|registered/.test(action) || /create|created|added|new|joined|registered/.test(text)) return 'create';
  if (status === 'false' || status === '0') return 'failed';
  if (status === 'true' || status === '1' || status === 'ok' || status === 'success') {
    if (/create|created|added|new/.test(text + ' ' + action)) return 'create';
    return 'default';
  }
  return 'default';
}

function mapNotificationItems(rawList) {
  return rawList.map((n) => {
    const id = n.id || n._id || n.uid || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    const title = n.title || n.subject || n.heading || 'Notification';
    const message = n.message || n.body || n.text || (n.payload && n.payload.message) || 'No message provided';
    const rawTimestamp = n.createdAt ?? n.timestamp ?? n.time ?? n.date ?? n.created_at ?? null;
    return {
      id,
      title,
      message,
      time: rawTimestamp ? formatNotificationTime(rawTimestamp) : (n.time || 'Just now'),
      raw: n,
      read: Boolean(n.read || n.isRead || n.read_at),
      variant: detectNotificationVariant(n),
    };
  }).sort((a, b) => {
    const aT = new Date(a.raw.createdAt ?? a.raw.timestamp ?? a.raw.time ?? a.time).getTime() || 0;
    const bT = new Date(b.raw.createdAt ?? b.raw.timestamp ?? b.raw.time ?? b.time).getTime() || 0;
    return bT - aT;
  });
}

const DashboardLayout = ({
  children,
  title,
  userProfile // optional injected profile
}) => {
  const {
    currentUser,
    userRole,
    logout
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [headerNotifications, setHeaderNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const headerNotificationsEnabled = userRole === 'admin' || userRole === 'teacher';

  const fetchHeaderNotifications = useCallback(async () => {
    if (!headerNotificationsEnabled) return;
    setNotificationsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/notifications`);
      if (!res.ok) {
        setHeaderNotifications([]);
        return;
      }
      const data = await res.json().catch(() => []);
      const arr = normalizeNotificationsArray(data);
      setHeaderNotifications(mapNotificationItems(arr));
    } catch {
      setHeaderNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, [headerNotificationsEnabled]);

  useEffect(() => {
    if (!headerNotificationsEnabled) return undefined;
    fetchHeaderNotifications();
    const t = setInterval(fetchHeaderNotifications, 15000);
    return () => clearInterval(t);
  }, [headerNotificationsEnabled, fetchHeaderNotifications]);

  const markHeaderNotificationRead = async (id) => {
    setHeaderNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, { method: 'POST' });
    } catch {
      /* ignore */
    }
  };

  const unreadNotificationCount = headerNotifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

function avatarSrc(input) {
  // normalize when a user object is passed
  if (!input) return "/images/default-avatar.png";

  // handle object inputs (user object or buffer-like)
  if (typeof input === "object") {
    // if buffer-like data present (ArrayBuffer / Uint8Array / Array / base64 string)
    const data = input.data ?? input.buffer ?? input.avatar ?? input.picture ?? input.profilePicture ?? null;
    if (data) {
      // string base64 inside object
      if (typeof data === "string") return avatarSrc(data);
      try {
        // ArrayBuffer / Uint8Array / Array -> convert to base64
        let bytes = null;
        if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
        else if (data instanceof Uint8Array) bytes = data;
        else if (Array.isArray(data)) bytes = new Uint8Array(data);
        if (bytes) {
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const b64 = typeof window !== "undefined" ? window.btoa(binary) : Buffer.from(binary, "binary").toString("base64");
          const prefix = b64.slice(0, 8);
          const mime = prefix.startsWith("/9j/") ? "image/jpeg" : prefix.startsWith("iVBORw0K") ? "image/png" : "image/jpeg";
          return `data:${mime};base64,${b64}`;
        }
      } catch (e) {
        // fall through to other handlers
      }
    }
    // fallback: try known string fields on the object
    const a = input.avatar ?? input.picture ?? input.profilePicture ?? input.pictureSrc ?? input.profileImage ?? "";
    return avatarSrc(a);
  }

  // non-object inputs: expect string
  if (typeof input !== "string") return "/images/default-avatar.png";
  const s = input.trim();
  if (!s) return "/images/default-avatar.png";

  // already a data URL
  if (s.startsWith("data:")) return s;

  // absolute or relative URL (keep as-is)
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return s;

  // likely base64 (remove whitespace/newlines)
  const base64Candidate = s.replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(base64Candidate) && base64Candidate.length > 20) {
    // detect common signatures for mime
    const jpegSig = base64Candidate.startsWith("/9j/");
    const pngSig = base64Candidate.startsWith("iVBORw0K");
    const mime = jpegSig ? "image/jpeg" : pngSig ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${base64Candidate}`;
  }

  // fallback: return original string to avoid invalid data URL
  return s;
}

  // Define navigation items based on user role
  const getNavItems = () => {
    if (userRole === 'admin') {
      return [{
        name: 'Dashboard',
        path: '/admin',
        icon: <LayoutDashboard className="w-5 h-5" />
      }, {
        name: 'Teachers',
        path: '/admin/teachers',
        icon: <UserIcon className="w-5 h-5" />
      }, {
        name: 'Students',
        path: '/admin/students',
        icon: <UsersIcon className="w-5 h-5" />
      }, {
        name: 'Subjects',
        path: '/admin/subjects',
        icon: <BookOpenIcon className="w-5 h-5" />
      }, {
        name: 'Results',
        path: '/admin/results',
        icon: <ClipboardListIcon className="w-5 h-5" />
      }, {
        name: 'Scratch Cards',
        path: '/admin/scratch-cards',
        icon: <CreditCardIcon className="w-5 h-5" />
      }, {
        name: 'Portal access',
        path: '/admin/portal-settings',
        icon: <Lock className="w-5 h-5" />
      }, {
        name: 'Class Assignment',
        path: '/admin/class-assignment',
        icon: <GraduationCap className="w-5 h-5" />
      }];
    } else if (userRole === 'teacher') {
      return [{
        name: 'Dashboard',
        path: '/teacher',
        icon: <LayoutDashboard className="w-5 h-5" />
      }, {
        name: 'Classes',
        path: '/teacher/classes',
        icon: <UsersIcon className="w-5 h-5" />
      }, {
        name: 'Attendance',
        path: '/teacher/attendance',
        icon: <ClipboardCheck className="w-5 h-5" />
      }, {
        name: 'Results',
        path: '/teacher/results',
        icon: <ClipboardListIcon className="w-5 h-5" />
      }, {
        name: 'Profile',
        path: '/teacher/profile',
        icon: <UserIcon className="w-5 h-5" />
      }];
    } else if (userRole === 'student') {
      return [{
        name: 'Results',
        path: '/student/results',
        icon: <ClipboardListIcon className="w-5 h-5" />
      }];
    }
    return [];
  };
  const navItems = getNavItems();

  const displayUser = userProfile ?? currentUser;
  const staffShell = userRole === 'admin' || userRole === 'teacher';

  const navLinkClass = (path) => {
    const active = location.pathname === path;
    if (staffShell) {
      return active
        ? 'bg-indigo-500/25 text-white shadow-sm ring-1 ring-indigo-400/35'
        : 'text-slate-300 hover:bg-slate-800/90 hover:text-white';
    }
    return active
      ? 'bg-indigo-500/15 text-indigo-100 ring-1 ring-indigo-400/30'
      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white';
  };

  return <div className={`flex h-screen ${staffShell ? 'bg-slate-100' : 'bg-slate-50'}`}>
      {/* Sidebar */}
      <div className={`${showMobileMenu ? 'block' : 'hidden'} fixed inset-0 z-40 lg:hidden`} role="dialog" aria-modal="true">
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setShowMobileMenu(false)} />
        <div className="relative flex max-w-xs w-full flex-1 flex-col bg-slate-900 pt-5 pb-4">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button type="button" className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" onClick={() => setShowMobileMenu(false)}>
              <span className="sr-only">Close sidebar</span>
              <XIcon className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 px-4">
            <img className="h-8 w-auto" src="/logo.png" alt="" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-white sm:text-sm">Yetland</h1>
              <p className="truncate text-xs text-slate-400">{userRole === 'admin' ? 'Administration' : userRole === 'teacher' ? 'Staff portal' : 'Portal'}</p>
            </div>
          </div>
          <div className="mt-5 flex-1 h-0 overflow-y-auto">
            <nav className="space-y-1 px-2">
              {navItems.map(item => <Link key={item.name} to={item.path} className={`${navLinkClass(item.path)} group flex items-center rounded-lg px-3 py-2.5 text-sm truncate whitespace-nowrap`} onClick={() => setShowMobileMenu(false)}>
                  <div className="flex-shrink-0 opacity-90">{item.icon}</div>
                  <span className="ml-3 truncate">{item.name}</span>
                </Link>)}
            </nav>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      {userRole !== 'student' && <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex w-64 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-r border-slate-700/80 bg-slate-900 pt-6 pb-6">
              <div className="flex flex-shrink-0 items-start gap-3 px-5">
                <img className="h-9 w-auto shrink-0" src="/logo.png" alt="" />
                <div className="min-w-0">
                  <h1 className="text-base font-bold leading-tight text-white">Yetland Management</h1>
                  <p className="mt-0.5 text-xs text-slate-400">{userRole === 'admin' ? 'School administration' : 'Staff portal'}</p>
                </div>
              </div>
              <nav className="mt-8 flex-1 space-y-1 px-3">
                {navItems.map(item => <Link key={item.name} to={item.path} className={`${navLinkClass(item.path)} group flex items-center rounded-lg px-3 py-2.5 text-sm`}>
                    <div className="flex-shrink-0 opacity-90">{item.icon}</div>
                    <span className="ml-3 truncate">{item.name}</span>
                  </Link>)}
              </nav>
            </div>
          </div>
        </div>}

      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top navigation bar */}
        <div className="relative z-10 flex h-16 shrink-0 items-center border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur">
          {userRole !== 'student' && <button type="button" className="border-r border-slate-200 px-4 text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 lg:hidden" onClick={() => setShowMobileMenu(true)}>
              <span className="sr-only">Open sidebar</span>
              <MenuIcon className="h-6 w-6" />
            </button>}

          <div className="flex flex-1 items-center justify-between px-4">
            <div className="flex min-w-0 flex-1 items-center">
              <h1 className="truncate text-sm font-semibold text-slate-800 sm:text-base md:text-lg">{title}</h1>
            </div>

            <div className="ml-4 flex items-center gap-2 md:ml-6">
              {headerNotificationsEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    setNotificationModalOpen(true);
                    fetchHeaderNotifications();
                  }}
                  className="relative rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2"
                  aria-label="Open notifications"
                >
                  <BellIcon className="h-5 w-5" aria-hidden />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </span>
                  )}
                </button>
              )}
              <div className="relative">
                <div>
                  <button type="button" className="flex max-w-xs items-center rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2" id="user-menu" aria-expanded="false" aria-haspopup="true" onClick={() => { setShowProfileMenu(!showProfileMenu); setNotificationModalOpen(false); }}>
                    <span className="sr-only">Open user menu</span>
                    <img className="h-8 w-8 rounded-full ring-2 ring-slate-100" src={avatarSrc(displayUser)} alt="" />
                    <span className="ml-2 max-w-[10rem] truncate whitespace-nowrap text-sm text-slate-700">{displayUser?.name || displayUser?.fullName || 'User'}</span>
                    <ChevronDownIcon className="ml-1 h-5 w-5 text-slate-400" />
                  </button>
                </div>

                {showProfileMenu && <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl border border-slate-200/90 bg-white py-2 shadow-lg ring-1 ring-slate-900/5 focus:outline-none" role="menu" aria-orientation="vertical" aria-labelledby="user-menu">
                    <div className="border-b border-slate-100 px-4 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{displayUser?.name || 'User'}</div>
                        <div className="truncate text-xs text-slate-500">{displayUser?.uid ? `Staff ID: ${displayUser.uid}` : ''}</div>
                      </div>
                    </div>

                    {userRole === 'teacher' && <Link to="/teacher/profile" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" role="menuitem" onClick={() => setShowProfileMenu(false)}>Your Profile</Link>}

                    <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" role="menuitem" type="button">
                      <div className="flex items-center">
                        <div className="mr-2 h-5 w-5" />
                        Sign out
                      </div>
                    </button>
                  </div>}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>

      {notificationModalOpen && headerNotificationsEnabled && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 pt-16 sm:pt-20">
          <button
            type="button"
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            aria-label="Close notifications"
            onClick={() => setNotificationModalOpen(false)}
          />
          <div className="relative z-10 mt-0 flex max-h-[min(28rem,80vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
                <p className="text-xs text-slate-500">
                  {unreadNotificationCount > 0 ? `${unreadNotificationCount} unread` : 'All caught up'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotificationModalOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {notificationsLoading && headerNotifications.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-slate-500">Loading…</p>
              ) : headerNotifications.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-slate-500">No notifications yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {headerNotifications.map((notification) => (
                    <li
                      key={notification.id}
                      onClick={() => !notification.read && markHeaderNotificationRead(notification.id)}
                      className={`cursor-pointer px-5 py-4 transition ${!notification.read ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <BellIcon
                            className={`h-4 w-4 ${
                              notification.variant === 'delete'
                                ? 'text-red-500'
                                : notification.variant === 'create'
                                  ? 'text-emerald-600'
                                  : notification.variant === 'failed'
                                    ? 'text-amber-500'
                                    : !notification.read
                                      ? 'text-emerald-600'
                                      : 'text-slate-400'
                            }`}
                            aria-hidden
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                          <p className="mt-0.5 text-sm text-slate-600">{notification.message}</p>
                          <p className="mt-2 text-xs text-slate-400">{notification.time}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>;
};

export default DashboardLayout;