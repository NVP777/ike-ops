'use client';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { topThree } from '@/lib/scores';

const MEDAL = ['#f5c542', '#c9cdd3', '#c7803f'];

// Today's three fastest people for one game. Pass a new `refresh` value after submitting a run to reload it.
export default function Leaderboard({ game, fmt, refresh = 0 }) {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  useEffect(() => { let live = true; topThree(game).then((r) => { if (live) setRows(r); }); return () => { live = false; }; }, [game, refresh]);
  return (
    <div className="pit-res" style={{ width: 'min(100%,320px)' }}>
      <div className="ta-sub" style={{ marginBottom: 8 }}>today’s top 3</div>
      {rows === null && <div className="m">Loading…</div>}
      {rows?.length === 0 && <div className="m">Nobody has set a time today.</div>}
      {rows?.map((r, i) => (
        <div className="pit-row" key={r.user_id}>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: MEDAL[i], marginRight: 8 }} />{r.user_name}{r.user_id === user.id ? ' (you)' : ''}</span>
          <b>{fmt(r.score)}</b>
        </div>
      ))}
    </div>
  );
}
