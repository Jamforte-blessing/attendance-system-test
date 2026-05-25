import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { companies, departments as deptApi } from '../api';

function CompanyForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, address: initial.address || '', radius_meters: initial.radius_meters || 100 }
      : { name: '', address: '', radius_meters: 100 }
  );
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

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
        <label className="label">Company Name *</label>
        <input className="input" value={form.name} onChange={set('name')} required placeholder="e.g. Acme Corp" />
      </div>
      <div>
        <label className="label">Address</label>
        <input className="input" value={form.address} onChange={set('address')} placeholder="e.g. 12 Lagos Street, Ikeja" />
      </div>
      <div>
        <label className="label">Allowed Radius (metres)</label>
        <input
          type="number" min="10" max="5000" className="input max-w-xs"
          value={form.radius_meters}
          onChange={set('radius_meters')}
        />
        <p className="text-xs text-gray-400 mt-1">
   
        </p>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">{initial ? 'Save Changes' : 'Add Company'}</button>
      </div>
    </form>
  );
}

function LocationModal({ company, onClose, onSaved }) {
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState(
    company.latitude != null
      ? { latitude: company.latitude, longitude: company.longitude }
      : null
  );
  const [radius, setRadius] = useState(company.radius_meters || 100);
  const [error, setError] = useState('');

  const capture = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }
    setCapturing(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setPreview({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setCapturing(false);
      },
      () => {
        setError('Could not get location. Make sure location access is allowed in your browser.');
        setCapturing(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const save = async () => {
    if (!preview) { setError('Capture a location first.'); return; }
    try {
      await companies.setLocation(company.id, {
        latitude: preview.latitude,
        longitude: preview.longitude,
        radius_meters: radius,
      });
      toast.success('Location saved');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Stand at the workplace entrance, then click <strong>Capture Current Location</strong>.
        Employees must be within the allowed radius to clock in.
      </p>

      {preview ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1">
          <p className="text-sm font-semibold text-green-800">Location captured</p>
          <p className="text-xs text-green-700 font-mono">Lat: {preview.latitude.toFixed(6)}</p>
          <p className="text-xs text-green-700 font-mono">Lng: {preview.longitude.toFixed(6)}</p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500 text-center">
          No location set yet
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={capture}
        disabled={capturing}
        className="btn-secondary w-full"
      >
        {capturing ? 'Getting location...' : 'Capture Current Location'}
      </button>

      <div>
        <label className="label">Allowed Radius (metres)</label>
        <input
          type="number" min="10" max="5000" className="input max-w-xs"
          value={radius}
          onChange={e => setRadius(Number(e.target.value))}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} disabled={!preview} className="btn-primary">Save Location</button>
      </div>
    </div>
  );
}

function DepartmentsModal({ company, onClose }) {
  const [depts, setDepts] = useState([]);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }

  const load = () => companies.departments(company.id).then(setDepts).catch(() => {});

  useEffect(() => { load(); }, [company.id]);

  const add = async e => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await companies.addDepartment(company.id, { name: newName.trim() });
      setNewName('');
      load();
      toast.success('Department added');
    } catch (err) { toast.error(err); }
  };

  const remove = async (deptId, name) => {
    if (!confirm(`Delete department "${name}"?`)) return;
    await companies.removeDepartment(company.id, deptId);
    load();
    toast.success('Department deleted');
  };

  const saveEdit = async e => {
    e.preventDefault();
    if (!editing.name.trim()) return;
    try {
      await deptApi.update(editing.id, { name: editing.name.trim(), company_id: company.id });
      setEditing(null);
      load();
      toast.success('Department renamed');
    } catch (err) { toast.error(err); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Departments for <strong>{company.name}</strong>
      </p>

      {depts.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No departments yet</p>
      ) : (
        <div className="space-y-2">
          {depts.map(d => (
            <div key={d.id} className="p-3 bg-gray-50 rounded-lg">
              {editing?.id === d.id ? (
                <form onSubmit={saveEdit} className="flex items-center gap-2">
                  <input
                    className="input flex-1 py-1.5 text-sm"
                    value={editing.name}
                    onChange={e => setEditing(v => ({ ...v, name: e.target.value }))}
                    autoFocus
                  />
                  <button type="submit" className="btn-primary btn-sm">Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="btn-secondary btn-sm">Cancel</button>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-gray-500">{d.employee_count} employee{d.employee_count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing({ id: d.id, name: d.name })} className="btn-secondary btn-sm">Edit</button>
                    <button onClick={() => remove(d.id, d.name)} className="btn-danger btn-sm">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="flex gap-3 border-t pt-4">
        <input
          className="input flex-1"
          placeholder="New department name..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-primary whitespace-nowrap">Add</button>
      </form>

      <div className="flex justify-end pt-2">
        <button onClick={onClose} className="btn-secondary">Done</button>
      </div>
    </div>
  );
}

export default function Companies() {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'location' | 'departments'
  const [selected, setSelected] = useState(null);

  const load = () => companies.list().then(setList).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleAdd = data => companies.create(data).then(() => { toast.success('Company added'); load(); });
  const handleEdit = data => companies.update(selected.id, data).then(() => { toast.success('Company updated'); load(); });
  const handleDelete = async company => {
    if (!confirm(`Delete company "${company.name}"? All employees and departments will be unlinked.`)) return;
    await companies.remove(company.id);
    toast.success('Company deleted');
    load();
  };

  const open = (mode, company = null) => { setSelected(company); setModal(mode); };
  const close = () => { setModal(null); setSelected(null); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Each company has its own employees, departments, and workplace location for clock-in validation.
          </p>
        </div>
        <button onClick={() => open('add')} className="btn-primary self-start sm:self-auto">+ Add Company</button>
      </div>

      {list.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500 font-medium">No companies yet</p>
          <p className="text-sm text-gray-400 mt-1">Add a company to start managing employees.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-th">Company</th>
                <th className="table-th">Address</th>
                <th className="table-th">Location</th>
                <th className="table-th">Radius</th>
                <th className="table-th">Employees</th>
                <th className="table-th">Departments</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="table-td font-medium">{c.name}</td>
                  <td className="table-td text-gray-500 text-xs">{c.address || '—'}</td>
                  <td className="table-td">
                    {c.latitude != null ? (
                      <span className="badge-green">Set</span>
                    ) : (
                      <span className="badge-yellow">Not set</span>
                    )}
                  </td>
                  <td className="table-td">{c.radius_meters}m</td>
                  <td className="table-td">{c.employee_count}</td>
                  <td className="table-td">{c.department_count}</td>
                  <td className="table-td">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => open('location', c)} className="btn-secondary btn-sm">
                        Set Location
                      </button>
                      <button onClick={() => open('departments', c)} className="btn-secondary btn-sm">
                        Departments
                      </button>
                      <button onClick={() => open('edit', c)} className="btn-secondary btn-sm">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(c)} className="btn-danger btn-sm">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {modal === 'add' && (
        <Modal title="Add Company" onClose={close}>
          <CompanyForm onSave={handleAdd} onClose={close} />
        </Modal>
      )}
      {modal === 'edit' && selected && (
        <Modal title="Edit Company" onClose={close}>
          <CompanyForm initial={selected} onSave={handleEdit} onClose={close} />
        </Modal>
      )}
      {modal === 'location' && selected && (
        <Modal title={`Set Location — ${selected.name}`} onClose={close} size="md">
          <LocationModal company={selected} onClose={close} onSaved={load} />
        </Modal>
      )}
      {modal === 'departments' && selected && (
        <Modal title={`Departments — ${selected.name}`} onClose={close} size="md">
          <DepartmentsModal company={selected} onClose={close} />
        </Modal>
      )}
    </div>
  );
}
