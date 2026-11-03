'use client';
import { useRef } from 'react';

const SWATCHES = [['Amber', 38], ['Green', 135], ['Cyan', 185], ['Blue', 215], ['Violet', 270], ['Pink', 320]];

// Drag around the ring to pick a hue (0 to 359). The background shifts from red to that hue.
export default function AlertColor({ hue, onChange }) {
  const ref = useRef(null);
  const pick = (e) => {
    const r = ref.current.getBoundingClientRect();
    const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    onChange(Math.round((a + 90 + 360) % 360));
  };
  const key = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange((hue + 5) % 360); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange((hue + 355) % 360); }
  };
  return (
    <div className="alertpick">
      <div ref={ref} className="wheel" role="slider" tabIndex={0} aria-label="Alert color" aria-valuemin={0} aria-valuemax={359} aria-valuenow={hue}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
        onPointerMove={(e) => { if (e.buttons) pick(e); }} onKeyDown={key}>
        <div className="wheel-hole"><span className="wheel-dot" style={{ background: `hsl(${hue},100%,52%)` }} /></div>
        <i className="wheel-knob" style={{ transform: `rotate(${hue}deg) translateY(-87px)`, background: `hsl(${hue},100%,52%)` }} />
      </div>
      <div className="sws">
        {SWATCHES.map(([name, h]) => (
          <button key={name} className={`sw ${Math.abs(h - hue) < 3 ? 'on' : ''}`} style={{ background: `hsl(${h},100%,52%)` }} aria-label={name} onClick={() => onChange(h)} />
        ))}
      </div>
    </div>
  );
}
