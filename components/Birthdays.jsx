'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { useApp } from '@/lib/store';

export const firstName = (name, email) => {
  const s = (name && !name.includes('@') ? name : (email || '').split('@')[0]).trim().split(/\s+/)[0];
  return s ? s[0].toUpperCase() + s.slice(1) : 'Someone';
};

const istDay = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

// Whose birthday is today, plus the wishes so far. Quietly empty until the birthdays SQL has been run.
export function useBirthdays() {
  const [data, setData] = useState({ people: [], wishes: [] });
  const load = useCallback(async () => {
    // Both calls at once (the wishes call returns nothing when nobody has a birthday), so the card shows after one round trip.
    const [p, w] = await Promise.all([supabase.rpc('birthdays_today'), supabase.rpc('birthday_wishes_today')]);
    if (p.error) return;
    const d = { people: p.data || [], wishes: !p.data?.length || w.error ? [] : w.data || [] };
    setData(d);
    try { localStorage.setItem('ike-bday-cache', JSON.stringify({ day: istDay(), ...d })); } catch {}
  }, []);
  useEffect(() => {
    // Show today's last known card straight away while the fresh data loads.
    try { const c = JSON.parse(localStorage.getItem('ike-bday-cache') || 'null'); if (c && c.day === istDay() && c.people?.length) setData({ people: c.people, wishes: c.wishes || [] }); } catch {}
    load();
    const f = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [load]);
  return { ...data, reload: load };
}

function Confetti({ onDone }) {
  const cv = useRef(null);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onDone?.(); return; }
    const c = cv.current, x = c.getContext('2d');
    const w = (c.width = window.innerWidth), h = (c.height = window.innerHeight);
    const cols = ['#e8392f', '#ffb703', '#ffffff', '#4cc9f0', '#80ed99'];
    const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * w, y: -20 - Math.random() * h * 0.5, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, s: 6 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: cols[Math.floor(Math.random() * cols.length)] }));
    const t0 = performance.now(); let raf;
    const tick = (t) => {
      x.clearRect(0, 0, w, h); let alive = 0;
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += 0.02; if (p.y < h + 20) alive++;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore();
      }
      if (alive && t - t0 < 6000) raf = requestAnimationFrame(tick); else onDone?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line
  return <canvas ref={cv} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' }} />;
}

function Card({ p, wishes, reload }) {
  const { user } = useAuth();
  const { say } = useApp();
  const mine = p.email === user.email;
  const nm = firstName(p.name, p.email);
  const all = wishes.filter((w) => w.birthday_email === p.email);
  const lines = all.filter((w) => w.message);
  const wished = all.some((w) => w.from_email === user.email);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [boom, setBoom] = useState(() => { if (!mine) return false; try { return localStorage.getItem('ike-bday-confetti') !== new Date().toDateString(); } catch { return true; } });
  useEffect(() => { if (boom) { try { localStorage.setItem('ike-bday-confetti', new Date().toDateString()); } catch {} } }, [boom]);

  const run = async (fn, ok) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { say('Could not do that. Try again.'); return false; }
    if (ok) say(ok);
    await reload(); return true;
  };
  const toggle = () => run(() => wished ? supabase.rpc('unwish_birthday', { p_email: p.email }) : supabase.rpc('wish_birthday', { p_email: p.email, p_message: null }), wished ? '' : `Wished ${nm} 🎉`);
  const send = async () => { const t = text.trim(); if (!t) return; if (await run(() => supabase.rpc('wish_birthday', { p_email: p.email, p_message: t }), 'Added to the card')) setText(''); };
  const who = all.map((w) => firstName(w.from_name, w.from_email));

  return (
    <div className="glass pad2" style={{ marginBottom: 12 }}>
      {boom && <Confetti onDone={() => setBoom(false)} />}
      <div className="t" style={{ fontSize: 18 }}>{mine ? `🎂 Happy birthday, ${nm}!` : `🎂 It's ${nm}'s birthday today`}</div>
      <div className="m" style={{ margin: '4px 0 10px' }}>{mine ? 'The whole team is cheering for you.' : 'Send a wish and leave a note on their card.'}</div>
      {all.length > 0 && <div className="m" style={{ marginBottom: 10 }}><b>{all.length} wish{all.length === 1 ? '' : 'es'}</b>{mine || all.length <= 8 ? `: ${who.join(', ')}` : ''}</div>}
      {lines.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {lines.map((w) => <div key={w.from_email} className="m" style={{ padding: '3px 0' }}><b>{firstName(w.from_name, w.from_email)}:</b> {w.message}</div>)}
        </div>
      )}
      {!mine && (
        <>
          <button className={`btn full${wished ? ' ghost' : ''}`} disabled={busy} onClick={toggle}>{wished ? 'Wished 🎉 (tap to undo)' : `Wish ${nm} 🎉`}</button>
          <div className="two" style={{ marginTop: 10 }}>
            <input className="grow" aria-label={`Add a line for ${nm}`} placeholder={`Add a line to ${nm}'s card`} maxLength={200} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button className="btn" disabled={busy || !text.trim()} onClick={send}>Add</button>
          </div>
        </>
      )}
    </div>
  );
}

export function BirthdayBanner({ people, wishes, reload }) {
  if (!people.length) return null;
  return <>{people.map((p) => <Card key={p.email} p={p} wishes={wishes} reload={reload} />)}</>;
}
