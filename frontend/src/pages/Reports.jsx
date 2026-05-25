import { useEffect, useState } from 'react';
import { reports, departments } from '../api';

export default function Reports() {
  const [summary, setSummary] = useState([]);
  const [depts, setDepts] = useState([]);
  const [period, setPeriod] = useState('week');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [range, setRange] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { departments.list().then(setDepts); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = { period, department_id: filterDept };
      if (from) params.from = from;
      if (to) params.to = to;
      const data = await reports.summary(params);
      setSummary(data.rows);
      setRange(data.range);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [period, filterDept]);

  const exportCsv = () => {
    const params = { period, department_id: filterDept };
    if (from) params.from = from;
    if (to) params.to = to;
    window.open(reports.exportUrl(params), '_blank');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <button onClick={exportCsv} className="btn-secondary self-start sm:self-auto">⬇ Export CSV</button>
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label className="label">Period</label>
          <select className="input" value={period} onChange={e => { setPeriod(e.target.value); setFrom(''); setTo(''); }}>
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
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
          <select className="input" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}{d.company_name ? ` (${d.company_name})` : ''}</option>)}
          </select>
        </div>
        <div>
          <button onClick={load} className="btn-primary w-full sm:w-auto">Apply</button>
        </div>
      </div>

      {range.from && (
        <p className="text-sm text-gray-500">
          Showing: <strong>{range.from}</strong> to <strong>{range.to}</strong>
        </p>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-th">Employee</th>
                <th className="table-th">ID</th>
                <th className="table-th">Department</th>
                <th className="table-th">Days Present</th>
                <th className="table-th">Total Clock-Ins</th>
                <th className="table-th">Late Count</th>
                <th className="table-th">First Clock-In</th>
                <th className="table-th">Last Clock-Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
              )}
              {!loading && summary.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No data for this period</td></tr>
              )}
              {!loading && summary.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="table-td font-medium">{row.name}</td>
                  <td className="table-td text-xs font-mono text-gray-500">{row.emp_id}</td>
                  <td className="table-td">{row.department || '—'}</td>
                  <td className="table-td">
                    <span className={`font-semibold ${row.days_present > 0 ? 'text-green-700' : 'text-red-500'}`}>
                      {row.days_present}
                    </span>
                  </td>
                  <td className="table-td">{row.total_clockins}</td>
                  <td className="table-td">
                    {row.late_count > 0 ? (
                      <span className="badge-yellow">{row.late_count} late</span>
                    ) : <span className="text-green-600 text-xs font-medium">✓ On time</span>}
                  </td>
                  <td className="table-td text-xs text-gray-500">
                    {row.first_clock_in ? new Date(row.first_clock_in).toLocaleString() : '—'}
                  </td>
                  <td className="table-td text-xs text-gray-500">
                    {row.last_clock_out ? new Date(row.last_clock_out).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
