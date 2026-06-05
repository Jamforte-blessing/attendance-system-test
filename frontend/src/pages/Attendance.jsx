import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { RowActions } from '../components/RowActions';
import { attendance, employees, departments, units } from '../api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const ALL = '__all__';
const toSel = v => v || ALL;
const fromSel = v => (v === ALL ? '' : v);

export default function Attendance() {
  const [logs, setLogs] = useState([]);
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
    type: '',
  });

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const load = async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    attendance.list(params).then(setLogs);
  };

  useEffect(() => {
    departments.list().then(setDepts);
    units.list().then(u => { setAllUnits(u); setFilteredUnits(u); });
    employees.list({ status: 'active' }).then(setEmpList);
  }, []);

  useEffect(() => {
    setFilteredUnits(filters.department_id
      ? allUnits.filter(u => String(u.department_id) === String(filters.department_id))
      : allUnits);
    setFilters(f => ({ ...f, unit_id: '' }));
  }, [filters.department_id, allUnits]);

  useEffect(() => { load(); }, [filters]);

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

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Attendance Logs</h1>
      </div>

      <Card>
        <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-end">
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
            <label className="label">Type</label>
            <Select value={toSel(filters.type)} onValueChange={v => setFilter('type', fromSel(v))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL}>All</SelectItem>
                <SelectItem value="clock_in">Clock In</SelectItem>
                <SelectItem value="clock_out">Clock Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button type="button" variant="outline" size="sm"
              onClick={() => setFilters({ date: '', employee_id: '', department_id: '', unit_id: '', type: '' })}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0 gap-0">
        <div className="px-4 py-3 border-b">
          <span className="text-sm text-muted-foreground">{logs.length} record{logs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
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
            <tbody className="divide-y">
              {logs.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No records found</td></tr>
              )}
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-muted/30">
                  <td className="table-td font-medium">{log.employee_name}</td>
                  <td className="table-td text-xs font-mono text-muted-foreground">{log.emp_id}</td>
                  <td className="table-td">{log.department_name || '—'}</td>
                  <td className="table-td">
                    <span className={log.type === 'clock_in' ? 'badge-green' : 'badge-gray'}>
                      {log.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                    </span>
                  </td>
                  <td className="table-td">
                    <span className="font-medium">{format(new Date(log.timestamp), 'HH:mm')}</span>
                    <span className="text-xs text-muted-foreground ml-1">{format(new Date(log.timestamp), 'dd/MM/yyyy')}</span>
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
