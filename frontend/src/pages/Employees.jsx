import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { RowActions } from '../components/RowActions';
import { employees, departments, companies } from '../api';

function EmployeeForm({ initial, depts, companyList, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    employee_id: '', name: '', email: '', phone: '',
    company_id: '', department_id: '',
    shift_start: '09:00', shift_end: '17:00',
  });
  const [filteredDepts, setFilteredDepts] = useState(depts);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // When company changes, filter departments to that company
  useEffect(() => {
    if (form.company_id) {
      setFilteredDepts(depts.filter(d => String(d.company_id) === String(form.company_id)));
    } else {
      setFilteredDepts(depts);
    }
    // Clear department if it no longer belongs to the selected company
    setForm(f => ({ ...f, department_id: '' }));
  }, [form.company_id, depts]);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Employee ID *</label>
          <input className="input" value={form.employee_id} onChange={set('employee_id')} required disabled={!!initial} />
        </div>
        <div>
          <label className="label">Full Name *</label>
          <input className="input" value={form.name} onChange={set('name')} required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={set('phone')} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Company</label>
          <select className="input" value={form.company_id} onChange={set('company_id')}>
            <option value="">None</option>
            {companyList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Department</label>
          <select className="input" value={form.department_id} onChange={set('department_id')}>
            <option value="">None</option>
            {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Shift Start</label>
          <input type="time" className="input" value={form.shift_start} onChange={set('shift_start')} />
        </div>
        <div>
          <label className="label">Shift End</label>
          <input type="time" className="input" value={form.shift_end} onChange={set('shift_end')} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">{initial ? 'Save Changes' : 'Add Employee'}</button>
      </div>
    </form>
  );
}

export default function Employees() {
  const [empList, setEmpList] = useState([]);
  const [depts, setDepts] = useState([]);
  const [companyList, setCompanyList] = useState([]);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  const load = async () => {
    const [e, d, c] = await Promise.all([
      employees.list({ search, department_id: filterDept, company_id: filterCompany }),
      departments.list(),
      companies.list(),
    ]);
    setEmpList(e);
    setDepts(d);
    setCompanyList(c);
  };

  useEffect(() => { load(); }, [search, filterDept, filterCompany]);

  const handleAdd = data => employees.create(data).then(() => { toast.success('Employee added'); load(); });
  const handleEdit = data => employees.update(selected.id, data).then(() => { toast.success('Employee updated'); load(); });
  const handleDeactivate = async emp => {
    if (!confirm(`Deactivate ${emp.name}?`)) return;
    await employees.remove(emp.id);
    toast.success('Employee deactivated');
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <button onClick={() => setModal('add')} className="btn-primary self-start sm:self-auto">+ Add Employee</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          className="input"
          placeholder="Search name or ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          <option value="">All Companies</option>
          {companyList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="table-th">ID</th>
              <th className="table-th">Name</th>
              <th className="table-th">Company</th>
              <th className="table-th">Department</th>
              <th className="table-th">Shift</th>
              <th className="table-th">Email</th>
              <th className="table-th">Status</th>
              <th className="table-th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {empList.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No employees found</td></tr>
            )}
            {empList.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="table-td font-mono text-xs">{emp.employee_id}</td>
                <td className="table-td font-medium">{emp.name}</td>
                <td className="table-td text-gray-500">{emp.company_name || '—'}</td>
                <td className="table-td">{emp.department_name || '—'}</td>
                <td className="table-td text-xs">{emp.shift_start} – {emp.shift_end}</td>
                <td className="table-td text-gray-500">{emp.email || '—'}</td>
                <td className="table-td">
                  <span className={emp.status === 'active' ? 'badge-green' : 'badge-gray'}>
                    {emp.status}
                  </span>
                </td>
                <td className="table-td">
                  <RowActions actions={[
                    { label: 'Edit', onClick: () => { setSelected(emp); setModal('edit'); } },
                    ...(emp.status === 'active' ? ['separator', { label: 'Deactivate', onClick: () => handleDeactivate(emp), variant: 'destructive' }] : []),
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {modal === 'add' && (
        <Modal title="Add Employee" onClose={() => setModal(null)}>
          <EmployeeForm depts={depts} companyList={companyList} onSave={handleAdd} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'edit' && selected && (
        <Modal title="Edit Employee" onClose={() => setModal(null)}>
          <EmployeeForm initial={selected} depts={depts} companyList={companyList} onSave={handleEdit} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
