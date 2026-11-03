'use client';
import { useEffect, useState } from 'react';
import TimeAttack from './TimeAttack';
import PitStop from './PitStop';

// Opens when you hold the IKE logo for 2 seconds.
const dayNum = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const fmt = (t) => { const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(2).padStart(5, '0')}`; };
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

export default function Garage({ onClose }) {
  const [screen, setScreen] = useState('menu');
  const [bests, setBests] = useState({});
  useEffect(() => { setBests({ lap: read(`ike-lap-${dayNum()}`), pit: read('ike-pit-best') }); }, [screen]);
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') (screen === 'menu' ? onClose() : setScreen('menu')); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [screen, onClose]);

  return (
    <div className="garage">
      {screen === 'menu' && (
        <div className="gar-menu">
          <div className="gar-title">GARAGE</div>
          <img className="gar-car" src="/ike-car.svg" alt="" draggable="false" />
          <button className="gar-card" onClick={() => setScreen('lap')}>
            <b>TIME ATTACK</b>
            <span className="m">One lap on today’s track, the same for everyone. Checkpoints, a ghost of your best, and medals.</span>
            <span className="gar-best">{bests.lap?.t ? `Best today ${fmt(bests.lap.t)}` : 'No lap yet today'}</span>
          </button>
          <button className="gar-card" onClick={() => setScreen('pit')}>
            <b>PIT STOP</b>
            <span className="m">Lights out, then loosen four wheel nuts in order. Tests your reaction.</span>
            <span className="gar-best">{bests.pit?.pit ? `Best stop ${(bests.pit.pit / 1000).toFixed(2)} s, reaction ${(bests.pit.react / 1000).toFixed(2)} s` : 'No stop yet'}</span>
          </button>
          <button className="btn ghost" style={{ marginTop: 'auto' }} onClick={onClose}>Back to work</button>
        </div>
      )}
      {screen === 'lap' && <TimeAttack onExit={() => setScreen('menu')} />}
      {screen === 'pit' && <PitStop onExit={() => setScreen('menu')} />}
    </div>
  );
}
