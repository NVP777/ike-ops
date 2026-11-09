'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase, configOk } from '@/lib/supabase';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const urlError = () => {
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return q.get('error_description') || h.get('error_description') || '';
};

// status: config | loading | out | denied | error | in
export function AuthProvider({ children }) {
  const [s, setS] = useState({ status: configOk ? 'loading' : 'config', user: null, member: null, error: '' });
  const [ignite, setIgnite] = useState(false);
  const [authError, setAuthError] = useState('');
  const fresh = useRef(false);
  const loadedFor = useRef(null);

  useEffect(() => {
    if (!configOk) return;
    // Coming back from Google, the address has ?code=... . That means a fresh login, so play the intro.
    fresh.current = new URLSearchParams(window.location.search).has('code');
    setAuthError(urlError());
    let alive = true;

    const load = async (session) => {
      if (!alive) return;
      if (!session?.user) { loadedFor.current = null; setS({ status: 'out', user: null, member: null, error: '' }); return; }
      const u = session.user;
      if (loadedFor.current === u.id) return; // already checked this user
      const email = (u.email || '').toLowerCase();
      const user = { id: u.id, email, name: u.user_metadata?.full_name || email, avatar: u.user_metadata?.avatar_url || '',
        alertHue: typeof u.user_metadata?.alert_hue === 'number' ? u.user_metadata.alert_hue : null };
      // Is this email on the team list? The database only lets people read their own row here.
      let { data, error } = await supabase.from('members').select('email,name,role,year,title,page_grants,page_blocks').eq('email', email).maybeSingle();
      // Database not migrated yet (no year / page columns): fall back to the basics.
      if (error && /year|title|page_grants|page_blocks/.test(error.message || '')) ({ data, error } = await supabase.from('members').select('email,name,role').eq('email', email).maybeSingle());
      if (!alive) return;
      if (error) { setS({ status: 'error', user, member: null, error: error.message }); return; }
      if (!data) { setS({ status: 'denied', user, member: null, error: '' }); return; }
      loadedFor.current = u.id;
      user.name = data.name || user.name;
      // Remember my Google name on my team row, so captains see it too.
      if (u.user_metadata?.full_name && (!data.name || data.name.includes('@'))) supabase.rpc('sync_my_name', { p_name: u.user_metadata.full_name }).then(() => {});
      setS({ status: 'in', user, member: { ...data, grants: data.page_grants || [], blocks: data.page_blocks || [] }, error: '' });
      if (fresh.current) {
        fresh.current = false;
        setIgnite(true);
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      setTimeout(() => load(session), 0); // never call the database from inside this callback directly
    });
    // If checking the login takes more than 12 seconds, say so instead of showing "Starting up" forever.
    const watchdog = setTimeout(() => {
      if (alive) setS((cur) => (cur.status === 'loading' ? { status: 'error', user: null, member: null, error: 'Starting up took too long. Check your connection and try again.' } : cur));
    }, 12000);
    return () => { alive = false; clearTimeout(watchdog); sub.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async () => {
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/`, queryParams: { prompt: 'select_account' } },
    });
    if (error) setAuthError(error.message);
  }, []);

  const signOut = useCallback(async () => {
    loadedFor.current = null;
    await supabase.auth.signOut();
  }, []);

  return (
    <Ctx.Provider value={{ ...s, ignite, endIgnite: () => setIgnite(false), startIgnite: () => setIgnite(true), signIn, signOut, authError }}>
      {children}
    </Ctx.Provider>
  );
}
