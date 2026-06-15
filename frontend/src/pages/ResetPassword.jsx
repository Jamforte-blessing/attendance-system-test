import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { auth } from '../api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircleIcon, CheckCircleIcon } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError('No reset token found. Please request a new password reset link.');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) return setError('Passwords do not match.');
    if (newPassword.length < 6) return setError('Password must be at least 6 characters.');
    setError('');
    setLoading(true);
    try {
      await auth.resetPassword({ token, newPassword });
      setDone(true);
      setTimeout(() => navigate('/desk', { replace: true }), 3000);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <Card className="w-full max-w-sm bg-neutral-900 ring-neutral-800">
        <CardContent className="pt-6 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Set New Password</h1>
            <p className="text-sm text-neutral-400 mt-1">Enter a new password for your account.</p>
          </div>

          {done ? (
            <Alert className="bg-green-950 border-green-800">
              <CheckCircleIcon className="text-green-400" />
              <AlertDescription className="text-green-300">
                Password updated successfully. Redirecting you to sign in…
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  disabled={!token}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                  placeholder="Min. 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  disabled={!token}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                  placeholder="Repeat password"
                />
              </div>

              {error && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                  <AlertCircleIcon />
                  <AlertDescription className="text-destructive">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={loading || !token}
                className="w-full bg-white text-neutral-900 hover:bg-neutral-100"
                size="lg"
              >
                {loading && <Spinner className="mr-2 text-neutral-600" />}
                {loading ? 'Updating…' : 'Set New Password'}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-neutral-500">
            <Link to="/desk" className="text-neutral-400 hover:text-white underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
