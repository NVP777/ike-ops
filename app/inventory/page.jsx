'use client';
import { useState } from 'react';
import Sheet from '@/components/Sheet';
import { useApp } from '@/lib/store';
import { inr, fmtDate, fmtStamp, daysSince, todayISO, TAGS } from '@/lib/data';

function Money({ v }) {
  const neg = v < 0;
  return (
    <span>
      {neg && '−'}<span className="rs">₹</span>{Math.abs(v).toLocaleString('en-IN')}
    </span>
  );
}

const SORT_S = { az: 'Name A to Z', za: 'Name Z to A', low: 'Quantity, lowest first', high: 'Quantity, highest first', new: 'Newest first' };
const SORT_R = { new: 'Newest first', old: 'Oldest first', az: 'Name A to Z', cost: 'Cost, highest first' };
const cmpS = {
  az: (a, b) => a.name.localeCompare(b.name), za: (a, b) => b.name.localeCompare(a.name),
  low: (a, b) => a.qty - b.qty, high: (a, b) => b.qty - a.qty,
  new: (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
};
const cmpR = {
  new: (a, b) => b.date.localeCompare(a.date) || b.id - a.id, old: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  az: (a, b) => a.name.localeCompare(b.name), cost: (a, b) => (b.cost || 0) - (a.cost || 0),
};
const defFor = (t) => ({ tag: 'all', who: 'all', level: 'all', status: 'all', sort: t === 'st' ? 'az' : 'new' });
const STATUS = { requested: ['Requested', 'w'], approved: ['Approved', 'ok'], rejected: ['Rejected', 'b'], received: ['Received', ''] };
const isLow = (s) => s.min != null && s.qty <= s.min;

/* ---------- export helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Text starting with = + - @ would run as a formula in Excel, so it gets a leading apostrophe.
const csvCell = (v) => { let s = String(v ?? ''); if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
function downloadCsv(name, rows) {
  const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
// Opens a clean A4 report in a new tab and starts printing. Choose "Save as PDF" in the print window.
// Rows are { c: [cells], hl: true|false }. hl rows print in red. The header row repeats on every page.
function printReport({ title, sub, head, rows, summary }) {
  const w = window.open('', '_blank'); if (!w) return false;
  const css = '@page{size:A4;margin:14mm}body{font:12px/1.45 system-ui,sans-serif;color:#111;margin:0}.top{border-bottom:3px solid #e8392f;padding-bottom:8px;margin-bottom:12px}.top small{letter-spacing:.14em;color:#e8392f;font-weight:700}h1{font-size:20px;margin:4px 0 2px}p{margin:0;color:#555}table{border-collapse:collapse;width:100%}thead{display:table-header-group}tr{page-break-inside:avoid}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f3f3f3;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}tr.hl td{color:#b3241b;font-weight:600}.sum{margin-top:14px;padding:10px 12px;background:#f7f7f7;border-left:3px solid #e8392f;font-weight:600}';
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body><div class="top"><small>INSPIRED KARTERS, BITS PILANI</small><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.hl ? ' class="hl"' : ''}>${r.c.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${summary ? `<div class="sum">${esc(summary)}</div>` : ''}</body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  return true;
}

/* ---------- sheets ---------- */
function StockSheet({ initial, onClose, onSave }) {
  const { say } = useApp();
  const isNew = !initial;
  const [name, setName] = useState(initial?.name || ''); const [qty, setQty] = useState(initial ? String(initial.qty) : '');
  const [unit, setUnit] = useState(initial?.unit || 'pcs'); const [min, setMin] = useState(initial?.min != null ? String(initial.min) : '');
  const [tag, setTag] = useState(initial?.tag || 'Miscellaneous'); const [loc, setLoc] = useState(initial?.loc || ''); const [note, setNote] = useState(initial?.note || '');
  const [photo, setPhoto] = useState(initial?.photo || null);
  const save = () => {
    if (!name.trim() || qty === '' || +qty < 0) return say('Add a name and a quantity');
    onSave({ name: name.trim(), qty: +qty, unit: unit.trim() || 'pcs', min: min === '' ? null : +min, tag, loc: loc.trim(), note: note.trim(), photo });
  };
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">{isNew ? 'Add item' : 'Edit item'}</h1>
      <label htmlFor="s1">Item name</label><input id="s1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hex bolts M8" />
      <div className="fgrid">
        <div><label htmlFor="s2">Quantity</label><input id="s2" type="number" inputMode="decimal" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><label htmlFor="s3">Unit</label><input id="s3" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs" /></div>
        <div><label htmlFor="s4">Low stock alert at (optional)</label><input id="s4" type="number" inputMode="decimal" step="any" value={min} onChange={(e) => setMin(e.target.value)} placeholder="40" /></div>
        <div><label htmlFor="s5">Tag</label><select id="s5" value={tag} onChange={(e) => setTag(e.target.value)}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></div>
      </div>
      <label htmlFor="s6">Location (optional)</label><input id="s6" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Shelf A2" />
      <label htmlFor="s7">Notes (optional)</label><textarea id="s7" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      <label htmlFor="s8">Photo (optional)</label>
      <input id="s8" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)); }} />
      {photo && (<><img className="rcpt" src={photo} alt="Item photo preview" /><button className="lnk" onClick={() => setPhoto(null)}>Remove photo</button></>)}
      <div className="two"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn grow" onClick={save}>{isNew ? 'Save item' : 'Save changes'}</button></div>
    </Sheet>
  );
}

