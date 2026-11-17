// Sends an announcement as a push notification. Only a captain can call it; the check happens here, on the server.
import { setVapidDetails, sendNotification } from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!service || !pub || !priv) return Response.json({ error: 'Push is not configured on the server.' }, { status: 501 });

    const token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '');
    if (!token) return Response.json({ error: 'Not signed in.' }, { status: 401 });

    // Who is calling? Check their token first, before reading anything else from the request.
    const asUser = createClient(url, anon, { auth: { persistSession: false } });
    const { data: u } = await asUser.auth.getUser(token);
    const email = (u?.user?.email || '').toLowerCase();
    if (!email) return Response.json({ error: 'Not signed in.' }, { status: 401 });

    let parsed;
    try { parsed = await req.json(); } catch { return Response.json({ error: 'Bad request' }, { status: 400 }); }
    const { title, body, audience } = parsed || {};
    if (typeof title !== 'string' || !title.trim() || title.length > 120 || (body != null && (typeof body !== 'string' || body.length > 500))) return Response.json({ error: 'Bad request' }, { status: 400 });

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: me } = email ? await admin.from('members').select('role').eq('email', email).maybeSingle() : { data: null };
    if (me?.role !== 'Captain') return Response.json({ error: 'Only a captain can send announcements.' }, { status: 403 });

    // Everyone in the chosen audience who has turned notifications on.
    let q = admin.from('members').select('email');
    if (audience && audience !== 'Everyone') q = q.eq('role', audience);
    const { data: members } = await q;
    const emails = (members || []).map((m) => m.email.toLowerCase());
    const { data: subs } = emails.length ? await admin.from('push_subscriptions').select('endpoint,p256dh,auth,email').in('email', emails) : { data: [] };

    setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
    const payload = JSON.stringify({ title, body: body || '', url: '/' });
    let sent = 0; const dead = [];
    await Promise.all((subs || []).map(async (s) => {
      try { await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); sent++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint); else console.error('push failed', e.statusCode, e.body); }
    }));
    if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', dead);
    return Response.json({ sent, devices: (subs || []).length, people: new Set((subs || []).map((s) => s.email)).size, audience: emails.length });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Could not send push notifications.' }, { status: 500 });
  }
}
