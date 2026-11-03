'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';

// TIME ATTACK. A real lap, not an endless runner: today's track is the same for everyone (it is built from the date),
// it has a finish line, three checkpoints named after the car's subsystems that add time, a ghost of your best run,
// and gold, silver and bronze times. Portrait, top-down. Hold the left or right half of the screen to steer.
const L = 2000;                                              // track length in metres
const GATES = [[500, 'CHASSIS'], [1000, 'POWERTRAIN'], [1500, 'AERO']];
const START_LEFT = 24, BONUS = 7;                            // seconds on the clock at the start, and added at each checkpoint
const VMAX = 62, ACC = 16, STEER = 460;
// Medal times come from a bot that races today's track well (dodges everything, takes the boosts), so every day is fair.
const medalList = (e) => [['GOLD', e * 1.06, '#f5c542'], ['SILVER', e * 1.15, '#c9cdd3'], ['BRONZE', e * 1.3, '#c7803f']];
const medalFor = (t, e) => (e ? medalList(e).find(([, lim]) => t <= lim) || null : null);
const pad = (n) => String(n).padStart(2, '0');
const dayNum = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const dayLabel = (n) => `${Math.floor(n / 10000)}-${pad(Math.floor(n / 100) % 100)}-${pad(n % 100)}`;
const fmt = (t) => { const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(2).padStart(5, '0')}`; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The same date always gives the same road and the same obstacles.
export function buildTrack(seed) {
  const r = mulberry32(seed);
  const waves = [0.5, 0.32, 0.18].map((a) => ({ a, f: (2 * Math.PI) / (150 + r() * 180), p: r() * 6.28 }));
  const c = (p) => {
    const ramp = clamp((p - 70) / 120, 0, 1) * clamp((L + 40 - p) / 160, 0, 1); // straight at the start and the finish
    return ramp * waves.reduce((s, w) => s + w.a * Math.sin(p * w.f + w.p), 0);
  };
  const o = []; let p = 140;
  while (p < L - 120) {
    const q = r();
    const type = q < 0.4 ? 'cone' : q < 0.58 ? 'tyre' : q < 0.8 ? 'oil' : 'boost';
    const n = type === 'cone' ? 1 + Math.floor(r() * 3) : 1;
    const base = (r() * 2 - 1) * 0.72;
    for (let i = 0; i < n; i++) o.push({ p: p + i * 5, ox: clamp(base + i * 0.12, -0.82, 0.82), type, hit: false });
    p += 22 + r() * 32;
  }
  return { c, o };
}

function drawCar(ctx, x, y, rot, alpha, body, dark) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  ctx.fillStyle = '#0a0a0a';
  [[-12, -17], [12, -17], [-12, 16], [12, 16]].forEach(([wx, wy]) => ctx.fillRect(wx - 4.5, wy - 8, 9, 16)); // wheels
  ctx.fillStyle = body; ctx.fillRect(-17, -32, 34, 5);                                                       // front wing
  ctx.beginPath(); ctx.moveTo(-4, -30); ctx.lineTo(4, -30); ctx.lineTo(7, -14); ctx.lineTo(-7, -14); ctx.closePath(); ctx.fill(); // nose
  ctx.fillRect(-7, -16, 14, 36);                                                                             // body
  ctx.fillStyle = dark; ctx.fillRect(-11, -2, 22, 16);                                                       // sidepods
  ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-1.2, -30, 2.4, 52);                                               // stripe
  ctx.fillStyle = '#0d0d0f'; ctx.beginPath(); ctx.ellipse(0, -2, 4, 6, 0, 0, 6.3); ctx.fill();               // cockpit
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -1, 2.4, 0, 6.3); ctx.fill();                          // helmet
  ctx.fillStyle = '#1a1a1d'; ctx.fillRect(-14, 20, 28, 6);                                                   // rear wing
  ctx.fillStyle = body; ctx.fillRect(-15, 19, 2, 8); ctx.fillRect(13, 19, 2, 8);
  ctx.restore();
}

const fresh = (saved) => ({
  s: 0, x: 0, sv: 0, speed: 0, left: START_LEFT, t: 0, spin: 0, spinA: 0, spinDir: 1, boost: 0, shake: 0,
  passed: [false, false, false], rec: [], recT: 0, smoke: [], sparks: [], msg: '', msgT: 0,
  ghost: saved?.g || null, phase: 'ready', last: performance.now(), hudT: 0,
});

function stepGame(G, dt, E) {
const { c, o } = E;
    const W = E.W, AMP = W * 0.30, rw = W * 0.24;
    G.t += dt; G.left -= dt;
    if (G.spin > 0) G.spin -= dt;
    if (G.boost > 0) G.boost -= dt;
    const dir = G.spin > 0 ? 0 : E.input();
    G.sv += (dir * STEER - G.sv) * Math.min(1, dt * 9);
    G.x += G.sv * (0.5 + 0.5 * Math.min(1, G.speed / VMAX)) * dt;
    G.x -= ((c(G.s + 1) - c(G.s - 1)) / 2) * AMP * G.speed * dt;     // the road bends away under the car
    const lim = rw + 60;
    if (Math.abs(G.x) > lim) { G.x = Math.sign(G.x) * lim; G.speed *= 0.97; G.shake = 1; }
    const off = Math.abs(G.x) > rw - 5;
    const cap = G.boost > 0 ? VMAX * 1.32 : VMAX;
    if (off) { G.speed = Math.max(22, G.speed - 42 * dt); G.shake = Math.max(G.shake, 0.6); }
    else G.speed = G.speed < cap ? Math.min(cap, G.speed + ACC * dt) : Math.max(cap, G.speed - 30 * dt);
    G.s += G.speed * dt;
    G.shake = Math.max(0, G.shake - dt * 3);
    G.spinA = G.spin > 0 ? G.spinA + 14 * dt * G.spinDir : G.spinA * 0.8;

    for (const ob of o) {
      if (ob.hit || Math.abs(ob.p - G.s) > 2.4) continue;
      const half = ob.type === 'tyre' ? 13 : ob.type === 'oil' ? 20 : ob.type === 'boost' ? 22 : 8;
      if (Math.abs(ob.ox * rw - G.x) > half + 10) continue;
      ob.hit = true;
      const spark = (n) => { for (let i = 0; i < n; i++) G.sparks.push({ x: W / 2 + G.x, y: E.H * 0.8 - 20, vx: (Math.random() - 0.5) * 260, vy: -60 - Math.random() * 160, life: 0 }); };
      if (ob.type === 'boost') { G.boost = 1.6; G.speed = Math.min(VMAX * 1.32, G.speed + 26); G.msg = 'BOOST'; G.msgT = 0.9; E.buzz(15); }
      else if (ob.type === 'cone') { G.speed *= 0.6; G.shake = 0.5; spark(6); E.buzz(25); }
      else if (ob.type === 'tyre') { G.speed *= 0.35; G.shake = 1; G.sv = (Math.random() < 0.5 ? -1 : 1) * 220; spark(12); E.buzz([40, 20, 60]); }
      else { G.spin = 1.1; G.spinDir = Math.random() < 0.5 ? -1 : 1; G.speed *= 0.75; G.msg = 'OIL!'; G.msgT = 0.9; E.buzz(30); }
    }
    GATES.forEach(([p, name], i) => {
      if (!G.passed[i] && G.s >= p) { G.passed[i] = true; G.left += BONUS; G.msg = `${name}  +${BONUS}s`; G.msgT = 1.3; E.buzz(20); }
    });
    G.recT += dt;
    while (G.recT >= 0.1) { G.recT -= 0.1; G.rec.push([+G.s.toFixed(1), Math.round(G.x)]); }
    if (G.speed > 15 && Math.random() < 0.7) G.smoke.push({ x: G.x, y: 26, life: 0 });
    if (G.s >= L) E.finish(G, 'finish');
    else if (G.left <= 0) { G.left = 0; E.finish(G, 'time'); }
  }

// Races the expert bot over today's track and returns its time in seconds.
function expertTime(seed, W) {
  const { c, o } = buildTrack(seed);
  const G = fresh(null); G.phase = 'run';
  let done = false, v = 0;
  const E = { W, H: 800, c, o, input: () => v, finish: () => { done = true; }, buzz() {} };
  const rw = W * 0.24;
  for (let i = 0; i < 60 * 90 && !done; i++) {
    let target = 0;
    for (const ob of o) {
      if (ob.hit) continue;
      const d = ob.p - G.s; if (d < 0 || d > 38) continue;
      const ox = ob.ox * rw;
      if (ob.type === 'boost') { target = ox; break; }
      if (Math.abs(ox - G.x) < 34) { target = ox > 0 ? ox - 46 : ox + 46; break; }
    }
    const e = target - G.x; v = Math.abs(e) < 8 ? 0 : e > 0 ? 1 : -1;
    stepGame(G, 1 / 60, E);
  }
  return G.t;
}

export default function TimeAttack({ onExit }) {
  const { user } = useAuth();
  const day = useMemo(() => dayNum(), []);
  const track = useMemo(() => buildTrack(day), [day]);
  const box = useRef(null), cv = useRef(null), g = useRef(null), inp = useRef(0), timers = useRef([]);
  const readSaved = () => { try { return JSON.parse(localStorage.getItem(`ike-lap-${day}`)); } catch { return null; } };
  const [saved, setSaved] = useState(readSaved);
  const [phase, setPhase] = useState('ready'); // ready | lights | run | done
  const [lights, setLights] = useState(0);
  const [hud, setHud] = useState({ left: START_LEFT, speed: 0, prog: 0, msg: '' });
  const [result, setResult] = useState(null);
  const [par, setPar] = useState(null);
  const parRef = useRef(null);
  const medals = par ? medalList(par) : [];
  const [copied, setCopied] = useState(false);

  const buzz = (p) => { try { navigator.vibrate?.(p); } catch {} };

  useEffect(() => {
    g.current = fresh(readSaved());
    const canvas = cv.current, ctx = canvas.getContext('2d');
    const view = { W: 0, H: 0 };
    const fam = (getComputedStyle(document.documentElement).getPropertyValue('--font-logo') || '').trim() || 'sans-serif';
    const size = () => {
      const r = box.current.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.W = r.width; view.H = r.height; canvas.width = r.width * dpr; canvas.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size(); window.addEventListener('resize', size);
    const e = expertTime(day, view.W); parRef.current = e; setPar(e);
    const { c, o } = track;
    let raf;

    const finish = (G, kind) => {
      G.phase = 'done'; setPhase('done'); inp.current = 0;
      buzz(kind === 'finish' ? [30, 40, 30, 40, 100] : [200]);
      if (kind === 'finish') {
        const time = G.t, prev = readSaved(), pb = !prev || time < prev.t;
        if (pb) { const rec = { t: time, g: G.rec }; try { localStorage.setItem(`ike-lap-${day}`, JSON.stringify(rec)); } catch {} setSaved(rec); }
        setResult({ kind, time, medal: medalFor(time, parRef.current), pb, best: pb ? time : prev.t });
      } else setResult({ kind, dist: Math.round(G.s) });
    };

    const E = { get W() { return view.W; }, get H() { return view.H; }, c, o, input: () => inp.current, finish, buzz };
    const step = (G, dt) => stepGame(G, dt, E);

    const draw = (G) => {
      const W = view.W, H = view.H; if (!W) return;
      const k = (H * 0.8) / 95, carY = H * 0.8, AMP = W * 0.30, rw = W * 0.24, cs = c(G.s);
      const px = (p) => W / 2 + (c(p) - cs) * AMP;
      ctx.save();
      if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 7 * G.shake, (Math.random() - 0.5) * 4 * G.shake);
      for (let y = -8; y < H + 8; y += 4) {
        const p = G.s + (carY - y) / k, cx = px(p);
        ctx.fillStyle = Math.floor(p / 14) & 1 ? '#0b1f12' : '#0e2716'; ctx.fillRect(-12, y, W + 24, 4);
        ctx.fillStyle = Math.floor(p / 5) & 1 ? '#e8392f' : '#f1f1f1'; ctx.fillRect(cx - rw - 8, y, 8, 4); ctx.fillRect(cx + rw, y, 8, 4);
        ctx.fillStyle = '#26262c'; ctx.fillRect(cx - rw, y, rw * 2, 4);
        if (p > 0 && (Math.floor(p / 7) & 1)) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(cx - 1.5, y, 3, 4); }
        if (p >= 0 && p < 2.5) { ctx.fillStyle = '#dcdcdc'; ctx.fillRect(cx - rw, y, rw * 2, 4); }
        for (const [gp] of GATES) if (p >= gp && p < gp + 2.4) { ctx.fillStyle = '#e8392f'; ctx.fillRect(cx - rw - 8, y, rw * 2 + 16, 4); }
        if (p >= L && p < L + 5) {
          for (let xx = cx - rw, j = 0; xx < cx + rw; xx += 14, j++) {
            ctx.fillStyle = (j + Math.floor((p - L) / 2.5)) % 2 ? '#101010' : '#f4f4f4';
            ctx.fillRect(xx, y, Math.min(14, cx + rw - xx), 4);
          }
        }
      }
      ctx.textAlign = 'center'; ctx.font = `13px ${fam}`; ctx.fillStyle = '#fff';
      for (const [gp, name] of GATES) { const y = carY - (gp - G.s) * k; if (y > -20 && y < H + 20) ctx.fillText(name, px(gp), y - 8); }
      for (const ob of o) {
        const y = carY - (ob.p - G.s) * k; if (y < -30 || y > H + 30) continue;
        if (ob.hit && (ob.type === 'cone' || ob.type === 'tyre')) continue;
        const x = px(ob.p) + ob.ox * rw;
        if (ob.type === 'cone') {
          ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x - 8, y + 6); ctx.lineTo(x + 8, y + 6); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 2, 10, 3);
        } else if (ob.type === 'tyre') {
          ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.3); ctx.fill();
          ctx.strokeStyle = '#555'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.3); ctx.fill();
        } else if (ob.type === 'oil') {
          ctx.fillStyle = 'rgba(8,8,14,.92)'; ctx.beginPath(); ctx.ellipse(x, y, 22, 14, 0, 0, 6.3); ctx.fill();
          ctx.strokeStyle = 'rgba(130,100,220,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x - 4, y - 3, 12, 6, 0, 0, 6.3); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(255,210,58,.18)'; ctx.fillRect(x - 24, y - 22, 48, 40);
          ctx.strokeStyle = ob.hit ? 'rgba(255,210,58,.4)' : '#ffd23a'; ctx.lineWidth = 4;
          for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(x - 14, y + 6 - i * 10); ctx.lineTo(x, y - 6 - i * 10); ctx.lineTo(x + 14, y + 6 - i * 10); ctx.stroke(); }
        }
      }
      if (G.ghost?.length && (G.phase === 'run' || G.phase === 'done')) {  // the ghost is your best run
        const f = G.t / 0.1, i = Math.floor(f), a = G.ghost[i], b = G.ghost[i + 1];
        if (a) {
          const gs = b ? a[0] + (b[0] - a[0]) * (f - i) : a[0], gx = b ? a[1] + (b[1] - a[1]) * (f - i) : a[1];
          const y = carY - (gs - G.s) * k;
          if (y > -40 && y < H + 40) drawCar(ctx, px(gs) + gx, y, 0, 0.38, '#9fd8ff', '#6aa8d6');
        }
      }
      for (const q of G.smoke) { ctx.globalAlpha = Math.max(0, 0.35 - q.life * 0.6); ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.arc(W / 2 + q.x, carY + q.y, 3 + q.life * 9, 0, 6.3); ctx.fill(); }
      ctx.globalAlpha = 1;
      const tilt = clamp(G.sv / STEER, -1, 1) * 0.22;
      if (G.boost > 0) { ctx.fillStyle = 'rgba(255,170,40,.8)'; ctx.beginPath(); ctx.moveTo(W / 2 + G.x - 5, carY + 26); ctx.lineTo(W / 2 + G.x + 5, carY + 26); ctx.lineTo(W / 2 + G.x, carY + 26 + 22 + Math.random() * 10); ctx.closePath(); ctx.fill(); }
      drawCar(ctx, W / 2 + G.x, carY, tilt + G.spinA, 1, '#e8392f', '#a8241c');
      ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.8;
      for (const q of G.sparks) { const kk = q.life / 0.6; ctx.strokeStyle = `rgba(255,${150 + ((kk * 80) | 0)},70,${1 - kk})`; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    };

    const loop = (now) => {
      const G = g.current, dt = Math.min(0.033, (now - G.last) / 1000); G.last = now;
      if (G.phase === 'run') step(G, dt);
      for (let i = G.smoke.length - 1; i >= 0; i--) { const q = G.smoke[i]; q.life += dt; q.y += 90 * dt; if (q.life > 0.6) G.smoke.splice(i, 1); }
      for (let i = G.sparks.length - 1; i >= 0; i--) { const q = G.sparks[i]; q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; if (q.life > 0.6) G.sparks.splice(i, 1); }
      draw(G);
      if (G.msgT > 0) G.msgT -= dt;
      G.hudT += dt;
      if (G.hudT > 0.1) { G.hudT = 0; setHud({ left: Math.max(0, G.left), speed: G.speed, prog: Math.min(1, G.s / L), msg: G.msgT > 0 ? G.msg : '' }); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const key = (down) => (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inp.current = down ? -1 : (inp.current === -1 ? 0 : inp.current);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inp.current = down ? 1 : (inp.current === 1 ? 0 : inp.current);
    };
    const kd = key(true), ku = key(false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener('resize', size);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      timers.current.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const start = () => {
    const G = g.current; if (!G || G.phase !== 'ready') return;
    G.phase = 'lights'; setPhase('lights'); setLights(0);
    for (let i = 1; i <= 5; i++) later(() => setLights(i), 400 + i * 650);
    later(() => { setLights(0); G.phase = 'run'; G.last = performance.now(); G.msg = 'GO!'; G.msgT = 0.9; setPhase('run'); buzz([25, 20, 25]); }, 400 + 5 * 650 + 700 + Math.random() * 900);
  };
  const again = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    track.o.forEach((ob) => { ob.hit = false; });
    g.current = fresh(readSaved()); inp.current = 0;
    setResult(null); setLights(0); setPhase('ready'); setHud({ left: START_LEFT, speed: 0, prog: 0, msg: '' }); setCopied(false);
  };
  const share = async () => {
    const m = result?.medal ? ` (${result.medal[0]})` : '';
    const text = `IKE Time Attack ${dayLabel(day)}: ${fmt(result.time)}${m}. Beat it.`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copy your time:', text); }
  };
  const steer = (e) => { const r = box.current.getBoundingClientRect(); inp.current = e.clientX < r.left + r.width / 2 ? -1 : 1; };
  const low = phase === 'run' && hud.left < 6;

  return (
    <div ref={box} className="ta-wrap">
      <canvas ref={cv} className="ta-canvas" />
      {phase === 'run' && (
        <div className="ta-touch" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); steer(e); }}
          onPointerMove={(e) => { if (e.buttons) steer(e); }} onPointerUp={() => { inp.current = 0; }} onPointerCancel={() => { inp.current = 0; }} />
      )}
      <div className="ta-hud">
        <div><div className={`ta-time ${low ? 'low' : ''}`}>{hud.left.toFixed(1)}</div><div className="ta-sub">time left</div></div>
        <div className="ta-speed"><div className="ta-time" style={{ fontSize: 26 }}>{Math.round(hud.speed * 3.2)}</div><div className="ta-sub">km/h</div></div>
      </div>
      <div className="ta-bar"><i style={{ width: `${hud.prog * 100}%` }} />{GATES.map(([p]) => <b key={p} style={{ left: `${(p / L) * 100}%` }} />)}</div>
      {hud.msg && <div key={hud.msg + phase} className="ta-msg">{hud.msg}</div>}
      <button className="ta-x" onClick={onExit}>EXIT</button>

      {phase === 'lights' && <div className="ta-ov clear"><div className="lights">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={`lamp ${i < lights ? 'on' : ''}`} />)}</div></div>}

      {phase === 'ready' && (
        <div className="ta-ov">
          <div className="ta-sub">today’s track, {dayLabel(day)}</div>
          <div className="gar-title" style={{ fontSize: 40 }}>TIME ATTACK</div>
          <div className="m" style={{ maxWidth: 300 }}>One lap, {L} m. Hold the left or right half of the screen to steer. Checkpoints add {BONUS} seconds. Same track for everyone today.</div>
          <div className="medals">{medals.map(([n, lim, col]) => <span key={n}><i style={{ background: col }} />{n} {fmt(lim)}</span>)}</div>
          {saved?.t && <div className="m">Your best today: <b style={{ color: 'var(--text,#f4efee)' }}>{fmt(saved.t)}</b>. Its ghost races you.</div>}
          <button className="btn" style={{ padding: '14px 34px', fontSize: 16 }} onClick={start}>START</button>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="ta-ov">
          {result.kind === 'finish' ? (<>
            <div className="ta-sub">{result.pb ? 'new personal best' : `best today ${fmt(result.best)}`}</div>
            <div className="gar-title" style={{ fontSize: 52 }}>{fmt(result.time)}</div>
            {result.medal ? <div className="medal" style={{ background: result.medal[2] }}>{result.medal[0]}</div> : <div className="m">No medal. Bronze is {fmt(medals[2]?.[1] || 0)}.</div>}
          </>) : (<>
            <div className="gar-title" style={{ fontSize: 40 }}>OUT OF TIME</div>
            <div className="m">You made it {result.dist} m of {L} m. Hit the checkpoints to add time.</div>
          </>)}
          <div className="two" style={{ width: 'min(100%,320px)' }}>
            <button className="btn grow" onClick={again}>Go again</button>
            {result.kind === 'finish' && <button className="btn ghost grow" onClick={share}>{copied ? 'Copied' : 'Share time'}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
