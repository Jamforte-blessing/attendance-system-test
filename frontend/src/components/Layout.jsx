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

export default function Layout({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 text-white flex flex-col fixed inset-y-0">
        <div className="px-6 py-5 border-b border-gray-700">
          <h1 className="text-lg font-bold leading-tight">Attendance<br />Management</h1>
          <p className="text-xs text-gray-400 mt-1">Admin Panel</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
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
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-800 hover:text-white transition-colors w-full"
          >
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
