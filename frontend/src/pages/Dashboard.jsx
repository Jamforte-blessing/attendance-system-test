import { useEffect, useState, useCallback } from 'react';
import { dashboard } from '../api';
import { format } from 'date-fns';

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-4xl font-bold mt-1">{value ?? '—'}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [live, setLive] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([dashboard.stats(), dashboard.live()]);
      setStats(s);
      setLive(l);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Employees" value={stats?.totalActive} color="blue" />
        <StatCard label="Clocked In Today" value={stats?.clockedInToday} color="green" />
        <StatCard label="Currently In" value={stats?.currentlyIn} color="green" sub="right now" />
        <StatCard label="Late Today" value={stats?.lateToday} color="yellow" />
        <StatCard label="Absent" value={stats?.absent} color="red" />
        <StatCard label="On Leave" value={stats?.onLeave} color="gray" />
      </div>

      {/* Recent activity */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Recent Activity</h2>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {(stats?.recentActivity || []).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>
          )}
          {(stats?.recentActivity || []).map(log => (
            <div key={log.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
              <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${log.type === 'clock_in' ? 'bg-green-500' : 'bg-gray-400'}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{log.employee_name}</p>
                <p className="text-xs text-gray-500">
                  {log.type === 'clock_in' ? 'Clocked in' : 'Clocked out'} &bull;{' '}
                  {format(new Date(log.timestamp), 'HH:mm')}
                  {log.is_late ? <span className="ml-1 text-yellow-600 font-medium">LATE</span> : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Currently in */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Currently Inside ({live.length})</h2>
        {live.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nobody is currently clocked in</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b">
                <th className="table-th">Employee</th>
                <th className="table-th">ID</th>
                <th className="table-th">Department</th>
                <th className="table-th">Clocked In</th>
                <th className="table-th">Duration</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {live.map(e => {
                  const mins = Math.floor((Date.now() - new Date(e.clocked_in_at).getTime()) / 60000);
                  const hrs = Math.floor(mins / 60);
                  const duration = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
                  return (
                    <tr key={e.id}>
                      <td className="table-td font-medium">{e.name}</td>
                      <td className="table-td text-gray-500">{e.emp_id}</td>
                      <td className="table-td">{e.department || '—'}</td>
                      <td className="table-td">{format(new Date(e.clocked_in_at), 'HH:mm')}</td>
                      <td className="table-td text-green-600 font-medium">{duration}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
