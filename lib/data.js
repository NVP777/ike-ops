// Mock data. Replace each export with a Supabase query later.
export const NAME = 'Local Demo Operator';
export const EMAIL = 'demo@local.invalid';
export const inr = (n) => (n < 0 ? '−' : '') + '₹' + Math.abs(n).toLocaleString('en-IN');

export const ACCOUNTS = [
  { id: 'bank', label: 'Bank' },
  { id: 'dean', label: 'Dean’s fund' },
  { id: 'bitsaa', label: 'BITSAA' },
];
export const TAGS = ['Elect', 'Mech', 'Management', 'Miscellaneous'];
export const OPENING = { bank: 100000, dean: 20000, bitsaa: 30000 };
export const acct = (id) => ACCOUNTS.find((a) => a.id === id)?.label || id;

export const TASKS = [
  { n: 'Aarav Mehta', s: 'Chassis', d: 'Validate mounting points for the next test session.' },
  { n: 'Local Demo', s: 'Powertrain', d: 'Inspect the drivetrain after the latest shakedown.' },
  { n: 'Riya Shah', s: 'Aerodynamics', d: 'Finalize the wing mounting template.', why: 'Waiting for the updated CAD reference.' },
];
export const STOCK = [['Hex bolts M8', '120 in stock'], ['Brake fluid DOT 4', '3 bottles'], ['Zip ties', 'Low: 15 left']];
export const BUY = [['Steering rack', 'Awaiting approval'], ['Slick tyres, set of 4', 'Awaiting approval']];
export const LEADS = [['Bosch', 'Intro call booked', '₹2,00,000'], ['Tata Elxsi', 'Proposal sent', '₹1,50,000'], ['Local dealership', 'New lead', '₹40,000']];

// author 'You' = the logged-in demo user. Others belong to other people.
export const TXN = [
  { id: 1, name: 'Brake pads, 4 sets', amt: -6400, date: '2026-10-26', account: 'bank', tag: 'Mech', author: 'You', note: 'Front axle set. Bill is with the treasurer.', receipt: null },
  { id: 2, name: 'Dean’s fund release', amt: 50000, date: '2026-10-19', account: 'dean', tag: 'Management', author: 'Aarav Mehta', note: '', receipt: null },
  { id: 3, name: 'Welding rods', amt: -2150, date: '2026-10-17', account: 'bank', tag: 'Mech', author: 'You', note: '', receipt: null },
  { id: 4, name: 'Alumni donation', amt: 12000, date: '2026-10-15', account: 'bitsaa', tag: 'Miscellaneous', author: 'Riya Shah', note: 'Batch of 2019.', receipt: null },
  { id: 5, name: 'Printing, sponsor deck', amt: -780, date: '2026-10-14', account: 'bank', tag: 'Management', author: 'Aarav Mehta', note: '', receipt: null },
  { id: 6, name: 'Wiring loom', amt: -3200, date: '2026-10-10', account: 'bank', tag: 'Elect', author: 'Riya Shah', note: '', receipt: null },
];
// status: requested -> approved -> paid
export const REIMB = [
  { id: 1, who: 'Aarav Mehta', for: 'Fuel for test run', amt: 1800, tag: 'Mech', date: '2026-09-12', status: 'requested', receipt: null, note: '' },
  { id: 2, who: 'Riya Shah', for: 'Wing template printing', amt: 950, tag: 'Miscellaneous', date: '2026-10-20', status: 'approved', receipt: null, note: '' },
];

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

