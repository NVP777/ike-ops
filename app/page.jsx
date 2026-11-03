'use client';
import { useApp } from '@/lib/store';
import { TASKS, BUY } from '@/lib/data';
   import Greeting from '@/components/Greeting';
function Money({ v }) {
  const neg = v < 0;
  return (
    <span>
      {neg && '−'}<span className="rs">₹</span>{Math.abs(v).toLocaleString('en-IN')}
    </span>
  );
}

export default function Home() {
  const { role, has, keys, me, claimKey, releaseKey, balances, overdue, overdueDocs } = useApp();
  return (
    <>
      <h1>Pit wall</h1><div className="sub">{role} view</div>
         <Greeting />
      {overdueDocs > 0 && <div className="alert r">{overdueDocs} item{overdueDocs > 1 ? 's' : ''} in Documents past deadline.</div>}
      {has('finance') && overdue > 0 && <div className="alert r">{overdue} reimbursement{overdue > 1 ? 's' : ''} pending for over 30 days.</div>}
      {has('inventory') && <div className="alert">{BUY.length} inventory requests are waiting for approval.</div>}

      {has('finance') && (<>
        <h2>Balances</h2>
        <div className="glass bal">{balances.map((b) => (<div key={b.id}><div className="m">{b.label}</div><div className="num green"><Money v={b.value} /></div></div>))}</div>
      </>)}

      {has('boiler') && (<>
        <h2>Boiler room keys<span>3 duplicates</span></h2>
        <div className="slots">
          {keys.map((k) => {
            const mine = k.by === me, taken = k.by && !mine;
            return (
              <div key={k.n} className={`glass slot ${mine ? 'mine' : taken ? 'taken' : ''}`}>
                <div className="kn">{k.n}</div>
                <div className="grow"><div className="t">{k.by ? (mine ? 'With you' : k.by) : 'In the cradle'}</div><div className="m">{k.by ? 'Taken this morning' : 'Available to claim'}</div></div>
                {mine ? <button className="btn ghost" onClick={() => releaseKey(k.n)}>Release</button>
                  : taken ? (has('admin') && <button className="btn ghost" onClick={() => releaseKey(k.n)}>Take back</button>)
                  : <button className="btn" onClick={() => claimKey(k.n)}>Claim</button>}
              </div>
            );
          })}
        </div>
      </>)}

      {has('tasks') && (<>
        <h2>Subsystems<span>{TASKS.length} active</span></h2>
        <div className="glass pad">
          {TASKS.map((t) => (
            <div className="row" key={t.s}>
              <div className="grow"><div className="t">{t.s} <span className="m">· {t.n}</span></div><div className="m">{t.d}</div>{t.why && <div className="amber m" style={{ marginTop: 4 }}>{t.why}</div>}</div>
              {t.why ? <span className="tag b">Blocked</span> : <span className="tag">Active</span>}
            </div>
          ))}
        </div>
      </>)}
    </>
  );
}
