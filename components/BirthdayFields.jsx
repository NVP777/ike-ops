'use client';
import { useState } from 'react';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Day + month pickers (no year). onSave(month, day) returns an error message or ''.
export default function BirthdayFields({ month, day, onSave, saveLabel = 'Save', onSkip, skipLabel = 'Skip' }) {
  const [m, setM] = useState(month || '');
  const [d, setD] = useState(day || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (mm, dd) => { setBusy(true); setErr(''); const e = await onSave(mm, dd); setBusy(false); if (e) setErr(e); };
  const save = () => {
    if (!m || !d) { setErr('Pick both a month and a day'); return; }
    if (Number(d) > DAYS_IN[m - 1]) { setErr(`${MONTHS[m - 1]} has no day ${d}`); return; }
    run(Number(m), Number(d));
  };
  return (
    <>
      <div className="two">
        <div className="grow"><label htmlFor="bd-d">Day</label>
          <select id="bd-d" value={d} onChange={(e) => setD(e.target.value)}><option value="">Day</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></div>
        <div className="grow"><label htmlFor="bd-m">Month</label>
          <select id="bd-m" value={m} onChange={(e) => setM(e.target.value)}><option value="">Month</option>{MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select></div>
      </div>
      {err && <div className="err" role="alert" style={{ marginTop: 10 }}>{err}</div>}
      <div className="two" style={{ marginTop: 14 }}>
        {onSkip && <button className="btn ghost grow" disabled={busy} onClick={onSkip}>{skipLabel}</button>}
        <button className="btn grow" disabled={busy} onClick={save}>{saveLabel}</button>
      </div>
    </>
  );
}
