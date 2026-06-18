import { useEffect, useRef, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { auth, employeeAuth, desk } from '../api';
import { getBestAvailablePosition } from '../utils/geolocation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

const RESET_DELAY = 4000;
const NONE = '__none__';

const labelClass = 'block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-2';

// Dark-themed trigger for the desk dark background
const DeskSelect = ({ value, onValueChange, children, placeholder }) => (
  <Select value={value || NONE} onValueChange={v => onValueChange(v === NONE ? '' : v)}>
    <SelectTrigger className="w-full bg-neutral-800 border-2 border-neutral-700 text-white h-12 text-base sm:text-lg rounded-xl px-4 focus-visible:ring-0 focus-visible:border-neutral-400 data-placeholder:text-neutral-400 data-placeholder:leading-7">
      <SelectValue placeholder={placeholder} className="leading-7" />
    </SelectTrigger>
    <SelectContent position="popper" className="text-base">
      {children}
    </SelectContent>
  </Select>
);

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function getGreeting(date) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

function useGeolocation() {
  const get = () => getBestAvailablePosition(12, 500);
  return get;
}

export default function Desk() {
  const now = useClock();
  const getLocation = useGeolocation();

  const [companyList, setCompanyList] = useState([]);
  const [deptList, setDeptList] = useState([]);
  const [empList, setEmpList] = useState([]);

  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');

  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const [employeeToken, setEmployeeToken] = useState(() => localStorage.getItem('employee_token') || '');
  const [employee, setEmployee] = useState(() => {
    const stored = localStorage.getItem('employee_info');
    return stored ? JSON.parse(stored) : null;
  });
  const [mustChangePassword, setMustChangePassword] = useState(() => JSON.parse(localStorage.getItem('employee_must_change_password') || 'false'));
  const [resetMode, setResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [mustRegisterFace, setMustRegisterFace] = useState(() => JSON.parse(localStorage.getItem('employee_must_register_face') || 'false'));
  const [faceRegisterMode, setFaceRegisterMode] = useState(() => JSON.parse(localStorage.getItem('employee_must_register_face') || 'false'));
  const [faceRegisterLoading, setFaceRegisterLoading] = useState(false);
  const [faceRegisterError, setFaceRegisterError] = useState('');
  const [faceRegisterSuccess, setFaceRegisterSuccess] = useState('');

  const [activeTab, setActiveTab] = useState('clock');
  const [insightsPeriod, setInsightsPeriod] = useState('today');
  const [customRangeStart, setCustomRangeStart] = useState(format(new Date(Date.now() - 6 * 86400000), 'yyyy-MM-dd'));
  const [customRangeEnd, setCustomRangeEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [insightsSummary, setInsightsSummary] = useState(null);
  const [insightsDailyLogs, setInsightsDailyLogs] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const [progress, setProgress] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    if (!loading) { setProgress(0); return; }
    setProgress(18);
    const t = setInterval(() => setProgress(v => (v < 82 ? v + 12 : v)), 650);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    if (mustChangePassword) setResetMode(true);
  }, [mustChangePassword]);

  useEffect(() => {
    desk.companies().then(setCompanyList).catch(() => {});
  }, []);

  useEffect(() => {
    setSelectedDept('');
    setSelectedEmp('');
    setStatus(null);
    if (!selectedCompany) { setDeptList([]); setEmpList([]); return; }
    desk.departments({ company_id: selectedCompany }).then(setDeptList).catch(() => {});
  }, [selectedCompany]);

  useEffect(() => {
    setSelectedEmp('');
    setStatus(null);
    if (!selectedCompany) { setEmpList([]); return; }
    const params = { company_id: selectedCompany };
    if (selectedDept) params.department_id = selectedDept;
    desk.employees(params).then(setEmpList).catch(() => {});
  }, [selectedCompany, selectedDept]);

  const loadStatus = useCallback(async id => {
    if (!id) { setStatus(null); return; }
    try {
      const s = await desk.status(id);
      setStatus(s);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (employee?.id) {
      loadStatus(employee.id);
    } else {
      loadStatus(selectedEmp);
    }
  }, [employee?.id, selectedEmp, loadStatus]);

  useEffect(() => {
    const loggedIn = !!employee && !!employeeToken;
    const shouldRun = loggedIn && (activeTab === 'clock' || faceRegisterMode);
    if (!shouldRun) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCameraReady(false);
      }
      return;
    }
    let mounted = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } } })
      .then(s => {
        if (!mounted) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setCameraReady(true);
        setCameraError('');
      })
      .catch(() => {
        if (mounted) setCameraError('Camera not available');
      });
    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCameraReady(false);
      }
    };
  }, [employee, employeeToken, activeTab, faceRegisterMode]);

  const capturePhoto = () => {
    if (!videoRef.current || !cameraReady) return null;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleScan = async () => {
    const activeEmployeeId = employee?.id || selectedEmp;
    if (!activeEmployeeId || loading) return;
    setLoading(true);
    setError('');

    const photo = capturePhoto();

    let coords = null;
    try {
      coords = await getLocation();
    } catch (locErr) {
      setError(locErr);
      setLoading(false);
      return;
    }

    try {
      const res = await desk.scan({
        employee_id: activeEmployeeId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        photo,
      });
      setResult(res);
      setTimeout(() => {
        setResult(null);
        setSelectedEmp('');
        setStatus(null);
        setLoading(false);
      }, RESET_DELAY);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const isClockIn = status?.nextAction === 'clock_in';
  const isDone    = status?.nextAction === 'done';
  const employeeLoggedIn = !!employee && !!employeeToken;
  const formatMinutes = minutes => {
    const total = Math.max(0, parseInt(minutes, 10) || 0);
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  };

  useEffect(() => {
    if (!employee?.id || activeTab !== 'insights') return;
    if (insightsPeriod === 'custom' && (!customRangeStart || !customRangeEnd)) {
      setInsightsSummary(null);
      return;
    }
    setInsightsLoading(true);
    const params = { period: insightsPeriod };
    if (insightsPeriod === 'custom') {
      params.start = customRangeStart;
      params.end = customRangeEnd;
    }
    desk.insights(employee.id, params)
      .then(data => {
        setInsightsSummary(data);
        setInsightsDailyLogs(data?.dailyLogs || []);
      })
      .catch(() => {})
      .finally(() => setInsightsLoading(false));
  }, [employee?.id, activeTab, insightsPeriod, customRangeStart, customRangeEnd]);

  const handleEmployeeLogin = async e => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const result = await auth.login({ email: loginEmail, password: loginPassword });
      if (result.role !== 'employee') {
        throw 'Please sign in with employee credentials';
      }
      const mustChange = !!result.mustChangePassword;
      const mustFace = !!result.mustRegisterFace;
      setEmployeeToken(result.token);
      setEmployee(result.employee || null);
      setMustChangePassword(mustChange);
      setMustRegisterFace(mustFace);
      localStorage.setItem('employee_token', result.token);
      localStorage.setItem('employee_info', JSON.stringify(result.employee || null));
      localStorage.setItem('employee_must_change_password', JSON.stringify(mustChange));
      localStorage.setItem('employee_must_register_face', JSON.stringify(mustFace));
      setLoginEmail('');
      setLoginPassword('');
      setResetMode(mustChange);
      if (mustFace) setFaceRegisterMode(true);
    } catch (err) {
      setLoginError(typeof err === 'string' ? err : 'Invalid email or password');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotPassword = async e => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail) {
      setForgotError('Email is required');
      return;
    }
    setForgotLoading(true);
    try {
      const result = await auth.forgotPassword({ email: forgotEmail });
      setForgotSuccess(result.message || 'If that email is registered, a temporary password has been sent.');
      setForgotEmail('');
    } catch (err) {
      setForgotError(typeof err === 'string' ? err : 'Unable to request password reset');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleEmployeeLogout = () => {
    localStorage.removeItem('employee_token');
    localStorage.removeItem('employee_info');
    localStorage.removeItem('employee_must_change_password');
    localStorage.removeItem('employee_must_register_face');
    setEmployeeToken('');
    setEmployee(null);
    setMustChangePassword(false);
    setResetMode(false);
    setMustRegisterFace(false);
    setFaceRegisterMode(false);
    setFaceRegisterError('');
    setFaceRegisterSuccess('');
    setStatus(null);
    setResult(null);
    setError('');
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handlePasswordReset = async e => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      await employeeAuth.changePassword(employeeToken, { newPassword });
      setPasswordSuccess('Password updated successfully.');
      setMustChangePassword(false);
      localStorage.setItem('employee_must_change_password', 'false');
      setResetMode(false);
      setNewPassword('');
      setConfirmPassword('');
      setMustRegisterFace(true);
      localStorage.setItem('employee_must_register_face', 'true');
      setFaceRegisterMode(true);
    } catch (err) {
      setPasswordError(typeof err === 'string' ? err : 'Unable to reset password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleFaceRegister = async () => {
    const photo = capturePhoto();
    if (!photo) {
      setFaceRegisterError('Could not capture photo. Make sure your camera is enabled.');
      return;
    }
    setFaceRegisterLoading(true);
    setFaceRegisterError('');
    try {
      await employeeAuth.registerFace(employeeToken, { image: photo });
      setFaceRegisterSuccess('Face registered! You can now clock in.');
      setMustRegisterFace(false);
      localStorage.setItem('employee_must_register_face', 'false');
      setTimeout(() => {
        setFaceRegisterMode(false);
        setFaceRegisterSuccess('');
      }, 2000);
    } catch (err) {
      setFaceRegisterError(typeof err === 'string' ? err : 'Registration failed. Please try again.');
    } finally {
      setFaceRegisterLoading(false);
    }
  };

  const activeCompanyLogo = (() => {
    if (employee?.company_id) {
      return companyList.find(c => c.id === employee.company_id)?.logo_url || null;
    }
    if (selectedCompany) {
      return companyList.find(c => c.id === parseInt(selectedCompany))?.logo_url || null;
    }
    return null;
  })();

  // ── Success screen ──────────────────────────────────────────────────────────
  if (result) {
    const isIn = result.type === 'clock_in';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-700">
        <div className="flex flex-col items-center text-white text-center px-6 py-10">
          {activeCompanyLogo && <img src={activeCompanyLogo} alt="Logo" className="h-12 w-auto mb-6 opacity-80 object-contain" />}
          <h2 className="text-2xl sm:text-4xl font-bold mb-3">
            {isIn ? 'Clocked In!' : 'Clocked Out!'}
          </h2>
          {isIn && (
            <p className="text-base sm:text-xl font-medium opacity-75 mb-2">Welcome to work</p>
          )}
          <p className="text-lg sm:text-2xl font-semibold opacity-90 mb-2">{result.employeeName}</p>
          <p className="text-base sm:text-lg font-mono opacity-70 mb-5">
            {format(new Date(result.timestamp), 'hh:mm:ss a')}
          </p>
          {result.isLate && (
            <span className="bg-yellow-400 text-yellow-900 font-bold text-base sm:text-lg px-5 py-1.5 rounded-full mb-4">
              Marked as Late
            </span>
          )}
          {result.isEarly && (
            <span className="bg-orange-400 text-orange-900 font-bold text-base sm:text-lg px-5 py-1.5 rounded-full mb-4">
              Left Early
            </span>
          )}
          <p className="text-sm opacity-50 mt-6">Screen resets in a moment...</p>
        </div>
      </div>
    );
  }

  if (!employeeLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 px-4 py-10">
        <Card className="w-full max-w-md bg-neutral-900 ring-neutral-800">
          <CardContent className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">{getGreeting(now)}</h1>
              <p className="text-sm text-neutral-400 mt-2">
                Sign in with your email and password to clock in or out.
              </p>
            </div>

            <form onSubmit={handleEmployeeLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                  className="w-full bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="••••••••"
                />
              </div>

              {loginError && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 text-destructive">
                  <AlertDescription className="text-destructive">{loginError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={loginLoading} className="w-full bg-white text-neutral-900 hover:bg-neutral-100" size="lg">
                {loginLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setForgotMode(v => !v);
                  setForgotError('');
                  setForgotSuccess('');
                  setForgotEmail(loginEmail);
                }}
                className="text-sm font-medium text-neutral-300 hover:text-white"
              >
                Forgot password?
              </button>
            </div>

            {forgotMode && (
              <form onSubmit={handleForgotPassword} className="space-y-4 rounded-2xl border border-neutral-700 bg-neutral-800/70 p-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Employee email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                    className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder:text-neutral-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white"
                    placeholder="you@example.com"
                  />
                </div>

                {forgotError && (
                  <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 text-destructive">
                    <AlertDescription className="text-destructive">{forgotError}</AlertDescription>
                  </Alert>
                )}
                {forgotSuccess && (
                  <div className="rounded-xl border border-emerald-700 bg-emerald-900/20 p-3 text-sm text-emerald-200">{forgotSuccess}</div>
                )}

                <Button type="submit" disabled={forgotLoading} className="w-full" variant="outline">
                  {forgotLoading ? 'Sending...' : 'Send temporary password'}
                </Button>
              </form>
            )}

            {loginLoading && (
              <Progress value={loginLoading ? 70 : 0} className="h-0.5 bg-neutral-700 [&_[data-slot=progress-indicator]]:bg-white" />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main kiosk screen ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-neutral-900 font-sans antialiased">
      {/* Header */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-3 sm:py-4 bg-black/40 border-b border-white/10">
        {activeCompanyLogo
          ? <img src={activeCompanyLogo} alt="Logo" className="h-8 sm:h-10 w-auto object-contain" />
          : <span className="text-white font-semibold text-sm sm:text-base">{employee?.name?.split(' ')[0] || ''}</span>
        }
        <span className="text-sm sm:text-base font-mono text-white/60 tabular-nums">
          {format(now, 'hh:mm:ss a')}&nbsp;&nbsp;·&nbsp;&nbsp;{format(now, 'EEEE, dd MMMM yyyy')}
        </span>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-neutral-800/80 border border-neutral-700 rounded-3xl p-6">
            <div>
              <p className="text-sm text-neutral-400">Signed in as</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{employee.name}</h1>
              <p className="text-sm text-neutral-500 mt-1">{employee.email}</p>
            </div>
            <div className="flex flex-col gap-2 sm:min-w-36">
              <Button
                variant="outline"
                onClick={() => {
                  setResetMode(true);
                  setPasswordError('');
                  setPasswordSuccess('');
                }}
                className="h-11 px-4"
              >
                Change password
              </Button>
              <Button variant="outline" onClick={handleEmployeeLogout} className="h-11 px-4">
                Logout
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-2 border-b border-neutral-700">
            <button
              onClick={() => setActiveTab('clock')}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'clock'
                  ? 'border-b-2 border-white text-white'
                  : 'text-neutral-400 hover:text-neutral-300'
              }`}
            >
              Clock In / Out
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'insights'
                  ? 'border-b-2 border-white text-white'
                  : 'text-neutral-400 hover:text-neutral-300'
              }`}
            >
              Insights
            </button>
          </div>

          {mustChangePassword && (
            <div className="mt-5 rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-5 text-sm text-yellow-100">
              <p className="font-semibold">First login detected</p>
              <p className="mt-1 text-yellow-200">
                Your account is using a temporary password. Please set a new password before continuing.
              </p>
            </div>
          )}

          {resetMode && (
            <form onSubmit={handlePasswordReset} className="mt-5 space-y-4 bg-neutral-800/75 border border-neutral-700 rounded-3xl p-5">
              <h2 className="text-base font-semibold text-white">{mustChangePassword ? 'Set new password' : 'Reset password'}</h2>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="New password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="Confirm password"
                />
              </div>
              {passwordError && (
                <div className="rounded-xl border border-red-700 bg-red-900/20 p-3 text-sm text-red-200">{passwordError}</div>
              )}
              {passwordSuccess && (
                <div className="rounded-xl border border-emerald-700 bg-emerald-900/20 p-3 text-sm text-emerald-200">{passwordSuccess}</div>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" disabled={passwordLoading} className="w-full">
                  {passwordLoading ? 'Saving...' : 'Save password'}
                </Button>
                {!mustChangePassword && (
                  <Button type="button" variant="outline" className="w-full" onClick={() => setResetMode(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Tab Content */}
        {faceRegisterMode ? (
          <div className="w-full max-w-md space-y-5">
            <div className="rounded-3xl border border-blue-500/40 bg-blue-500/10 p-5 text-sm text-blue-100">
              <p className="font-semibold">Face Registration Required</p>
              <p className="mt-1 text-blue-200">
                Look directly at the camera in good lighting, then click Register.
              </p>
            </div>

            <div className="flex justify-center">
              <div className="relative w-52 h-52 rounded-full overflow-hidden border-2 border-white/20 bg-neutral-800">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-neutral-500">Starting camera...</span>
                  </div>
                )}
              </div>
            </div>

            {faceRegisterError && (
              <div className="rounded-xl border border-red-700 bg-red-900/20 p-3 text-sm text-red-200">{faceRegisterError}</div>
            )}
            {faceRegisterSuccess && (
              <div className="rounded-xl border border-emerald-700 bg-emerald-900/20 p-3 text-sm text-emerald-200">{faceRegisterSuccess}</div>
            )}

            <Button
              onClick={handleFaceRegister}
              disabled={faceRegisterLoading || !cameraReady}
              size="lg"
              className="w-full bg-white text-neutral-900 hover:bg-neutral-100"
            >
              {faceRegisterLoading ? 'Registering...' : 'Register My Face'}
            </Button>

            {!mustRegisterFace && (
              <Button variant="outline" className="w-full" onClick={() => setFaceRegisterMode(false)}>
                Cancel
              </Button>
            )}
          </div>
        ) : activeTab === 'clock' ? (
          <>
            <div className="w-full max-w-md bg-neutral-800/80 border border-neutral-700 rounded-3xl p-6 text-center mb-6">
              <p className="text-sm text-neutral-400 mb-2">Next action</p>
              <h2 className="text-2xl font-bold text-white mb-2">{isDone ? 'Done for today' : isClockIn ? 'Clock In' : 'Clock Out'}</h2>
              <p className="text-sm text-neutral-500">
                {status?.lastLog ? (
                  <>Last {status.lastLog.type === 'clock_in' ? 'clock in' : 'clock out'} at {format(new Date(status.lastLog.timestamp), 'hh:mm a')}.</>
                ) : (
                  <>No attendance record yet for today.</>
                )}
              </p>
            </div>

            {error && (
              <div className="w-full max-w-md bg-red-900/50 border border-red-700 text-red-300 rounded-xl px-4 py-3 mb-5 text-center text-sm sm:text-base">
                {error}
              </div>
            )}

            {/* Camera preview */}
            <div className="w-full max-w-md flex justify-center mb-5">
              {!cameraError ? (
                <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-white/20 bg-neutral-800">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-neutral-500">Camera…</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-neutral-600">{cameraError}</p>
              )}
            </div>

            <Button
              onClick={handleScan}
              disabled={loading || isDone}
              size="lg"
              className={`w-full max-w-md h-auto py-4 sm:py-5 text-base sm:text-xl font-bold rounded-2xl tracking-wide transition-all duration-150 active:scale-[0.98] ${
                isDone
                  ? 'bg-neutral-700 text-neutral-500 hover:bg-neutral-700 cursor-not-allowed blur-sm opacity-50'
                  : loading
                  ? 'bg-neutral-700 text-neutral-500 hover:bg-neutral-700 cursor-not-allowed'
                  : isClockIn
                  ? 'bg-white hover:bg-neutral-100 text-neutral-900 shadow-lg shadow-black/40'
                  : 'bg-neutral-500 hover:bg-neutral-400 text-white shadow-lg shadow-neutral-950/60'
              }`}
            >
              {loading
                ? 'Verifying location...'
                : isDone
                ? 'Attendance complete for today'
                : isClockIn
                ? 'Clock In'
                : 'Clock Out'}
            </Button>

            {loading && (
              <div className="w-full max-w-md mt-5 space-y-2">
                <Progress
                  value={progress}
                  className="h-1.5 bg-neutral-700 [&_[data-slot=progress-indicator]]:bg-white"
                />
                <p className="text-center text-xs text-neutral-500 tracking-wide">
                  Loading...
                </p>
              </div>
            )}
          </>
        ) : activeTab === 'insights' ? (
          <div className="w-full space-y-4">
            {/* Period Filter */}
            <div className="flex flex-wrap gap-2 justify-center">
              {['today', 'week', 'month', 'custom'].map(period => (
                <button
                  key={period}
                  onClick={() => setInsightsPeriod(period)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    insightsPeriod === period
                      ? 'bg-white text-neutral-900'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {period === 'today'
                    ? 'Today'
                    : period === 'week'
                    ? 'This Week'
                    : period === 'month'
                    ? 'This Month'
                    : 'Custom Range'}
                </button>
              ))}
            </div>

            {insightsPeriod === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto mt-3">
                <div>
                  <label className="label text-white">Start Date</label>
                  <input
                    type="date"
                    className="input w-full text-white bg-neutral-700 border-neutral-600 placeholder-neutral-400"
                    value={customRangeStart}
                    onChange={e => setCustomRangeStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label text-white">End Date</label>
                  <input
                    type="date"
                    className="input w-full text-white bg-neutral-700 border-neutral-600 placeholder-neutral-400"
                    value={customRangeEnd}
                    onChange={e => setCustomRangeEnd(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Responsive Grid Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-6xl mx-auto">
              {insightsLoading && (
                <div className="lg:col-span-2 rounded-xl border border-neutral-700 bg-neutral-800/70 p-3 text-center text-sm text-neutral-400">
                  Loading insights...
                </div>
              )}

              {/* Your Information */}
              <div className="bg-neutral-800/80 border border-neutral-700 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Your Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Employee ID</span>
                    <span className="text-white font-mono">{employee.employee_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Email</span>
                    <span className="text-white break-all">{employee.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Status</span>
                    <span className="text-green-400 font-semibold">Active</span>
                  </div>
                </div>
              </div>

              {/* Attendance Status */}
              <div className="bg-neutral-800/80 border border-neutral-700 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {insightsPeriod === 'today'
                    ? "Today's Attendance"
                    : insightsPeriod === 'week'
                    ? 'This Week'
                    : insightsPeriod === 'month'
                    ? 'This Month'
                    : 'Custom Range'}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Status</span>
                    <span className="text-white">
                      {insightsPeriod === 'today' ? (
                        status?.lastLog ? (
                          <>
                            {status.lastLog.type === 'clock_in' ? '🟢 Clocked In' : '🔴 Clocked Out'} at{' '}
                            {format(new Date(status.lastLog.timestamp), 'hh:mm a')}
                          </>
                        ) : (
                          <span className="text-neutral-500">No records yet</span>
                        )
                      ) : (
                        <span className="text-neutral-500">Aggregate data</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">
                      {insightsPeriod === 'today' ? 'Next Action' : 'Period Status'}
                    </span>
                    <span
                      className={
                        insightsPeriod === 'today'
                          ? isClockIn
                            ? 'text-blue-400 font-semibold'
                            : isDone
                            ? 'text-neutral-500'
                            : 'text-orange-400 font-semibold'
                          : 'text-blue-400 font-semibold'
                      }
                    >
                      {insightsPeriod === 'today'
                        ? isDone
                          ? 'Done for today'
                          : isClockIn
                          ? 'Clock In'
                          : 'Clock Out'
                        : 'In Progress'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="bg-neutral-800/80 border border-neutral-700 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-900/50 rounded-xl p-4 text-center">
                    <p className="text-neutral-400 text-sm mb-2">Total Hours</p>
                    <p className="text-2xl font-bold text-white">
                      {formatMinutes(insightsSummary?.totalMinutes)}
                    </p>
                  </div>
                  <div className="bg-neutral-900/50 rounded-xl p-4 text-center">
                    <p className="text-neutral-400 text-sm mb-2">Days Present</p>
                    <p className="text-2xl font-bold text-green-400">
                      {insightsSummary?.daysPresent ?? 0}
                    </p>
                  </div>
                  <div className="bg-neutral-900/50 rounded-xl p-4 text-center">
                    <p className="text-neutral-400 text-sm mb-2">On Time</p>
                    <p className="text-2xl font-bold text-emerald-400">{insightsSummary?.onTime ?? 0}</p>
                  </div>
                  <div className="bg-neutral-900/50 rounded-xl p-4 text-center">
                    <p className="text-neutral-400 text-sm mb-2">Late</p>
                    <p className="text-2xl font-bold text-yellow-400">{insightsSummary?.late ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* Period Info */}
              <div className="bg-neutral-800/80 border border-neutral-700 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Period Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-neutral-400">Current Period</span>
                    <span className="text-white text-right">
                      {insightsPeriod === 'today'
                        ? format(new Date(), 'MMM d, yyyy')
                        : insightsPeriod === 'week'
                        ? `Week of ${format(new Date(new Date().setDate(new Date().getDate() - new Date().getDay())), 'MMM d')}`
                        : insightsPeriod === 'month'
                        ? format(new Date(), 'MMMM yyyy')
                        : `${format(new Date(customRangeStart), 'MMM d, yyyy')} — ${format(new Date(customRangeEnd), 'MMM d, yyyy')}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Records</span>
                    <span className="text-white font-mono">
                      {insightsSummary?.records ?? 0} entries
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily attendance log table */}
            {insightsDailyLogs.length > 0 && (
              <div className="bg-neutral-800/80 border border-neutral-700 rounded-3xl p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-4">Daily Log</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-700">
                        <th className="text-left py-2 pr-4 text-neutral-400 font-medium">Date</th>
                        <th className="text-left py-2 pr-4 text-neutral-400 font-medium">Clock In</th>
                        <th className="text-left py-2 pr-4 text-neutral-400 font-medium">Clock Out</th>
                        <th className="text-left py-2 pr-4 text-neutral-400 font-medium">Hours</th>
                        <th className="text-left py-2 text-neutral-400 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-700/50">
                      {insightsDailyLogs.map(row => {
                        const ci = row.clock_in ? new Date(row.clock_in) : null;
                        const co = row.clock_out ? new Date(row.clock_out) : null;
                        const mins = ci && co ? Math.round((co - ci) / 60000) : null;
                        const hrs = mins != null ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '—';
                        return (
                          <tr key={row.date} className="hover:bg-neutral-700/20">
                            <td className="py-3 pr-4">
                              <span className="text-white font-medium">{format(new Date(row.date + 'T00:00:00'), 'EEE dd MMM')}</span>
                            </td>
                            <td className="py-3 pr-4">
                              {ci
                                ? <span className="text-green-400 font-mono">{format(ci, 'hh:mm a')}</span>
                                : <span className="text-neutral-600">—</span>}
                            </td>
                            <td className="py-3 pr-4">
                              {co
                                ? <span className="text-neutral-300 font-mono">{format(co, 'hh:mm a')}</span>
                                : <span className="text-neutral-600">—</span>}
                            </td>
                            <td className="py-3 pr-4">
                              <span className="text-neutral-300">{hrs}</span>
                            </td>
                            <td className="py-3">
                              {row.was_late
                                ? <span className="text-yellow-400 text-xs font-semibold">Late</span>
                                : row.was_early
                                ? <span className="text-orange-400 text-xs font-semibold">Early Out</span>
                                : ci
                                ? <span className="text-green-400 text-xs font-semibold">On Time</span>
                                : <span className="text-neutral-600 text-xs">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}

      </div>
    </div>
  );
}
