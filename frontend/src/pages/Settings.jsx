import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { settings } from '../api';

export default function Settings() {
  const [form, setForm] = useState({
    company_name: '',
    work_start_time: '09:00',
    work_end_time: '17:00',
    late_threshold_minutes: '15',
    timezone: 'Africa/Lagos',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settings.get().then(data => setForm(f => ({ ...f, ...data })));
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await settings.update(form);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <form onSubmit={save} className="card space-y-5">
        <h2 className="text-base font-semibold text-gray-800 border-b pb-3">General Settings</h2>

        <div>
          <label className="label">System Name</label>
          <input className="input" value={form.company_name} onChange={set('company_name')} />
        </div>

        <div>
          <label className="label">Timezone</label>
          <select className="input" value={form.timezone} onChange={set('timezone')}>
            <option value="Africa/Lagos">Africa/Lagos (WAT, UTC+1)</option>
            <option value="Africa/Accra">Africa/Accra (GMT)</option>
            <option value="Africa/Nairobi">Africa/Nairobi (EAT, UTC+3)</option>
            <option value="Africa/Johannesburg">Africa/Johannesburg (SAST, UTC+2)</option>
            <option value="Africa/Cairo">Africa/Cairo (EET, UTC+2)</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Default Work Start</label>
            <input type="time" className="input" value={form.work_start_time} onChange={set('work_start_time')} />
          </div>
          <div>
            <label className="label">Default Work End</label>
            <input type="time" className="input" value={form.work_end_time} onChange={set('work_end_time')} />
          </div>
        </div>

        <div>
          <label className="label">Late Threshold (minutes)</label>
          <input
            type="number" min="0" max="120" className="input max-w-xs"
            value={form.late_threshold_minutes}
            onChange={set('late_threshold_minutes')}
          />
          <p className="text-xs text-gray-400 mt-1">
            An employee is marked late if they clock in more than this many minutes after their shift start time.
          </p>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      <div className="card bg-blue-50 border-blue-200 text-sm text-blue-800">
        <p className="font-semibold mb-1">Departments</p>
        <p>Departments are now managed per company. Go to <strong>Companies</strong> and click <strong>Departments</strong> on any company to add or remove departments.</p>
      </div>
    </div>
  );
}
