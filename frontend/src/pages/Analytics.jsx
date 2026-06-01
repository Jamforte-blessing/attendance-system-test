import { useEffect, useState } from 'react';
import { analytics } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';

const C = {
  onTime:  '#22c55e',
  late:    '#f59e0b',
  absent:  '#ef4444',
  present: '#6366f1',
  rate:    '#6366f1',
};

function StatCard({ label, value, sub, accent }) {
  return (
    <Card>
      <CardContent className="pt-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${accent || ''}`}>{value ?? '—'}</p>
        {sub && <p className="text-xs mt-1 text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const PIE_LABELS = { on_time: 'On Time', late: 'Late', absent: 'Absent' };
const PIE_COLORS = [C.onTime, C.late, C.absent];

function TodayPie({ today }) {
  const data = [
    { name: 'On Time', value: today.on_time },
    { name: 'Late',    value: today.late },
    { name: 'Absent',  value: today.absent },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No attendance data yet today</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-md px-3 py-2 text-xs space-y-1">
      <p className="font-medium">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    analytics.get()
      .then(d => { setData(d); })
      .catch(err => { console.error('Analytics error:', err); setError(String(err)); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading analytics...</div>;
  if (error || !data) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-muted-foreground">Failed to load analytics</p>
      {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
      <button onClick={load} className="text-sm underline text-muted-foreground hover:text-foreground">Retry</button>
    </div>
  );

  const { weekly, today, by_department, hourly } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Today summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Attendance Rate"
          value={`${today.attendance_rate}%`}
          sub={`${today.on_time + today.late} of ${today.total} employees`}
          accent={today.attendance_rate >= 80 ? 'text-green-600' : today.attendance_rate >= 50 ? 'text-amber-600' : 'text-red-600'}
        />
        <StatCard label="On Time Today"  value={today.on_time}  accent="text-green-600" />
        <StatCard label="Late Today"     value={today.late}     accent="text-amber-600" />
        <StatCard label="Absent Today"   value={today.absent}   accent="text-red-600" />
      </div>

      {/* Weekly trend + Today breakdown */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">7-Day Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={weekly} barSize={18} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day_name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="on_time" name="On Time" stackId="a" fill={C.onTime} radius={[0, 0, 0, 0]} />
                <Bar dataKey="late"    name="Late"    stackId="a" fill={C.late}   radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <TodayPie today={today} />
            <div className="flex justify-center gap-5 mt-1">
              {[['On Time', C.onTime, today.on_time], ['Late', C.late, today.late], ['Absent', C.absent, today.absent]].map(([label, color, val]) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                  {label}: <strong className="text-foreground">{val}</strong>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department breakdown + Hourly distribution */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Department Attendance (Today)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {by_department.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No departments</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, by_department.length * 48)}>
                <BarChart data={by_department} layout="vertical" barSize={14} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="department" width={100} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} formatter={(v, name) => [`${v}%`, 'Attendance Rate']} />
                  <Bar dataKey="rate" name="Rate" fill={C.rate} radius={[0, 3, 3, 0]}
                    label={{ position: 'right', fontSize: 11, formatter: v => `${v}%` }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clock-In Hours (Today)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={hourly} barSize={14} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Clock-ins" fill={C.present} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
