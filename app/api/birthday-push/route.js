// Birthday push, called once a day at 00:00 India time (18:30 UTC) by the Vercel cron (needs CRON_SECRET). Sent by the server
// through the push service, so it arrives even when the app is closed. Everyone with notifications on is told whose
// birthday it is; the birthday person gets their own message. Birthdays are matched on India time.
import { setVapidDetails, sendNotification } from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { birthdayPush } from '@/lib/birthdayMessages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const first = (name, email) => {
  const s = (name && !name.includes('@') ? name : (email || '').split('@')[0]).trim().split(/\s+/)[0];
  return s ? s[0].toUpperCase() + s.slice(1) : 'Someone';
};
const isLeap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);

export async function GET(req) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, secret = process.env.CRON_SECRET;
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    const missing = Object.entries({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: service, NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, CRON_SECRET: secret }).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) { console.error('birthday push not configured, missing:', missing.join(', ')); return Response.json({ error: 'Not configured on the server.', missing }, { status: 501 }); }
    if ((req.headers.get('authorization') || '') !== `Bearer ${secret}`) return Response.json({ error: 'Not allowed.' }, { status: 401 });

    const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
    const y = ist.getUTCFullYear(), mo = ist.getUTCMonth() + 1, d = ist.getUTCDate();
    const doy = Math.floor((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 0)) / 86400000);

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: ms, error } = await admin.from('members').select('email,name,birth_month,birth_day').not('birth_month', 'is', null);
    if (error) throw error;
    const people = (ms || []).filter((m) => (m.birth_month === mo && m.birth_day === d) || (m.birth_month === 2 && m.birth_day === 29 && mo === 2 && d === 28 && !isLeap(y)))
      .map((m) => ({ email: m.email.toLowerCase(), nm: first(m.name, m.email) }));
    if (!people.length) return Response.json({ birthdays: 0, sent: 0 });

    const { data: subs } = await admin.from('push_subscriptions').select('endpoint,p256dh,auth,email');
    setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);

    let sent = 0; const dead = [];
    await Promise.all((subs || []).flatMap((s) => {
      const to = (s.email || '').toLowerCase();
      return people.map(async (p) => {
        const self = p.email === to;
        const payload = JSON.stringify(birthdayPush({ self, nm: p.nm, email: p.email, dayOfYear: doy }));
        try { await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high' }); sent++; }
        catch (e) { if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint); else console.error('birthday push failed', e.statusCode); }
      });
    }));
    if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', dead);
    return Response.json({ birthdays: people.length, sent, expired: dead.length });
  } catch (e) {
    console.error('birthday push failed', e?.message);
    return Response.json({ error: 'Could not send birthday notifications.' }, { status: 500 });
  }
}
