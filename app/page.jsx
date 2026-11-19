'use client';
import { useApp } from '@/lib/store';
import Greeting from '@/components/Greeting';
import { NotifItem } from '@/components/Sheets';
import { useAuth } from '@/components/AuthProvider';
import { BirthdayBanner, useBirthdays, firstName } from '@/components/Birthdays';


function Money({ v }) {
  const neg = v < 0;
  return (
    <span>
      {neg && '−'}<span className="rs">₹</span>{Math.abs(v).toLocaleString('en-IN')}
    </span>
  );
}

export default function Home() {
  const { role, has, balances, overdue, overdueDocs, pendingReqs, notifs, unread, setSheet, markRead } = useApp();
  const { user } = useAuth();
  const bd = useBirthdays();
  const myBday = bd.people.find((p) => p.email === user.email);
  const recent = notifs.filter((n) => !n.need || has(n.need)).slice(0, 6);
  return (
    <>
      <h1>Pit wall</h1><div className="sub">{role} view</div>
      <div className="home-grid">
      <div className="home-top">
      <Greeting birthdayName={myBday ? firstName(myBday.name, myBday.email) : ''} />
      <BirthdayBanner people={bd.people} wishes={bd.wishes} reload={bd.reload} />
      {has('finance') && overdue > 0 && <div className="alert r">{overdue} reimbursement{overdue > 1 ? 's' : ''} pending for over 30 days.</div>}
      {overdueDocs > 0 && <div className="alert r">{overdueDocs} item{overdueDocs > 1 ? 's' : ''} in Documents past deadline.</div>}
      {has('inventory') && pendingReqs > 0 && <div className="alert">{pendingReqs} inventory request{pendingReqs > 1 ? 's are' : ' is'} waiting for approval.</div>}

      </div>

      <div className="home-bal">
      {has('financeTotals') && (<>
        <h2>Balances</h2>
        <div className="glass bal">{balances.map((b) => (<div key={b.id}><div className="m">{b.label}</div><div className="num green"><Money v={b.value} /></div></div>))}</div>
      </>)}
      </div>

      <aside className="home-side">
        <h2>Notifications<span>{unread > 0 ? `${unread} new` : 'all read'}</span></h2>
        <div className="glass notes">
          {recent.length ? recent.map((n) => (
            <NotifItem key={n.id} n={n} timeStyle={{ fontSize: 14, whiteSpace: 'nowrap' }} />
          )) :<div className="empty">Announcements will show up here once someone sends one.</div>}
        </div>
        <div className="two">
          {unread > 0 && <button className="btn ghost" onClick={markRead}>Mark all read</button>}
          <button className="btn ghost" onClick={() => setSheet('notifs')}>View all</button>
          {has('announce') && <button className="btn" onClick={() => setSheet('announce')}>Send announcement</button>}
        </div>
      </aside>
      </div>
    </>
  );
}
