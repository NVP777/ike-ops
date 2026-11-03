'use client';
import { useEffect, useState } from 'react';
import { PERMS, initials } from '@/lib/nav';

// Double-tap your profile: your IKE Super Licence. Move over it to tilt it, tap it to flip it.
const LABEL = { finance: 'Finance', sponsors: 'Sponsors', boiler: 'Boiler room', inventory: 'Inventory', tasks: 'Subsystems', announce: 'Announcements', admin: 'Admin' };
const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

export default function Licence({ user, role, onClose }) {
  const [flip, setFlip] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [photo, setPhoto] = useState(!!user.avatar);
  const h = hash(user.id || user.email);
  const num = String((h % 98) + 1).padStart(2, '0');
  const no = `IKE-26-${String(h % 10000).padStart(4, '0')}`;
  const name = (user.name || user.email || '').toUpperCase();
  useEffect(() => {
    try { navigator.vibrate?.([20, 30, 40]); } catch {}
    const f = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -14, y: ((e.clientX - r.left) / r.width - 0.5) * 14 });
  };
  return (
    <div className="lic-wrap" onClick={onClose}>
      <div className="lic-scene" onClick={(e) => { e.stopPropagation(); setFlip((f) => !f); }} onPointerMove={move} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
        <div className="lic" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y + (flip ? 180 : 0)}deg)` }}>
          <div className="lic-face lic-front">
            <div className="lic-top">
              <div><div className="lic-logo">IKE</div><div className="lic-small">Super licence</div></div>
              <div className="lic-chip" />
            </div>
            <div className="lic-mid">
              <div className="lic-photo">
                {photo ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" onError={() => setPhoto(false)} /> : <span>{initials(user.name) || '?'}</span>}
              </div>
              <div className="lic-who">
                <div className="lic-name">{name}</div>
                <div className="lic-small">{role}</div>
              </div>
              <div className="lic-num">#{num}</div>
            </div>
            <div className="lic-bot">
              <div><div className="lic-small">Licence no.</div><div className="lic-val">{no}</div></div>
              <div><div className="lic-small">Valid</div><div className="lic-val">2026 season</div></div>
              <div className="lic-holo" />
            </div>
          </div>
          <div className="lic-face lic-back">
            <div className="lic-stripe" />
            <div className="lic-small" style={{ marginTop: 14 }}>Cleared for</div>
            <div className="lic-clear">{PERMS[role].map((p) => LABEL[p] || p).join('  ·  ')}</div>
            <div className="lic-sign"><span>{user.name}</span></div>
            <div className="lic-bar" />
            <div className="lic-small" style={{ textAlign: 'center' }}>Inspired Karters, BITS Pilani</div>
          </div>
        </div>
      </div>
      <div className="lic-hint">TAP THE CARD TO FLIP · TAP OUTSIDE TO CLOSE</div>
    </div>
  );
}
