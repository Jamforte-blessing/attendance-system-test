import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { RowActions } from '../components/RowActions';
import { attendance, employees, departments } from '../api';

function ManualEntryForm({ onSave, onClose }) {
  const [empList, setEmpList] = useState([]);
  const [form, setForm] = useState({ employee_id: '', type: 'clock_in', timestamp: '', notes: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => { employees.list({ status: 'active' }).then(setEmpList); }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Employee *</label>
        <select className="input" value={form.employee_id} onChange={set('employee_id')} required>
          <option value="">Select employee...</option>
          {empList.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Type *</label>
          <select className="input" value={form.type} onChange={set('type')}>
            <option value="clock_in">Clock In</option>
            <option value="clock_out">Clock Out</option>
          </select>
        </div>
        <div>
          <label className="label">Timestamp</label>
          <input type="datetime-local" className="input" value={form.timestamp} onChange={set('timestamp')} />
          <p className="text-xs text-gray-400 mt-1">Leave blank for now</p>
        </div>
      </div>
      <div>
        <label className="label">Notes (reason for manual entry)</label>
        <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} placeholder="e.g. Device was offline" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">Add Record</button>
      </div>
    </form>
  );
}

export default function Attendance() {
  const [logs, setLogs] = useState([]);
  const [depts, setDepts] = useState([]);
  const [empList, setEmpList] = useState([]);
  const [modal, setModal] = useState(false);
  const [filters, setFilters] = useState({
    date: new Date().toISOString().slice(0, 10),
    employee_id: '',
    department_id: '',
    type: '',
  });

  const setFilter = k => e => setFilters(f => ({ ...f, [k]: e.target.value }));

  const load = async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    attendance.list(params).then(setLogs);
  };

  useEffect(() => {
    departments.list().then(setDepts);
    employees.list({ status: 'active' }).then(setEmpList);
  }, []);

  useEffect(() => { load(); }, [filters]);

  const handleManual = data => attendance.addManual(data).then(() => { toast.success('Record added'); load(); });
  const handleDelete = async id => {
    if (!confirm('Delete this attendance record?')) return;
    await attendance.remove(id);
    toast.success('Record deleted');
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Attendance Logs</h1>
        <button onClick={() => setModal(true)} className="btn-primary self-start sm:self-auto">+ Manual Entry</button>
      </div>

      {/* Filters */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={filters.date} onChange={setFilter('date')} />
        </div>
        <div>
          <label className="label">Employee</label>
          <select className="input" value={filters.employee_id} onChange={setFilter('employee_id')}>
            <option value="">All</option>
            {empList.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Department</label>
          <select className="input" value={filters.department_id} onChange={setFilter('department_id')}>
            <option value="">All</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={filters.type} onChange={setFilter('type')}>
            <option value="">All</option>
            <option value="clock_in">Clock In</option>
            <option value="clock_out">Clock Out</option>
          </select>
        </div>
        <div>
          <button onClick={() => setFilters({ date: '', employee_id: '', department_id: '', type: '' })}
            className="btn-secondary btn-sm w-full sm:w-auto">Clear Filters</button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="text-sm text-gray-500">{logs.length} record{logs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-th">Employee</th>
                <th className="table-th">ID</th>
                <th className="table-th">Department</th>
                <th className="table-th">Type</th>
                <th className="table-th">Time</th>
                <th className="table-th">Flags</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No records found</td></tr>
              )}
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="table-td font-medium">{log.employee_name}</td>
                  <td className="table-td text-xs font-mono text-gray-500">{log.emp_id}</td>
                  <td className="table-td">{log.department_name || '—'}</td>
                  <td className="table-td">
                    <span className={log.type === 'clock_in' ? 'badge-green' : 'badge-gray'}>
                      {log.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                    </span>
                  </td>
                  <td className="table-td">
                    <span className="font-medium">{format(new Date(log.timestamp), 'HH:mm')}</span>
                    <span className="text-xs text-gray-400 ml-1">{format(new Date(log.timestamp), 'dd/MM/yyyy')}</span>
                  </td>
                  <td className="table-td">
                    <div className="flex gap-1 flex-wrap">
                      {log.is_late === 1 && <span className="badge-yellow">Late</span>}
                      {log.is_early === 1 && <span className="badge-orange">Early Out</span>}
                      {log.is_manual === 1 && <span className="badge-blue">Manual</span>}
                    </div>
                  </td>
                  <td className="table-td">
                    <RowActions actions={[
                      { label: 'Delete', onClick: () => handleDelete(log.id), variant: 'destructive' },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title="Manual Attendance Entry" onClose={() => setModal(false)}>
          <ManualEntryForm onSave={handleManual} onClose={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
