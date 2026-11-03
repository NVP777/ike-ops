'use client';
import { useEffect, useState } from 'react';
import Sheet from '@/components/Sheet';
import CarLoader from '@/components/CarLoader';
import { useApp } from '@/lib/store';

const PAGE = 40;
const link = (u) => { const t = (u || '').trim(); if (!t) return ''; return /^https?:\/\//i.test(t) ? t : `https://${t}`; };
const KINDS = { all: 'All', company: 'Companies', alum: 'Alumni' };
const HAS = {
  phone: (r) => !!r.contact,
  poc: (r) => !!r.poc,
  email: (r) => !!r.email,
};

export default function Sponsors() {
  const { say } = useApp();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [at, setAt] = useState(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [need, setNeed] = useState({ phone: 'any', email: 'any', poc: 'any' }); // any, yes (has it) or no (missing it)
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState(null);

  // Reads the Sheet now, then again every 30 seconds, so changes made in the Sheet appear here.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/sponsors', { cache: 'no-store' })
        .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
        .then(({ ok, j }) => {
          if (!alive) return;
          if (!ok) throw new Error(j.error || 'Could not load the sponsor sheet.');
          setRows(j.rows); setAt(new Date()); setErr('');
        })
        .catch((e) => { if (alive) setErr(e.message || 'Could not load the sponsor sheet.'); });
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); say(`${label} copied`); }
    catch { say('Could not copy. Select the text and copy it.'); }
  };

  const all = rows || [];
  // The Sheet has a "Type" column (Company or Alum). If it's missing or empty, the filter stays hidden.
  const hasType = all.some((r) => r.type);
  const byKind = kind === 'all' ? all : all.filter((r) => (r.type || '').toLowerCase().startsWith(kind));
  // Each dropdown set to Yes or No must match for a sponsor to show. Names stay A to Z.
  const ticked = Object.keys(need).filter((k) => need[k] !== 'any');
  const sortedKind = byKind
    .filter((r) => ticked.every((k) => HAS[k](r) === (need[k] === 'yes')))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const needle = q.trim().toLowerCase();
  const list = needle
    ? sortedKind.filter((r) => [r.name, r.poc, r.contact, r.email, r.update].some((v) => (v || '').toLowerCase().includes(needle)))
    : sortedKind;
  const shown = list.slice(0, limit);
  const sel = all.find((r) => r.id === openId);

  return (
    <>
      <h1>Sponsors</h1>
      <div className="m" style={{ marginTop: 4 }}>
        {at ? `Synced ${at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}, refreshes every 30 seconds` : 'Connecting to the sheet…'}
      </div>

      {err && <div className="alert r" style={{ marginTop: 12 }}>{err}</div>}

      <div className="stats">
        <div className="stat"><div className="m">Sponsors in the sheet</div><div className="num">{all.length}</div></div>
        <div className="stat"><div className="m">With an email</div><div className="num">{all.filter((r) => r.email).length}</div></div>
        <div className="stat"><div className="m">With a phone number</div><div className="num">{all.filter((r) => r.contact).length}</div></div>
      </div>

      <h2>Sponsors</h2>
      {hasType && (
        <div className="glass seg" style={{ marginBottom: 12 }}>
          {Object.entries(KINDS).map(([k, v]) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setLimit(PAGE); }}>
              {v} ({k === 'all' ? all.length : all.filter((r) => (r.type || '').toLowerCase().startsWith(k)).length})
            </button>
          ))}
        </div>
      )}
      <div className="srow">
        <input aria-label="Search sponsors" placeholder="Search name, POC, email, phone, update" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
        {[['phone', 'Phone'], ['email', 'Email'], ['poc', 'POC']].map(([k, label]) => {
          const yes = all.filter(HAS[k]).length;
          return (
            <div key={k}>
              <label htmlFor={`need-${k}`}>{label}</label>
              <select id={`need-${k}`} value={need[k]} onChange={(e) => { setNeed((n) => ({ ...n, [k]: e.target.value })); setLimit(PAGE); }}>
                <option value="any">Any</option>
                <option value="yes">Yes ({yes})</option>
                <option value="no">No ({all.length - yes})</option>
              </select>
            </div>
          );
        })}
      </div>
      {ticked.length > 0 && <button className="lnk" style={{ marginTop: 8 }} onClick={() => { setNeed({ phone: 'any', email: 'any', poc: 'any' }); setLimit(PAGE); }}>Clear filters</button>}
      <div className="cnt">
        <span className="m">{rows === null ? 'Loading…' : list.length === all.length ? `${all.length} sponsors` : `${list.length} of ${all.length} shown`}</span>
      </div>

      <div className="glass pad">
        {rows === null && !err && <CarLoader label="Reading the sheet" />}
        {rows && list.length === 0 && <div className="empty">No sponsors match.</div>}
        {shown.map((r) => (
          <div className="row click" key={r.id} role="button" tabIndex={0} onClick={() => setOpenId(r.id)} onKeyDown={(e) => e.key === 'Enter' && setOpenId(r.id)}>
            <div className="grow">
              <div className="t">{r.name}</div>
              <div className="m">{r.poc || 'No point of contact'}{hasType && r.type ? `, ${r.type}` : ''}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {[['phone', 'Phone'], ['poc', 'POC'], ['email', 'Email']].map(([k, label]) => (
                  <span key={k} className={`tag ${HAS[k](r) ? 'ok' : 'b'}`}>{HAS[k](r) ? '✓' : '✗'} {label}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {list.length > shown.length && (
        <button className="btn ghost full" style={{ marginTop: 12 }} onClick={() => setLimit((l) => l + PAGE)}>
          Show {Math.min(PAGE, list.length - shown.length)} more
        </button>
      )}

      {sel && (
        <Sheet onClose={() => setOpenId(null)}>
          <h1 className="sh">{sel.name}</h1>
          {hasType && sel.type && <div className="m" style={{ marginTop: 4 }}>{sel.type}</div>}

          <div className="m" style={{ margin: '14px 0 2px' }}>Point of contact</div>
          <div>{sel.poc || <span className="m">Not given</span>}</div>

          <div className="m" style={{ margin: '14px 0 2px' }}>Phone</div>
          {sel.contact ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <a className="lnk" href={`tel:${sel.contact.replace(/\s+/g, '')}`}>{sel.contact}</a>
              <button className="lnk" onClick={() => copy(sel.contact, 'Phone number')}>Copy</button>
            </div>
          ) : <span className="m">Not given</span>}

          <div className="m" style={{ margin: '14px 0 2px' }}>Email</div>
          {sel.email ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <a className="lnk" href={`mailto:${sel.email}`} style={{ wordBreak: 'break-all' }}>{sel.email}</a>
              <button className="lnk" onClick={() => copy(sel.email, 'Email')}>Copy</button>
            </div>
          ) : <span className="m">Not given</span>}

          <div className="m" style={{ margin: '14px 0 2px' }}>LinkedIn</div>
          {sel.linkedin ? <a className="lnk" href={link(sel.linkedin)} target="_blank" rel="noreferrer">Open profile</a> : <span className="m">Not given</span>}

          <div className="m" style={{ margin: '14px 0 2px' }}>Update so far</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{sel.update || <span className="m">No update yet.</span>}</div>

          <button className="btn full" style={{ marginTop: 20 }} onClick={() => setOpenId(null)}>Close</button>
        </Sheet>
      )}
    </>
  );
}
