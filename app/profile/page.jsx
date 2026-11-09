'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/store';
import { initials } from '@/lib/nav';
import { ACCOUNTS, TAGS } from '@/lib/data';
import { useAuth } from '@/components/AuthProvider';
import Party from '@/components/Party';
import AlertColor from '@/components/AlertColor';
import TeamManager from '@/components/TeamManager';

export default function Profile() {
  const { role, realRole, myTitle, has, opening, saveOpening, alertHue, setAlertHue, previewAlert, openLicence } = useApp();
  const lastTap = useRef(0);
  const tapCard = () => { const now = Date.now(); if (now - lastTap.current < 350) { lastTap.current = 0; openLicence(); } else lastTap.current = now; };
  const { user } = useAuth();
  const [party, setParty] = useState(null);
  useEffect(() => { const f = () => setParty(null); window.addEventListener('ike-party-close', f); return () => window.removeEventListener('ike-party-close', f); }, []);
  const [vals, setVals] = useState(() => ({ ...opening }));
  useEffect(() => { setVals({ ...opening }); }, [opening]); // opening balances arrive from the database after the page opens
  return (
    <>
      <h1>Profile</h1>
      <div className="glass idcard" onClick={tapCard} style={{ touchAction: 'manipulation', cursor: 'pointer' }}>
        <div className="avatar big">{initials(user.name)}</div>
        <div className="num" style={{ fontSize: 28 }}>{user.name}</div><div className="m">{myTitle ? `${myTitle} · ` : ''}{role}</div><div className="m">{user.email}</div>
      </div>
      {has('admin') && (<>
        <h2>Settings<span>Captain only</span></h2>
        <div className="glass pad2">
          <label htmlFor="fy">Financial year</label><input id="fy" defaultValue="2025-26" />
          {ACCOUNTS.map((a) => (
            <div key={a.id}>
              <label htmlFor={`o-${a.id}`}>Opening balance, {a.label} (₹)</label>
              <input id={`o-${a.id}`} type="number" inputMode="numeric" value={vals[a.id]} onChange={(e) => setVals((v) => ({ ...v, [a.id]: e.target.value }))} />
            </div>
          ))}
          <button className="btn full" style={{ marginTop: 18 }} onClick={() => saveOpening(vals)}>Save changes</button>
        </div>
        <h2>Tags</h2>
        <div className="m">Every transaction is tagged with one of: {TAGS.join(', ')}.</div>
        {realRole === 'Captain' && <TeamManager />}
      </>)}
      <h2>Background color<span>Just for you</span></h2>
      <div className="glass pad2">
        <div className="m" style={{ marginBottom: 12 }}>Pick the color of your app background. It is saved to your account and follows you to any device. Drag the ring or pick a preset.</div>
        <AlertColor hue={alertHue} onChange={setAlertHue} />
        <div className="two" style={{ marginTop: 16 }}>
          <button className="btn ghost grow" onClick={previewAlert}>Preview</button>
          <button className="btn ghost grow" onClick={() => setAlertHue(38)}>Reset to amber</button>
        </div>
      </div>
      <button className="made" onClick={() => setParty({ k: Date.now() })}>
        Made with <span className="heart">❤️</span> by Naman Panpalia <span className="m"></span>
      </button>
      {party && <Party key={party.k} />}
    </>
  );
}
