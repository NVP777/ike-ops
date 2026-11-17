// Deletes files in storage that no row points to any more (replaced or deleted receipts, photos and documents).
// Callable by a captain (from Profile) or by the weekly Vercel cron (needs CRON_SECRET). Only files older than a day are removed,
// so an upload that is still being saved is never touched. If anything looks wrong it stops and deletes nothing.
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'files';
const FOLDERS = ['finance', 'documents', 'inventory'];
const MIN_AGE_MS = 24 * 60 * 60 * 1000;
const SOURCES = [['transactions', 'receipt_path'], ['reimbursements', 'receipt_path'], ['document_versions', 'file_path'], ['stock_items', 'photo_path']];

async function allowed(req, admin, url, anon) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '');
  if (!token) return false;
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
  const { data: u } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
  const email = (u?.user?.email || '').toLowerCase();
  if (!email) return false;
  const { data: me } = await admin.from('members').select('role').eq('email', email).maybeSingle();
  return me?.role === 'Captain';
}

async function column(admin, table, col) {
  const out = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await admin.from(table).select(col).range(from, from + size - 1);
    if (error) throw new Error(`${table}.${col}: ${error.message}`);
    (data || []).forEach((r) => r[col] && out.push(r[col]));
    if (!data || data.length < size) return out;
  }
}

async function handle(req) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !service) return Response.json({ error: 'Not configured on the server.' }, { status: 501 });
    const admin = createClient(url, service, { auth: { persistSession: false } });
    if (!(await allowed(req, admin, url, anon))) return Response.json({ error: 'Only a captain can do this.' }, { status: 401 });
    const dry = new URL(req.url).searchParams.get('dry') === '1';

    // Every path a row still uses. If any lookup fails we abort rather than risk deleting a file that is in use.
    const used = new Set();
    for (const [t, c] of SOURCES) (await column(admin, t, c)).forEach((p) => used.add(p));

    const cutoff = Date.now() - MIN_AGE_MS;
    let checked = 0; const stale = [];
    for (const folder of FOLDERS) {
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await admin.storage.from(BUCKET).list(folder, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) throw new Error(`list ${folder}: ${error.message}`);
        for (const f of data || []) {
          if (!f.id) continue; // a sub-folder placeholder, not a file
          checked++;
          const path = `${folder}/${f.name}`;
          if (!used.has(path) && f.created_at && new Date(f.created_at).getTime() < cutoff) stale.push(path);
        }
        if (!data || data.length < 100) break;
      }
    }

    let removed = 0;
    if (!dry) {
      for (let i = 0; i < stale.length; i += 100) {
        const { error } = await admin.storage.from(BUCKET).remove(stale.slice(i, i + 100));
        if (error) throw new Error(`remove: ${error.message}`);
        removed += Math.min(100, stale.length - i);
      }
    }
    return Response.json({ checked, unused: stale.length, removed, dryRun: dry });
  } catch (e) {
    console.error('cleanup failed', e?.message);
    return Response.json({ error: 'Cleanup stopped. Nothing more was deleted.' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