// New request (anyone) and edit (author or captain). The captain also gets a status field when editing.
function ReqSheet({ initial, onClose, onSave }) {
  const { say, has } = useApp();
  const isNew = !initial;
  const [name, setName] = useState(initial?.name || ''); const [qty, setQty] = useState(initial ? String(initial.qty) : '1');
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : ''); const [tag, setTag] = useState(initial?.tag || 'Miscellaneous');
  const [note, setNote] = useState(initial?.note || ''); const [status, setStatus] = useState(initial?.status || 'requested');
  const save = () => {
    if (!name.trim() || !+qty) return say('Add a name and a quantity');
    const base = { name: name.trim(), qty: +qty, cost: cost === '' ? null : +cost, tag, note: note.trim() };
    onSave(!isNew && has('admin') ? { ...base, status } : base);
  };
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">{isNew ? 'Request an item' : 'Edit request'}</h1>
      <label htmlFor="q1">What do we need</label><input id="q1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Steering rack" />
      <div className="fgrid">
        <div><label htmlFor="q2">Quantity</label><input id="q2" type="number" inputMode="decimal" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><label htmlFor="q3">Estimated cost (₹, optional)</label><input id="q3" type="number" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
        <div><label htmlFor="q4">Tag</label><select id="q4" value={tag} onChange={(e) => setTag(e.target.value)}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></div>
        {!isNew && has('admin') && <div><label htmlFor="q6">Status</label><select id="q6" value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></div>}
      </div>
      <label htmlFor="q5">Why (optional)</label><textarea id="q5" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why do we need it?" />
      <div className="two"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn grow" onClick={save}>{isNew ? 'Send request' : 'Save changes'}</button></div>
    </Sheet>
  );
}

// Take out or add stock. Open to everyone, and every change is logged with who did it.
function AdjustSheet({ item, mode, onClose, onSave }) {
  const { say } = useApp();
  const [n, setN] = useState(''); const [note, setNote] = useState('');
  const use = mode === 'use';
  const after = n === '' ? item.qty : Math.round((item.qty + (use ? -1 : 1) * +n) * 1000) / 1000;
  const save = () => {
    if (!(+n > 0)) return say('Enter an amount');
    if (use && +n > item.qty) return say(`Only ${item.qty} ${item.unit} in stock`);
    onSave(use ? -+n : +n, note.trim() || (use ? 'Taken out' : 'Restocked'));
  };
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">{use ? 'Take out' : 'Add stock'}</h1>
      <div className="m" style={{ marginTop: 6 }}>{item.name}: {item.qty} {item.unit} in stock now</div>
      <label htmlFor="j1">How many {item.unit}</label><input id="j1" type="number" inputMode="decimal" step="any" value={n} onChange={(e) => setN(e.target.value)} placeholder="5" autoFocus />
      <label htmlFor="j2">What for (optional)</label><input id="j2" value={note} onChange={(e) => setNote(e.target.value)} placeholder={use ? 'Chassis build' : 'Bought from market'} />
      <div className="m" style={{ marginTop: 12 }}>After this: <b className={use && after <= (item.min ?? -1) ? 'redt' : ''}>{after} {item.unit}</b></div>
      <div className="two"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn grow" onClick={save}>{use ? 'Take out' : 'Add'}</button></div>
    </Sheet>
  );
}

