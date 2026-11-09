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

export default function AppShell({ children }) {
  const { sheet, toast, has, role } = useApp();
  const path = usePathname(); const router = useRouter();
  const view = useRef(); const last = useRef(0); const [hide, setHide] = useState(false);
  useEffect(() => { view.current?.scrollTo(0, 0); setHide(false); }, [path]);
  // Page guard (UI only). The real guard is database policies.
  useEffect(() => { const p = PAGES.find((x) => x.href === path); if (p && p.perm && !has(p.perm)) router.replace('/'); }, [role, path]); // eslint-disable-line
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
