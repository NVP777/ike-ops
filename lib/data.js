// Fixed lists and small helpers only. All real data lives in the database.
export const inr = (n) => (n < 0 ? '−' : '') + '₹' + Math.abs(n).toLocaleString('en-IN');

export const ACCOUNTS = [
  { id: 'bank', label: 'Bank' },
  { id: 'dean', label: 'Dean’s fund' },
  { id: 'bitsaa', label: 'BITSAA' },
];
export const TAGS = ['Elect', 'Mech', 'Management', 'Miscellaneous'];
export const acct = (id) => ACCOUNTS.find((a) => a.id === id)?.label || id;

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const fmtDate = (iso) => {
  if (iso === todayISO()) return 'Today';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const daysSince = (iso) => {
  const [y, m, d] = iso.split('-').map(Number), n = new Date();
  return Math.floor((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(y, m - 1, d)) / 86400000);
};
// "28 Oct 2026, 3:45 pm" in the viewer's own time zone.
export const fmtStamp = (at) => {
  const d = new Date(at);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${fmtDate(iso)}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};
// "5 min ago", "3h ago", "Yesterday"
export const ago = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
};
