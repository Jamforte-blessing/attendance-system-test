import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { kiosk } from '../api';

const RESET_DELAY = 4000;

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

  // Load companies once
  useEffect(() => {
    kiosk.companies().then(setCompanyList).catch(() => {});
  }, []);

  // Load departments when company changes
  useEffect(() => {
    setSelectedDept('');
    setSelectedEmp('');
    setStatus(null);
    if (!selectedCompany) { setDeptList([]); setEmpList([]); return; }
    kiosk.departments({ company_id: selectedCompany }).then(setDeptList).catch(() => {});
  }, [selectedCompany]);

  // Load employees when company or department changes
  useEffect(() => {
    setSelectedEmp('');
    setStatus(null);
    if (!selectedCompany) { setEmpList([]); return; }
    const params = { company_id: selectedCompany };
    if (selectedDept) params.department_id = selectedDept;
    kiosk.employees(params).then(setEmpList).catch(() => {});
  }, [selectedCompany, selectedDept]);

  // Load employee status when employee selected
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
    return (
      <div className={`kiosk-screen ${result.type === 'clock_in' ? 'kiosk-success-in' : 'kiosk-success-out'}`}>
        <div className="kiosk-result-card">
          <h2 className="kiosk-result-action">
            {result.type === 'clock_in' ? 'Clocked In!' : 'Clocked Out!'}
          </h2>
          <p className="kiosk-result-name">{result.employeeName}</p>
          <p className="kiosk-result-time">
            {format(new Date(result.timestamp), 'hh:mm:ss a')}
          </p>
          {result.isLate && (
            <p className="kiosk-late-tag">Marked as Late</p>
          )}
          {result.isEarly && (
            <p className="kiosk-early-tag">Left Early</p>
          )}
          <p className="kiosk-reset-hint">Screen resets in a moment...</p>
        </div>
      </div>
    );
  }

  // ── Main kiosk screen ───────────────────────────────────────────────────────
  return (
    <div className="kiosk-screen kiosk-idle">
      <div className="kiosk-header">
        <span className="kiosk-header-title">Employee Attendance</span>
        <span className="kiosk-header-time">
          {format(now, 'hh:mm:ss a')} &nbsp;·&nbsp; {format(now, 'EEEE, dd MMMM yyyy')}
        </span>
      </div>

      <div className="kiosk-card">
        <h1 className="kiosk-card-title">Clock In / Clock Out</h1>
        <p className="kiosk-card-sub">Select your company and name, then tap the button below.</p>

        {/* Company select */}
        <div className="kiosk-field">
          <label className="kiosk-label">Company</label>
          <select
            className="kiosk-select"
            value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
          >
            <option value="">— Select company —</option>
            {companyList.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Department select */}
        {selectedCompany && (
          <div className="kiosk-field">
            <label className="kiosk-label">Department</label>
            <select
              className="kiosk-select"
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
            >
              <option value="">All Departments</option>
              {deptList.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Employee select */}
        {selectedCompany && (
          <div className="kiosk-field">
            <label className="kiosk-label">Your Name</label>
            <select
              className="kiosk-select"
              value={selectedEmp}
              onChange={e => setSelectedEmp(e.target.value)}
            >
              <option value="">— Select your name —</option>
              {empList.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Current status hint */}
        {status && (
          <div className={`kiosk-status-hint ${isClockIn ? 'kiosk-hint-in' : 'kiosk-hint-out'}`}>
            {status.lastLog ? (
              <>
                You last <strong>{status.lastLog.type === 'clock_in' ? 'clocked in' : 'clocked out'}</strong>{' '}
                at <strong>{format(new Date(status.lastLog.timestamp), 'hh:mm a')}</strong>.
                {' '}Next action: <strong>{isClockIn ? 'Clock In' : 'Clock Out'}</strong>.
              </>
            ) : (
              <>You have no records today. Tap <strong>Clock In</strong> to start.</>
            )}
          </div>
        )}

        {/* Location note */}
        {selectedEmp && (
          <p className="text-xs text-gray-500 mb-3 text-center max-w-md">
            Your location will be verified when you tap the button below.
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="kiosk-error">{error}</div>
        )}

        {/* Action button */}
        <button
          onClick={handleScan}
          disabled={!selectedEmp || loading}
          className={`kiosk-action-btn ${
            !selectedEmp || loading
              ? 'kiosk-btn-disabled'
              : isClockIn
              ? 'kiosk-btn-in'
              : 'kiosk-btn-out'
          }`}
        >
          {loading ? (
            <span>Verifying location...</span>
          ) : !selectedCompany ? (
            <span>Select your company above</span>
          ) : !selectedEmp ? (
            <span>Select your name above</span>
          ) : isClockIn ? (
            <span>Clock In</span>
          ) : (
            <span>Clock Out</span>
          )}
        </button>
      </div>
    </div>
  );
}
