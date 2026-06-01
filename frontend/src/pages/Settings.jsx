import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { settings, adminAccounts } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertCircleIcon } from 'lucide-react';

function getCurrentUsername() {
  try {
    const token = localStorage.getItem('admin_token');
    if (!token) return null;
    return JSON.parse(atob(token.split('.')[1])).username;
  } catch { return null; }
}

function AdminAccountsSection() {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', confirm: '' });
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const currentUser = getCurrentUsername();

  const load = () => adminAccounts.list().then(setAdmins).catch(() => {});
  useEffect(() => { load(); }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdd = async e => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setAdding(true);
    try {
      await adminAccounts.create({ username: form.username, password: form.password });
      toast.success('Admin account created');
      setForm({ username: '', password: '', confirm: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to create admin account');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = admin =>
    setPending({
      username: admin.username,
      action: async () => {
        await adminAccounts.remove(admin.username);
        toast.success('Admin account deleted');
        load();
      },
    });

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle>Admin Accounts</CardTitle>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>+ Add Admin</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <p className="text-xs text-muted-foreground">
          The primary admin account is configured via environment variables. Additional accounts created here can also log in.
        </p>

        {admins.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">No additional admin accounts</p>
        ) : (
          <div className="space-y-2">
            {admins.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{a.username}</p>
                  <p className="text-xs text-muted-foreground">Added {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={a.username === currentUser}
                  onClick={() => handleDelete(a)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleAdd} className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-medium">New Admin Account</p>
            <div>
              <label className="label">Username *</label>
              <input className="input" value={form.username} onChange={set('username')} required placeholder="e.g. john" autoComplete="off" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Password *</label>
                <input type="password" className="input" value={form.password} onChange={set('password')} required minLength={6} placeholder="Min. 6 characters" autoComplete="new-password" />
              </div>
              <div>
                <label className="label">Confirm Password *</label>
                <input type="password" className="input" value={form.confirm} onChange={set('confirm')} required placeholder="Repeat password" autoComplete="new-password" />
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setError(''); setForm({ username: '', password: '', confirm: '' }); }} disabled={adding}>Cancel</Button>
              <Button type="submit" disabled={adding}>
                {adding && <Spinner className="mr-2" />}
                {adding ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>

      <AlertDialog open={!!pending} onOpenChange={open => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pending?.username}"?</AlertDialogTitle>
            <AlertDialogDescription>This admin account will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { pending?.action(); setPending(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

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
  const setVal = k => v => setForm(f => ({ ...f, [k]: v }));

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
      <h1 className="text-2xl font-bold">Settings</h1>

      <form onSubmit={save}>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <div>
              <label className="label">System Name</label>
              <input className="input" value={form.company_name} onChange={set('company_name')} />
            </div>

            <div>
              <label className="label">Timezone</label>
              <Select value={form.timezone} onValueChange={setVal('timezone')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="Africa/Lagos">Africa/Lagos (WAT, UTC+1)</SelectItem>
                  <SelectItem value="Africa/Accra">Africa/Accra (GMT)</SelectItem>
                  <SelectItem value="Africa/Nairobi">Africa/Nairobi (EAT, UTC+3)</SelectItem>
                  <SelectItem value="Africa/Johannesburg">Africa/Johannesburg (SAST, UTC+2)</SelectItem>
                  <SelectItem value="Africa/Cairo">Africa/Cairo (EET, UTC+2)</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                </SelectContent>
              </Select>
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
              <input type="number" min="0" max="120" className="input max-w-xs" value={form.late_threshold_minutes} onChange={set('late_threshold_minutes')} />
              <p className="text-xs text-muted-foreground mt-1">
                An employee is marked late if they clock in more than this many minutes after their shift start time.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving}>
                {saving && <Spinner className="mr-2" />}
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <AdminAccountsSection />

      <Card className="bg-primary/5 ring-primary/20">
        <CardContent className="pt-0 text-sm">
          <p className="font-semibold mb-1">Departments</p>
          <p className="text-muted-foreground">Departments are managed per company. Go to <strong>Companies</strong> and click <strong>Departments</strong> on any company to add or remove departments.</p>
        </CardContent>
      </Card>
    </div>
  );
}
