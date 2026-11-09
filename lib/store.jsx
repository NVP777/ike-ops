'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { PAGES, PERMS } from './nav';
import { ACCOUNTS, todayISO, daysSince, ago } from './data';
import { supabase } from './supabase';
import { useAuth } from '@/components/AuthProvider';
import Flag from '@/components/Flag';
import Licence from '@/components/Licence';
import Garage from '@/components/Garage';
import { buzz } from './haptics';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const NO_OPENING = { bank: 0, dean: 0, bitsaa: 0 };
const denied = () => Object.assign(new Error('not allowed'), { code: '42501' });
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`); // randomUUID needs https
const num = (v) => (v == null ? null : Number(v));

export function AppProvider({ children }) {
  const { user, member } = useAuth();
  const userId = user.id;
  const realRole = member.role;                    // the role the database enforces
  const can = (p) => PERMS[realRole].includes(p);
  const me = userId;                               // "me" means my user id everywhere ("added by me" filters)
  const [role, setRoleState] = useState(realRole); // the role the screen shows (a captain can preview others)
  const setRole = (r) => { if (realRole === 'Captain') setRoleState(r); };

  // ---- real data, all loaded from the database. Nothing here is sample data. ----
  const [txns, setTxns] = useState([]);
  const [reimbs, setReimbs] = useState([]);
  const [opening, setOpening] = useState(NO_OPENING);
  const [docs, setDocs] = useState([]);
  const [stock, setStock] = useState([]);
  const [stockLog, setStockLog] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [keys, setKeys] = useState([]);
  const [subs, setSubs] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [ready, setReady] = useState(false);

  const [order, setOrder] = useState([]);
  const [sheet, setSheet] = useState(null); // 'notifs' | 'announce' | 'pages' | null
  const [toast, setToast] = useState('');
  const [flag, setFlag] = useState(null);
  const [licence, setLicence] = useState(false); // double-tap your profile
  const [garage, setGarage] = useState(false);   // hold the IKE logo
  // Background color: a hue (0 to 359, 38 = amber, the default) each person picks. Saved on their account, so it follows them to any device.
  const [hue, setHue] = useState(typeof user.alertHue === 'number' ? user.alertHue : 38);
  const [preview, setPreview] = useState(false);
  const saveTimer = useRef(null), previewTimer = useRef(null), queued = useRef({});
  const previewAlert = () => {
    setPreview(true); clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setPreview(false), 4500);
  };
  const setAlertHue = (h) => {
    const v = ((Math.round(h) % 360) + 360) % 360;
    setHue(v); previewAlert();
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { supabase.auth.updateUser({ data: { alert_hue: v } }).then(({ error }) => { if (error) console.error(error); }); }, 700);
  };

  useEffect(() => { try { setOrder(JSON.parse(localStorage.getItem('ike-nav')) || []); } catch {} }, []);
  const saveOrder = (o) => { setOrder(o); try { localStorage.setItem('ike-nav', JSON.stringify(o)); } catch {} };

  const has = (p) => PERMS[role].includes(p);
  const navItems = () => {
    const ids = [...order];
    PAGES.forEach((p) => { if (!ids.includes(p.id)) ids.push(p.id); }); // new pages appear automatically
    return ids.map((i) => PAGES.find((p) => p.id === i)).filter((p) => p && (!p.perm || has(p.perm)));
  };
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const celebrate = (label = '') => setFlag({ id: Date.now(), label }); // finish banner
  const fail = (e, msg) => {
    console.error(msg, e);
    say(e?.code === '42501' || /row-level security|permission denied|not allowed|Only the captain/i.test(e?.message || '')
      ? 'You do not have permission to do that' : `${msg}${e?.message ? `: ${e.message}` : ''}`);
    return false;
  };
  // Author edits and deletes their own entries. Captain can edit and delete everything. (The database enforces this too.)
  const canEdit = (t) => role === 'Captain' || t.authorId === userId;

  const upload = async (file, folder) => {
    const ext = ((file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin').slice(0, 8);
    const path = `${folder}/${uid()}.${ext}`;
    const { error } = await supabase.storage.from('files').upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) throw error;
    return path;
  };
  const signedUrls = async (paths) => {
    const list = [...new Set(paths.filter(Boolean))];
    if (!list.length) return {};
    const { data } = await supabase.storage.from('files').createSignedUrls(list, 3600);
    const m = {}; (data || []).forEach((d) => { if (d.signedUrl) m[d.path] = d.signedUrl; });
    return m;
  };

  // ---- loaders: each reads one area from the database ----
  const loadFinance = useCallback(async () => {
    if (!PERMS[realRole].includes('finance')) return;
    const [t, r, o] = await Promise.all([
      supabase.from('transactions').select('*').order('txn_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('reimbursements').select('*').order('requested_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('settings').select('value').eq('key', 'opening').maybeSingle(),
    ]);
    if (t.error || r.error) { console.error(t.error || r.error); setToast('Could not load finance data'); return; }
    const urls = await signedUrls([...t.data.map((x) => x.receipt_path), ...r.data.map((x) => x.receipt_path)]);
    setTxns(t.data.map((x) => ({ id: x.id, name: x.name, amt: Number(x.amount), date: x.txn_date, account: x.account, tag: x.tag, note: x.note,
      receipt: x.receipt_path ? urls[x.receipt_path] || null : null, reimbId: x.reimbursement_id, author: x.author_name, authorId: x.author_id })));
    setReimbs(r.data.map((x) => ({ id: x.id, who: x.who, for: x.what, amt: Number(x.amount), tag: x.tag, note: x.note, date: x.requested_on, status: x.status,
      receipt: x.receipt_path ? urls[x.receipt_path] || null : null, author: x.author_name, authorId: x.author_id })));
    if (o.data?.value) setOpening({ ...NO_OPENING, ...o.data.value });
  }, [realRole]);

  const loadDocs = useCallback(async () => {
    const [d, v] = await Promise.all([
      supabase.from('documents').select('*').order('doc_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('document_versions').select('*').order('n', { ascending: false }),
    ]);
    if (d.error || v.error) { console.error(d.error || v.error); return; }
    const urls = await signedUrls(v.data.map((x) => x.file_path));
    const by = {};
    v.data.forEach((x) => {
      (by[x.document_id] = by[x.document_id] || []).push({ id: x.id, n: x.n, link: x.link, note: x.note, date: x.version_date, author: x.author_name,
        file: x.file_path ? { name: x.file_name, size: Number(x.file_size) || 0, type: x.file_type || '', url: urls[x.file_path] || '' } : null });
    });
    setDocs(d.data.map((x) => ({ id: x.id, kind: x.kind, title: x.title, desc: x.description, tag: x.tag, due: x.due_date || '', done: x.done,
      date: x.doc_date, author: x.author_name, authorId: x.author_id, versions: by[x.id] || [] })));
  }, []);

  const loadInv = useCallback(async () => {
    if (!PERMS[realRole].includes('inventory')) return;
    const [s, l, r] = await Promise.all([
      supabase.from('stock_items').select('*').order('name'),
      supabase.from('stock_log').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('purchase_requests').select('*').order('request_date', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    if (s.error || l.error || r.error) { console.error(s.error || l.error || r.error); return; }
    const urls = await signedUrls(s.data.map((x) => x.photo_path));
    setStock(s.data.map((x) => ({ id: x.id, name: x.name, qty: Number(x.qty), unit: x.unit, min: num(x.min_qty), tag: x.tag, loc: x.location, note: x.note,
      photo: x.photo_path ? urls[x.photo_path] || null : null, author: x.author_name, authorId: x.author_id, date: x.item_date })));
    setStockLog(l.data.map((x) => ({ id: x.id, stockId: x.stock_id, delta: Number(x.delta), after: Number(x.qty_after), by: x.by_name, at: x.created_at, note: x.note })));
    setReqs(r.data.map((x) => ({ id: x.id, name: x.name, qty: Number(x.qty), cost: num(x.cost), tag: x.tag, note: x.note, status: x.status,
      author: x.author_name, authorId: x.author_id, date: x.request_date })));
  }, [realRole]);

  const loadKeys = useCallback(async () => {
    if (!PERMS[realRole].includes('boiler')) return;
    const { data, error } = await supabase.from('keys').select('*').order('n');
    if (error) { console.error(error); return; }
    setKeys(data.map((x) => ({ n: x.n, by: x.held_by_name, byId: x.held_by, at: x.taken_at })));
  }, [realRole]);

  const loadSubs = useCallback(async () => {
    if (!PERMS[realRole].includes('tasks')) return;
    const { data, error } = await supabase.from('subsystems').select('*').order('name');
    if (error) { console.error(error); return; }
    setSubs(data.map((x) => ({ id: x.id, name: x.name, lead: x.lead, task: x.task, status: x.status, why: x.blocked_reason, updated: x.updated_at, author: x.author_name, authorId: x.author_id })));
  }, [realRole]);

  const loadNotifs = useCallback(async () => {
    const [n, r] = await Promise.all([
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('notif_reads').select('notification_id'),
    ]);
    if (n.error || r.error) { console.error(n.error || r.error); return; }
    const seen = new Set((r.data || []).map((x) => x.notification_id));
    setNotifs(n.data.map((x) => ({ id: x.id, t: x.title, b: x.body || 'No details.', w: ago(x.created_at), read: seen.has(x.id), need: null, audience: x.audience, by: x.created_by })));
  }, []);

  useEffect(() => {
    let on = true;
    const safe = (f) => f().catch((e) => console.error(e));
    Promise.all([loadFinance, loadDocs, loadInv, loadKeys, loadSubs, loadNotifs].map(safe)).finally(() => { if (on) setReady(true); });
    return () => { on = false; };
  }, [loadFinance, loadDocs, loadInv, loadKeys, loadSubs, loadNotifs]);

  // When anyone changes something, everyone's screen refreshes. (Refreshes are grouped, so a burst of changes reloads once.)
  useEffect(() => {
    const queue = (name, fn) => { clearTimeout(queued.current[name]); queued.current[name] = setTimeout(() => fn().catch((e) => console.error(e)), 150); };
    // A new name every time: in development React starts this effect twice, and a reused name hands back the old, already-subscribed channel.
    const ch = supabase.channel(`ike-live-${Math.random().toString(36).slice(2)}`);
    const on = (table, fn) => ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => queue(table, fn));
    if (can('finance')) { on('transactions', loadFinance); on('reimbursements', loadFinance); on('settings', loadFinance); }
    on('documents', loadDocs); on('document_versions', loadDocs);
    if (can('inventory')) { on('stock_items', loadInv); on('stock_log', loadInv); on('purchase_requests', loadInv); }
    if (can('boiler')) on('keys', loadKeys);
    if (can('tasks')) on('subsystems', loadSubs);
    on('notifications', loadNotifs);
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [realRole, loadFinance, loadDocs, loadInv, loadKeys, loadSubs, loadNotifs]); // eslint-disable-line

  // Every write below returns true when it worked, so a form can stay open (and keep what was typed) when it fails.
  // ---- finance ----
  const addTxn = async (t) => {
    try {
      const receipt_path = t.receiptFile ? await upload(t.receiptFile, 'finance') : null;
      const { error } = await supabase.from('transactions').insert({ name: t.name, amount: t.amt, txn_date: todayISO(), account: t.account, tag: t.tag, note: t.note || '', receipt_path });
      if (error) throw error;
      buzz([14, 30, 18]); say('Transaction added'); await loadFinance(); return true;
    } catch (e) { return fail(e, 'Could not add the transaction'); }
  };
  const updateTxn = async (id, p) => {
    try {
      const patch = { name: p.name, amount: p.amt, account: p.account, tag: p.tag, note: p.note || '' };
      if (p.receiptFile) patch.receipt_path = await upload(p.receiptFile, 'finance');
      const { data, error } = await supabase.from('transactions').update(patch).eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      say('Changes saved'); await loadFinance(); return true;
    } catch (e) { return fail(e, 'Could not save the changes'); }
  };
  const deleteTxn = async (id) => {
    try {
      const t = txns.find((x) => x.id === id);
      // Deleting a reimbursement payment puts its claim back to approved.
      if (t?.reimbId) { const r = await supabase.from('reimbursements').update({ status: 'approved' }).eq('id', t.reimbId); if (r.error) throw r.error; }
      const { data, error } = await supabase.from('transactions').delete().eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      say('Transaction deleted'); await loadFinance(); return true;
    } catch (e) { return fail(e, 'Could not delete'); }
  };
  const addReimb = async (r) => {
    try {
      const receipt_path = r.receiptFile ? await upload(r.receiptFile, 'finance') : null;
      const { error } = await supabase.from('reimbursements').insert({ who: r.who, what: r.for, amount: r.amt, tag: r.tag, note: r.note || '', receipt_path, requested_on: todayISO() });
      if (error) throw error;
      buzz([14, 30, 18]); say('Reimbursement requested'); await loadFinance(); return true;
    } catch (e) { return fail(e, 'Could not send the request'); }
  };
  // One function for every change to a claim (edit, approve, mark paid, undo paid). Captain only.
  // The database keeps one linked expense in Transactions while a claim is Paid, and removes it when it leaves Paid.
  const updateReimb = async (id, patch, account, msg = 'Changes saved') => {
    try {
      const cur = reimbs.find((x) => x.id === id);
      const f = {};
      if (patch.who !== undefined) f.who = patch.who;
      if (patch.for !== undefined) f.what = patch.for;
      if (patch.amt !== undefined) f.amount = patch.amt;
      if (patch.tag !== undefined) f.tag = patch.tag;
      if (patch.note !== undefined) f.note = patch.note;
      if (patch.receiptFile) f.receipt_path = await upload(patch.receiptFile, 'finance');
      if (Object.keys(f).length) {
        const { data, error } = await supabase.from('reimbursements').update(f).eq('id', id).select('id');
        if (error) throw error; if (!data?.length) throw denied();
      }
      if (patch.status && (patch.status !== cur?.status || (patch.status === 'paid' && account))) {
        const { error } = await supabase.rpc('set_reimbursement_status', { p_id: id, p_status: patch.status, p_account: account || null, p_date: todayISO() });
        if (error) throw error;
      }
      if (patch.status === 'paid' && cur?.status !== 'paid') celebrate('Claim paid');
      say(msg); await loadFinance(); return true;
    } catch (e) { return fail(e, 'Could not save the changes'); }
  };
  // Captain or the person who posted the claim. (The database must enforce this too.)
  const deleteReimb = async (id) => {
    try {
      const { data, error } = await supabase.from('reimbursements').delete().eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      say('Reimbursement deleted'); await loadFinance(); return true;
    } catch (e) { return fail(e, 'Could not delete the reimbursement'); }
  };
  const approveReimb = (id) => updateReimb(id, { status: 'approved' }, undefined, 'Approved');
  const payReimb = (id, account) => updateReimb(id, { status: 'paid' }, account, 'Marked as paid');
  const saveOpening = async (v) => {
    try {
      const value = Object.fromEntries(ACCOUNTS.map((a) => [a.id, +v[a.id] || 0]));
      const { data, error } = await supabase.from('settings').upsert({ key: 'opening', value, updated_at: new Date().toISOString() }).select('key');
      if (error) throw error; if (!data?.length) throw denied();
      setOpening(value); say('Saved'); return true;
    } catch (e) { return fail(e, 'Could not save'); }
  };

  // ---- documents and submissions ----
  const createDoc = async (kind, d, file) => {
    const { data, error } = await supabase.from('documents').insert({ kind, title: d.title, description: d.desc || '', tag: d.tag, due_date: d.due || null, doc_date: todayISO() }).select('id').single();
    if (error) throw error;
    const v = await supabase.from('document_versions').insert({ document_id: data.id, n: 1, file_path: file?.path || null, file_name: file?.name || null,
      file_size: file?.size ?? null, file_type: file?.type || null, link: d.link || '', note: 'First version', version_date: todayISO() });
    if (v.error) { await supabase.from('documents').delete().eq('id', data.id); throw v.error; }
  };
  // alsoSub: also create an independent copy in Submissions (the tick box on a new document).
  const addDoc = async (d, alsoSub = false) => {
    try {
      const file = d.file?.raw ? { path: await upload(d.file.raw, 'documents'), name: d.file.name, size: d.file.size, type: d.file.type } : null;
      await createDoc(d.kind, d, file);
      if (alsoSub) await createDoc('sub', d, file);
      say(alsoSub ? 'Added, and copied to Submissions' : d.kind === 'sub' ? 'Submission added' : 'Document added');
      buzz([14, 30, 18]); await loadDocs(); return true;
    } catch (e) { return fail(e, 'Could not add it'); }
  };
  const updateDoc = async (id, p) => {
    try {
      const { data, error } = await supabase.from('documents').update({ title: p.title, description: p.desc || '', tag: p.tag, due_date: p.due || null }).eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      say('Changes saved'); await loadDocs(); return true;
    } catch (e) { return fail(e, 'Could not save the changes'); }
  };
  const deleteDoc = async (id) => {
    try {
      const { data, error } = await supabase.from('documents').delete().eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      say('Deleted'); await loadDocs(); return true;
    } catch (e) { return fail(e, 'Could not delete'); }
  };
  const addVersion = async (id, v) => {
    try {
      const n = (docs.find((d) => d.id === id)?.versions[0]?.n || 0) + 1;
      const file = v.file?.raw ? { path: await upload(v.file.raw, 'documents'), name: v.file.name, size: v.file.size, type: v.file.type } : null;
      const { error } = await supabase.from('document_versions').insert({ document_id: id, n, file_path: file?.path || null, file_name: file?.name || null,
        file_size: file?.size ?? null, file_type: file?.type || null, link: v.link || '', note: v.note || '', version_date: todayISO() });
      if (error) throw error;
      buzz([14, 30, 18]); say('New version added'); await loadDocs(); return true;
    } catch (e) { return fail(e, 'Could not add the version'); }
  };
  const toggleDone = async (id) => {
    try {
      const d = docs.find((x) => x.id === id); if (!d) return false;
      const { data, error } = await supabase.from('documents').update({ done: !d.done }).eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      if (!d.done) celebrate('Done');
      await loadDocs(); return true;
    } catch (e) { return fail(e, 'Could not update'); }
  };
  const overdueDocs = docs.filter((d) => d.due && !d.done && d.due < todayISO()).length;

  // ---- inventory ----
  const addStock = async (x) => {
    try {
      const photo_path = x.photoFile ? await upload(x.photoFile, 'inventory') : null;
      const { error } = await supabase.from('stock_items').insert({ name: x.name, qty: x.qty, unit: x.unit, min_qty: x.min, tag: x.tag, location: x.loc || '', note: x.note || '', photo_path, item_date: todayISO() });
      if (error) throw error;
      buzz([14, 30, 18]); say('Item added'); await loadInv(); return true;
    } catch (e) { return fail(e, 'Could not add the item'); }
  };
  const updateStock = async (id, p) => {
    try {
      const patch = { name: p.name, qty: p.qty, unit: p.unit, min_qty: p.min, tag: p.tag, location: p.loc || '', note: p.note || '' };
      if (p.photoFile) patch.photo_path = await upload(p.photoFile, 'inventory');
      else if (p.photo === null) patch.photo_path = null; // the photo was removed in the form
      const { data, error } = await supabase.from('stock_items').update(patch).eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      say('Changes saved'); await loadInv(); return true;
    } catch (e) { return fail(e, 'Could not save the changes'); }
  };
  const deleteStock = async (id) => {
    try {
      const { data, error } = await supabase.from('stock_items').delete().eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      say('Item deleted'); await loadInv(); return true;
    } catch (e) { return fail(e, 'Could not delete'); }
  };
  // Anyone with inventory access can take out or add stock. The database does it safely even if two people act at once.
  const adjustStock = async (id, delta, note) => {
    try {
      const { error } = await supabase.rpc('adjust_stock', { p_item: id, p_delta: delta, p_note: note || null });
      if (error) throw error;
      say(delta < 0 ? 'Stock updated' : 'Stock added'); await loadInv(); return true;
    } catch (e) { return fail(e, 'Could not update the stock'); }
  };
  const addReq = async (r) => {
    try {
      const { error } = await supabase.from('purchase_requests').insert({ name: r.name, qty: r.qty, cost: r.cost, tag: r.tag, note: r.note || '', request_date: todayISO() });
      if (error) throw error;
      buzz([14, 30, 18]); say('Request sent'); await loadInv(); return true;
    } catch (e) { return fail(e, 'Could not send the request'); }
  };
  const updateReq = async (id, p, msg = 'Changes saved') => {
    try {
      const patch = {};
      if (p.name !== undefined) patch.name = p.name;
      if (p.qty !== undefined) patch.qty = p.qty;
      if (p.cost !== undefined) patch.cost = p.cost;
      if (p.tag !== undefined) patch.tag = p.tag;
      if (p.note !== undefined) patch.note = p.note;
      if (p.status !== undefined) patch.status = p.status;
      const { data, error } = await supabase.from('purchase_requests').update(patch).eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      say(msg); await loadInv(); return true;
    } catch (e) { return fail(e, 'Could not save the changes'); }
  };
  const deleteReq = async (id) => {
    try {
      const { data, error } = await supabase.from('purchase_requests').delete().eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      say('Request deleted'); await loadInv(); return true;
    } catch (e) { return fail(e, 'Could not delete'); }
  };
  // target: 'none', 'new', or the id of an existing stock item.
  const receiveReq = async (id, target) => {
    try {
      const { error } = await supabase.rpc('receive_request', { p_req: id, p_target: String(target) });
      if (error) throw error;
      celebrate('Received');
      say(target === 'none' ? 'Marked as received' : 'Received and added to stock'); await loadInv(); return true;
    } catch (e) { return fail(e, 'Could not mark it received'); }
  };
  const pendingReqs = reqs.filter((r) => r.status === 'requested').length;

  // ---- boiler room keys ----
  const claimKey = async (n) => {
    try { const { error } = await supabase.rpc('claim_key', { p_n: n }); if (error) throw error; say(`Key ${n} claimed`); await loadKeys(); return true; }
    catch (e) { await loadKeys(); return fail(e, 'Could not claim the key'); }
  };
  const releaseKey = async (n) => {
    try { const { error } = await supabase.rpc('release_key', { p_n: n }); if (error) throw error; say(`Key ${n} released`); await loadKeys(); return true; }
    catch (e) { await loadKeys(); return fail(e, 'Could not release the key'); }
  };

  // ---- subsystems ----
  const addSub = async (s) => {
    try {
      const { error } = await supabase.from('subsystems').insert({ name: s.name, lead: s.lead || '', task: s.task || '', status: s.status, blocked_reason: s.why || '' });
      if (error) throw error;
      buzz([14, 30, 18]); say('Subsystem added'); await loadSubs(); return true;
    } catch (e) { return fail(e, 'Could not add the subsystem'); }
  };
  const updateSub = async (id, s) => {
    try {
      const { data, error } = await supabase.from('subsystems').update({ name: s.name, lead: s.lead || '', task: s.task || '', status: s.status, blocked_reason: s.why || '' }).eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      say('Saved'); await loadSubs(); return true;
    } catch (e) { return fail(e, 'Could not save'); }
  };
  const deleteSub = async (id) => {
    try {
      const { data, error } = await supabase.from('subsystems').delete().eq('id', id).select('id');
      if (error) throw error; if (!data?.length) throw denied();
      say('Subsystem deleted'); await loadSubs(); return true;
    } catch (e) { return fail(e, 'Could not delete'); }
  };

  // ---- announcements ----
  const pushAnnouncement = async (title, body, audience) => {
    try {
      const { error } = await supabase.from('notifications').insert({ title, body, audience });
      if (error) throw error;
      say(`Sent to ${audience}`); await loadNotifs(); return true;
    } catch (e) { return fail(e, 'Could not send the announcement'); }
  };
  const unread = notifs.filter((n) => !n.read).length;
  const markRead = async () => {
    const ids = notifs.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    setNotifs((a) => a.map((n) => ({ ...n, read: true })));
    const { error } = await supabase.from('notif_reads').upsert(ids.map((id) => ({ notification_id: id, user_id: userId })), { onConflict: 'notification_id,user_id', ignoreDuplicates: true });
    if (error) console.error(error);
  };

  const balances = ACCOUNTS.map((a) => ({ ...a, value: opening[a.id] + txns.filter((t) => t.account === a.id).reduce((s, t) => s + t.amt, 0) }));
  const overdue = reimbs.filter((r) => r.status !== 'paid' && daysSince(r.date) > 30).length;
  // What the background reacts to. Overdue reimbursements only count for people who can see finance.
  const attention = (has('finance') ? overdue : 0) + overdueDocs;

  return (
    <Ctx.Provider value={{ openLicence: () => setLicence(true), openGarage: () => setGarage(true),
      alertHue: hue, setAlertHue, preview, previewAlert, celebrate,
      me, userId, userName: user.name, role, realRole, setRole, has, ready, financeReady: ready,
      keys, claimKey, releaseKey, subs, addSub, updateSub, deleteSub,
      txns, addTxn, updateTxn, deleteTxn, canEdit, reimbs, addReimb, updateReimb, deleteReimb, approveReimb, payReimb,
      opening, saveOpening, balances, overdue, attention,
      docs, addDoc, updateDoc, deleteDoc, addVersion, toggleDone, overdueDocs,
      stock, stockLog, addStock, updateStock, deleteStock, adjustStock, receiveReq, reqs, addReq, updateReq, deleteReq, pendingReqs,
      notifs, unread, markRead, pushAnnouncement, order, saveOrder, navItems, sheet, setSheet, toast, say }}>
      {children}
      {flag && <Flag key={flag.id} label={flag.label} onDone={() => setFlag(null)} />}
      {licence && <Licence user={user} role={realRole} onClose={() => setLicence(false)} />}
      {garage && <Garage onClose={() => setGarage(false)} />}
    </Ctx.Provider>
  );
}
