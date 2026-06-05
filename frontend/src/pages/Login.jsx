import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircleIcon } from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!loading) { setProgress(0); return; }
    setProgress(20);
    const t = setInterval(() => setProgress(v => (v < 80 ? v + 15 : v)), 500);
    return () => clearInterval(t);
  }, [loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await auth.login({ username, password });
      setProgress(100);
      login(token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <Card className="w-full max-w-sm bg-neutral-900 ring-neutral-800">
        <CardContent className="pt-0 space-y-6">
          <h1 className="text-2xl font-bold text-white">{getGreeting()}</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 text-destructive">
                <AlertCircleIcon />
                <AlertDescription className="text-destructive">{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-white text-neutral-900 hover:bg-neutral-100" size="lg">
              {loading && <Spinner className="mr-2 text-neutral-600" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            {loading && (
              <Progress value={progress} className="h-0.5 bg-neutral-700 [&_[data-slot=progress-indicator]]:bg-white" />
            )}
          </form>

          <p className="text-center text-sm text-neutral-500">
            <a href="/kiosk" className="hover:text-neutral-300 underline">Go to Employee Kiosk</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
