'use client';
import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { useApp } from '@/lib/store';
import { supabase } from '@/lib/supabase';

const AUDIENCES = ['Everyone', 'ExComm', 'Management', 'Tech'];

// Replaces the old announcement sheet: it sends to a real audience and shows how many real people will see it.
export default function AnnounceSheet() {
  const { setSheet, pushAnnouncement, say } = useApp();
  const [t, setT] = useState(''); const [b, setB] = useState(''); const [a, setA] = useState('Everyone');
  const [counts, setCounts] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.from('members').select('role').then(({ data }) => {
      const rows = data || [], c = { Everyone: rows.length };
      AUDIENCES.slice(1).forEach((r) => { c[r] = rows.filter((x) => x.role === r).length; });
      setCounts(c);
    });
  }, []);
  const send = async () => {
    if (!t.trim()) return say('Add a title first');
    setBusy(true);
    const ok = await pushAnnouncement(t.trim(), b.trim(), a);
    setBusy(false);
    if (ok) setSheet(null);
  };
  return (
    <Sheet onClose={() => setSheet(null)}>
      <h1 className="sh">New announcement</h1>
      <label htmlFor="at">Title</label><input id="at" value={t} onChange={(e) => setT(e.target.value)} />
      <label htmlFor="ab">Message</label><textarea id="ab" rows={3} value={b} onChange={(e) => setB(e.target.value)} />
      <label htmlFor="aa">Send to</label>
      <select id="aa" value={a} onChange={(e) => setA(e.target.value)}>{AUDIENCES.map((k) => <option key={k}>{k}</option>)}</select>
      <p className="m" style={{ marginTop: 10 }}>{counts ? `This will notify ${counts[a]} ${counts[a] === 1 ? 'person' : 'people'}.` : 'Counting…'}</p>
      <div className="two"><button className="btn ghost" onClick={() => setSheet(null)}>Cancel</button><button className="btn grow" disabled={busy} onClick={send}>Push to team</button></div>
    </Sheet>
  );
}
