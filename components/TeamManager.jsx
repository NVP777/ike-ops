'use client';
import { useRef, useState } from 'react';
import { useApp } from '@/lib/store';
import { PERMS, ACCESS_PAGES, initials } from '@/lib/nav';
import { buzz } from '@/lib/haptics';
import Sheet from './Sheet';

// Members without a saved name show a tidy version of their email (e.g. jane.doe -> Jane Doe) until a captain sets one.
const shown = (m) => m.name && !m.name.includes('@') ? m.name : m.email.split('@')[0].split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const letters = (m) => initials(shown(m).replace(/[^A-Za-z ]/g, '').trim() || '?') || '?';
const ROLES = Object.keys(PERMS);
const TITLES = ['Team Manager', 'Team Lead', 'Vice Captain', 'Treasurer', 'Design Lead', 'Electronics Lead', 'Powertrain Lead'];
const FILTERS = ['All', ...ROLES];

export default function TeamManager() {
  const { team, changeRoles, savePages } = useApp();
  const [filter, setFilter] = useState('All');
  const [picked, setPicked] = useState([]);      // emails selected with long press
  const [open, setOpen] = useState(null);        // email of the member whose access is shown
  const [roleSheet, setRoleSheet] = useState(false);
  const timer = useRef(null), longHit = useRef(false);

  const list = team.filter((m) => filter === 'All' || m.role === filter);
  const selecting = picked.length > 0;
  const toggle = (email) => setPicked((p) => (p.includes(email) ? p.filter((x) => x !== email) : [...p, email]));

  const down = (email) => {
    longHit.current = false;
    timer.current = setTimeout(() => { longHit.current = true; buzz(15); toggle(email); }, 450);
  };
  const cancel = () => clearTimeout(timer.current);
  const tap = (email) => {
    if (longHit.current) { longHit.current = false; return; } // the long press already handled it
    if (selecting) toggle(email); else setOpen(email);
  };

  const member = team.find((m) => m.email === open);

  return (
    <>
      <h2>Team<span>{team.length} members</span></h2>
      <div className="glass pad2">
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f} className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <div className="m" style={{ margin: '4px 0 8px' }}>
          {selecting ? `${picked.length} selected. Tap to add or remove people.` : 'Tap a name for page access. Press and hold to select several.'}
        </div>
        {selecting && (
          <div className="two" style={{ marginBottom: 8 }}>
            <button className="btn grow" onClick={() => setRoleSheet(true)}>Change role</button>
            <button className="btn ghost" onClick={() => setPicked(list.map((m) => m.email))}>All shown</button>
            <button className="btn ghost" onClick={() => setPicked([])}>Cancel</button>
          </div>
        )}
        {list.length === 0 && <div className="m">No one here.</div>}
        {list.map((m) => {
          const on = picked.includes(m.email);
          return (
            <div key={m.email} className={`row click${on ? ' picked' : ''}`} style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
              onPointerDown={() => down(m.email)} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
              onContextMenu={(e) => e.preventDefault()} onClick={() => tap(m.email)}>
              {selecting
                ? <input type="checkbox" readOnly checked={on} style={{ width: 20, height: 20, accentColor: 'var(--red)', flex: 'none' }} />
                : <div className="avatar sm">{letters(m)}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shown(m)}</div>
                <div className="m">{m.title ? `${m.title} · ` : ''}{m.role}{m.year ? ` · ${m.year}` : ''}</div>
              </div>
              {(m.grants.length > 0 || m.blocks.length > 0) && <span className="tag b">Custom</span>}
            </div>
          );
        })}
      </div>

      {roleSheet && (
        <Sheet onClose={() => setRoleSheet(false)}>
          <h2 style={{ marginTop: 0 }}>Change role</h2>
          <div className="m" style={{ marginBottom: 12 }}>For {picked.length} selected member{picked.length > 1 ? 's' : ''}.</div>
          {ROLES.map((r) => (
            <button key={r} className="btn ghost full" style={{ marginTop: 8 }}
              onClick={async () => { if (await changeRoles(picked, r)) { setPicked([]); setRoleSheet(false); } }}>{r}</button>
          ))}
        </Sheet>
      )}

      {member && <Access key={member.email} m={member} onClose={() => setOpen(null)} savePages={savePages} />}
    </>
  );
}

// Which pages one person can open. Role gives a starting set; the captain can add or remove pages on top.
function Access({ m, onClose, savePages }) {
  const roleHas = (p) => PERMS[m.role].includes(p);
  const [grants, setGrants] = useState(m.grants);
  const [blocks, setBlocks] = useState(m.blocks);
  const [title, setTitle] = useState(m.title);
  const [name, setName] = useState(m.name && !m.name.includes('@') ? m.name : '');
  const allowed = (p) => (roleHas(p) ? !blocks.includes(p) : grants.includes(p));
  const flip = (p) => {
    if (roleHas(p)) setBlocks((b) => (b.includes(p) ? b.filter((x) => x !== p) : [...b, p]));
    else setGrants((g) => (g.includes(p) ? g.filter((x) => x !== p) : [...g, p]));
  };
  const dirty = title.trim() !== m.title || name.trim() !== (m.name && !m.name.includes('@') ? m.name : '') || JSON.stringify([...grants].sort()) !== JSON.stringify([...m.grants].sort()) || JSON.stringify([...blocks].sort()) !== JSON.stringify([...m.blocks].sort());
  return (
    <Sheet onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>{shown(m)}</h2>
      <div className="m">{m.role}{m.year ? ` · ${m.year}` : ''} · {m.email}</div>
      <label htmlFor="nm" style={{ marginTop: 14 }}>Name</label>
      <input id="nm" value={name} maxLength={60} placeholder="Full name" onChange={(e) => setName(e.target.value)} />
      <label htmlFor="ttl" style={{ marginTop: 14 }}>Title (shown on their profile)</label>
      <input id="ttl" list="ttls" value={title} maxLength={40} placeholder="e.g. Team Manager" onChange={(e) => setTitle(e.target.value)} />
      <datalist id="ttls">{TITLES.map((x) => <option key={x} value={x} />)}</datalist>
      <div className="m" style={{ margin: '14px 0 4px' }}>Home and Documents are open to everyone.</div>
      {ACCESS_PAGES.map((p) => (
        <label key={p.perm} className="chk" style={{ justifyContent: 'space-between' }}>
          <span>{p.label}<span className="m"> {roleHas(p.perm) ? (blocks.includes(p.perm) ? '· removed' : '· from role') : (grants.includes(p.perm) ? '· added' : '')}</span></span>
          <input type="checkbox" checked={allowed(p.perm)} onChange={() => flip(p.perm)} />
        </label>
      ))}
      <button className="btn full" style={{ marginTop: 22 }} disabled={!dirty} onClick={async () => { if (await savePages(m.email, grants, blocks, title, name)) onClose(); }}>Save access</button>
      <button className="btn ghost full" style={{ marginTop: 10 }} onClick={onClose}>Close</button>
    </Sheet>
  );
}
