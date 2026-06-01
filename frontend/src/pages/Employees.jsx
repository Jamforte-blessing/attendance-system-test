import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { RowActions } from '../components/RowActions';
import { employees, departments, companies } from '../api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircleIcon } from 'lucide-react';

const ALL = '__all__';
const toSel = v => v || ALL;
const fromSel = v => (v === ALL ? '' : v);

function EmployeeForm({ initial, depts, companyList, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    employee_id: '', name: '', email: '', phone: '',
    company_id: '', department_id: '',
    shift_start: '09:00', shift_end: '17:00',
  });
  const [filteredDepts, setFilteredDepts] = useState(depts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = k => v => setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }));

  useEffect(() => {
    if (form.company_id) {
      setFilteredDepts(depts.filter(d => String(d.company_id) === String(form.company_id)));
      if (!initial) {
        employees.nextId(form.company_id)
          .then(({ id }) => setForm(f => ({ ...f, employee_id: id })))
          .catch(() => {});
      }
    } else {
      setFilteredDepts(depts);
      if (!initial) setForm(f => ({ ...f, employee_id: '' }));
    }
    setForm(f => ({ ...f, department_id: '' }));
  }, [form.company_id, depts]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Employee ID *</label>
          <input className="input" value={form.employee_id} onChange={set('employee_id')} required disabled={!!initial} placeholder="Select a company to generate" />
          {!initial && <p className="text-xs text-muted-foreground mt-1">Auto-generated from company name. You can edit it.</p>}
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
          <Select value={toSel(form.company_id)} onValueChange={v => set('company_id')(fromSel(v))}>
            <SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={ALL}>None</SelectItem>
              {companyList.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="label">Department</label>
          <Select value={toSel(form.department_id)} onValueChange={v => set('department_id')(fromSel(v))}>
            <SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={ALL}>None</SelectItem>
              {filteredDepts.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
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

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner className="mr-2" />}
          {saving ? 'Saving...' : initial ? 'Save Changes' : 'Add Employee'}
        </Button>
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
  const [pending, setPending] = useState(null);

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

  const handleDeactivate = emp =>
    setPending({
      title: `Deactivate ${emp.name}?`,
      description: 'This employee will be deactivated and will no longer be able to clock in.',
      confirmLabel: 'Deactivate',
      action: async () => {
        await employees.remove(emp.id);
        toast.success('Employee deactivated');
        load();
      },
    });

  const handleDelete = emp =>
    setPending({
      title: `Permanently delete ${emp.name}?`,
      description: 'This will permanently delete the employee and all their attendance records. This cannot be undone.',
      confirmLabel: 'Delete Permanently',
      action: async () => {
        await employees.destroy(emp.id);
        toast.success('Employee deleted');
        load();
      },
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Button onClick={() => setModal('add')} className="self-start sm:self-auto">+ Add Employee</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input className="input" placeholder="Search name or ID..." value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={toSel(filterCompany)} onValueChange={v => setFilterCompany(fromSel(v))}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={ALL}>All Companies</SelectItem>
            {companyList.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={toSel(filterDept)} onValueChange={v => setFilterDept(fromSel(v))}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={ALL}>All Departments</SelectItem>
            {depts.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0 gap-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
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
            <tbody className="divide-y">
              {empList.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No employees found</td></tr>
              )}
              {empList.map(emp => (
                <tr key={emp.id} className="hover:bg-muted/30">
                  <td className="table-td font-mono text-xs">{emp.employee_id}</td>
                  <td className="table-td font-medium">{emp.name}</td>
                  <td className="table-td text-muted-foreground">{emp.company_name || '—'}</td>
                  <td className="table-td">{emp.department_name || '—'}</td>
                  <td className="table-td text-xs">{emp.shift_start} – {emp.shift_end}</td>
                  <td className="table-td text-muted-foreground">{emp.email || '—'}</td>
                  <td className="table-td">
                    <span className={emp.status === 'active' ? 'badge-green' : 'badge-gray'}>{emp.status}</span>
                  </td>
                  <td className="table-td">
                    <RowActions actions={[
                      { label: 'Edit', onClick: () => { setSelected(emp); setModal('edit'); } },
                      ...(emp.status === 'active' ? ['separator', { label: 'Deactivate', onClick: () => handleDeactivate(emp), variant: 'destructive' }] : []),
                      'separator',
                      { label: 'Delete Permanently', onClick: () => handleDelete(emp), variant: 'destructive' },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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

      <AlertDialog open={!!pending} onOpenChange={open => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { pending?.action(); setPending(null); }}>
              {pending?.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
