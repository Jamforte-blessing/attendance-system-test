import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { settings, accessAccounts, companies as companiesApi } from '../api';
import { useSettings } from '../context/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertCircleIcon } from 'lucide-react';

function LogoSection() {
  const { adminCompanies, refreshSettings } = useSettings();
  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (adminCompanies.length > 0 && !selectedId) setSelectedId(adminCompanies[0].id);
  }, [adminCompanies]);

  const selectedCompany = adminCompanies.find(c => c.id === selectedId);
  const displayLogo = preview || selectedCompany?.logo_url || null;

  const handleFileChange = e => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleCompanyChange = v => {
    setSelectedId(parseInt(v));
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!file || !selectedId) return;
    setUploading(true);
    try {
      await companiesApi.uploadLogo(selectedId, file);
      await refreshSettings();
      toast.success('Logo updated');
      setFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (adminCompanies.length === 0) return null;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Brand Logo</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {adminCompanies.length > 1 && (
          <div>
            <label className="label">Company</label>
            <Select value={selectedId?.toString()} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {adminCompanies.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="w-24 h-16 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
            {displayLogo ? (
              <img src={displayLogo} alt="Logo preview" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-xs text-muted-foreground text-center px-1">No logo</span>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              PNG, JPG, SVG or WebP · Max 2 MB · Shown in the sidebar and on the employee kiosk.
            </p>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                Choose Image
              </Button>
              {file && (
                <Button type="button" size="sm" disabled={uploading} onClick={handleUpload}>
                  {uploading && <Spinner className="mr-2" />}
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              )}
            </div>
            {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SuperAdminLogoSection() {
  const { adminCompanies, refreshSettings } = useSettings();
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settings.get().then(data => {
      setSelectedId(
        data?.superadmin_logo_company_id
          ? String(data.superadmin_logo_company_id)
          : adminCompanies[0] ? String(adminCompanies[0].id) : ''
      );
    }).catch(() => {});
  }, [adminCompanies]);

  if (adminCompanies.length <= 1) return null;

  const selectedCompany = adminCompanies.find(c => String(c.id) === selectedId);

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await settings.update({ superadmin_logo_company_id: selectedId });
      await refreshSettings();
      toast.success('Sidebar logo updated');
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Sidebar Logo</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose which company's logo appears in your sidebar as the super admin.
        </p>
        <div className="flex items-center gap-3">
          {selectedCompany?.logo_url && (
            <div className="w-16 h-10 rounded border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
              <img src={selectedCompany.logo_url} alt="Logo preview" className="h-full w-full object-contain p-1" />
            </div>
          )}
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {adminCompanies.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving && <Spinner className="mr-2" />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getCurrentUserInfo() {
  try {
    const token = localStorage.getItem('admin_token');
    if (!token) return {};
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { username: payload.username, isSuperAdmin: payload.isSuperAdmin };
  } catch { return {}; }
}

function AdminAccountsSection() {
  const { username: currentUser } = getCurrentUserInfo();
  const [admins, setAdmins] = useState([]);
  const [allCompanies, setAllCompanies] = useState([]);
  const [form, setForm] = useState({ username: '', email: '', company_ids: [] });
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [createdCred, setCreatedCred] = useState(null);
  const [pending, setPending] = useState(null);

  const load = () => accessAccounts.list().then(setAdmins).catch(() => {});

  useEffect(() => {
    load();
    companiesApi.list().then(setAllCompanies).catch(() => {});
  }, []);

  const toggleCompany = id =>
    setForm(f => ({
      ...f,
      company_ids: f.company_ids.includes(id)
        ? f.company_ids.filter(c => c !== id)
        : [...f.company_ids, id],
    }));

  const handleAdd = async e => {
    e.preventDefault();
    setError('');
    if (form.company_ids.length === 0) { setError('Assign at least one company'); return; }
    setAdding(true);
    try {
      const result = await accessAccounts.create({
        username: form.username,
        email: form.email,
        company_ids: form.company_ids,
      });
      setCreatedCred({
        username: result.username,
        email: result.email,
        password: result.generated_password,
        emailSent: result.email_sent,
      });
      setForm({ username: '', email: '', company_ids: [] });
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
        await accessAccounts.remove(admin.username);
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
            <Button size="sm" onClick={() => { setShowForm(true); setCreatedCred(null); }}>+ Add Admin</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">

        {createdCred && (
          <Alert className="border-green-300 bg-green-50">
            <AlertDescription>
              <p className="font-semibold text-green-800 mb-1">Admin "{createdCred.username}" created</p>
              <p className="text-sm text-green-700 mb-1">
                Generated password: <span className="font-mono font-bold select-all">{createdCred.password}</span>
              </p>
              <p className={`text-xs ${createdCred.emailSent ? 'text-green-600' : 'text-amber-700'}`}>
                {createdCred.emailSent
                  ? `Credentials were emailed to ${createdCred.email}.`
                  : `The account was created, but the email could not be sent to ${createdCred.email}. Check the SendGrid configuration.`}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {admins.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">No additional admin accounts</p>
        ) : (
          <div className="space-y-2">
            {admins.map(a => (
              <div key={a.id} className="p-3 bg-muted/50 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{a.username}</p>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={a.username === currentUser}
                    onClick={() => handleDelete(a)}
                  >
                    Delete
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Companies: {a.companies?.length > 0 ? a.companies.map(c => c.name).join(', ') : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Email: {a.email || '—'}</p>
                <p className="text-xs text-muted-foreground">
                  Password: <span className="font-mono select-all">{a.generated_password || '—'}</span>
                </p>
                <p className="text-xs text-muted-foreground">Added {new Date(a.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleAdd} className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-medium">New Admin Account</p>
            <div>
              <label className="label">Username *</label>
              <input
                className="input"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
                placeholder="e.g. goveloox-admin"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">Email *</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                placeholder="admin@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Assign Companies *</label>
              {allCompanies.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">No companies found. Create a company first.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-1 max-h-40 overflow-y-auto">
                  {allCompanies.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer p-1 rounded hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={form.company_ids.includes(c.id)}
                        onChange={() => toggleCompany(c.id)}
                        className="accent-primary"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">A password will be auto-generated, shown after creation, and emailed to the administrator.</p>
            {error && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowForm(false); setError(''); setForm({ username: '', email: '', company_ids: [] }); }}
                disabled={adding}
              >
                Cancel
              </Button>
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
  const { isSuperAdmin } = getCurrentUserInfo();
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

      <LogoSection />

      {isSuperAdmin && <SuperAdminLogoSection />}

      {isSuperAdmin && <AdminAccountsSection />}

      <Card className="bg-primary/5 ring-primary/20">
        <CardContent className="pt-0 text-sm">
          <p className="font-semibold mb-1">Departments</p>
          <p className="text-muted-foreground">Departments are managed per company. Go to <strong>Companies</strong> and click <strong>Departments</strong> on any company to add or remove departments.</p>
        </CardContent>
      </Card>
    </div>
  );
}
