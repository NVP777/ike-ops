'use client';
import { useState } from 'react';
import { useApp } from '@/lib/store';
import Greeting from '@/components/Greeting';
import CarLoader from '@/components/CarLoader';
import Sheet from '@/components/Sheet';
import { ago } from '@/lib/data';

function Money({ v }) {
  const neg = v < 0;
  return (
    <span>
      {neg && '−'}<span className="rs">₹</span>{Math.abs(v).toLocaleString('en-IN')}
    </span>
  );
}

const STATUS = { active: ['Active', ''], blocked: ['Blocked', 'b'], done: ['Done', 'ok'] };

// Add or update a subsystem. Anyone who runs the car can update one. Only its author or the captain can delete it.
function SubSheet({ initial, canDelete, onClose, onSave, onDelete }) {
  const { say } = useApp();
  const isNew = !initial;
  const [name, setName] = useState(initial?.name || ''); const [lead, setLead] = useState(initial?.lead || '');
  const [task, setTask] = useState(initial?.task || ''); const [status, setStatus] = useState(initial?.status || 'active'); const [why, setWhy] = useState(initial?.why || '');
  const save = () => {
    if (!name.trim()) return say('Give the subsystem a name');
    if (status === 'blocked' && !why.trim()) return say('Say what it is waiting for');
    onSave({ name: name.trim(), lead: lead.trim(), task: task.trim(), status, why: status === 'blocked' ? why.trim() : '' });
  };
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">{isNew ? 'Add subsystem' : 'Update subsystem'}</h1>
      <label htmlFor="u1">Name</label><input id="u1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chassis" />
      <label htmlFor="u2">Who is in charge</label><input id="u2" value={lead} onChange={(e) => setLead(e.target.value)} placeholder="Aarav Mehta" />
      <label htmlFor="u3">Working on now</label><textarea id="u3" rows={3} value={task} onChange={(e) => setTask(e.target.value)} placeholder="Validate mounting points for the next test session" />
      <label htmlFor="u4">Status</label>
      <select id="u4" value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
      {status === 'blocked' && (<><label htmlFor="u5">Waiting for</label><input id="u5" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="The updated CAD reference" /></>)}
      <div className="two"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn grow" onClick={save}>{isNew ? 'Add' : 'Save'}</button></div>
      {!isNew && canDelete && <button className="btn ghost full" style={{ marginTop: 10, color: 'var(--red2)' }} onClick={onDelete}>Delete subsystem</button>}
    </Sheet>
  );
}

export default function Home() {
  const { role, has, ready, keys, userId, claimKey, releaseKey, balances, overdue, overdueDocs, pendingReqs, subs, addSub, updateSub, deleteSub, canEdit } = useApp();
  const [sel, setSel] = useState(null); const [adding, setAdding] = useState(false);
  const activeN = subs.filter((s) => s.status === 'active').length;
  const del = async () => { if (window.confirm(`Delete ${sel.name}? This cannot be undone.`) && (await deleteSub(sel.id))) setSel(null); };
  return (
    <>
      <h1>Pit wall</h1><div className="sub">{role} view</div>
      <Greeting />
      {has('finance') && overdue > 0 && <div className="alert r">{overdue} reimbursement{overdue > 1 ? 's' : ''} pending for over 30 days.</div>}
      {overdueDocs > 0 && <div className="alert r">{overdueDocs} item{overdueDocs > 1 ? 's' : ''} in Documents past deadline.</div>}
      {has('inventory') && pendingReqs > 0 && <div className="alert">{pendingReqs} inventory request{pendingReqs > 1 ? 's are' : ' is'} waiting for approval.</div>}

      {has('finance') && (<>
        <h2>Balances</h2>
        <div className="glass bal">{balances.map((b) => (<div key={b.id}><div className="m">{b.label}</div><div className="num green"><Money v={b.value} /></div></div>))}</div>
      </>)}

      {has('boiler') && (<>
        <h2>Boiler room keys<span>{keys.length} duplicates</span></h2>
        <div className="slots">
          {!ready && keys.length === 0 && <CarLoader />}
          {keys.map((k) => {
            const mine = k.byId === userId, taken = k.byId && !mine;
            return (
              <div key={k.n} className={`glass slot ${mine ? 'mine' : taken ? 'taken' : ''}`}>
                <div className="kn">{k.n}</div>
                <div className="grow"><div className="t">{k.byId ? (mine ? 'With you' : k.by) : 'In the cradle'}</div><div className="m" suppressHydrationWarning>{k.byId ? `Taken ${ago(k.at)}` : 'Available to claim'}</div></div>
                {mine ? <button className="btn ghost" onClick={() => releaseKey(k.n)}>Release</button>
                  : taken ? (has('admin') && <button className="btn ghost" onClick={() => releaseKey(k.n)}>Take back</button>)
                  : <button className="btn" onClick={() => claimKey(k.n)}>Claim</button>}
              </div>
            );
          })}
        </div>
      </>)}

      {has('tasks') && (<>
        <h2>Subsystems<span>{activeN} active</span></h2>
        <div className="glass pad">
          {!ready && subs.length === 0 && <CarLoader />}
          {ready && subs.length === 0 && <div className="empty">No subsystems yet. Add the parts of your car, like chassis, powertrain, or aero.</div>}
          {subs.map((s) => {
            const [label, cls] = STATUS[s.status];
            return (
              <div className="row click" key={s.id} role="button" tabIndex={0} onClick={() => setSel(s)} onKeyDown={(e) => e.key === 'Enter' && setSel(s)}>
                <div className="grow">
                  <div className="t">{s.name}{s.lead && <span className="m"> · {s.lead}</span>}</div>
                  <div className="m">{s.task || 'Nothing set yet'}</div>
                  {s.status === 'blocked' && s.why && <div className="amber m" style={{ marginTop: 4 }}>{s.why}</div>}
                  <div className="m" style={{ opacity: 0.6 }} suppressHydrationWarning>Updated {ago(s.updated)}</div>
                </div>
                <span className={`tag ${cls}`}>{label}</span>
              </div>
            );
          })}
        </div>
        <button className="btn ghost full" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>Add subsystem</button>
      </>)}

      {adding && <SubSheet onClose={() => setAdding(false)} onSave={async (d) => { if (await addSub(d)) setAdding(false); }} />}
      {sel && <SubSheet initial={sel} canDelete={canEdit(sel)} onClose={() => setSel(null)} onSave={async (d) => { if (await updateSub(sel.id, d)) setSel(null); }} onDelete={del} />}
    </>
  );
}
