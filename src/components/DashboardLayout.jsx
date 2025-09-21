import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserIcon, UsersIcon, BookOpenIcon, ClipboardListIcon, CreditCardIcon, BellIcon, ChevronDownIcon, MenuIcon, XIcon, CalendarIcon , LayoutDashboard} from 'lucide-react';

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
function avatarSrc(input) {
  // normalize when a user object is passed
  if (!input) return "/images/default-avatar.png";
  if (typeof input === "object") {
    const a = input.avatar ?? input.picture ?? input.profilePicture ?? input.pictureSrc ?? input.profileImage ?? "";
    return avatarSrc(a);
  }

  if (typeof input !== "string") return "/images/default-avatar.png";
  const s = input.trim();
  if (!s) return "/images/default-avatar.png";

  // already a data URL
  if (s.startsWith("data:")) return s;

  // absolute or relative URL (keep as-is)
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return s;

  // likely base64 (very rough check)
  const base64Candidate = s.replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(base64Candidate) && base64Candidate.length > 50) {
    return `data:image/jpeg;base64,${base64Candidate}`;
  }

  // fallback: return original string to avoid creating an invalid data: URL
  return s;
}

  // helper to build avatar src with fallbacks (accepts data-url or base64 string)
  // const avatarSrc = (user) => {
  //   if (!user) return '/images/default-avatar.png';
  //   const a = user.avatar ?? user.picture ?? user.profilePicture ?? user.profileImage ?? '';
  //   if (!a) return '/images/default-avatar.png';

  //   if (typeof a === 'string') {
  //     const s = a.trim();

  //     // Already a data URL
  //     if (s.startsWith('data:')) return s;

  //     // Full URL or absolute path
  //     if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;

  //     // Likely base64 string (very rough check: allowed chars and length)
  //     const base64Candidate = s.replace(/\s+/g, '');
  //     if (/^[A-Za-z0-9+/=]+$/.test(base64Candidate) && base64Candidate.length > 50) {
  //       return `data:image/jpeg;base64,${base64Candidate}`;
  //     }
  //   }

  //   // fallback
  //   return '/images/default-avatar.png';
  // };

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
        name: 'Class Assignment',
        path: '/admin/class-assignment',
        icon: <UsersIcon className="w-5 h-5" />
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
        name: 'Results',
        path: '/teacher/results',
        icon: <ClipboardListIcon className="w-5 h-5" />
      }, {
        name: 'Attendance',
        path: '/teacher/attendance',
        icon: <CalendarIcon className="w-5 h-5" />
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

  // prefer injected profile (teacherProfile) when available
  const displayUser = userProfile ?? currentUser;

  return <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${showMobileMenu ? 'block' : 'hidden'} fixed inset-0 z-40 lg:hidden`} role="dialog" aria-modal="true">
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setShowMobileMenu(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button type="button" className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" onClick={() => setShowMobileMenu(false)}>
              <span className="sr-only">Close sidebar</span>
              <XIcon className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-shrink-0 flex items-center px-4">
            <h1 className="text-xl font-bold text-blue-600">School Management</h1>
          </div>
          <div className="mt-5 flex-1 h-0 overflow-y-auto">
            <nav className="px-2 space-y-1">
              {navItems.map(item => <Link key={item.name} to={item.path} className={`${location.pathname === item.path ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'} group flex items-center px-2 py-2 text-base font-medium rounded-md`}>
                  {item.icon}
                  <span className="ml-3">{item.name}</span>
                </Link>)}
            </nav>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      {userRole !== 'student' && <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex flex-col w-64">
            <div className="flex flex-col flex-grow border-r border-gray-200 pt-5 pb-4 bg-white overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-xl font-bold text-blue-600">School Management</h1>
              </div>
              <div className="mt-8 flex-grow flex flex-col">
                <nav className="flex-1 px-2 bg-white space-y-1">
                  {navItems.map(item => <Link key={item.name} to={item.path} className={`${location.pathname === item.path ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'} group flex items-center px-2 py-2 text-sm font-medium rounded-md`}>
                      {item.icon}
                      <span className="ml-3">{item.name}</span>
                    </Link>)}
                </nav>
              </div>
            </div>
          </div>
        </div>}

      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top navigation bar */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
          {userRole !== 'student' && <button type="button" className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden" onClick={() => setShowMobileMenu(true)}>
              <span className="sr-only">Open sidebar</span>
              <MenuIcon className="h-6 w-6" />
            </button>}

          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1 flex items-center">
              <h1 className="text-xl font-semibold text-gray-800 truncate">{title}</h1>
            </div>

            <div className="ml-4 flex items-center md:ml-6">
              {/* Notification button */}
              {userRole !== 'student' && <button className="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  <span className="sr-only">View notifications</span>
                  <BellIcon className="h-6 w-6" />
                </button>}

              {/* Profile dropdown */}
              <div className="ml-3 relative">
                <div>
                  <button type="button" className="max-w-xs flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" id="user-menu" aria-expanded="false" aria-haspopup="true" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                    <span className="sr-only">Open user menu</span>
                    <img className="h-8 w-8 rounded-full object-cover" src={avatarSrc(displayUser?.pictureSrc)} alt={displayUser?.name || 'User'} />
                    <span className="ml-2 text-gray-700">{displayUser?.name || displayUser?.fullName || 'User'}</span>
                    <ChevronDownIcon className="ml-1 h-5 w-5 text-gray-400" />
                  </button>
                </div>

                {showProfileMenu && <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg py-2 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none" role="menu" aria-orientation="vertical" aria-labelledby="user-menu">
                    {/* show user name + email */}
                    <div className="px-4 py-2 border-b border-gray-100">
                      <div className="flex items-center space-x-3">
<img
  className="h-10 w-10 rounded-full object-cover"
  src={avatarSrc(displayUser?.pictureSrc)}
  alt={displayUser?.name || displayUser?.fullName || displayUser?.email || "User"}
/>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{displayUser?.name || 'User'}</div>
<div className="text-xs text-gray-500">
  {displayUser?.uid ? `Staff ID: ${displayUser.uid}` : ''}
</div>
                        </div>
                      </div>
                    </div>

                    {userRole === 'teacher' && <Link to="/teacher/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem" onClick={() => setShowProfileMenu(false)}>Your Profile</Link>}

                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">
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
    </div>;
};

export default DashboardLayout;