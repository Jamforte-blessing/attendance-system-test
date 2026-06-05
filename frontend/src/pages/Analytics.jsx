import { useEffect, useState } from 'react';
import { analytics, employees as empApi, departments as deptApi, units as unitsApi } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';

const ALL = '__all__';
const toSel = v => v || ALL;
const fromSel = v => (v === ALL ? '' : v);

const C = {
  onTime:  '#22c55e',
  late:    '#f59e0b',
  absent:  '#ef4444',
  present: '#6366f1',
  rate:    '#6366f1',
};
const PIE_COLORS = [C.onTime, C.late, C.absent];

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: '7d',    label: 'Last 7 Days' },
  { value: '30d',   label: 'Last 30 Days' },
  { value: '90d',   label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
];

function computeDates(period, customFrom, customTo) {
  const today = new Date().toISOString().slice(0, 10);
  if (period === 'custom') return { date_from: customFrom || today, date_to: customTo || today };
  if (period === 'today') return { date_from: today, date_to: today };
  const offsets = { '7d': 6, '30d': 29, '90d': 89 };
  const days = offsets[period] ?? 6;
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { date_from: from.toISOString().slice(0, 10), date_to: today };
}

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

function BreakdownPie({ today }) {
  const data = [
    { name: 'On Time', value: today.on_time },
    { name: 'Late',    value: today.late },
    { name: 'Absent',  value: today.absent },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No data</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
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
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [empList, setEmpList] = useState([]);
  const [deptList, setDeptList] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [filteredUnits, setFilteredUnits] = useState([]);
  const [filters, setFilters] = useState({
    period: '7d',
    employee_id: '',
    department_id: '',
    unit_id: '',
    customFrom: '',
    customTo: '',
  });

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  useEffect(() => {
    empApi.list({ status: 'active' }).then(setEmpList).catch(() => {});
    deptApi.list().then(setDeptList).catch(() => {});
    unitsApi.list().then(u => { setAllUnits(u); setFilteredUnits(u); }).catch(() => {});
  }, []);

  useEffect(() => {
    setFilteredUnits(filters.department_id
      ? allUnits.filter(u => String(u.department_id) === String(filters.department_id))
      : allUnits);
    setFilters(f => ({ ...f, unit_id: '' }));
  }, [filters.department_id, allUnits]);

  useEffect(() => {
    const { period, employee_id, department_id, unit_id, customFrom, customTo } = filters;
    const { date_from, date_to } = computeDates(period, customFrom, customTo);
    const params = { date_from, date_to };
    if (employee_id) params.employee_id = employee_id;
    if (department_id && !employee_id) params.department_id = department_id;
    if (unit_id && !employee_id) params.unit_id = unit_id;

    setLoading(true);
    setError(null);
    analytics.get(params)
      .then(d => setData(d))
      .catch(err => { console.error('Analytics error:', err); setError(String(err)); })
      .finally(() => setLoading(false));
  }, [filters]);

  const { period, employee_id } = filters;
  const isPeriod = data?.today?.is_period;
  const trendData = data?.weekly || [];
  const useShortLabel = trendData.length <= 7;
  const hasDepts = (data?.by_department?.length ?? 0) > 0;

  const trendTitle = {
    today: 'Today\'s Attendance',
    '7d':  '7-Day Attendance Trend',
    '30d': '30-Day Attendance Trend',
    '90d': '90-Day Attendance Trend',
    custom: 'Attendance Trend',
  }[period] ?? 'Attendance Trend';

  const breakdownTitle = isPeriod
    ? 'Period Summary'
    : period === 'today'
      ? "Today's Breakdown"
      : `Breakdown (${data?.today?.date ?? ''})`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Filters */}
      <Card>
        <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label">Period</label>
            <Select value={filters.period} onValueChange={v => setFilter('period', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="label">Employee</label>
            <Select value={toSel(filters.employee_id)} onValueChange={v => setFilter('employee_id', fromSel(v))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL}>All Employees</SelectItem>
                {empList.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.employee_id})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!employee_id && (
            <div>
              <label className="label">Department</label>
              <Select value={toSel(filters.department_id)} onValueChange={v => setFilter('department_id', fromSel(v))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={ALL}>All Departments</SelectItem>
                  {deptList.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!employee_id && (
            <div>
              <label className="label">Unit</label>
              <Select value={toSel(filters.unit_id)} onValueChange={v => setFilter('unit_id', fromSel(v))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={ALL}>All Units</SelectItem>
                  {filteredUnits.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {filters.period === 'custom' && (
            <>
              <div>
                <label className="label">From</label>
                <input type="date" className="input" value={filters.customFrom}
                  onChange={e => setFilter('customFrom', e.target.value)} />
              </div>
              <div>
                <label className="label">To</label>
                <input type="date" className="input" value={filters.customTo}
                  onChange={e => setFilter('customTo', e.target.value)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-muted-foreground">Loading analytics...</div>
      ) : error || !data ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-muted-foreground">Failed to load analytics</p>
          {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
          <button
            onClick={() => setFilters(f => ({ ...f }))}
            className="text-sm underline text-muted-foreground hover:text-foreground"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Attendance Rate"
              value={`${data.today.attendance_rate}%`}
              sub={isPeriod
                ? `${data.today.on_time + data.today.late} of ${data.today.total} days`
                : `${data.today.on_time + data.today.late} of ${data.today.total} employees`}
              accent={
                data.today.attendance_rate >= 80 ? 'text-green-600'
                : data.today.attendance_rate >= 50 ? 'text-amber-600'
                : 'text-red-600'
              }
            />
            <StatCard
              label={isPeriod ? 'Days On Time'  : 'On Time'}
              value={data.today.on_time}
              accent="text-green-600"
            />
            <StatCard
              label={isPeriod ? 'Late Days'     : 'Late'}
              value={data.today.late}
              accent="text-amber-600"
            />
            <StatCard
              label={isPeriod ? 'Days Absent'   : 'Absent'}
              value={data.today.absent}
              accent="text-red-600"
            />
          </div>

          {/* Trend + Breakdown */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{trendTitle}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={trendData} barSize={18} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey={useShortLabel ? 'day_name' : 'date_label'}
                      tick={{ fontSize: 12 }} axisLine={false} tickLine={false}
                    />
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
                <CardTitle className="text-base">{breakdownTitle}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <BreakdownPie today={data.today} />
                <div className="flex justify-center gap-5 mt-1">
                  {[['On Time', C.onTime, data.today.on_time], ['Late', C.late, data.today.late], ['Absent', C.absent, data.today.absent]].map(([label, color, val]) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                      {label}: <strong className="text-foreground">{val}</strong>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department breakdown + Hourly */}
          <div className={`grid ${hasDepts ? 'lg:grid-cols-2' : ''} gap-6`}>
            {hasDepts && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Department Attendance</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={Math.max(200, data.by_department.length * 48)}>
                    <BarChart data={data.by_department} layout="vertical" barSize={14} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="department" width={100} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} formatter={v => [`${v}%`, 'Attendance Rate']} />
                      <Bar dataKey="rate" name="Rate" fill={C.rate} radius={[0, 3, 3, 0]}
                        label={{ position: 'right', fontSize: 11, formatter: v => `${v}%` }} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Clock-In Hours{period === 'today' ? ' (Today)' : ' (Period)'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.hourly} barSize={14} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
        </>
      )}
    </div>
  );
}
