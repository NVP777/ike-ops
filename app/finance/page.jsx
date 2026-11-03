'use client';
import { useState } from 'react';
import Sheet from '@/components/Sheet';
import CarLoader from '@/components/CarLoader';
import { useApp } from '@/lib/store';
import { inr, fmtDate, acct, ACCOUNTS, TAGS, daysSince, todayISO } from '@/lib/data';

function Money({ v }) {
  const neg = v < 0;
  return (
    <span>
      {neg && '−'}<span className="rs">₹</span>{Math.abs(v).toLocaleString('en-IN')}
    </span>
  );
}

const SORTS = { new: 'Newest first', old: 'Oldest first', high: 'Highest amount', low: 'Lowest amount' };
const cmp = {
  new: (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  old: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  high: (a, b) => Math.abs(b.amt) - Math.abs(a.amt),
  low: (a, b) => Math.abs(a.amt) - Math.abs(b.amt),
};
const DEF = { type: 'all', account: 'all', tag: 'all', from: '', to: '', sort: 'new' };
const STATUS = { requested: ['Requested', 'w'], approved: ['Approved', 'ok'], paid: ['Paid', ''] };

/* ---------- export helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function downloadCsv(name, rows) {
  const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
// Opens a clean report in a new tab and starts printing. Choose "Save as PDF" in the print window.
function printPdf(title, sub, head, rows, foot) {
  const w = window.open('', '_blank'); if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:13px system-ui,sans-serif;margin:28px;color:#111}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 14px;color:#555}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f3f3f3}</style></head><body><h1>${esc(title)}</h1><p>${esc(sub)}</p><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${foot ? `<p style="margin-top:14px"><b>${esc(foot)}</b></p>` : ''}</body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  return true;
}

function Receipt({ value, onChange }) {
  return (
    <>
      <label htmlFor="rc">Receipt photo (optional)</label>
      <input id="rc" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(URL.createObjectURL(f), f); }} />
      {value && <img className="rcpt" src={value} alt="Receipt preview" />}
    </>
  );
}

function TxnSheet({ initial, onClose, onSave }) {
  const { say } = useApp();
  const isNew = !initial;
  const [name, setName] = useState(initial?.name || '');
  const [amt, setAmt] = useState(initial ? String(Math.abs(initial.amt)) : '');
  const [type, setType] = useState(initial ? (initial.amt > 0 ? 'Income' : 'Expense') : 'Expense');
  const [account, setAccount] = useState(initial?.account || 'bank');
  const [tag, setTag] = useState(initial?.tag || 'Miscellaneous');
  const [note, setNote] = useState(initial?.note || '');
  const [receipt, setReceipt] = useState(initial?.receipt || null); const [receiptFile, setReceiptFile] = useState(null);
  const save = () => {
    if (!name.trim() || !+amt) return say('Add a name and an amount');
    onSave({ name: name.trim(), amt: type === 'Expense' ? -Math.abs(+amt) : Math.abs(+amt), account, tag, note: note.trim(), receiptFile });
  };
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">{isNew ? 'Add transaction' : 'Edit transaction'}</h1>
      <label htmlFor="x1">What for</label><input id="x1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Brake pads" />
      <div className="fgrid">
        <div><label htmlFor="x2">Amount (₹)</label><input id="x2" type="number" inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="6400" /></div>
        <div><label htmlFor="x3">Type</label><select id="x3" value={type} onChange={(e) => setType(e.target.value)}><option>Expense</option><option>Income</option></select></div>
        <div><label htmlFor="x5">Account</label><select id="x5" value={account} onChange={(e) => setAccount(e.target.value)}>{ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
        <div><label htmlFor="x6">Tag</label><select id="x6" value={tag} onChange={(e) => setTag(e.target.value)}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></div>
      </div>
      <label htmlFor="x4">Notes (optional)</label><textarea id="x4" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything worth remembering" />
      <Receipt value={receipt} onChange={(u, f) => { setReceipt(u); setReceiptFile(f); }} />
      <div className="two"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn grow" onClick={save}>{isNew ? 'Save transaction' : 'Save changes'}</button></div>
    </Sheet>
  );
}

// New request (anyone) and edit (captain only, includes status).
function ReimbSheet({ initial, payAccount, onClose, onSave }) {
  const { say, userName } = useApp();
  const isNew = !initial;
  const [who, setWho] = useState(initial?.who || userName); const [what, setWhat] = useState(initial?.for || '');
  const [amt, setAmt] = useState(initial ? String(initial.amt) : ''); const [tag, setTag] = useState(initial?.tag || 'Miscellaneous');
  const [note, setNote] = useState(initial?.note || ''); const [receipt, setReceipt] = useState(initial?.receipt || null); const [receiptFile, setReceiptFile] = useState(null);
  const [status, setStatus] = useState(initial?.status || 'requested'); const [acc, setAcc] = useState(payAccount || 'bank');
  const save = () => {
    if (!who.trim() || !what.trim() || !+amt) return say('Fill in who, what for, and the amount');
    const base = { who: who.trim(), for: what.trim(), amt: Math.abs(+amt), tag, note: note.trim(), receiptFile };
    onSave(isNew ? base : { ...base, status }, acc);
  };
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">{isNew ? 'Request reimbursement' : 'Edit reimbursement'}</h1>
      <label htmlFor="r1">Who paid</label><input id="r1" value={who} onChange={(e) => setWho(e.target.value)} />
      <label htmlFor="r2">What for</label><input id="r2" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Fuel for test run" />
      <div className="fgrid">
        <div><label htmlFor="r3">Amount (₹)</label><input id="r3" type="number" inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value)} /></div>
        <div><label htmlFor="r4">Tag</label><select id="r4" value={tag} onChange={(e) => setTag(e.target.value)}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></div>
      </div>
      {!isNew && (<>
        <label htmlFor="r6">Status</label>
        <select id="r6" value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
        {status === 'paid' && (<>
          <label htmlFor="r7">Paid from</label>
          <select id="r7" value={acc} onChange={(e) => setAcc(e.target.value)}>{ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
        </>)}
        <div className="m" style={{ marginTop: 8 }}>Moving a claim out of Paid removes the expense that was recorded for it.</div>
      </>)}
      <label htmlFor="r5">Notes (optional)</label><textarea id="r5" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      <Receipt value={receipt} onChange={(u, f) => { setReceipt(u); setReceiptFile(f); }} />
      <div className="two"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn grow" onClick={save}>{isNew ? 'Send request' : 'Save changes'}</button></div>
    </Sheet>
  );
}

function ReimbDetail({ r, onClose, onEdit }) {
  const { has, approveReimb, payReimb } = useApp();
  const [acc, setAcc] = useState('bank');
  const [label, cls] = STATUS[r.status]; const d = daysSince(r.date);
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">{r.for}</h1>
      <div className="num" style={{ marginTop: 12 }}><Money v={r.amt} /></div>
      <div style={{ marginTop: 10 }}><span className={`tag ${cls}`}>{label}</span></div>
      <div className="m" style={{ marginTop: 10 }} suppressHydrationWarning>
        {r.who}, {r.tag}, requested {fmtDate(r.date)}{r.status !== 'paid' && <span className={d > 30 ? 'redt' : ''}> ({d} days waiting)</span>}
      </div>
      {r.note && <><div className="m" style={{ margin: '18px 0 6px' }}>Notes</div><div style={{ whiteSpace: 'pre-wrap' }}>{r.note}</div></>}
      <div className="m" style={{ margin: '18px 0 6px' }}>Receipt</div>
      {r.receipt ? <img className="rcpt" src={r.receipt} alt="Receipt" /> : <span className="m">No receipt on file.</span>}
      {has('admin') && r.status === 'requested' && <button className="btn full" style={{ marginTop: 20 }} onClick={() => { approveReimb(r.id); onClose(); }}>Approve</button>}
      {has('admin') && r.status === 'approved' && (<>
        <label htmlFor="pa">Pay from</label>
        <select id="pa" value={acc} onChange={(e) => setAcc(e.target.value)}>{ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
        <button className="btn full" style={{ marginTop: 14 }} onClick={() => { payReimb(r.id, acc); onClose(); }}>Mark as paid</button>
      </>)}
      {has('admin') && <button className="btn ghost full" style={{ marginTop: 10 }} onClick={onEdit}>Edit</button>}
      <button className="btn ghost full" style={{ marginTop: 10 }} onClick={onClose}>Close</button>
    </Sheet>
  );
}

function ExportSheet({ what, count, onPick, onClose }) {
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">Export</h1>
      <div className="m" style={{ marginTop: 6 }}>{count} {what} will be exported{what === 'transactions' ? ', respecting your current search and filters' : ''}.</div>
      <button className="btn full" style={{ marginTop: 18 }} onClick={() => onPick('csv')}>Download CSV</button>
      <button className="btn ghost full" style={{ marginTop: 10 }} onClick={() => onPick('pdf')}>Save as PDF</button>
      <div className="m" style={{ marginTop: 10 }}>For PDF, a print window opens. Choose “Save as PDF” as the printer.</div>
      <button className="btn ghost full" style={{ marginTop: 14 }} onClick={onClose}>Cancel</button>
    </Sheet>
  );
}

export default function Finance() {
  const { txns, addTxn, updateTxn, deleteTxn, canEdit, reimbs, addReimb, updateReimb, say, financeReady } = useApp();
  const [tab, setTab] = useState('tx');
  const [q, setQ] = useState(''); const [f, setF] = useState(DEF); const [showF, setShowF] = useState(false);
  const [adding, setAdding] = useState(false); const [edit, setEdit] = useState(null); const [viewId, setViewId] = useState(null);
  const [askRe, setAskRe] = useState(false); const [reId, setReId] = useState(null); const [editRe, setEditRe] = useState(null);
  const [exp, setExp] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const inc = txns.filter((t) => t.amt > 0).reduce((s, t) => s + t.amt, 0);
  const out = txns.filter((t) => t.amt < 0).reduce((s, t) => s + t.amt, 0);
  const needle = q.trim().toLowerCase();
  const list = txns.filter((t) =>
    (!needle || `${t.name} ${t.note || ''} ${t.author} ${t.tag} ${acct(t.account)}`.toLowerCase().includes(needle)) &&
    (f.type === 'all' || (f.type === 'income' ? t.amt > 0 : t.amt < 0)) &&
    (f.account === 'all' || t.account === f.account) && (f.tag === 'all' || t.tag === f.tag) &&
    (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to)
  ).sort(cmp[f.sort]);
  const active = ['type', 'account', 'tag', 'from', 'to'].filter((k) => f[k] !== DEF[k]).length;
  const vt = txns.find((t) => t.id === viewId);
  const rv = reimbs.find((r) => r.id === reId);
  const pend = reimbs.filter((r) => r.status !== 'paid').length;
  const del = () => { if (window.confirm('Delete this transaction? This cannot be undone.')) { deleteTxn(vt.id); setViewId(null); } };

  const exportNow = (kind) => {
    const isTx = tab === 'tx';
    const fmt = kind === 'csv' ? (n) => n : inr;
    const head = isTx ? ['Date', 'What for', 'Type', 'Amount', 'Account', 'Tag', 'Added by', 'Notes']
      : ['Requested on', 'Who', 'What for', 'Amount', 'Tag', 'Status', 'Days waiting', 'Notes'];
    const rows = isTx
      ? list.map((t) => [t.date, t.name, t.amt > 0 ? 'Income' : 'Expense', fmt(t.amt), acct(t.account), t.tag, t.author, t.note || ''])
      : reimbs.map((r) => [r.date, r.who, r.for, fmt(r.amt), r.tag, STATUS[r.status][0], r.status === 'paid' ? '' : daysSince(r.date), r.note || '']);
    const base = `ike-${isTx ? 'transactions' : 'reimbursements'}-${todayISO()}`;
    if (kind === 'csv') downloadCsv(`${base}.csv`, [head, ...rows]);
    else {
      const li = list.filter((t) => t.amt > 0).reduce((s, t) => s + t.amt, 0), lo = list.filter((t) => t.amt < 0).reduce((s, t) => s + t.amt, 0);
      const ok = printPdf(isTx ? 'IKE transactions' : 'IKE reimbursements', `Generated ${todayISO()}`, head, rows,
        isTx ? `Income ${inr(li)}   Expense ${inr(lo)}   Net ${inr(li + lo)}` : '');
      if (!ok) return say('Allow pop-ups to export the PDF');
    }
    setExp(false);
  };

  return (
    <>
      <h1>Finance</h1>
      <div className="glass bal" style={{ marginTop: 16 }}>
        <div><div className="m">Income</div><div className="num green"><Money v={inc} /></div></div>
        <div><div className="m">Expense</div><div className="num redt"><Money v={out} /></div></div>
        <div><div className="m">Net</div><div className="num"><Money v={inc + out} /></div></div>
      </div>

      <div className="glass seg" style={{ marginTop: 22 }}>
        <button className={tab === 'tx' ? 'on' : ''} onClick={() => setTab('tx')}>Transactions</button>
        <button className={tab === 're' ? 'on' : ''} onClick={() => setTab('re')}>Reimbursements{pend > 0 && ` (${pend})`}</button>
      </div>

      {tab === 'tx' && (<>
        <div className="srow">
          <input aria-label="Search transactions" placeholder="Search name, notes, person" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn ghost" onClick={() => setShowF((s) => !s)}>Filters{active > 0 && ` (${active})`}</button>
          <button className="btn" onClick={() => setAdding(true)}>Add</button>
        </div>
        {showF && (
          <div className="glass" style={{ padding: 16, marginBottom: 10 }}>
            <div className="fgrid">
              <div><label htmlFor="f1">Type</label><select id="f1" value={f.type} onChange={set('type')}><option value="all">All</option><option value="income">Income</option><option value="expense">Expense</option></select></div>
              <div><label htmlFor="f2">Account</label><select id="f2" value={f.account} onChange={set('account')}><option value="all">All</option>{ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
              <div><label htmlFor="f3">Tag</label><select id="f3" value={f.tag} onChange={set('tag')}><option value="all">All</option>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div><label htmlFor="f4">Sort by</label><select id="f4" value={f.sort} onChange={set('sort')}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label htmlFor="f5">From</label><input id="f5" type="date" value={f.from} onChange={set('from')} /></div>
              <div><label htmlFor="f6">To</label><input id="f6" type="date" value={f.to} onChange={set('to')} /></div>
            </div>
            <button className="btn ghost full" style={{ marginTop: 14 }} onClick={() => { setF(DEF); setQ(''); }}>Clear all</button>
          </div>
        )}
        <div className="cnt">
          <span className="m">{list.length === txns.length ? `${list.length} transactions` : `${list.length} of ${txns.length} shown`}</span>
          <button className="lnk" onClick={() => setExp(true)}>Export</button>
        </div>
        <div className="glass pad">
          {list.length === 0 && <div className="empty">{financeReady ? 'No transactions match.' : <CarLoader />}</div>}
          {list.map((t) => (
            <div className="row click" key={t.id} role="button" tabIndex={0} onClick={() => setViewId(t.id)} onKeyDown={(e) => e.key === 'Enter' && setViewId(t.id)}>
              <div className="grow"><div className="t">{t.name}</div><div className="m" suppressHydrationWarning>{fmtDate(t.date)}, {acct(t.account)}, {t.tag}</div></div>
              <div className={`t ${t.amt > 0 ? 'green' : ''}`}>{inr(t.amt)}</div>
            </div>
          ))}
        </div>
      </>)}

      {tab === 're' && (<>
        <div className="srow"><button className="btn full" onClick={() => setAskRe(true)}>Request reimbursement</button></div>
        <div className="cnt">
          <span className="m">{reimbs.length} requests</span>
          <button className="lnk" onClick={() => setExp(true)}>Export</button>
        </div>
        <div className="glass pad">
          {reimbs.length === 0 && <div className="empty">{financeReady ? 'No reimbursement requests.' : <CarLoader />}</div>}
          {reimbs.map((r) => {
            const [label, cls] = STATUS[r.status]; const d = daysSince(r.date);
            return (
              <div className="row click" key={r.id} role="button" tabIndex={0} onClick={() => setReId(r.id)} onKeyDown={(e) => e.key === 'Enter' && setReId(r.id)}>
                <div className="grow"><div className="t">{r.for}</div>
                  <div className="m" suppressHydrationWarning>{r.who}, {fmtDate(r.date)}{r.status !== 'paid' && <span className={d > 30 ? 'redt' : ''}>, {d} days waiting</span>}</div></div>
                <div style={{ textAlign: 'right' }}><div className="t">{inr(r.amt)}</div><span className={`tag ${cls}`}>{label}</span></div>
              </div>
            );
          })}
        </div>
      </>)}

      {adding && <TxnSheet onClose={() => setAdding(false)} onSave={async (d) => { if (await addTxn(d)) setAdding(false); }} />}
      {edit && <TxnSheet initial={edit} onClose={() => setEdit(null)} onSave={async (d) => { if (await updateTxn(edit.id, d)) setEdit(null); }} />}
      {askRe && <ReimbSheet onClose={() => setAskRe(false)} onSave={async (d) => { if (await addReimb(d)) setAskRe(false); }} />}
      {editRe && <ReimbSheet initial={editRe} payAccount={txns.find((t) => t.reimbId === editRe.id)?.account} onClose={() => setEditRe(null)}
        onSave={async (d, account) => { if (await updateReimb(editRe.id, d, account)) setEditRe(null); }} />}
      {rv && !editRe && <ReimbDetail r={rv} onClose={() => setReId(null)} onEdit={() => { setEditRe(rv); setReId(null); }} />}
      {exp && <ExportSheet what={tab === 'tx' ? 'transactions' : 'reimbursement requests'} count={tab === 'tx' ? list.length : reimbs.length} onPick={exportNow} onClose={() => setExp(false)} />}

      {vt && (
        <Sheet onClose={() => setViewId(null)}>
          <h1 className="sh">{vt.name}</h1>
          <div className={`num ${vt.amt > 0 ? 'green' : 'redt'}`} style={{ marginTop: 12 }}><Money v={vt.amt} /></div>
          <div className="m" style={{ marginTop: 8 }} suppressHydrationWarning>{fmtDate(vt.date)}, {vt.amt > 0 ? 'Income' : 'Expense'}, {acct(vt.account)}, {vt.tag}</div>
          <div className="m" style={{ marginTop: 4 }}>Added by {vt.author}</div>
          {vt.reimbId && <div className="m amber" style={{ marginTop: 8 }}>Created from a reimbursement. To change it, edit the claim in the Reimbursements tab.</div>}
          <div className="m" style={{ margin: '18px 0 6px' }}>Notes</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{vt.note || <span className="m">No notes added.</span>}</div>
          <div className="m" style={{ margin: '18px 0 6px' }}>Receipt</div>
          {vt.receipt ? <img className="rcpt" src={vt.receipt} alt="Receipt" /> : <span className="m">No receipt on file.</span>}
          {canEdit(vt) && (
            <div className="two" style={{ marginTop: 20 }}>
              {!vt.reimbId && <button className="btn ghost grow" onClick={() => { setEdit(vt); setViewId(null); }}>Edit</button>}
              <button className="btn ghost grow" style={{ color: 'var(--red2)' }} onClick={del}>Delete</button>
            </div>
          )}
          <button className="btn full" style={{ marginTop: 12 }} onClick={() => setViewId(null)}>Close</button>
        </Sheet>
      )}
    </>
  );
}
