import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { settings } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

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

      <Card className="bg-primary/5 ring-primary/20">
        <CardContent className="pt-0 text-sm">
          <p className="font-semibold mb-1">Departments</p>
          <p className="text-muted-foreground">Departments are managed per company. Go to <strong>Companies</strong> and click <strong>Departments</strong> on any company to add or remove departments.</p>
        </CardContent>
      </Card>
    </div>
  );
}
