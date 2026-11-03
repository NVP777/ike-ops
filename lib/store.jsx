'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { PAGES, PERMS } from './nav';
import { DOCS, STOCK_LIST, STOCK_LOG, REQUESTS, ACCOUNTS, todayISO, daysSince } from './data';
import { supabase } from './supabase';
import { useAuth } from '@/components/AuthProvider';
import Flag from '@/components/Flag';
import Licence from '@/components/Licence';
import Garage from '@/components/Garage';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const NO_OPENING = { bank: 0, dean: 0, bitsaa: 0 };
const denied = () => Object.assign(new Error('not allowed'), { code: '42501' });

export function AppProvider({ children }) {
  const { user, member } = useAuth();
  const userId = user.id;
  const realRole = member.role; // the role the database enforces
  const me = 'You';             // still used by pages that are not saved to the database yet
  const [role, setRoleState] = useState(realRole); // the role the screen is showing (captain can preview others)
  const setRole = (r) => { if (realRole === 'Captain') setRoleState(r); };
  const [keys, setKeys] = useState([{ n: 1, by: null }, { n: 2, by: 'Aarav Mehta' }, { n: 3, by: null }]);
  const [txns, setTxns] = useState([]);
  const [reimbs, setReimbs] = useState([]);
  const [opening, setOpening] = useState(NO_OPENING);
  const [financeReady, setFinanceReady] = useState(false);
  const [docs, setDocs] = useState(DOCS);
  const [stock, setStock] = useState(STOCK_LIST);
  const [stockLog, setStockLog] = useState(STOCK_LOG);
  const [reqs, setReqs] = useState(REQUESTS);
  const [notifs, setNotifs] = useState([
    { id: 1, t: 'Reimbursement pending', b: 'One claim has waited more than 30 days.', w: '2h ago', read: false, need: 'finance' },
    { id: 2, t: 'Shakedown at 6 pm', b: 'Bring helmets. Chassis team sets up first.', w: 'Yesterday', read: true, need: null },
  ]);
  const [order, setOrder] = useState([]);
  const [sheet, setSheet] = useState(null); // 'notifs' | 'announce' | 'pages' | null
  const [toast, setToast] = useState('');
  const [flag, setFlag] = useState(null);
  const [licence, setLicence] = useState(false); // double-tap your profile
  const [garage, setGarage] = useState(false);   // hold the IKE logo
  // Alert color: a hue (0 to 359) the captain picks. Saved on their account, so it follows them to any device.
  const [hue, setHue] = useState(typeof user.alertHue === 'number' ? user.alertHue : 38);
  const [preview, setPreview] = useState(false);
  const saveTimer = useRef(null), previewTimer = useRef(null);
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
  const celebrate = (label = '') => setFlag({ id: Date.now(), label }); // checkered flag
  const fail = (e, msg) => {
    console.error(msg, e);
    say(e?.code === '42501' || /row-level security|permission denied|not allowed|Only the captain/i.test(e?.message || '')
      ? 'You do not have permission to do that' : `${msg}${e?.message ? `: ${e.message}` : ''}`);
    return false;
  };
  const claimKey = (n) => { setKeys((k) => k.map((x) => (x.n === n ? { ...x, by: me } : x))); say(`Key ${n} claimed`); };
  const releaseKey = (n) => { setKeys((k) => k.map((x) => (x.n === n ? { ...x, by: null } : x))); say(`Key ${n} released`); };

  // ---- finance: saved in the database ----
  // Author edits and deletes their own entries. Captain can edit and delete everything. (The database enforces this too.)
  const canEdit = (t) => role === 'Captain' || (t.authorId ? t.authorId === userId : t.author === me);

  const upload = async (file, folder) => {
    const ext = ((file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin').slice(0, 8);
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; // randomUUID needs https
    const path = `${folder}/${id}.${ext}`;
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

  const loadFinance = useCallback(async () => {
    if (!PERMS[realRole].includes('finance')) { setFinanceReady(true); return; }
    const [t, r, o] = await Promise.all([
      supabase.from('transactions').select('*').order('txn_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('reimbursements').select('*').order('requested_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('settings').select('value').eq('key', 'opening').maybeSingle(),
    ]);
    if (t.error || r.error) { console.error(t.error || r.error); setToast('Could not load finance data'); setFinanceReady(true); return; }
    const urls = await signedUrls([...t.data.map((x) => x.receipt_path), ...r.data.map((x) => x.receipt_path)]);
    setTxns(t.data.map((x) => ({ id: x.id, name: x.name, amt: Number(x.amount), date: x.txn_date, account: x.account, tag: x.tag, note: x.note,
      receipt: x.receipt_path ? urls[x.receipt_path] || null : null, reimbId: x.reimbursement_id, author: x.author_name, authorId: x.author_id })));
    setReimbs(r.data.map((x) => ({ id: x.id, who: x.who, for: x.what, amt: Number(x.amount), tag: x.tag, note: x.note, date: x.requested_on, status: x.status,
      receipt: x.receipt_path ? urls[x.receipt_path] || null : null, author: x.author_name, authorId: x.author_id })));
    if (o.data?.value) setOpening({ ...NO_OPENING, ...o.data.value });
    setFinanceReady(true);
  }, [realRole]);

  useEffect(() => { loadFinance(); }, [loadFinance]);
  // When anyone changes finance data, everyone's screen refreshes.
  useEffect(() => {
    if (!PERMS[realRole].includes('finance')) return;
    // A new name every time: in development React starts this effect twice, and a reused name hands back the old, already-subscribed channel.
    const ch = supabase.channel(`finance-live-${Math.random().toString(36).slice(2)}`);
    ['transactions', 'reimbursements', 'settings'].forEach((table) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => loadFinance()));
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [realRole, loadFinance]);

  // Every write below returns true when it worked, so a form can stay open (and keep what was typed) when it fails.
  const addTxn = async (t) => {
    try {
      const receipt_path = t.receiptFile ? await upload(t.receiptFile, 'finance') : null;
      const { error } = await supabase.from('transactions').insert({ name: t.name, amount: t.amt, txn_date: todayISO(), account: t.account, tag: t.tag, note: t.note || '', receipt_path });
      if (error) throw error;
      say('Transaction added'); await loadFinance(); return true;
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
      say('Reimbursement requested'); await loadFinance(); return true;
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

  // ---- documents and submissions (same edit/delete rule as finance: canEdit) ----
  // alsoSub: also create an independent copy in Submissions (the tick box on a new document).
  const addDoc = (d, alsoSub = false) => {
    const t = Date.now();
    const v = { id: t, n: 1, file: d.file || null, link: d.link || '', note: 'First version', date: todayISO(), author: me };
    const base = { date: todayISO(), author: me, done: false, title: d.title, desc: d.desc, tag: d.tag, due: d.due || '' };
    const items = [{ ...base, id: t, kind: d.kind, versions: [v] }];
    if (alsoSub) items.unshift({ ...base, id: t + 1, kind: 'sub', versions: [{ ...v, id: t + 1 }] });
    setDocs((a) => [...items, ...a]);
    say(alsoSub ? 'Added, and copied to Submissions' : d.kind === 'sub' ? 'Submission added' : 'Document added');
  };
  const addVersion = (id, v) => {
    setDocs((a) => a.map((d) => (d.id === id ? { ...d, versions: [{ id: Date.now(), n: (d.versions[0]?.n || 0) + 1, date: todayISO(), author: me, ...v }, ...d.versions] } : d)));
    say('New version added');
  };
  const toggleDone = (id) => {
    const d = docs.find((x) => x.id === id);
    if (d && !d.done) celebrate('Done');
    setDocs((a) => a.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  };
  const overdueDocs = docs.filter((d) => d.due && !d.done && d.due < todayISO()).length;
  const updateDoc = (id, p) => { setDocs((a) => a.map((d) => (d.id === id ? { ...d, ...p } : d))); say('Changes saved'); };
  const deleteDoc = (id) => { setDocs((a) => a.filter((d) => d.id !== id)); say('Deleted'); };
  // ---- inventory (author edits and deletes their own, captain can edit and delete everything: canEdit) ----
  const logEntry = (stockId, delta, after, note) => ({ id: `${Date.now()}-${Math.random()}`, stockId, delta, after, by: me, at: new Date().toISOString(), note });
  const round = (n) => Math.round(n * 1000) / 1000;
  const addStock = (x) => {
    const id = Date.now();
    setStock((a) => [{ id, date: todayISO(), author: me, ...x }, ...a]);
    setStockLog((l) => [logEntry(id, x.qty, x.qty, 'Added to inventory'), ...l]);
    say('Item added');
  };
  // Changing the quantity in Edit is logged too, so the history always adds up.
  const updateStock = (id, p) => {
    const old = stock.find((x) => x.id === id);
    setStock((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
    if (old && p.qty !== undefined && p.qty !== old.qty) setStockLog((l) => [logEntry(id, round(p.qty - old.qty), p.qty, 'Corrected in edit'), ...l]);
    say('Changes saved');
  };
  const deleteStock = (id) => { setStock((a) => a.filter((x) => x.id !== id)); setStockLog((l) => l.filter((e) => e.stockId !== id)); say('Item deleted'); };
  // Anyone can take out or add stock. delta is negative for take out.
  const adjustStock = (id, delta, note) => {
    const s = stock.find((x) => x.id === id); if (!s) return;
    const after = round(s.qty + delta);
    setStock((a) => a.map((x) => (x.id === id ? { ...x, qty: after } : x)));
    setStockLog((l) => [logEntry(id, delta, after, note), ...l]);
    say(delta < 0 ? 'Stock updated' : 'Stock added');
  };
  const addReq = (r) => { setReqs((a) => [{ id: Date.now(), date: todayISO(), author: me, status: 'requested', ...r }, ...a]); say('Request sent'); };
  const updateReq = (id, p, msg = 'Changes saved') => { setReqs((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x))); say(msg); };
  const deleteReq = (id) => { setReqs((a) => a.filter((x) => x.id !== id)); say('Request deleted'); };
  // target: 'none', 'new', or the id of an existing stock item.
  const receiveReq = (id, target) => {
    const r = reqs.find((x) => x.id === id); if (!r) return;
    setReqs((a) => a.map((x) => (x.id === id ? { ...x, status: 'received' } : x)));
    const note = `Received (requested by ${r.author})`;
    if (target === 'new') {
      const sid = Date.now();
      setStock((a) => [{ id: sid, name: r.name, qty: r.qty, unit: 'pcs', min: null, tag: r.tag, loc: '', note: '', photo: null, author: me, date: todayISO() }, ...a]);
      setStockLog((l) => [logEntry(sid, r.qty, r.qty, note), ...l]);
    } else if (target !== 'none') {
      const s = stock.find((x) => String(x.id) === String(target));
      if (s) { const after = round(s.qty + r.qty); setStock((a) => a.map((x) => (x.id === s.id ? { ...x, qty: after } : x))); setStockLog((l) => [logEntry(s.id, r.qty, after, note), ...l]); }
    }
    celebrate('Received');
    say(target === 'none' ? 'Marked as received' : 'Received and added to stock');
  };
  const pendingReqs = reqs.filter((r) => r.status === 'requested').length;
  const balances = ACCOUNTS.map((a) => ({ ...a, value: opening[a.id] + txns.filter((t) => t.account === a.id).reduce((s, t) => s + t.amt, 0) }));
  const overdue = reimbs.filter((r) => r.status !== 'paid' && daysSince(r.date) > 30).length;
  // What the background reacts to. Overdue reimbursements only count for people who can see finance.
  const attention = (has('finance') ? overdue : 0) + overdueDocs;

  const pushAnnouncement = (t, b, count) => {
    setNotifs((n) => [{ id: Date.now(), t, b: b || 'No details.', w: 'Just now', read: false, need: null }, ...n]);
    say(`Sent to ${count} people`);
  };
  const visible = notifs.filter((n) => !n.need || has(n.need));
  const unread = visible.filter((n) => !n.read).length;
  const markRead = () => setNotifs((n) => n.map((x) => ({ ...x, read: true })));

  return (
    <Ctx.Provider value={{ openLicence: () => setLicence(true), openGarage: () => setGarage(true), alertHue: realRole === 'Captain' ? hue : 38, setAlertHue, preview, previewAlert, celebrate, me, userId, userName: user.name, role, realRole, setRole, has, keys, claimKey, releaseKey, financeReady,
      txns, addTxn, updateTxn, deleteTxn, canEdit, reimbs, addReimb, updateReimb, approveReimb, payReimb,
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
