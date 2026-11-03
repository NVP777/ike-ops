'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/store';

// Glass pill. 4 icons per screen, snaps like a phone home screen.
// Hides on scroll down (hide prop). Double-tap opens the all-pages sheet.
export default function Dock({ hide }) {
  const { navItems, setSheet } = useApp();
  const path = usePathname();
  const items = navItems();
  const nav = useRef(); const last = useRef(0);
  const ix = items.findIndex((p) => p.href === path);
  useEffect(() => { if (ix > -1 && nav.current) nav.current.scrollLeft = Math.floor(ix / 4) * nav.current.clientWidth; }, [path]); // eslint-disable-line
  const tap = () => { const n = Date.now(); if (n - last.current < 350) { last.current = 0; setSheet('pages'); } else last.current = n; };
  return (
    <div id="dock" className={hide ? 'hide' : ''} onClick={tap}>
      <nav id="nav" ref={nav}>
        {items.map((p) => (
          <Link key={p.id} href={p.href} className={p.href === path ? 'on' : ''}><span className="it"><b>{p.icon}</b>{p.label}</span></Link>
        ))}
      </nav>
    </div>
  );
}
