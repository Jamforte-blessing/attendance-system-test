import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { RowActions } from '../components/RowActions';
import { companies, departments as deptApi, units as unitApi } from '../api';
import { getAveragedPosition } from '../utils/geolocation';
import { MapPicker } from '../components/MapPicker';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircleIcon } from 'lucide-react';

function CompanyForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, address: initial.address || '', radius_meters: initial.radius_meters || 100,
          default_shift_start: initial.default_shift_start || '09:00', default_shift_end: initial.default_shift_end || '17:00' }
      : { name: '', address: '', radius_meters: 100, default_shift_start: '09:00', default_shift_end: '17:00' }
  );
  const [coords, setCoords] = useState(
    initial?.latitude != null ? { latitude: parseFloat(initial.latitude), longitude: parseFloat(initial.longitude) } : null
  );
  const [locMode, setLocMode] = useState('map');
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = k => e => {
    const value = k === 'radius_meters' ? (e.target.value === '' ? '' : parseInt(e.target.value, 10)) : e.target.value;
    setForm(f => ({ ...f, [k]: value }));
  };

  const captureLocation = () => {
    setCapturing(true);
    setError('');
    getAveragedPosition(15, 500)
      .then(coords => { setCoords(coords); setCapturing(false); })
      .catch(err => { setError(typeof err === 'string' ? err : 'Could not get location. Make sure location access is allowed.'); setCapturing(false); });
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Default Shift Start</label>
          <input type="time" className="input" value={form.default_shift_start} onChange={set('default_shift_start')} />
        </div>
        <div>
          <label className="label">Default Shift End</label>
          <input type="time" className="input" value={form.default_shift_end} onChange={set('default_shift_end')} />
        </div>
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Workplace Location</p>
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setLocMode('map')}
              className={`px-3 py-1.5 transition-colors ${locMode === 'map' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              Pick on Map
            </button>
            <button
              type="button"
              onClick={() => setLocMode('gps')}
              className={`px-3 py-1.5 border-l transition-colors ${locMode === 'gps' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              Use GPS
            </button>
          </div>
        </div>

        {locMode === 'map' ? (
          <MapPicker coords={coords} onChange={setCoords} searchHint={form.address} />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Stand at the workplace entrance and click <strong>Capture Location</strong>.
            </p>
            {coords ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-0.5">
                <p className="text-xs font-semibold text-green-800">Location captured</p>
                <p className="text-xs text-green-700 font-mono">Lat: {coords.latitude.toFixed(6)}</p>
                <p className="text-xs text-green-700 font-mono">Lng: {coords.longitude.toFixed(6)}</p>
              </div>
            ) : (
              <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground text-center">No location set yet</div>
            )}
            <Button type="button" variant="outline" className="w-full" onClick={captureLocation} disabled={capturing || saving}>
              {capturing && <Spinner className="mr-2" />}
              {capturing ? 'Getting location...' : coords ? 'Update Location' : 'Capture Location'}
            </Button>
          </>
        )}
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

function UnitsPanel({ dept, companyId }) {
  const [unitList, setUnitList] = useState([]);
  const [newUnit, setNewUnit] = useState('');
  const [editingUnit, setEditingUnit] = useState(null);
  const [addingUnit, setAddingUnit] = useState(false);
  const [unitSaving, setUnitSaving] = useState(false);
  const [pending, setPending] = useState(null);

  const loadUnits = () => unitApi.list({ department_id: dept.id }).then(setUnitList).catch(() => {});
  useEffect(() => { loadUnits(); }, [dept.id]);

  const addUnit = async e => {
    e.preventDefault();
    if (!newUnit.trim()) return;
    setAddingUnit(true);
    try {
      await unitApi.create({ name: newUnit.trim(), department_id: dept.id });
      setNewUnit('');
      loadUnits();
      toast.success('Unit added');
    } catch (err) { toast.error(err); }
    setAddingUnit(false);
  };

  const saveUnit = async e => {
    e.preventDefault();
    if (!editingUnit.name.trim()) return;
    setUnitSaving(true);
    try {
      await unitApi.update(editingUnit.id, { name: editingUnit.name.trim() });
      setEditingUnit(null);
      loadUnits();
      toast.success('Unit renamed');
    } catch (err) { toast.error(err); }
    setUnitSaving(false);
  };

  const removeUnit = (unitId, name) =>
    setPending({
      title: `Delete unit "${name}"?`,
      description: 'This unit will be permanently deleted.',
      action: async () => {
        await unitApi.remove(unitId);
        loadUnits();
        toast.success('Unit deleted');
      },
    });

  return (
    <div className="mt-2 ml-4 border-l-2 border-muted pl-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Units</p>
      {unitList.length === 0 && (
        <p className="text-xs text-muted-foreground">No units yet</p>
      )}
      {unitList.map(u => (
        <div key={u.id} className="bg-background rounded p-2">
          {editingUnit?.id === u.id ? (
            <form onSubmit={saveUnit} className="flex items-center gap-2">
              <input className="input flex-1 py-1 text-xs" value={editingUnit.name} onChange={e => setEditingUnit(v => ({ ...v, name: e.target.value }))} autoFocus />
              <Button type="submit" size="sm" disabled={unitSaving}>{unitSaving ? 'Saving...' : 'Save'}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingUnit(null)} disabled={unitSaving}>Cancel</Button>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{u.name}</span>
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingUnit({ id: u.id, name: u.name })}>Edit</Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => removeUnit(u.id, u.name)}>Delete</Button>
              </div>
            </div>
          )}
        </div>
      ))}
      <form onSubmit={addUnit} className="flex gap-2 pt-1">
        <input className="input flex-1 py-1 text-xs" placeholder="New unit name..." value={newUnit} onChange={e => setNewUnit(e.target.value)} />
        <Button type="submit" size="sm" disabled={addingUnit}>{addingUnit ? 'Adding...' : 'Add Unit'}</Button>
      </form>

      <AlertDialog open={!!pending} onOpenChange={open => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { pending?.action(); setPending(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UpdateLocationModal({ company, onClose, onUpdate }) {
  const [coords, setCoords] = useState(
    company?.latitude != null ? { latitude: parseFloat(company.latitude), longitude: parseFloat(company.longitude) } : null
  );
  const [radius_meters, setRadius] = useState(company?.radius_meters || 100);
  const [locMode, setLocMode] = useState('map');
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const radiusRef = useRef(radius_meters);

  useEffect(() => { radiusRef.current = radius_meters; }, [radius_meters]);

  useEffect(() => {
    if (!autoUpdate) return;

    const capture = async () => {
      try {
        const pos = await getAveragedPosition(5, 500);
        setCoords(pos);
        await companies.setLocation(company.id, {
          latitude: pos.latitude,
          longitude: pos.longitude,
          radius_meters: radiusRef.current,
        });
        setLastSaved(new Date());
        onUpdate();
      } catch (_) {}
    };

    capture();
    const id = setInterval(capture, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [autoUpdate]);

  const captureLocation = () => {
    setCapturing(true);
    setError('');
    getAveragedPosition(12, 500)
      .then(c => { setCoords(c); setCapturing(false); })
      .catch(err => { setError(typeof err === 'string' ? err : 'Could not get location. Make sure location access is allowed.'); setCapturing(false); });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!coords) { setError('Please capture a location'); return; }
    setError('');
    setSaving(true);
    try {
      await companies.setLocation(company.id, { latitude: coords.latitude, longitude: coords.longitude, radius_meters });
      toast.success('Location updated');
      onUpdate();
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to update location');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Stand at the workplace entrance and click <strong>Capture Location</strong>. Employees must be within the allowed radius to clock in.
      </p>

      <div>
        <label className="label">Allowed Radius (metres)</label>
        <input
          type="number"
          min="10"
          max="5000"
          className="input max-w-xs"
          value={radius_meters}
          onChange={e => setRadius(parseInt(e.target.value, 10))}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Use 150–200m if employees are frequently blocked — consumer GPS can drift ±30m indoors.
        </p>
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Workplace Location</p>
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => { setLocMode('map'); setAutoUpdate(false); }}
              className={`px-3 py-1.5 transition-colors ${locMode === 'map' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              Pick on Map
            </button>
            <button
              type="button"
              onClick={() => setLocMode('gps')}
              className={`px-3 py-1.5 border-l transition-colors ${locMode === 'gps' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              Use GPS
            </button>
          </div>
        </div>

        {locMode === 'map' ? (
          <MapPicker coords={coords} onChange={setCoords} searchHint={company?.address || ''} />
        ) : (
          <>
            {coords ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-0.5">
                <p className="text-xs font-semibold text-green-800">
                  {lastSaved ? `Auto-updated at ${lastSaved.toLocaleTimeString()}` : 'Location captured'}
                </p>
                <p className="text-xs text-green-700 font-mono">Lat: {coords.latitude.toFixed(6)}</p>
                <p className="text-xs text-green-700 font-mono">Lng: {coords.longitude.toFixed(6)}</p>
              </div>
            ) : (
              <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground text-center">
                No location selected yet
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={captureLocation}
              disabled={capturing || saving || autoUpdate}
            >
              {capturing && <Spinner className="mr-2" />}
              {capturing ? 'Getting location...' : coords ? 'Recapture Location' : 'Capture Location'}
            </Button>
          </>
        )}
      </div>

      {locMode === 'gps' && (
        <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoUpdate}
              onChange={e => setAutoUpdate(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-sm font-medium">Auto-update location every 2 minutes</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Keep this modal open on the kiosk device. The coordinates will refresh automatically so employees can always clock in.
          </p>
          {autoUpdate && (
            <p className={`text-xs font-medium ${lastSaved ? 'text-green-700' : 'text-muted-foreground'}`}>
              {lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()} · Next update in ~2 min` : 'Fetching first reading…'}
            </p>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          {autoUpdate ? 'Stop & Close' : 'Cancel'}
        </Button>
        {!autoUpdate && (
          <Button type="submit" disabled={saving || !coords}>
            {saving && <Spinner className="mr-2" />}
            {saving ? 'Updating...' : 'Update Location'}
          </Button>
        )}
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
  const [expandedUnits, setExpandedUnits] = useState({});
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
      description: 'This department and all its units will be permanently deleted.',
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

  const toggleUnits = id => setExpandedUnits(v => ({ ...v, [id]: !v[id] }));

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
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.employee_count} employee{d.employee_count !== 1 ? 's' : ''} · {d.unit_count} unit{d.unit_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => toggleUnits(d.id)}>
                        {expandedUnits[d.id] ? 'Hide Units' : 'Units'}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ id: d.id, name: d.name })}>Edit</Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => removeDept(d.id, d.name)}>Delete</Button>
                    </div>
                  </div>
                  {expandedUnits[d.id] && <UnitsPanel dept={d} companyId={company.id} />}
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
          {adding ? 'Adding...' : 'Add Department'}
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
  const { isSuperAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null);

  const load = () => companies.list().then(setList).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleAdd = async data => {
    await companies.create(data);
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
        {isSuperAdmin && (
          <Button onClick={() => open('add')} className="self-start sm:self-auto">+ Add Company</Button>
        )}
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
                  <th className="table-th">Default Shift</th>
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
                    <td className="table-td text-xs text-muted-foreground">
                      {c.default_shift_start || '09:00'} – {c.default_shift_end || '17:00'}
                    </td>
                    <td className="table-td">
                      {c.latitude != null ? <span className="badge-green">Set</span> : <span className="badge-yellow">Not set</span>}
                    </td>
                    <td className="table-td">{c.radius_meters}m</td>
                    <td className="table-td">{c.employee_count}</td>
                    <td className="table-td">{c.department_count}</td>
                    <td className="table-td">
                      <RowActions actions={[
                        { label: 'Update Location', onClick: () => open('updateLocation', c) },
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

      {modal === 'add' && <Modal title="Add Company" onClose={close} size="lg"><CompanyForm onSave={handleAdd} onClose={close} /></Modal>}
      {modal === 'edit' && selected && <Modal title="Edit Company" onClose={close} size="lg"><CompanyForm initial={selected} onSave={handleEdit} onClose={close} /></Modal>}
      {modal === 'updateLocation' && selected && <Modal title={`Update Location — ${selected.name}`} onClose={close} size="lg"><UpdateLocationModal company={selected} onClose={close} onUpdate={load} /></Modal>}
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
