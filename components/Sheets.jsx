'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sheet from './Sheet';
import { useApp } from '@/lib/store';
import { PAGES } from '@/lib/nav';

export function NotifSheet() {
  const { notifs, has, markRead, setSheet } = useApp();
  const [list] = useState(() => notifs.filter((n) => !n.need || has(n.need)));
  useEffect(() => { markRead(); }, []); // eslint-disable-line
  return (
    <Sheet onClose={() => setSheet(null)}>
      <h1 className="sh">Notifications</h1>
      {list.length ? list.map((n) => (
        <div className="row" key={n.id}>
          <div className="grow"><div className="t">{!n.read && <span className="dot">● </span>}{n.t}</div><div className="m">{n.b}</div></div>
          <div className="m">{n.w}</div>
        </div>
      )) : <div className="empty">Announcements will show up here once someone sends one.</div>}
      {has('announce') && <p style={{ marginTop: 16 }}><button className="btn" onClick={() => setSheet('announce')}>Send announcement</button></p>}
    </Sheet>
  );
}

// Double-tap the dock: all pages as big tiles. Tap to open, drag to reorder.
export function PagesSheet() {
  const { navItems, order, saveOrder, setSheet } = useApp();
  const router = useRouter(); const path = usePathname();
  const [ids, setIds] = useState(() => navItems().map((p) => p.id));
  const [lift, setLift] = useState(null);
  const drag = useRef(null);
  const down = (e, id) => { drag.current = { id, x: e.clientX, y: e.clientY, moved: false }; };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    if (!d.moved) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return; d.moved = true; setLift(d.id); }
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-id]');
    if (t && t.dataset.id !== d.id) setIds((a) => {
      const from = a.indexOf(d.id), to = a.indexOf(t.dataset.id), b = a.filter((x) => x !== d.id);
      b.splice(from < to ? b.indexOf(t.dataset.id) + 1 : b.indexOf(t.dataset.id), 0, d.id); return b;
    });
  };
  const up = () => {
    const d = drag.current; drag.current = null; setLift(null); if (!d) return;
    if (d.moved) saveOrder([...ids, ...order.filter((i) => !ids.includes(i))]);
    else { setSheet(null); router.push(PAGES.find((p) => p.id === d.id).href); }
  };
  return (
    <Sheet onClose={() => setSheet(null)}>
      <h1 className="sh">All pages</h1><div className="m">Tap to open. Drag a page to move it.</div>
      <div className="grid" onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setLift(null); }}>
        {ids.map((id) => { const p = PAGES.find((x) => x.id === id); return (
          <div key={id} data-id={id} onPointerDown={(e) => down(e, id)} className={`tile${p.href === path ? ' on' : ''}${lift === id ? ' lift' : ''}`}><b>{p.icon}</b>{p.label}</div>
        ); })}
      </div>
      <button className="btn full" style={{ marginTop: 18 }} onClick={() => setSheet(null)}>Done</button>
    </Sheet>
  );
}
