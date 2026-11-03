'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/store';
import { useAuth } from './AuthProvider';
import { PERMS, initials } from '@/lib/nav';

// Not sticky: lives inside the scrolling <main>, so it scrolls away.
export default function Header() {
  const { role, setRole, realRole, unread, setSheet, openGarage, openLicence } = useApp();
  const { user, signOut, startIgnite } = useAuth();
  // Easter egg: tap the IKE logo three times quickly and the car goes past again.
  const taps = useRef({ n: 0, t: 0 });
  const holdT = useRef(null), held = useRef(false), lastAv = useRef(0);
  const [rev, setRev] = useState(false);
  // Hold the logo for 2 seconds: the Garage (racing games).
  const holdStart = () => {
    held.current = false; setRev(true); clearTimeout(holdT.current);
    holdT.current = setTimeout(() => { held.current = true; setRev(false); try { navigator.vibrate?.([40, 30, 40, 30, 120]); } catch {} openGarage(); }, 2000);
  };
  const holdEnd = () => { clearTimeout(holdT.current); setRev(false); };
  const tapLogo = () => {
    if (held.current) { held.current = false; return; } // the tap that ends a hold is not a tap
    const now = Date.now();
    taps.current = now - taps.current.t < 600 ? { n: taps.current.n + 1, t: now } : { n: 1, t: now };
    if (taps.current.n >= 3) { taps.current = { n: 0, t: 0 }; startIgnite(); }
  };
  const [open, setOpen] = useState(false);
  const box = useRef();
  useEffect(() => {
    const f = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', f); return () => document.removeEventListener('click', f);
  }, []);
  return (
    <header>
      <div className={`logo${rev ? ' rev' : ''}`} onClick={tapLogo} onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd} onContextMenu={(e) => e.preventDefault()} style={{ cursor: 'pointer', userSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>IKE</div>
      <div className="hr">
        <button className="bell" aria-label="Notifications" onClick={() => setSheet('notifs')}>🔔{unread > 0 && <i>{unread}</i>}</button>
        <div className="pwrap" ref={box}>
          <button className="avatar" aria-label="Profile" onClick={() => {
            const now = Date.now(); // double-tap: your Super Licence
            if (now - lastAv.current < 350) { lastAv.current = 0; setOpen(false); openLicence(); } else { lastAv.current = now; setOpen((o) => !o); }
          }}>{initials(user.name) || '?'}</button>
          {open && (
            <div className="pbox glass">
              <div className="t">{user.name}</div>
              <div className="m">{realRole}{role !== realRole ? `, viewing as ${role}` : ''}</div>
              <div className="m" style={{ wordBreak: 'break-all' }}>{user.email}</div>
              {realRole === 'Captain' && (<>
                <div className="m" style={{ marginTop: 14 }}>View the app as</div>
                <div className="who">{Object.keys(PERMS).map((r) => (
                  <button key={r} className="btn ghost" style={r === role ? { borderColor: 'var(--red)' } : {}} onClick={() => setRole(r)}>{r}</button>
                ))}</div>
              </>)}
              <Link href="/profile" className="btn full" style={{ marginTop: 14 }} onClick={() => setOpen(false)}>View profile</Link>
              <button className="btn ghost full" style={{ marginTop: 8 }} onClick={signOut}>Log off</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
