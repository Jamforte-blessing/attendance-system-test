import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/companies', label: 'Companies' },
  { to: '/employees', label: 'Employees' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
];

function SidebarContent({ onNav, onLogout }) {
  return (
    <>
      <div className="px-6 py-5 border-b border-gray-700">
        <img src="/logo.png" alt="Jam Forte Technologies" className="h-10 w-auto" />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNav}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-2">
        <a
          href="/kiosk"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors w-full"
        >
          <span>Employee Kiosk</span>
          <span className="ml-auto text-xs opacity-50">↗</span>
        </a>
      </div>

      <div className="px-3 pb-4 border-t border-gray-700 pt-3">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-800 hover:text-white transition-colors w-full"
        >
          <span>Log Out</span>
        </button>
      </div>
    </>
  );
}

export default function Layout({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-gray-900 text-white flex-col fixed inset-y-0 z-30">
        <SidebarContent onNav={() => {}} onLogout={handleLogout} />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-gray-900 text-white flex items-center px-4 py-3 shadow">
        <button
          onClick={() => setOpen(true)}
          className="text-gray-300 hover:text-white mr-3 p-1"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src="/logo.png" alt="Jam Forte Technologies" className="h-7 w-auto" />
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-gray-900 text-white flex flex-col h-full shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
              <span className="font-bold text-sm">Menu</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <SidebarContent onNav={() => setOpen(false)} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-60 min-h-screen">
        <div className="pt-14 md:pt-8 p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