// kind: 'doc' (Documents tab) or 'sub' (Submissions tab).
// versions are newest first. Each: { id, n, file: {name,size,url}|null, link, note, date, author }.
// due: ISO date or ''. done: marks a deadline as handled.
export const DOCS = [
  { id: 1, kind: 'doc', title: 'Team rulebook 2026', desc: 'Official rules for the season: scrutineering, conduct, and safety.', tag: 'Management', author: 'Aarav Mehta', date: '2026-09-02', due: '', done: false,
    versions: [
      { id: 11, n: 2, file: null, link: 'https://example.com/rulebook-2026', note: 'Added the safety section', date: '2026-09-20', author: 'Aarav Mehta' },
      { id: 10, n: 1, file: null, link: '', note: 'First version', date: '2026-09-02', author: 'Aarav Mehta' },
    ] },
  { id: 2, kind: 'doc', title: 'Wiring harness diagram', desc: 'Latest revision of the kart loom layout.', tag: 'Elect', author: 'Riya Shah', date: '2026-10-05', due: '', done: false,
    versions: [{ id: 20, n: 1, file: null, link: '', note: 'First version', date: '2026-10-05', author: 'Riya Shah' }] },
  { id: 3, kind: 'doc', title: 'Chassis build checklist', desc: 'Step-by-step checklist before every test session.', tag: 'Mech', author: 'You', date: '2026-10-12', due: '', done: false,
    versions: [{ id: 30, n: 1, file: null, link: '', note: 'First version', date: '2026-10-12', author: 'You' }] },
  { id: 4, kind: 'sub', title: 'Test session report, 24 Oct', desc: 'Lap times, tyre wear, and issues found.', tag: 'Mech', author: 'You', date: '2026-10-25', due: '2026-10-30', done: false,
    versions: [{ id: 40, n: 1, file: null, link: '', note: 'First version', date: '2026-10-25', author: 'You' }] },
  { id: 5, kind: 'sub', title: 'Sponsor deck draft v2', desc: 'Updated numbers and a new layout, ready for review.', tag: 'Management', author: 'Aarav Mehta', date: '2026-10-21', due: '2026-10-24', done: false,
    versions: [{ id: 50, n: 1, file: null, link: 'https://example.com/sponsor-deck', note: 'First version', date: '2026-10-21', author: 'Aarav Mehta' }] },
];

// Inventory. min = alert level (null = no alert). status of a request: requested, approved, rejected, received.
export const STOCK_LIST = [
  { id: 1, name: 'Hex bolts M8', qty: 120, unit: 'pcs', min: 40, tag: 'Mech', loc: 'Shelf A2', note: 'Stainless, 30 mm.', author: 'You', date: '2026-09-10' },
  { id: 2, name: 'Brake fluid DOT 4', qty: 3, unit: 'bottles', min: 2, tag: 'Mech', loc: 'Cabinet 1', note: '', author: 'Aarav Mehta', date: '2026-09-18' },
  { id: 3, name: 'Zip ties', qty: 15, unit: 'pcs', min: 50, tag: 'Miscellaneous', loc: 'Drawer B', note: '', author: 'Riya Shah', date: '2026-10-02' },
  { id: 4, name: 'Crimp terminals', qty: 200, unit: 'pcs', min: 100, tag: 'Elect', loc: 'Shelf C1', note: 'Assorted sizes.', author: 'Riya Shah', date: '2026-10-08' },
];
export const REQUESTS = [
  { id: 1, name: 'Steering rack', qty: 1, cost: 18000, tag: 'Mech', note: 'Current one has play.', status: 'requested', author: 'Riya Shah', date: '2026-10-22' },
  { id: 2, name: 'Slick tyres, set of 4', qty: 4, cost: 32000, tag: 'Mech', note: 'For the November track day.', status: 'requested', author: 'You', date: '2026-10-24' },
  { id: 3, name: 'Battery connectors', qty: 10, cost: 600, tag: 'Elect', note: '', status: 'approved', author: 'Aarav Mehta', date: '2026-10-18' },
  { id: 4, name: 'Hex bolts M8', qty: 100, cost: 450, tag: 'Mech', note: '', status: 'received', author: 'You', date: '2026-10-01' },
];

// Stock activity log. delta: + added, - taken out. after: quantity after the change.
export const STOCK_LOG = [
  { id: 'l1', stockId: 1, delta: 150, after: 150, by: 'You', at: '2026-09-10T11:00:00', note: 'Added to inventory' },
  { id: 'l2', stockId: 1, delta: -30, after: 120, by: 'Aarav Mehta', at: '2026-10-05T16:20:00', note: 'Chassis build' },
  { id: 'l3', stockId: 2, delta: 4, after: 4, by: 'Aarav Mehta', at: '2026-09-18T12:00:00', note: 'Added to inventory' },
  { id: 'l4', stockId: 2, delta: -1, after: 3, by: 'You', at: '2026-10-12T10:15:00', note: 'Brake bleed' },
  { id: 'l5', stockId: 3, delta: 60, after: 60, by: 'Riya Shah', at: '2026-10-02T09:30:00', note: 'Added to inventory' },
  { id: 'l6', stockId: 3, delta: -45, after: 15, by: 'Riya Shah', at: '2026-10-20T17:45:00', note: 'Wiring job' },
  { id: 'l7', stockId: 4, delta: 200, after: 200, by: 'Riya Shah', at: '2026-10-08T14:00:00', note: 'Added to inventory' },
];
// "28 Oct 2026, 3:45 pm" in the viewer's own time zone.
export const fmtStamp = (at) => {
  const d = new Date(at);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${fmtDate(iso)}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};