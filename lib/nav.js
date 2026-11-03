// Pages shown in the bottom dock. Add a page here and it appears in everyone's dock
// (after their saved order) if their role has the permission.
export const PAGES = [
  { id: 'home', href: '/', label: 'Home', icon: '⌂', perm: null },
  { id: 'finance', href: '/finance', label: 'Finance', icon: '₹', perm: 'finance' },
  { id: 'inventory', href: '/inventory', label: 'Inventory', icon: '▣', perm: 'inventory' },
  { id: 'sponsors', href: '/sponsors', label: 'Sponsors', icon: '✦', perm: 'sponsors' },
  { id: 'documents', href: '/documents', label: 'Documents', icon: '▤', perm: null },
];
// Demo only. Real enforcement later = Supabase RLS.
export const PERMS = {
  // 'financeTotals' = sees the Income / Expense / Net summary on the finance page.
  Captain: ['finance', 'financeTotals', 'sponsors', 'boiler', 'inventory', 'tasks', 'announce', 'admin'],
  ExComm: ['finance', 'financeTotals', 'sponsors', 'boiler', 'inventory', 'tasks'],
  Management: ['finance', 'financeTotals', 'sponsors', 'inventory'],
  Tech: ['finance', 'boiler', 'inventory', 'tasks'],
};
export const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
