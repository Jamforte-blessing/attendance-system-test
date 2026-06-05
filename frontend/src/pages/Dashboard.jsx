import { useEffect, useState, useCallback } from 'react';
import { dashboard } from '../api';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({ label, value, sub }) {
  return (
    <Card>
      <CardContent className="pt-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-4xl font-bold mt-1">{value ?? '—'}</p>
        {sub && <p className="text-xs mt-1 text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <h1 className="text-2xl font-bold">{getGreeting()}, {stats?.companyName ?? 'Admin'}</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Total Employees" value={stats?.totalActive} />
        <StatCard label="Clocked In Today" value={stats?.clockedInToday} />
        <StatCard label="Currently In" value={stats?.currentlyIn} sub="right now" />
        <StatCard label="Late Today" value={stats?.lateToday} />
        <StatCard label="Absent" value={stats?.absent} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(stats?.recentActivity || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>
            )}
            {(stats?.recentActivity || []).map(log => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${log.type === 'clock_in' ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{log.employee_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.type === 'clock_in' ? 'Clocked in' : 'Clocked out'} &bull;{' '}
                    {format(new Date(log.timestamp), 'HH:mm')}
                    {log.is_late ? <span className="ml-1 text-yellow-600 font-medium">LATE</span> : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="py-0 gap-0">
        <CardHeader className="py-4 border-b">
          <CardTitle>Currently Inside ({live.length})</CardTitle>
        </CardHeader>
        {live.length === 0 ? (
          <CardContent className="text-center py-6">
            <p className="text-sm text-muted-foreground">Nobody is currently clocked in</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b bg-muted/50">
                <th className="table-th">Employee</th>
                <th className="table-th">ID</th>
                <th className="table-th">Department</th>
                <th className="table-th">Clocked In</th>
                 <th className="table-th">Clocked Out</th>
                <th className="table-th">Duration</th>
              </tr></thead>
              <tbody className="divide-y">
                {live.map(e => {
                  const mins = Math.floor((Date.now() - new Date(e.clocked_in_at).getTime()) / 60000);
                  const hrs = Math.floor(mins / 60);
                  const duration = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
                  return (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="table-td font-medium">{e.name}</td>
                      <td className="table-td text-muted-foreground">{e.emp_id}</td>
                      <td className="table-td">{e.department || '—'}</td>
                      <td className="table-td">{format(new Date(e.clocked_in_at), 'HH:mm')}</td>
                      <td className="table-td">{e.clocked_out_at ? format(new Date(e.clocked_out_at), 'HH:mm') : '—'}</td>
                      <td className="table-td text-green-600 font-medium">{duration}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
