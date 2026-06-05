import { useEffect, useState } from 'react';
import { reports, departments, employees as employeesApi, units as unitsApi } from '../api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = '__all__';
const toSel = v => v || ALL;
const fromSel = v => (v === ALL ? '' : v);

export default function Reports() {
  const [summary, setSummary] = useState([]);
  const [depts, setDepts] = useState([]);
  const [emps, setEmps] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [filteredUnits, setFilteredUnits] = useState([]);
  const [period, setPeriod] = useState('week');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [range, setRange] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    departments.list().then(setDepts);
    unitsApi.list().then(u => { setAllUnits(u); setFilteredUnits(u); });
  }, []);

  useEffect(() => {
    const params = {};
    if (filterDept) params.department_id = filterDept;
    employeesApi.list(params).then(data => setEmps(data)).catch(() => setEmps([]));
    setFilterEmployee('');
    setFilterUnit('');
  }, [filterDept]);

  useEffect(() => {
    setFilteredUnits(filterDept
      ? allUnits.filter(u => String(u.department_id) === String(filterDept))
      : allUnits);
  }, [filterDept, allUnits]);

  const buildParams = () => {
    const params = { period, department_id: filterDept, unit_id: filterUnit, employee_id: filterEmployee };
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await reports.summary(buildParams());
      setSummary(data.rows);
      setRange(data.range);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [period, filterDept, filterEmployee]);

  const exportCsv = async () => {
    try {
      const blob = await reports.export(buildParams());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'attendance_report.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (_) {}
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Button variant="outline" onClick={exportCsv} className="self-start sm:self-auto">⬇ Export CSV</Button>
      </div>

      <Card>
        <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-end">
          <div>
            <label className="label">Period</label>
            <Select value={period} onValueChange={v => { setPeriod(v); setFrom(''); setTo(''); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {period === 'custom' && (
            <>
              <div>
                <label className="label">From</label>
                <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">To</label>
                <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />
              </div>
            </>
          )}

          <div>
            <label className="label">Department</label>
            <Select value={toSel(filterDept)} onValueChange={v => setFilterDept(fromSel(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL}>All Departments</SelectItem>
                {depts.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}{d.company_name ? ` (${d.company_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="label">Unit</label>
            <Select value={toSel(filterUnit)} onValueChange={v => setFilterUnit(fromSel(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL}>All Units</SelectItem>
                {filteredUnits.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="label">Employee</label>
            <Select value={toSel(filterEmployee)} onValueChange={v => setFilterEmployee(fromSel(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL}>All Employees</SelectItem>
                {emps.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name}
                    {e.employee_id ? ` · ${e.employee_id}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Button onClick={load} className="w-full sm:w-auto">Apply</Button>
          </div>
        </CardContent>
      </Card>

      {range.from && (
        <p className="text-sm text-muted-foreground">
          Showing: <strong>{range.from}</strong> to <strong>{range.to}</strong>
        </p>
      )}

      <Card className="py-0 gap-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="table-th">Employee</th>
                <th className="table-th">ID</th>
                <th className="table-th">Department</th>
                <th className="table-th">Days Present</th>
                <th className="table-th">Total Clock-Ins</th>
                <th className="table-th">Late Count</th>
                <th className="table-th">Early Count</th>
                <th className="table-th">First Clock-In</th>
                <th className="table-th">Last Clock-Out</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              )}
              {!loading && summary.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No data for this period</td></tr>
              )}
              {!loading && summary.map(row => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="table-td font-medium">{row.name}</td>
                  <td className="table-td text-xs font-mono text-muted-foreground">{row.emp_id}</td>
                  <td className="table-td">{row.department || '—'}</td>
                  <td className="table-td">
                    <span className={`font-semibold ${row.days_present > 0 ? 'text-green-700' : 'text-destructive'}`}>
                      {row.days_present}
                    </span>
                  </td>
                  <td className="table-td">{row.total_clockins}</td>
                  <td className="table-td">
                    {row.late_count > 0
                      ? <span className="badge-yellow">{row.late_count} late</span>
                      : <span className="text-green-600 text-xs font-medium">✓ On time</span>}
                  </td>
                  <td className="table-td">
                    {row.early_count > 0
                      ? <span className="badge-orange">{row.early_count} early</span>
                      : <span className="text-green-600 text-xs font-medium">✓ No early out</span>}
                  </td>
                  <td className="table-td text-xs text-muted-foreground">
                    {row.first_clock_in ? new Date(row.first_clock_in).toLocaleString() : '—'}
                  </td>
                  <td className="table-td text-xs text-muted-foreground">
                    {row.last_clock_out ? new Date(row.last_clock_out).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
