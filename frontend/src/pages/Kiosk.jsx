import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { kiosk } from '../api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

const RESET_DELAY = 4000;
const NONE = '__none__';

const labelClass = 'block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-2';

// Dark-themed trigger for the kiosk dark background
const KioskSelect = ({ value, onValueChange, children, placeholder }) => (
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

function useGeolocation() {
  const get = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation is not supported by this browser.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => reject('Location access was denied. Please allow location access and try again.'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  return get;
}

export default function Kiosk() {
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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!loading) { setProgress(0); return; }
    setProgress(18);
    const t = setInterval(() => setProgress(v => (v < 82 ? v + 12 : v)), 650);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    kiosk.companies().then(setCompanyList).catch(() => {});
  }, []);

  useEffect(() => {
    setSelectedDept('');
    setSelectedEmp('');
    setStatus(null);
    if (!selectedCompany) { setDeptList([]); setEmpList([]); return; }
    kiosk.departments({ company_id: selectedCompany }).then(setDeptList).catch(() => {});
  }, [selectedCompany]);

  useEffect(() => {
    setSelectedEmp('');
    setStatus(null);
    if (!selectedCompany) { setEmpList([]); return; }
    const params = { company_id: selectedCompany };
    if (selectedDept) params.department_id = selectedDept;
    kiosk.employees(params).then(setEmpList).catch(() => {});
  }, [selectedCompany, selectedDept]);

  const loadStatus = useCallback(async id => {
    if (!id) { setStatus(null); return; }
    try {
      const s = await kiosk.status(id);
      setStatus(s);
    } catch (_) {}
  }, []);

  useEffect(() => { loadStatus(selectedEmp); }, [selectedEmp, loadStatus]);

  const handleScan = async () => {
    if (!selectedEmp || loading) return;
    setLoading(true);
    setError('');

    let coords = null;
    try {
      coords = await getLocation();
    } catch (locErr) {
      setError(locErr);
      setLoading(false);
      return;
    }

    try {
      const res = await kiosk.scan({
        employee_id: selectedEmp,
        latitude: coords.latitude,
        longitude: coords.longitude,
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

  // ── Success screen ──────────────────────────────────────────────────────────
  if (result) {
    const isIn = result.type === 'clock_in';
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${isIn ? 'bg-green-600' : 'bg-neutral-700'}`}>
        <div className="flex flex-col items-center text-white text-center px-6 py-10">
          <img src="/logo.png" alt="Logo" className="h-12 w-auto mb-8 opacity-70" />
          <h2 className="text-2xl sm:text-4xl font-bold mb-3">
            {isIn ? 'Clocked In!' : 'Clocked Out!'}
          </h2>
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

  // ── Main kiosk screen ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-neutral-900 font-sans antialiased">
      {/* Header */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-3 sm:py-4 bg-black/40 border-b border-white/10">
        <img src="/logo.png" alt="Logo" className="h-8 sm:h-10 w-auto" />
        <span className="text-sm sm:text-base font-mono text-white/60 tabular-nums">
          {format(now, 'hh:mm:ss a')}&nbsp;&nbsp;·&nbsp;&nbsp;{format(now, 'EEEE, dd MMMM yyyy')}
        </span>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2 text-center tracking-tight">
          Clock In / Clock Out
        </h1>
        <p className="text-neutral-400 text-sm sm:text-base mb-6 sm:mb-8 text-center max-w-md">
          Select your company and name, then tap the button below.
        </p>

        {/* Selectors */}
        <div className="w-full max-w-md space-y-5 mb-6">
          <div>
            <label className={labelClass}>Company</label>
            <KioskSelect
              value={selectedCompany}
              onValueChange={setSelectedCompany}
              placeholder="— Select company —"
            >
              <SelectItem value={NONE}>— Select company —</SelectItem>
              {companyList.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </KioskSelect>
          </div>

          {selectedCompany && (
            <div>
              <label className={labelClass}>Department</label>
              <KioskSelect
                value={selectedDept}
                onValueChange={setSelectedDept}
                placeholder="All Departments"
              >
                <SelectItem value={NONE}>All Departments</SelectItem>
                {deptList.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </KioskSelect>
            </div>
          )}

          {selectedCompany && (
            <div>
              <label className={labelClass}>Your Name</label>
              <KioskSelect
                value={selectedEmp}
                onValueChange={setSelectedEmp}
                placeholder="— Select your name —"
              >
                <SelectItem value={NONE}>— Select your name —</SelectItem>
                {empList.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </KioskSelect>
            </div>
          )}
        </div>

        {/* Status hint */}
        {status && (
          <div className={`w-full max-w-md rounded-xl px-4 py-3 mb-5 text-sm sm:text-base text-center border ${
            isClockIn
              ? 'bg-green-900/40 text-green-300 border-green-700'
              : 'bg-neutral-800/60 text-neutral-300 border-neutral-600'
          }`}>
            {status.lastLog ? (
              <>
                You last <strong>{status.lastLog.type === 'clock_in' ? 'clocked in' : 'clocked out'}</strong>{' '}
                at <strong>{format(new Date(status.lastLog.timestamp), 'hh:mm a')}</strong>.{' '}
                Next action: <strong>{isClockIn ? 'Clock In' : 'Clock Out'}</strong>.
              </>
            ) : (
              <>You have no records today. Tap <strong>Clock In</strong> to start.</>
            )}
          </div>
        )}

        {selectedEmp && (
          <p className="text-xs text-neutral-600 mb-4 text-center max-w-md">
            Your location will be verified when you tap the button below.
          </p>
        )}

        {error && (
          <div className="w-full max-w-md bg-red-900/50 border border-red-700 text-red-300 rounded-xl px-4 py-3 mb-5 text-center text-sm sm:text-base">
            {error}
          </div>
        )}

        {/* Action button */}
        <Button
          onClick={handleScan}
          disabled={!selectedEmp || loading}
          size="lg"
          className={`w-full max-w-md h-auto py-4 sm:py-5 text-base sm:text-xl font-bold rounded-2xl tracking-wide transition-all duration-150 active:scale-[0.98] ${
            !selectedEmp || loading
              ? 'bg-neutral-700 text-neutral-500 hover:bg-neutral-700 cursor-not-allowed'
              : isClockIn
              ? 'bg-white hover:bg-neutral-100 text-neutral-900 shadow-lg shadow-black/40'
              : 'bg-neutral-500 hover:bg-neutral-400 text-white shadow-lg shadow-neutral-950/60'
          }`}
        >
          {loading
            ? 'Verifying location...'
            : !selectedCompany
            ? 'Select your company above'
            : !selectedEmp
            ? 'Select your name above'
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
      </div>
    </div>
  );
}