// Shown when the captain marks an approved request as received.
function ReceiveSheet({ req, stock, onClose, onConfirm }) {
  const match = stock.find((s) => s.name.trim().toLowerCase() === req.name.trim().toLowerCase());
  const [target, setTarget] = useState(match ? String(match.id) : 'new');
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">Mark as received</h1>
      <div className="m" style={{ marginTop: 6 }}>{req.name}, quantity {req.qty}. Should it go into stock?</div>
      <label htmlFor="rv">Add to stock</label>
      <select id="rv" value={target} onChange={(e) => setTarget(e.target.value)}>
        {stock.map((s) => <option key={s.id} value={String(s.id)}>Add {req.qty} to: {s.name} (now {s.qty} {s.unit})</option>)}
        <option value="new">Create a new item: {req.name}</option>
        <option value="none">Do not add to stock</option>
      </select>
      <div className="m" style={{ marginTop: 8 }}>It is logged in the item's activity history.</div>
      <div className="two"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn grow" onClick={() => onConfirm(target)}>Confirm</button></div>
    </Sheet>
  );
}

function ExportSheet({ tab, count, onPick, onClose }) {
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">Export</h1>
      <div className="m" style={{ marginTop: 6 }}>{count} {tab === 'st' ? 'items' : 'requests'} will be exported, using your current search and filters.</div>
      <button className="btn full" style={{ marginTop: 18 }} onClick={() => onPick('csv')}>Download CSV</button>
      <button className="btn ghost full" style={{ marginTop: 10 }} onClick={() => onPick('pdf')}>Save as PDF</button>
      {tab === 'st' && <button className="btn ghost full" style={{ marginTop: 10 }} onClick={() => onPick('log')}>Download activity log (CSV)</button>}
      <div className="m" style={{ marginTop: 10 }}>For PDF, a print window opens. Choose “Save as PDF” as the printer.{tab === 'st' && ' The activity log lists every take out and restock for these items.'}</div>
      <button className="btn ghost full" style={{ marginTop: 14 }} onClick={onClose}>Cancel</button>
    </Sheet>
  );
}

