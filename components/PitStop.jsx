'use client';
import { useEffect, useRef, useState } from 'react';
import Leaderboard from './Leaderboard';
import { submitScore } from '@/lib/scores';

// PIT STOP. Five red lights come on, then go out. React, then loosen the four wheel nuts in order, 1 to 4.
// Moving before the lights go out is a false start. Wrong nut: +0.5 s.
const SLOTS = [[30, 30], [70, 30], [70, 70], [30, 70]];
const rate = (ms) => (ms <= 190 ? 'Superhuman' : ms <= 230 ? 'Pro' : ms <= 280 ? 'Club racer' : ms <= 350 ? 'Weekend driver' : 'Still waking up');
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; } return b; };
const read = () => { try { return JSON.parse(localStorage.getItem('ike-pit-best')) || {}; } catch { return {}; } };
const sec = (ms) => (ms / 1000).toFixed(2);
const mkNuts = () => shuffle(SLOTS).map(([x, y], i) => ({ n: i + 1, x, y, done: false }));

export default function PitStop({ onExit }) {
  const [ph, setPh] = useState('idle'); // idle | lights | wait | go | done | jump
  const [lights, setLights] = useState(0);
  const [nuts, setNuts] = useState(mkNuts);
  const [bad, setBad] = useState(0);
  const [res, setRes] = useState(null);
  const [best, setBest] = useState(read);
  const [board, setBoard] = useState(0);
  const t0 = useRef(0), tFirst = useRef(0), pen = useRef(0), next = useRef(1), timers = useRef([]);
  const buzz = (p) => { try { navigator.vibrate?.(p); } catch {} };
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);

  const start = () => {
    clear();
    setNuts(mkNuts()); next.current = 1; pen.current = 0; setRes(null); setBad(0);
    setPh('lights'); setLights(0);
    for (let i = 1; i <= 5; i++) later(() => setLights(i), 500 + i * 600);
    later(() => setPh('wait'), 500 + 5 * 600);
    later(() => { setLights(0); setPh('go'); t0.current = performance.now(); buzz(25); }, 500 + 5 * 600 + 800 + Math.random() * 1700);
  };
  const arenaDown = () => { if (ph === 'lights' || ph === 'wait') { clear(); setPh('jump'); buzz([60, 40, 60]); } };
  const tap = (n, e) => {
    e.stopPropagation();
    if (ph !== 'go') return;
    if (n !== next.current) { pen.current += 500; setBad((b) => b + 1); buzz(60); return; }
    const now = performance.now();
    if (n === 1) tFirst.current = now;
    setNuts((a) => a.map((x) => (x.n === n ? { ...x, done: true } : x)));
    next.current += 1;
    if (n === 4) {
      const r = { react: Math.round(tFirst.current - t0.current), pit: Math.round(now - t0.current + pen.current) };
      const b = read(), nb = { react: Math.min(b.react ?? 1e9, r.react), pit: Math.min(b.pit ?? 1e9, r.pit) };
      try { localStorage.setItem('ike-pit-best', JSON.stringify(nb)); } catch {}
      submitScore('pit', r.pit).then(() => setBoard((x) => x + 1));
      setBest(nb); setRes(r); setPh('done'); buzz([30, 40, 30, 40, 100]);
    }
  };

  const hint = { idle: 'When the lights go out, tap nuts 1 to 4 in order. As fast as you can.', lights: 'Wait for it…', wait: 'Wait for it…', go: 'GO!', jump: 'FALSE START. You moved before the lights went out.', done: '' }[ph];
  return (
    <div className="pit">
      <div className="gar-title" style={{ fontSize: 40 }}>PIT STOP</div>
      <div className="pit-arena" onPointerDown={arenaDown}>
        <div className="lights">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={`lamp ${i < lights ? 'on' : ''}`} />)}</div>
        <div className="m" style={{ minHeight: 40, textAlign: 'center', maxWidth: 320, color: ph === 'go' ? 'var(--ok)' : undefined, fontSize: ph === 'go' ? 22 : undefined }}>{hint}</div>
        <div className="pit-wheel">
          <div className="pit-hub" />
          {nuts.map((n) => (
            <div key={n.n} className={`nut ${ph === 'go' || ph === 'done' ? 'live' : ''} ${n.done ? 'done' : ''}`} style={{ left: `${n.x}%`, top: `${n.y}%` }} onPointerDown={(e) => tap(n.n, e)} role="button" aria-label={`Nut ${n.n}`}>{n.n}</div>
          ))}
        </div>
        {bad > 0 && ph === 'go' && <div className="m redt">Wrong nut. +0.5 s ({bad})</div>}
      </div>

      {ph === 'done' && res && (
        <div className="pit-res">
          <div className="pit-row"><span>Reaction</span><b>{sec(res.react)} s</b></div>
          <div className="pit-row"><span>Pit stop{bad ? ` (with ${bad} penalt${bad > 1 ? 'ies' : 'y'})` : ''}</span><b>{sec(res.pit)} s</b></div>
          <div className="m" style={{ marginTop: 6 }}>{rate(res.react)}. Your bests: {best.react ? `${sec(best.react)} s reaction, ${sec(best.pit)} s stop` : 'none yet'}.</div>
        </div>
      )}
      {(ph === 'idle' || ph === 'done') && <Leaderboard game="pit" fmt={(ms) => `${sec(ms)} s`} refresh={board} />}
      <div className="two" style={{ width: 'min(100%,340px)', marginTop: 'auto' }}>
        {(ph === 'idle' || ph === 'done' || ph === 'jump') && <button className="btn grow" onClick={start}>{ph === 'idle' ? 'START' : 'Go again'}</button>}
        <button className="btn ghost grow" onClick={onExit}>Garage</button>
      </div>
    </div>
  );
}
