import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { RowActions } from '../components/RowActions';
import { companies, departments as deptApi } from '../api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircleIcon } from 'lucide-react';

function CompanyForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, address: initial.address || '', radius_meters: initial.radius_meters || 100 }
      : { name: '', address: '', radius_meters: 100 }
  );
  const [coords, setCoords] = useState(
    initial?.latitude != null ? { latitude: parseFloat(initial.latitude), longitude: parseFloat(initial.longitude) } : null
  );
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const captureLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation is not supported by this browser.'); return; }
    setCapturing(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      pos => { setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setCapturing(false); },
      () => { setError('Could not get location. Make sure location access is allowed.'); setCapturing(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({ ...form, ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}) });
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Company Name *</label>
        <input className="input" value={form.name} onChange={set('name')} required placeholder="e.g. Acme Corp" />
      </div>
      <div>
        <label className="label">Address</label>
        <input className="input" value={form.address} onChange={set('address')} placeholder="e.g. 12 Lagos Street, Ikeja" />
      </div>
      <div>
        <label className="label">Allowed Radius (metres)</label>
        <input type="number" min="10" max="5000" className="input max-w-xs" value={form.radius_meters} onChange={set('radius_meters')} />
      </div>

      <div className="border-t pt-4 space-y-3">
        <p className="text-sm font-medium">Workplace Location</p>
        <p className="text-xs text-muted-foreground">
          Stand at the workplace entrance and click <strong>Capture Location</strong>. Employees must be within the allowed radius to clock in.
        </p>
        {coords ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-0.5">
            <p className="text-xs font-semibold text-green-800">Location captured</p>
            <p className="text-xs text-green-700 font-mono">Lat: {coords.latitude.toFixed(6)}</p>
            <p className="text-xs text-green-700 font-mono">Lng: {coords.longitude.toFixed(6)}</p>
          </div>
        ) : (
          <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground text-center">
            No location set yet
          </div>
        )}
        <Button type="button" variant="outline" className="w-full" onClick={captureLocation} disabled={capturing || saving}>
          {capturing && <Spinner className="mr-2" />}
          {capturing ? 'Getting location...' : coords ? 'Update Location' : 'Capture Location'}
        </Button>
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
          {saving ? 'Saving...' : initial ? 'Save Changes' : 'Add Company'}
        </Button>
      </div>
    </form>
  );
}

function DepartmentsModal({ company, onClose }) {
  const [depts, setDepts] = useState([]);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [pending, setPending] = useState(null);

  const load = () => companies.departments(company.id).then(setDepts).catch(() => {});
  useEffect(() => { load(); }, [company.id]);

  const add = async e => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await companies.addDepartment(company.id, { name: newName.trim() });
      setNewName('');
      load();
      toast.success('Department added');
    } catch (err) { toast.error(err); }
    setAdding(false);
  };

  const removeDept = (deptId, name) =>
    setPending({
      title: `Delete "${name}"?`,
      description: 'This department will be permanently deleted.',
      action: async () => {
        await companies.removeDepartment(company.id, deptId);
        load();
        toast.success('Department deleted');
      },
    });

  const saveEdit = async e => {
    e.preventDefault();
    if (!editing.name.trim()) return;
    setEditSaving(true);
    try {
      await deptApi.update(editing.id, { name: editing.name.trim(), company_id: company.id });
      setEditing(null);
      load();
      toast.success('Department renamed');
    } catch (err) { toast.error(err); }
    setEditSaving(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Departments for <strong>{company.name}</strong>
      </p>

      {depts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No departments yet</p>
      ) : (
        <div className="space-y-2">
          {depts.map(d => (
            <div key={d.id} className="p-3 bg-muted/50 rounded-lg">
              {editing?.id === d.id ? (
                <form onSubmit={saveEdit} className="flex items-center gap-2">
                  <input className="input flex-1 py-1.5 text-sm" value={editing.name} onChange={e => setEditing(v => ({ ...v, name: e.target.value }))} autoFocus />
                  <Button type="submit" size="sm" disabled={editSaving}>
                    {editSaving && <Spinner className="mr-1" />}
                    {editSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)} disabled={editSaving}>Cancel</Button>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.employee_count} employee{d.employee_count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ id: d.id, name: d.name })}>Edit</Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => removeDept(d.id, d.name)}>Delete</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="flex gap-3 border-t pt-4">
        <input className="input flex-1" placeholder="New department name..." value={newName} onChange={e => setNewName(e.target.value)} />
        <Button type="submit" className="whitespace-nowrap" disabled={adding}>
          {adding && <Spinner className="mr-2" />}
          {adding ? 'Adding...' : 'Add'}
        </Button>
      </form>

      <div className="flex justify-end pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Done</Button>
      </div>

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

export default function Companies() {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null);

  const load = () => companies.list().then(setList).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleAdd = async data => {
    const { latitude, longitude, ...companyData } = data;
    const res = await companies.create(companyData);
    if (latitude != null && res?.id) {
      await companies.setLocation(res.id, { latitude, longitude, radius_meters: companyData.radius_meters });
    }
    toast.success('Company added');
    load();
  };

  const handleEdit = async data => {
    const { latitude, longitude, ...companyData } = data;
    await companies.update(selected.id, companyData);
    if (latitude != null) {
      await companies.setLocation(selected.id, { latitude, longitude, radius_meters: companyData.radius_meters });
    }
    toast.success('Company updated');
    load();
  };

  const handleDelete = company =>
    setPending({
      title: `Delete ${company.name}?`,
      description: 'All employees and departments will be unlinked. This action cannot be undone.',
      action: async () => {
        await companies.remove(company.id);
        toast.success('Company deleted');
        load();
      },
    });

  const open = (mode, company = null) => { setSelected(company); setModal(mode); };
  const close = () => { setModal(null); setSelected(null); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Each company has its own employees, departments, and workplace location for clock-in validation.
          </p>
        </div>
        <Button onClick={() => open('add')} className="self-start sm:self-auto">+ Add Company</Button>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <p className="font-medium text-muted-foreground">No companies yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add a company to start managing employees.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0 gap-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="table-th">Company</th>
                  <th className="table-th">Address</th>
                  <th className="table-th">Location</th>
                  <th className="table-th">Radius</th>
                  <th className="table-th">Employees</th>
                  <th className="table-th">Departments</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map(c => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="table-td font-medium">{c.name}</td>
                    <td className="table-td text-muted-foreground text-xs">{c.address || '—'}</td>
                    <td className="table-td">
                      {c.latitude != null ? <span className="badge-green">Set</span> : <span className="badge-yellow">Not set</span>}
                    </td>
                    <td className="table-td">{c.radius_meters}m</td>
                    <td className="table-td">{c.employee_count}</td>
                    <td className="table-td">{c.department_count}</td>
                    <td className="table-td">
                      <RowActions actions={[
                        { label: 'Departments', onClick: () => open('departments', c) },
                        { label: 'Edit', onClick: () => open('edit', c) },
                        'separator',
                        { label: 'Delete', onClick: () => handleDelete(c), variant: 'destructive' },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal === 'add' && <Modal title="Add Company" onClose={close} size="md"><CompanyForm onSave={handleAdd} onClose={close} /></Modal>}
      {modal === 'edit' && selected && <Modal title="Edit Company" onClose={close} size="md"><CompanyForm initial={selected} onSave={handleEdit} onClose={close} /></Modal>}
      {modal === 'departments' && selected && <Modal title={`Departments — ${selected.name}`} onClose={close} size="md"><DepartmentsModal company={selected} onClose={close} /></Modal>}

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