export default function Inventory() {
  const { me, has, canEdit, stock, stockLog, addStock, updateStock, deleteStock, adjustStock, receiveReq, reqs, addReq, updateReq, deleteReq, pendingReqs, say } = useApp();
  const [tab, setTab] = useState('st');
  const [q, setQ] = useState(''); const [f, setF] = useState(defFor('st')); const [showF, setShowF] = useState(false);
  const [adding, setAdding] = useState(false); const [edit, setEdit] = useState(null); const [viewId, setViewId] = useState(null);
  const [adj, setAdj] = useState(null); const [recv, setRecv] = useState(false); const [exp, setExp] = useState(false); const [allLog, setAllLog] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const go = (t) => { setTab(t); setF(defFor(t)); setQ(''); setShowF(false); };
  const open = (id) => { setViewId(id); setAllLog(false); };

  const needle = q.trim().toLowerCase();
  const stockList = stock.filter((s) =>
    (!needle || `${s.name} ${s.loc || ''} ${s.note || ''} ${s.tag} ${s.author}`.toLowerCase().includes(needle)) &&
    (f.tag === 'all' || s.tag === f.tag) && (f.who === 'all' || s.author === me) && (f.level === 'all' || isLow(s))
  ).sort(cmpS[f.sort] || cmpS.az);
  const reqList = reqs.filter((r) =>
    (!needle || `${r.name} ${r.note || ''} ${r.tag} ${r.author}`.toLowerCase().includes(needle)) &&
    (f.tag === 'all' || r.tag === f.tag) && (f.who === 'all' || r.author === me) && (f.status === 'all' || r.status === f.status)
  ).sort(cmpR[f.sort] || cmpR.new);
  const keys = tab === 'st' ? ['tag', 'who', 'level'] : ['tag', 'who', 'status'];
  const active = keys.filter((k) => f[k] !== defFor(tab)[k]).length;
  const total = tab === 'st' ? stock.length : reqs.length, shown = tab === 'st' ? stockList.length : reqList.length;
  const vs = tab === 'st' ? stock.find((s) => s.id === viewId) : null;
  const vr = tab === 're' ? reqs.find((r) => r.id === viewId) : null;
  const hist = vs ? stockLog.filter((e) => e.stockId === vs.id).sort((a, b) => b.at.localeCompare(a.at)) : [];
  const adjItem = adj ? stock.find((s) => s.id === adj.id) : null;
  const delS = () => { if (window.confirm('Delete this item and its history? This cannot be undone.')) { deleteStock(vs.id); setViewId(null); } };
  const delR = () => { if (window.confirm('Delete this request? This cannot be undone.')) { deleteReq(vr.id); setViewId(null); } };

  const exportNow = (kind) => {
    const bits = [];
    if (q.trim()) bits.push(`search "${q.trim()}"`);
    if (f.tag !== 'all') bits.push(`tag ${f.tag}`);
    if (f.who === 'me') bits.push('added by me');
    if (tab === 'st' && f.level === 'low') bits.push('low stock only');
    if (tab === 're' && f.status !== 'all') bits.push(`status ${STATUS[f.status][0].toLowerCase()}`);
    const sub = `Generated ${todayISO()}. ${shown} of ${total} shown${bits.length ? ` (${bits.join(', ')})` : ''}.`;
    const day = todayISO();

    if (kind === 'log') {
      const rows = stockLog.filter((e) => stockList.some((s) => s.id === e.stockId)).sort((a, b) => b.at.localeCompare(a.at))
        .map((e) => { const s = stock.find((x) => x.id === e.stockId); return [fmtStamp(e.at), s.name, e.delta, s.unit, e.after, e.by, e.note]; });
      downloadCsv(`ike-stock-activity-${day}.csv`, [['When', 'Item', 'Change', 'Unit', 'Quantity after', 'By', 'Note'], ...rows]);
      return setExp(false);
    }

    if (tab === 'st') {
      const head = ['Item', 'Quantity', 'Unit', 'Low alert at', 'Level', 'Tag', 'Location', 'Added by', 'Notes'];
      const cells = (s) => [s.name, s.qty, s.unit, s.min ?? '', isLow(s) ? 'LOW' : 'OK', s.tag, s.loc || '', s.author, s.note || ''];
      if (kind === 'csv') downloadCsv(`ike-stock-${day}.csv`, [head, ...stockList.map(cells)]);
      else {
        const lowN = stockList.filter(isLow).length;
        const ok = printReport({ title: 'IKE stock list', sub, head, rows: stockList.map((s) => ({ c: cells(s), hl: isLow(s) })), summary: `${stockList.length} items, ${lowN} low on stock (shown in red).` });
        if (!ok) return say('Allow pop-ups to export the PDF');
      }
    } else {
      const head = ['Requested on', 'Item', 'Quantity', 'Estimated cost', 'Tag', 'Status', 'Requested by', 'Days waiting', 'Reason'];
      const fmt = kind === 'csv' ? (n) => n ?? '' : (n) => (n == null ? '' : inr(n));
      const cells = (r) => [r.date, r.name, r.qty, fmt(r.cost), r.tag, STATUS[r.status][0], r.author, r.status === 'requested' ? daysSince(r.date) : '', r.note || ''];
      if (kind === 'csv') downloadCsv(`ike-requests-${day}.csv`, [head, ...reqList.map(cells)]);
      else {
        const sum = reqList.reduce((t, r) => t + (r.cost || 0), 0);
        const by = Object.keys(STATUS).map((k) => `${reqList.filter((r) => r.status === k).length} ${STATUS[k][0].toLowerCase()}`).join(', ');
        const ok = printReport({ title: 'IKE purchase requests', sub, head, rows: reqList.map((r) => ({ c: cells(r), hl: false })), summary: `${reqList.length} requests (${by}). Total estimated cost ${inr(sum)}.` });
        if (!ok) return say('Allow pop-ups to export the PDF');
      }
    }
    setExp(false);
  };

  return (
    <>
      <h1>Inventory</h1>
      <div className="glass seg" style={{ marginTop: 18 }}>
        <button className={tab === 'st' ? 'on' : ''} onClick={() => go('st')}>Stock ({stock.length})</button>
        <button className={tab === 're' ? 'on' : ''} onClick={() => go('re')}>Requests{pendingReqs > 0 && ` (${pendingReqs})`}</button>
      </div>

      <div className="srow">
        <input aria-label={tab === 'st' ? 'Search stock' : 'Search requests'} placeholder={tab === 'st' ? 'Search name, location, notes' : 'Search name, reason, person'} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn ghost" onClick={() => setShowF((s) => !s)}>Filters{active > 0 && ` (${active})`}</button>
        <button className="btn" onClick={() => setAdding(true)}>Add</button>
      </div>
      {showF && (
        <div className="glass" style={{ padding: 16, marginBottom: 10 }}>
          <div className="fgrid">
            <div><label htmlFor="h1">Tag</label><select id="h1" value={f.tag} onChange={set('tag')}><option value="all">All</option>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label htmlFor="h2">Added by</label><select id="h2" value={f.who} onChange={set('who')}><option value="all">Everyone</option><option value="me">Me</option></select></div>
            {tab === 'st'
              ? <div><label htmlFor="h3">Stock level</label><select id="h3" value={f.level} onChange={set('level')}><option value="all">All</option><option value="low">Low stock only</option></select></div>
              : <div><label htmlFor="h3">Status</label><select id="h3" value={f.status} onChange={set('status')}><option value="all">All</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></div>}
            <div><label htmlFor="h4">Sort by</label><select id="h4" value={f.sort} onChange={set('sort')}>{Object.entries(tab === 'st' ? SORT_S : SORT_R).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <button className="btn ghost full" style={{ marginTop: 14 }} onClick={() => { setF(defFor(tab)); setQ(''); }}>Clear all</button>
        </div>
      )}
      <div className="cnt">
        <span className="m">{shown === total ? `${total} ${tab === 'st' ? 'items' : 'requests'}` : `${shown} of ${total} shown`}</span>
        <button className="lnk" onClick={() => setExp(true)}>Export</button>
      </div>

      <div className="glass pad">
        {shown === 0 && <div className="empty">Nothing matches.</div>}
        {tab === 'st' && stockList.map((s) => (
          <div className="row click" key={s.id} role="button" tabIndex={0} onClick={() => open(s.id)} onKeyDown={(e) => e.key === 'Enter' && open(s.id)}>
            {s.photo && <img className="thumb" src={s.photo} alt="" />}
            <div className="grow"><div className="t">{s.name}</div><div className="m">{s.tag}{s.loc ? `, ${s.loc}` : ''}</div></div>
            <div style={{ textAlign: 'right' }}>
              <div className="t">{s.qty} {s.unit}</div>
              {isLow(s) && <span className="tag b">Low</span>}
              <button className="btn ghost qt" disabled={s.qty <= 0} onClick={(e) => { e.stopPropagation(); setAdj({ id: s.id, mode: 'use' }); }}>Take out</button>
            </div>
          </div>
        ))}
        {tab === 're' && reqList.map((r) => {
          const [label, cls] = STATUS[r.status]; const d = daysSince(r.date);
          return (
            <div className="row click" key={r.id} role="button" tabIndex={0} onClick={() => open(r.id)} onKeyDown={(e) => e.key === 'Enter' && open(r.id)}>
              <div className="grow"><div className="t">{r.name} <span className="m">x{r.qty}</span></div>
                <div className="m" suppressHydrationWarning>{fmtDate(r.date)}, {r.tag}, {r.author}{r.status === 'requested' && `, ${d} days waiting`}</div></div>
              <div style={{ textAlign: 'right' }}>{r.cost != null && <div className="t">{inr(r.cost)}</div>}<span className={`tag ${cls}`}>{label}</span></div>
            </div>
          );
        })}
      </div>

      {adding && tab === 'st' && <StockSheet onClose={() => setAdding(false)} onSave={(d) => { addStock(d); setAdding(false); }} />}
      {adding && tab === 're' && <ReqSheet onClose={() => setAdding(false)} onSave={(d) => { addReq(d); setAdding(false); }} />}
      {edit && tab === 'st' && <StockSheet initial={edit} onClose={() => setEdit(null)} onSave={(d) => { updateStock(edit.id, d); setEdit(null); }} />}
      {edit && tab === 're' && <ReqSheet initial={edit} onClose={() => setEdit(null)} onSave={(d) => { updateReq(edit.id, d); setEdit(null); }} />}
      {adj && adjItem && <AdjustSheet item={adjItem} mode={adj.mode} onClose={() => setAdj(null)} onSave={(delta, note) => { adjustStock(adjItem.id, delta, note); setAdj(null); }} />}
      {recv && vr && <ReceiveSheet req={vr} stock={stock} onClose={() => setRecv(false)} onConfirm={(t) => { receiveReq(vr.id, t); setRecv(false); }} />}
      {exp && <ExportSheet tab={tab} count={shown} onPick={exportNow} onClose={() => setExp(false)} />}

      {vs && !adj && (
        <Sheet onClose={() => setViewId(null)}>
          <h1 className="sh">{vs.name}</h1>
          {vs.photo && <img className="rcpt" src={vs.photo} alt={vs.name} />}
          <div className="num" style={{ marginTop: 12 }}>{vs.qty} <span className="m">{vs.unit}</span></div>
          {isLow(vs) && <div className="m redt" style={{ marginTop: 6 }}>Low on stock (alert level is {vs.min} {vs.unit})</div>}
          <div className="two" style={{ marginTop: 16 }}>
            <button className="btn grow" onClick={() => setAdj({ id: vs.id, mode: 'use' })}>Take out</button>
            <button className="btn ghost grow" onClick={() => setAdj({ id: vs.id, mode: 'add' })}>Add stock</button>
          </div>
          <div className="m" style={{ marginTop: 14 }}>{vs.tag}{vs.loc ? `, ${vs.loc}` : ''}</div>
          <div className="m" style={{ marginTop: 4 }}>Added by {vs.author}, <span suppressHydrationWarning>{fmtDate(vs.date)}</span></div>
          <div className="m" style={{ margin: '18px 0 6px' }}>Notes</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{vs.note || <span className="m">No notes.</span>}</div>

          <div className="m" style={{ margin: '18px 0 6px' }}>Activity</div>
          {hist.length === 0 && <span className="m">Nothing logged yet.</span>}
          {(allLog ? hist : hist.slice(0, 6)).map((e) => (
            <div key={e.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <div className={`t ${e.delta > 0 ? 'green' : 'redt'}`}>{e.delta > 0 ? '+' : '−'}{Math.abs(e.delta)} {vs.unit} <span className="m">(now {e.after})</span></div>
              <div className="m" suppressHydrationWarning>{e.by}, {fmtStamp(e.at)}{e.note ? `, ${e.note}` : ''}</div>
            </div>
          ))}
          {!allLog && hist.length > 6 && <button className="lnk" onClick={() => setAllLog(true)}>Show all {hist.length}</button>}

          {canEdit(vs) && (
            <div className="two" style={{ marginTop: 20 }}>
              <button className="btn ghost grow" onClick={() => { setEdit(vs); setViewId(null); }}>Edit</button>
              <button className="btn ghost grow" style={{ color: 'var(--red2)' }} onClick={delS}>Delete</button>
            </div>
          )}
          <button className="btn full" style={{ marginTop: 12 }} onClick={() => setViewId(null)}>Close</button>
        </Sheet>
      )}

      {vr && !recv && (
        <Sheet onClose={() => setViewId(null)}>
          <h1 className="sh">{vr.name}</h1>
          <div className="m" style={{ marginTop: 8 }}>Quantity: {vr.qty}</div>
          {vr.cost != null && <div className="num" style={{ marginTop: 8 }}><Money v={vr.cost} /></div>}
          <div style={{ marginTop: 10 }}><span className={`tag ${STATUS[vr.status][1]}`}>{STATUS[vr.status][0]}</span></div>
          <div className="m" style={{ marginTop: 10 }} suppressHydrationWarning>{vr.tag}, requested by {vr.author}, {fmtDate(vr.date)}{vr.status === 'requested' && `, ${daysSince(vr.date)} days waiting`}</div>
          <div className="m" style={{ margin: '18px 0 6px' }}>Why</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{vr.note || <span className="m">No reason given.</span>}</div>
          {has('admin') && vr.status === 'requested' && (
            <div className="two" style={{ marginTop: 20 }}>
              <button className="btn grow" onClick={() => updateReq(vr.id, { status: 'approved' }, 'Approved')}>Approve</button>
              <button className="btn ghost grow" onClick={() => updateReq(vr.id, { status: 'rejected' }, 'Rejected')}>Reject</button>
            </div>
          )}
          {has('admin') && vr.status === 'approved' && <button className="btn full" style={{ marginTop: 20 }} onClick={() => setRecv(true)}>Mark as received</button>}
          {canEdit(vr) && (
            <div className="two" style={{ marginTop: 12 }}>
              <button className="btn ghost grow" onClick={() => { setEdit(vr); setViewId(null); }}>Edit</button>
              <button className="btn ghost grow" style={{ color: 'var(--red2)' }} onClick={delR}>Delete</button>
            </div>
          )}
          <button className="btn full" style={{ marginTop: 12 }} onClick={() => setViewId(null)}>Close</button>
        </Sheet>
      )}
    </>
  );
}
