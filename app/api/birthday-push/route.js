// Morning birthday push, called once a day by the Vercel cron (needs CRON_SECRET). Everyone with notifications on is told whose
// birthday it is; the birthday person gets their own message. Birthdays are matched on India time.
import { setVapidDetails, sendNotification } from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const first = (name, email) => {
  const s = (name && !name.includes('@') ? name : (email || '').split('@')[0]).trim().split(/\s+/)[0];
  return s ? s[0].toUpperCase() + s.slice(1) : 'Someone';
};
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

// Different wording each day and for each person.
const OTHERS = [
  (n) => `Lights out on another lap around the sun for ${n}. Send a wish!`,
  (n) => `Green flag for ${n}'s new year. Tap to send a wish.`,
  (n) => `Pit stop for cake. Wish ${n} a happy birthday!`,
  (n) => `Fastest lap of ${n}'s life so far starts today. Say happy birthday!`,
  (n) => `The whole garage is cheering for ${n} today. Add a line to their card.`,
];
const SELF = [
  'The whole team is cheering for you. Open IKE Ops for your birthday card.',
  'Lights out on a new year. Your team has left you something in IKE Ops.',
  'Green flag for your new year. Open IKE Ops to see who wished you.',
];

const isLeap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);

export async function GET(req) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, secret = process.env.CRON_SECRET;
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!url || !service || !pub || !priv || !secret) return Response.json({ error: 'Not configured on the server.' }, { status: 501 });
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
        const payload = JSON.stringify(self
          ? { title: `🎂 Happy birthday, ${p.nm}!`, body: SELF[(doy + hash(p.email)) % SELF.length], url: '/' }
          : { title: `🏁 It's ${p.nm}'s birthday`, body: OTHERS[(doy + hash(p.email)) % OTHERS.length](p.nm), url: '/' });
        try { await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); sent++; }
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
