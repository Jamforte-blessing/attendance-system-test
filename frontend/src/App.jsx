import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Kiosk from './pages/Kiosk';

export default function App() {
  return (
    <Routes>
      {/* Employee-facing kiosk — no sidebar, full screen */}
      <Route path="/kiosk" element={<Kiosk />} />

      {/* Admin panel — all pages share the sidebar layout */}
      <Route path="/*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}
