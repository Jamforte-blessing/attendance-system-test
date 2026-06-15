import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { RowActions } from '../components/RowActions';
import { attendance, employees, departments, units, companies as companiesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const ALL = '__all__';
const toSel = v => v || ALL;
const fromSel = v => (v === ALL ? '' : v);

export default function Attendance() {
  const { isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [depts, setDepts] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [filteredUnits, setFilteredUnits] = useState([]);
  const [empList, setEmpList] = useState([]);
  const [pending, setPending] = useState(null);
  const [filters, setFilters] = useState({
    date: new Date().toISOString().slice(0, 10),
    employee_id: '',
    department_id: '',
    unit_id: '',
    company_id: '',
  });

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const load = () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    attendance.list(params).then(setLogs);
  };

  // Load companies list for superadmin and units on mount
  useEffect(() => {
    if (isSuperAdmin) companiesApi.list().then(setCompaniesList).catch(() => {});
    units.list().then(u => { setAllUnits(u); setFilteredUnits(u); });
  }, [isSuperAdmin]);

  // Reload departments + employees when company filter changes
  useEffect(() => {
    const deptParams = filters.company_id ? { company_id: filters.company_id } : {};
    const empParams = { status: 'active', ...(filters.company_id ? { company_id: filters.company_id } : {}) };
    departments.list(deptParams).then(setDepts);
    employees.list(empParams).then(setEmpList);
    setFilters(f => ({ ...f, department_id: '', unit_id: '', employee_id: '' }));
  }, [filters.company_id]);

  useEffect(() => {
    setFilteredUnits(filters.department_id
      ? allUnits.filter(u => String(u.department_id) === String(filters.department_id))
      : allUnits);
    setFilters(f => ({ ...f, unit_id: '' }));
  }, [filters.department_id, allUnits]);

  useEffect(() => { load(); }, [filters]);

  // Group raw logs into one row per employee per day
  const groupedLogs = useMemo(() => {
    const map = new Map();
    logs.forEach(log => {
      const date = log.timestamp.slice(0, 10);
      const key = `${log.employee_id}_${date}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          employee_name: log.employee_name,
          emp_id: log.emp_id,
          department_name: log.department_name,
          date,
          clock_in: null,
          clock_out: null,
          clock_in_id: null,
          clock_out_id: null,
          is_late: 0,
          is_early: 0,
          is_manual: 0,
        });
      }
      const entry = map.get(key);
      if (log.type === 'clock_in') {
        if (!entry.clock_in || log.timestamp < entry.clock_in) {
          entry.clock_in = log.timestamp;
          entry.clock_in_id = log.id;
        }
        if (log.is_late === 1) entry.is_late = 1;
      }
      if (log.type === 'clock_out') {
        if (!entry.clock_out || log.timestamp > entry.clock_out) {
          entry.clock_out = log.timestamp;
          entry.clock_out_id = log.id;
        }
        if (log.is_early === 1) entry.is_early = 1;
      }
      if (log.is_manual === 1) entry.is_manual = 1;
    });
    return [...map.values()];
  }, [logs]);

  const handleDelete = id =>
    setPending({
      title: 'Delete attendance record?',
      description: 'This record will be permanently removed. This action cannot be undone.',
      action: async () => {
        await attendance.remove(id);
        toast.success('Record deleted');
        load();
      },
    });

  const clearFilters = () => setFilters({
    date: '',
    employee_id: '',
    department_id: '',
    unit_id: '',
    company_id: '',
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Attendance Logs</h1>
      </div>

      <Card>
        <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-end">
          {isSuperAdmin && (
            <div>
              <label className="label">Company</label>
              <Select value={toSel(filters.company_id)} onValueChange={v => setFilter('company_id', fromSel(v))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={ALL}>All Companies</SelectItem>
                  {companiesList.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={filters.date} onChange={e => setFilter('date', e.target.value)} />
          </div>
          <div>
            <label className="label">Employee</label>
            <Select value={toSel(filters.employee_id)} onValueChange={v => setFilter('employee_id', fromSel(v))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL}>All</SelectItem>
                {empList.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="label">Department</label>
            <Select value={toSel(filters.department_id)} onValueChange={v => setFilter('department_id', fromSel(v))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL}>All</SelectItem>
                {depts.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="label">Unit</label>
            <Select value={toSel(filters.unit_id)} onValueChange={v => setFilter('unit_id', fromSel(v))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL}>All</SelectItem>
                {filteredUnits.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0 gap-0">
        <div className="px-4 py-3 border-b">
          <span className="text-sm text-muted-foreground">
            {groupedLogs.length} day{groupedLogs.length !== 1 ? 's' : ''} · {logs.length} record{logs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="table-th">Employee</th>
                <th className="table-th">ID</th>
                <th className="table-th">Department</th>
                <th className="table-th">Date</th>
                <th className="table-th">Clock In</th>
                <th className="table-th">Clock Out</th>
                <th className="table-th">Flags</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {groupedLogs.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No records found</td></tr>
              )}
              {groupedLogs.map(row => (
                <tr key={row.key} className="hover:bg-muted/30">
                  <td className="table-td font-medium">{row.employee_name}</td>
                  <td className="table-td text-xs font-mono text-muted-foreground">{row.emp_id}</td>
                  <td className="table-td">{row.department_name || '—'}</td>
                  <td className="table-td">
                    <span className="font-medium">{format(new Date(row.date + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                    <span className="text-xs text-muted-foreground ml-1">{format(new Date(row.date + 'T00:00:00'), 'EEE')}</span>
                  </td>
                  <td className="table-td">
                    {row.clock_in
                      ? <span className="font-semibold text-green-700">{format(new Date(row.clock_in), 'HH:mm')}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="table-td">
                    {row.clock_out
                      ? <span className="font-semibold">{format(new Date(row.clock_out), 'HH:mm')}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="table-td">
                    <div className="flex gap-1 flex-wrap">
                      {row.is_late === 1 && <span className="badge-yellow">Late</span>}
                      {row.is_early === 1 && <span className="badge-orange">Early Out</span>}
                      {row.is_manual === 1 && <span className="badge-blue">Manual</span>}
                    </div>
                  </td>
                  <td className="table-td">
                    <RowActions actions={[
                      ...(row.clock_in_id ? [{ label: 'Delete Clock In', onClick: () => handleDelete(row.clock_in_id), variant: 'destructive' }] : []),
                      ...(row.clock_in_id && row.clock_out_id ? ['separator'] : []),
                      ...(row.clock_out_id ? [{ label: 'Delete Clock Out', onClick: () => handleDelete(row.clock_out_id), variant: 'destructive' }] : []),
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AlertDialog open={!!pending} onOpenChange={open => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { pending?.action(); setPending(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
