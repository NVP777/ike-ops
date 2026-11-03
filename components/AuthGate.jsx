'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AppProvider } from '@/lib/store';
import AppShell from './AppShell';
import { useAuth } from './AuthProvider';
import Ignition from './Ignition';
import CarLoader from './CarLoader';

const CAR = '/ike-car.svg';

function Google() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function Login() {
  const { signIn, authError } = useAuth();
  useEffect(() => { const i = new Image(); i.src = CAR; }, []); // warm the cache so the intro starts instantly
  // Only when testing over Wi-Fi: show the exact address Supabase has to allow.
  const lan = window.location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
  return (
    <div className="auth">
      <img className="auth-car" src={CAR} alt="" draggable="false" />
      <div className="auth-logo">IKE</div>
      <div className="auth-tag">Inspired Karters, BITS Pilani. Operations portal.</div>
      <button className="gbtn" onClick={signIn}><Google />Continue with Google</button>
      <div className="m">Only approved team members can enter.</div>
      {authError && <div className="err" role="alert">{authError}</div>}
      {lan && <div className="m" style={{ fontSize: 11, opacity: 0.6, maxWidth: 320 }}>Testing address: {window.location.origin}. Add both {window.location.origin} and {window.location.origin}/** to the Redirect URLs in Supabase.</div>}
    </div>
  );
}

function Denied() {
  const { user, signOut } = useAuth();
  return (
    <div className="auth">
      <div className="auth-logo">IKE</div>
      <div className="t" style={{ fontSize: 18 }}>This account isn’t on the team list</div>
      <div className="m" style={{ maxWidth: 320 }}>You signed in as {user.email}. Ask the captain to add that email, or sign in with a different Google account.</div>
      <button className="gbtn" onClick={signOut}>Use a different account</button>
    </div>
  );
}

function Problem() {
  const { error, signOut } = useAuth();
  return (
    <div className="auth">
      <div className="auth-logo">IKE</div>
      <div className="t" style={{ fontSize: 18 }}>Couldn’t check your access</div>
      <div className="err" style={{ maxWidth: 340 }}>{error}</div>
      <div className="m" style={{ maxWidth: 340 }}>If it mentions a missing table, the database script hasn’t been run yet.</div>
      <button className="gbtn" onClick={() => window.location.reload()}>Try again</button>
      <button className="lnk" onClick={signOut}>Sign out</button>
    </div>
  );
}

function Config() {
  return (
    <div className="auth">
      <div className="auth-logo">IKE</div>
      <div className="t" style={{ fontSize: 18 }}>Database address is missing or wrong</div>
      <div className="m" style={{ maxWidth: 340 }}>
        In <b>.env.local</b>, NEXT_PUBLIC_SUPABASE_URL must look like https://yourproject.supabase.co (not localhost), and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. Save the file, stop the server, and run npm run dev again.
      </div>
    </div>
  );
}

export default function AuthGate({ children }) {
  const { status } = useAuth();
  const path = usePathname();
  if (path === '/privacy') return <>{children}</>; // public page: needs no login
  if (status === 'config') return <Config />;
  if (status === 'loading') return <div className="auth"><CarLoader label="Starting up" /></div>;
  if (status === 'out') return <Login />;
  if (status === 'denied') return <Denied />;
  if (status === 'error') return <Problem />;
  return (<><AppProvider><AppShell>{children}</AppShell></AppProvider><Ignition /></>);
}
