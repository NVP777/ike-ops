'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ShaderBg from './ShaderBg';
import Header from './Header';
import Dock from './Dock';
import { NotifSheet, PagesSheet } from './Sheets';
import AnnounceSheet from './AnnounceSheet';
import { useApp } from '@/lib/store';
import { PAGES } from '@/lib/nav';
import { buzz } from '@/lib/haptics';

export default function AppShell({ children }) {
  const { sheet, toast, has, role } = useApp();
  const path = usePathname(); const router = useRouter();
  const view = useRef(); const last = useRef(0); const [hide, setHide] = useState(false);
  useEffect(() => { view.current?.scrollTo(0, 0); setHide(false); }, [path]);
  // Page guard (UI only). The real guard is database policies.
  useEffect(() => { const p = PAGES.find((x) => x.href === path); if (p && p.perm && !has(p.perm)) router.replace('/'); }, [role, path]); // eslint-disable-line
  // A short tick on every tap of a button, link, tile or dropdown.
  useEffect(() => {
    const f = (e) => { if (e.target.closest?.('button, a, select, [role=button], .tile')) buzz(8); };
    document.addEventListener('pointerdown', f, true);
    return () => document.removeEventListener('pointerdown', f, true);
  }, []);
  const onScroll = (e) => {
    const y = e.currentTarget.scrollTop;
    if (y > last.current + 8 && y > 60) setHide(true); else if (y < last.current - 8 || y <= 60) setHide(false);
    last.current = y;
  };
  return (
    <>
      <ShaderBg />
      <div id="app">
        <main id="view" ref={view} onScroll={onScroll}><Header />{children}</main>
        <Dock hide={hide} />
      </div>
      {sheet === 'notifs' && <NotifSheet />}
      {sheet === 'announce' && <AnnounceSheet />}
      {sheet === 'pages' && <PagesSheet />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
