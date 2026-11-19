'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sheet from './Sheet';
import { useApp } from '@/lib/store';
import { PAGES } from '@/lib/nav';

// One announcement: text, plus (captain only) "Who got it" and Delete. Used in the sheet and on the home panel.
export function NotifItem({ n, onGone, timeStyle }) {
  const { realRole, team, deleteNotif, loadDelivery } = useApp();
  const [open, setOpen] = useState(false);
  const [det, setDet] = useState(undefined); // undefined = not loaded, null = none recorded, else rows
  const isCaptain = realRole === 'ExComm';
  const nameOf = (email) => { const m = (team || []).find((x) => x.email === email); return m && m.name && !m.name.includes('@') ? m.name : email; };
  const group = (rows, s) => rows.filter((r) => r.status === s).map((r) => nameOf(r.email)).sort();
  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (det === undefined) { const rows = await loadDelivery(n.id); setDet(rows && rows.length ? rows : null); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete "${n.t}" for everyone?`)) return;
    if (await deleteNotif(n.id)) onGone?.(n.id);
  };
  return (
    <div className="nitem">
      <div className="row">
        <div className="grow"><div className="t">{!n.read && <span className="dot">● </span>}{n.t}</div><div className="m">{n.b}</div></div>
        <div className="m" style={timeStyle}>{n.w}</div>
      </div>
      {isCaptain && (
        <div className="two" style={{ margin: '2px 0 10px' }}>
          <button className="btn ghost" onClick={toggle}>{open ? 'Hide' : 'Who got it'}{n.audience ? ` · ${n.audience}` : ''}</button>
          <button className="btn ghost" onClick={remove}>Delete</button>
        </div>
      )}
      {isCaptain && open && (
        <div className="glass pad2" style={{ marginBottom: 10 }}>
          {det === undefined ? <div className="m">Loading…</div> : det === null ? <div className="m">No delivery record for this announcement (sent before tracking was added).</div> : (
            <>
              <div className="m"><b>Sent to ({group(det, 'delivered').length})</b></div>
              <div className="m" style={{ marginBottom: 8 }}>{group(det, 'delivered').join(', ') || 'No one'}</div>
              <div className="m"><b>Not sent: notifications off ({group(det, 'not_enabled').length})</b></div>
              <div className="m" style={{ marginBottom: 8 }}>{group(det, 'not_enabled').join(', ') || 'No one'}</div>
              <div className="m"><b>Not sent: delivery failed ({group(det, 'failed').length})</b></div>
              <div className="m">{group(det, 'failed').join(', ') || 'No one'}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function NotifSheet() {
  const { notifs, has, markRead, setSheet } = useApp();
  const [list] = useState(() => notifs.filter((n) => !n.need || has(n.need)));
  const [gone, setGone] = useState([]);       // ids deleted while this sheet is open
  useEffect(() => { markRead(); }, []); // eslint-disable-line
  const shownList = list.filter((n) => !gone.includes(n.id));
  return (
    <Sheet onClose={() => setSheet(null)}>
      <h1 className="sh">Notifications</h1>
      {shownList.length ? shownList.map((n) => <NotifItem key={n.id} n={n} onGone={(id) => setGone((g) => [...g, id])} />) : <div className="empty">Announcements will show up here once someone sends one.</div>}
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
