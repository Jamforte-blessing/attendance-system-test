import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { RowActions } from '../components/RowActions';
import { employees, departments, companies, units } from '../api';
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

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatWorkDays = wd => {
  if (!wd || wd === 'Mon,Tue,Wed,Thu,Fri') return 'Mon–Fri';
  if (wd === 'Mon,Tue,Wed,Thu,Fri,Sat') return 'Mon–Sat';
  return wd.replace(/,/g, ', ');
};

function StatBox({ label, value, accent }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${accent}`}>{value ?? '—'}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function TodayAttendance({ logs }) {
  if (!logs || logs.length === 0) {
    return <p className="text-sm text-muted-foreground">No attendance recorded today.</p>;
  }
  const clockIn  = logs.find(l => l.type === 'clock_in');
  const clockOut = logs.find(l => l.type === 'clock_out');

  let duration = null;
  if (clockIn) {
    const endMs = clockOut ? new Date(clockOut.timestamp).getTime() : Date.now();
    const mins = Math.round((endMs - new Date(clockIn.timestamp).getTime()) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
    if (!clockOut) duration += ' (ongoing)';
  }

  return (
    <div className="flex flex-wrap gap-6">
      {clockIn && (
        <div>
          <p className="text-xs text-muted-foreground">Clock In</p>
          <p className="text-base font-semibold">{format(new Date(clockIn.timestamp), 'HH:mm')}</p>
          {clockIn.is_late === 1 && <span className="badge-yellow text-xs">Late</span>}
        </div>
      )}
      {clockOut && (
        <div>
          <p className="text-xs text-muted-foreground">Clock Out</p>
          <p className="text-base font-semibold">{format(new Date(clockOut.timestamp), 'HH:mm')}</p>
          {clockOut.is_early === 1 && <span className="badge-orange text-xs">Early Out</span>}
        </div>
      )}
      {duration && (
        <div>
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className={`text-base font-semibold ${clockOut ? 'text-green-600' : 'text-amber-600'}`}>{duration}</p>
        </div>
      )}
      {clockIn && !clockOut && (
        <div className="flex items-end pb-0.5">
          <span className="badge-green text-xs">Currently Working</span>
        </div>
      )}
    </div>
  );
}

function EmployeeViewModal({ emp, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employees.stats(emp.id)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [emp.id]);

  return (
    <Modal title={emp.name} onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div><p className="text-xs text-muted-foreground">Employee ID</p><p className="font-mono font-medium text-sm">{emp.employee_id}</p></div>
            <div><p className="text-xs text-muted-foreground">Company</p><p className="text-sm">{emp.company_name || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Department</p><p className="text-sm">{emp.department_name || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Unit</p><p className="text-sm">{emp.unit_name || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Shift</p><p className="text-sm">{emp.shift_start} – {emp.shift_end}</p></div>
            <div><p className="text-xs text-muted-foreground">Work Days</p><p className="text-sm">{formatWorkDays(emp.work_days)}</p></div>
            {emp.email && <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm truncate">{emp.email}</p></div>}
            {emp.phone && <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm">{emp.phone}</p></div>}
          </div>

          {stats && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Today</p>
                <TodayAttendance logs={stats.today} />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  This Week <span className="normal-case font-normal">({stats.week.from} – {stats.week.to})</span>
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <StatBox label="Days Present" value={stats.week.days_present} accent="text-green-600" />
                  <StatBox label="Late Days"    value={stats.week.late_days}    accent={stats.week.late_days    > 0 ? 'text-amber-600'  : 'text-muted-foreground'} />
                  <StatBox label="Early Outs"   value={stats.week.early_outs}   accent={stats.week.early_outs   > 0 ? 'text-orange-600' : 'text-muted-foreground'} />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  This Month <span className="normal-case font-normal">({stats.month.from} – {stats.month.to})</span>
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <StatBox label="Days Present" value={stats.month.days_present} accent="text-green-600" />
                  <StatBox label="Late Days"    value={stats.month.late_days}    accent={stats.month.late_days    > 0 ? 'text-amber-600'  : 'text-muted-foreground'} />
                  <StatBox label="Early Outs"   value={stats.month.early_outs}   accent={stats.month.early_outs   > 0 ? 'text-orange-600' : 'text-muted-foreground'} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function EmployeeForm({ initial, depts, companyList, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { ...initial, work_days: initial.work_days || 'Mon,Tue,Wed,Thu,Fri' }
    : {
        employee_id: '', name: '', email: '', phone: '',
        company_id: '', department_id: '', unit_id: '',
        shift_start: '09:00', shift_end: '17:00',
        work_days: 'Mon,Tue,Wed,Thu,Fri',
      }
  );
  const [filteredDepts, setFilteredDepts] = useState(
    initial?.company_id ? depts.filter(d => String(d.company_id) === String(initial.company_id)) : depts
  );
  const [filteredUnits, setFilteredUnits] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = k => v => setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }));

  const toggleDay = day => setForm(f => {
    const current = (f.work_days || '').split(',').filter(Boolean);
    const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    return { ...f, work_days: DAYS.filter(d => updated.includes(d)).join(',') };
  });

  // Keep filteredDepts in sync when depts list loads
  useEffect(() => {
    setFilteredDepts(form.company_id ? depts.filter(d => String(d.company_id) === String(form.company_id)) : depts);
  }, [depts]);

  // Fetch units whenever department changes (also runs on mount for edit mode)
  useEffect(() => {
    if (form.department_id) {
      units.list({ department_id: form.department_id }).then(setFilteredUnits).catch(() => setFilteredUnits([]));
    } else {
      setFilteredUnits([]);
    }
  }, [form.department_id]);

  // Auto-generate employee ID in add mode whenever company / dept / unit changes
  useEffect(() => {
    if (initial || !form.company_id) return;
    employees.nextId({ company_id: form.company_id, department_id: form.department_id, unit_id: form.unit_id })
      .then(({ id }) => setForm(f => ({ ...f, employee_id: id })))
      .catch(() => {});
  }, [form.company_id, form.department_id, form.unit_id]);

  const onCompanyChange = v => {
    const company_id = fromSel(v);
    const co = companyList.find(c => String(c.id) === String(company_id));
    setFilteredDepts(company_id ? depts.filter(d => String(d.company_id) === String(company_id)) : depts);
    setForm(f => ({
      ...f,
      company_id,
      department_id: '',
      unit_id: '',
      employee_id: '',
      ...(co?.default_shift_start ? { shift_start: co.default_shift_start, shift_end: co.default_shift_end || f.shift_end } : {}),
    }));
  };

  const onDeptChange = v => {
    setForm(f => ({ ...f, department_id: fromSel(v), unit_id: '' }));
  };

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
          <label className="label">Employee ID</label>
          <input className="input bg-muted cursor-not-allowed" value={form.employee_id} readOnly placeholder="Select a company to generate" />
          {!initial && <p className="text-xs text-muted-foreground mt-1">Auto-generated from company, department, and unit.</p>}
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
          <Select value={toSel(form.company_id)} onValueChange={onCompanyChange}>
            <SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={ALL}>None</SelectItem>
              {companyList.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="label">Department</label>
          <Select value={toSel(form.department_id)} onValueChange={onDeptChange} disabled={!form.company_id}>
            <SelectTrigger className="w-full"><SelectValue placeholder={form.company_id ? 'None' : 'Select company first'} /></SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={ALL}>None</SelectItem>
              {filteredDepts.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Unit</label>
          <Select value={toSel(form.unit_id)} onValueChange={v => setForm(f => ({ ...f, unit_id: fromSel(v) }))} disabled={!form.department_id}>
            <SelectTrigger className="w-full"><SelectValue placeholder={form.department_id ? 'None' : 'Select department first'} /></SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={ALL}>None</SelectItem>
              {filteredUnits.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
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

      <div>
        <label className="label">Work Days</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {DAYS.map(day => {
            const active = (form.work_days || '').split(',').includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Only selected days count as scheduled work days for reports and absence tracking.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || (!initial && !form.employee_id)}>
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
  const [allUnits, setAllUnits] = useState([]);
  const [filterUnits, setFilterUnits] = useState([]);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [pending, setPending] = useState(null);

  const load = async () => {
    const [e, d, c, u] = await Promise.all([
      employees.list({ search, department_id: filterDept, company_id: filterCompany, unit_id: filterUnit }),
      departments.list(),
      companies.list(),
      units.list(),
    ]);
    setEmpList(e);
    setDepts(d);
    setCompanyList(c);
    setAllUnits(u);
  };

  useEffect(() => {
    if (filterDept) {
      setFilterUnits(allUnits.filter(u => String(u.department_id) === String(filterDept)));
    } else {
      setFilterUnits(allUnits);
    }
    setFilterUnit('');
  }, [filterDept, allUnits]);

  useEffect(() => { load(); }, [search, filterDept, filterCompany, filterUnit]);

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

  const handleGeneratePassword = emp =>
    setPending({
      title: `Generate a new password for ${emp.name}?`,
      description: 'This will generate a fresh login password for the employee and resend their account details by email.',
      confirmLabel: 'Generate Password',
      action: async () => {
        const result = await employees.generatePassword(emp.id);
        toast.success(result.message || 'Password generated and credentials emailed');
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
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button onClick={() => setModal('add')}>+ Add Employee</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
        <Select value={toSel(filterUnit)} onValueChange={v => setFilterUnit(fromSel(v))}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={ALL}>All Units</SelectItem>
            {filterUnits.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
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
                <th className="table-th">Unit</th>
                <th className="table-th">Shift</th>
                <th className="table-th">Work Days</th>
                <th className="table-th">Email</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {empList.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">No employees found</td></tr>
              )}
              {empList.map(emp => (
                <tr key={emp.id} className="hover:bg-muted/30">
                  <td className="table-td font-mono text-xs">{emp.employee_id}</td>
                  <td className="table-td font-medium">{emp.name}</td>
                  <td className="table-td text-muted-foreground">{emp.company_name || '—'}</td>
                  <td className="table-td">{emp.department_name || '—'}</td>
                  <td className="table-td text-muted-foreground">{emp.unit_name || '—'}</td>
                  <td className="table-td text-xs">{emp.shift_start} – {emp.shift_end}</td>
                  <td className="table-td text-xs text-muted-foreground">{formatWorkDays(emp.work_days)}</td>
                  <td className="table-td text-muted-foreground">{emp.email || '—'}</td>
                  <td className="table-td">
                    <RowActions actions={[
                      { label: 'View', onClick: () => { setSelected(emp); setModal('view'); } },
                      { label: 'Edit', onClick: () => { setSelected(emp); setModal('edit'); } },
                      ...(emp.can_generate_password ? [{ label: 'Generate Password', onClick: () => handleGeneratePassword(emp) }] : []),
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

      {modal === 'view' && selected && (
        <EmployeeViewModal emp={selected} onClose={() => { setModal(null); setSelected(null); }} />
      )}
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
