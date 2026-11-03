'use client';
import { useApp } from '@/lib/store';
import { useAuth } from './AuthProvider';

const hello = (h) => (h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Late night session');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// "Good evening, Naman" plus one line about what needs you right now.
export default function Greeting() {
  const { has, keys, me, reimbs, overdue, overdueDocs, pendingReqs } = useApp();
  const { user } = useAuth();
  const first = (user.name || '').trim().split(/\s+/)[0] || 'there';

  const bits = [];
  if (has('admin')) {
    const claims = reimbs.filter((r) => r.status === 'requested').length;
    if (claims) bits.push(`${plural(claims, 'claim')} to approve`);
    if (pendingReqs) bits.push(`${plural(pendingReqs, 'item request')} to approve`);
  }
  const late = (has('finance') ? overdue : 0) + overdueDocs;
  if (late) bits.push(`${late} overdue`);
  const mine = has('boiler') ? keys.find((k) => k.by === me) : null;
  if (mine) bits.push(`you have key ${mine.n}`);
  const line = bits.length ? `${bits.join(', ').replace(/^./, (c) => c.toUpperCase())}.` : 'All clear. Nothing needs you right now. 🏁';

  return (
    <div className="greet">
      <div className="greet-hi">{hello(new Date().getHours())}, <b>{first}</b></div>
      <div className="m">{line}</div>
    </div>
  );
}
