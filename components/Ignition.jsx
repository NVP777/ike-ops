'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';

// The car in your logo drives across the screen right to left (its nose points left). A dark curtain
// follows it and uncovers the app behind. Smoke and speed lines trail the car.
// Plays once after a fresh login, about 2 seconds, tap anywhere to skip. Skipped with "reduce motion".
const AR = 568 / 204;      // width / height of the car artwork
const GO = 250;            // ms before the car starts moving
const TRAVEL = 1600;       // ms the car takes to cross
const END = GO + TRAVEL + 450; // ms until everything has faded

export default function Ignition() {
  const { ignite, endIgnite } = useAuth();
  if (!ignite) return null;
  return <Run onDone={endIgnite} />;
}

function Run({ onDone }) {
  const root = useRef(null), veil = useRef(null), car = useRef(null), g1 = useRef(null), g2 = useRef(null), cv = useRef(null);
  const [ready, setReady] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    if (root.current) { root.current.style.transition = 'opacity .25s'; root.current.style.opacity = '0'; }
    setTimeout(onDone, 260);
  };

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onDone(); return; }
    const t = setTimeout(() => setReady(true), 900); // don't wait forever for the image
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!ready) return;
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = cv.current;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);

    const carW = Math.min(W * 0.92, 640), carH = carW / AR, cy = H * 0.5;
    [car, g1, g2].forEach((r) => { r.current.style.width = `${carW}px`; r.current.style.top = `${cy - carH / 2}px`; });
    const x0 = W, x1 = -carW; // left edge of the car: starts just off the right edge, ends just off the left

    // one soft puff, drawn once and stamped many times
    const sp = document.createElement('canvas'); sp.width = sp.height = 64;
    const sc = sp.getContext('2d'); const gr = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(238,238,238,1)'); gr.addColorStop(0.5, 'rgba(205,205,205,.45)'); gr.addColorStop(1, 'rgba(205,205,205,0)');
    sc.fillStyle = gr; sc.fillRect(0, 0, 64, 64);

    try { navigator.vibrate?.([20, 40, 60]); } catch {}

    const parts = [], streaks = [];
    const start = performance.now();
    let last = start, prevTail = x0 + carW, raf;

    const loop = (now) => {
      if (done.current) return;
      const t = now - start, dt = now - last; last = now;
      const p = Math.min(1, Math.max(0, (t - GO) / TRAVEL));
      const x = x0 + (x1 - x0) * Math.pow(p, 2.2); // starts slow, ends fast
      const tail = x + carW;                        // right edge (the rear of the car)
      const v = Math.max(0, prevTail - tail); prevTail = tail;

      const tf = (dx) => `translate3d(${x + dx}px,0,0) skewX(-6deg)`;
      car.current.style.transform = tf(0);
      g1.current.style.transform = tf(Math.min(v, 70) * 2.5);
      g2.current.style.transform = tf(Math.min(v, 70) * 5);

      // curtain: solid up to just before the tail, soft edge, then the app shows through
      const m = `linear-gradient(90deg,#000 ${Math.max(0, tail - 140)}px,transparent ${Math.max(1, tail)}px)`;
      veil.current.style.webkitMaskImage = m; veil.current.style.maskImage = m;
      if (p >= 1) veil.current.style.display = 'none';

      ctx.clearRect(0, 0, W, H);
      if (t < 800) { // ignition glow at the right edge
        const a = Math.sin(Math.min(1, t / 800) * Math.PI) * 0.5;
        const g = ctx.createRadialGradient(W, cy, 0, W, cy, W * 0.8);
        g.addColorStop(0, `rgba(255,70,45,${a})`); g.addColorStop(1, 'rgba(255,70,45,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      if (p > 0 && p < 1 && tail > 0 && tail < W + 80) {
        for (let i = 0; i < 3; i++) parts.push({ x: Math.min(tail, W) - 6 + Math.random() * 10, y: cy + carH * (0.04 + Math.random() * 0.2),
          vx: 0.3 + Math.random() * 0.8, vy: -(0.1 + Math.random() * 0.45), s: 26 + Math.random() * 26, g: 0.9 + Math.random() * 0.8, life: 0, max: 900 + Math.random() * 500 });
        for (let i = 0; i < 3; i++) streaks.push({ x: tail + Math.random() * 24, y: cy + (Math.random() - 0.5) * carH * 1.6, len: 30 + v * (1.5 + Math.random() * 2), life: 0, max: 240 });
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i]; q.life += dt;
        if (q.life > q.max) { parts.splice(i, 1); continue; }
        const k = q.life / q.max; q.x += q.vx * dt * 0.06; q.y += q.vy * dt * 0.06;
        const s = q.s * (1 + k * q.g * 2.2);
        ctx.globalAlpha = (1 - k) * 0.3; ctx.drawImage(sp, q.x - s / 2, q.y - s / 2, s, s);
      }
      ctx.lineWidth = 1.4;
      for (let i = streaks.length - 1; i >= 0; i--) {
        const q = streaks[i]; q.life += dt;
        if (q.life > q.max) { streaks.splice(i, 1); continue; }
        ctx.globalAlpha = (1 - q.life / q.max) * 0.5; ctx.strokeStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + q.len, q.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (t >= END) { finish(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready]); // eslint-disable-line

  return (
    <div ref={root} className="ign" onClick={finish} aria-hidden="true">
      <div ref={veil} className="ign-veil" />
      <img ref={g2} className="ign-car ghost two" src="/ike-car.svg" alt="" draggable="false" />
      <img ref={g1} className="ign-car ghost" src="/ike-car.svg" alt="" draggable="false" />
      <img ref={car} className="ign-car" src="/ike-car.svg" alt="" draggable="false" onLoad={() => setReady(true)} />
      <canvas ref={cv} className="ign-fx" />
    </div>
  );
}
