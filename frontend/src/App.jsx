import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Desk from './pages/Desk';

function AdminRoutes() {
  return (
    <ProtectedRoute>
      <Layout>
        <Routes>
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/companies"  element={<Companies />} />
          <Route path="/employees"  element={<Employees />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/reports"    element={<Reports />} />
          <Route path="/analytics"  element={<Analytics />} />
          <Route path="/settings"   element={<Settings />} />
          <Route path="*"           element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
      <Routes>
        {/* Default — public desk */}
        <Route path="/"      element={<Navigate to="/desk" replace />} />
        <Route path="/desk" element={<Desk />} />
        <Route path="/kiosk" element={<Navigate to="/desk" replace />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />

        {/* Admin panel — protected */}
        <Route path="/*" element={<AdminRoutes />} />
      </Routes>
      </SettingsProvider>
    </AuthProvider>
  );
}
