'use client';
import { useEffect } from 'react';

// Finish message, styled like a race-control banner: a strip drops in from the top with a waving
// checkered tab and a green light, plus a quick green glow around the screen edges. About 2 seconds.
export default function Flag({ label, onDone }) {
  useEffect(() => {
    try { navigator.vibrate?.([12, 40, 26]); } catch {}
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line
  return (
    <div className="fin" aria-hidden="true">
      <div className="fin-glow" />
      <div className="fin-strip">
        <span className="fin-chk" />
        <span className="fin-txt">{label || 'Done'}</span>
        <span className="fin-led" />
      </div>
    </div>
  );
}
