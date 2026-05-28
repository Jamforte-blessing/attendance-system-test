import { useState, useRef, useEffect } from 'react';

function MoreHorizontal() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
    </svg>
  );
}

export function RowActions({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative flex justify-end" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 focus:outline-none"
      >
        <MoreHorizontal />
        <span className="sr-only">Open menu</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-8 w-44 rounded-md border border-gray-200 bg-white shadow-lg py-1">
          {actions.map((action, i) =>
            action === 'separator' ? (
              <div key={i} className="h-px bg-gray-100 my-1" />
            ) : (
              <button
                key={i}
                onClick={() => { action.onClick(); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm ${action.variant === 'destructive' ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                {action.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
