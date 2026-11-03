'use client';
import { useEffect, useRef, useState } from 'react';

// "Made by us": a chassis build plate stamps onto the screen, sparks fly off it, and a red laser
// engraves the details. The inspection counter goes up every time. Tap anywhere to close.
function Row({ d, children }) {
  return (
    <div className="pl-row" style={{ '--d': d }}>
      <div className="pin">{children}</div>
      <i className="laser" />
    </div>
  );
}

export default function Party() {
  const root = useRef(null), cv = useRef(null), plate = useRef(null), closed = useRef(false);
  // Read only here. In development React runs this function twice, so it must not save anything.
  const [n] = useState(() => {
    try { return (+localStorage.getItem('ike-party') || 0) + 1; } catch { return 1; }
  });

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    if (root.current) { root.current.style.transition = 'opacity .25s'; root.current.style.opacity = '0'; }
    setTimeout(() => window.dispatchEvent(new Event('ike-party-close')), 260);
  };

  useEffect(() => {
    try { localStorage.setItem('ike-party', String(n)); } catch {} // saves the same number even if this runs twice
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timers = [setTimeout(close, 9000)];
    let raf;
    if (!reduce) {
      timers.push(setTimeout(() => { try { navigator.vibrate?.([35, 25, 90]); } catch {} }, 420));
      const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = cv.current; c.width = W * dpr; c.height = H * dpr;
      const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
      const sparks = []; let emitted = false, last = performance.now();
      const emit = () => { // sparks leave the plate's edge, as if it was just stamped
        const r = plate.current.getBoundingClientRect();
        for (let i = 0; i < 46; i++) {
          const t = Math.random() * 2 * (r.width + r.height); let px, py, ang;
          if (t < r.width) { px = r.left + t; py = r.top; ang = -Math.PI / 2; }
          else if (t < r.width + r.height) { px = r.right; py = r.top + (t - r.width); ang = 0; }
          else if (t < 2 * r.width + r.height) { px = r.right - (t - r.width - r.height); py = r.bottom; ang = Math.PI / 2; }
          else { px = r.left; py = r.bottom - (t - 2 * r.width - r.height); ang = Math.PI; }
          const a = ang + (Math.random() - 0.5) * 1.4, v = 3 + Math.random() * 8;
          sparks.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 450 + Math.random() * 500 });
        }
        emitted = true;
      };
      timers.push(setTimeout(emit, 430));
      const loop = (now) => {
        if (closed.current) return;
        const dt = Math.min(now - last, 40); last = now; const f = dt / 16;
        ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.8;
        for (let i = sparks.length - 1; i >= 0; i--) {
          const p = sparks[i]; p.life += dt;
          if (p.life > p.max) { sparks.splice(i, 1); continue; }
          p.vy += 0.28 * f; p.x += p.vx * f; p.y += p.vy * f;
          const k = p.life / p.max;
          ctx.strokeStyle = `rgba(255,${150 + ((k * 80) | 0)},70,${1 - k})`;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.8, p.y - p.vy * 1.8); ctx.stroke();
        }
        if (emitted && sparks.length === 0) return;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); };
  }, []); // eslint-disable-line

  const rows = [['CHASSIS No.', '001'], ['BUILT BY', 'NAMAN PANPALIA'], ['PIT CREW', 'CLAUDE'], ['SEASON', '2026'], ['INSPECTIONS', String(n).padStart(3, '0')]];
  return (
    <div ref={root} className="party" onClick={close}>
      <canvas ref={cv} className="party-fx" />
      <div ref={plate} className="plate" role="dialog" aria-label="Chassis build plate">
        <i className="rivet r1" /><i className="rivet r2" /><i className="rivet r3" /><i className="rivet r4" />
        <Row d="0.7s"><div className="pl-small">Inspired Karters · BITS Pilani</div></Row>
        <Row d="0.8s"><div className="pl-head">Operations Terminal</div></Row>
        {rows.map(([k, v], i) => (
          <Row key={k} d={`${1.0 + i * 0.3}s`}><div className="pl-line"><span className="pl-k">{k}</span><span className="pl-v">{v}</span></div></Row>
        ))}
        <Row d="2.6s"><div className="pl-decal">Not for road use</div></Row>
      </div>
      <div className="party-close">TAP TO CLOSE</div>
    </div>
  );
}
