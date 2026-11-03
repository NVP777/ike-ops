// Reads the sponsor Sheet as CSV. It works because the Sheet is shared as "Anyone with the link: Viewer".
// No Google account, service account, or API key is needed. The app never writes to the Sheet.
export const dynamic = 'force-dynamic';

const norm = (s) => String(s || '').split('(')[0].toLowerCase().replace(/[^a-z]/g, '');
const KEYS = { type: 'type', name: 'name', poc: 'poc', contactno: 'contact', contact: 'contact', email: 'email', linkedin: 'linkedin', updatesofar: 'update' };

// Small CSV parser that handles quoted cells, commas and line breaks inside quotes.
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export async function GET() {
  try {
    const id = process.env.GOOGLE_SHEET_ID;
    if (!id) throw new Error('GOOGLE_SHEET_ID is not set.');

    const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`, { cache: 'no-store' });
    const text = await res.text();
    // If the Sheet isn't shared publicly, Google returns a sign-in page instead of CSV.
    if (!res.ok || text.trim().startsWith('<')) {
      throw new Error('Sheet is not shared as "Anyone with the link: Viewer".');
    }

    const [head = [], ...body] = parseCsv(text);
    const cols = head.map((h) => KEYS[norm(h)] || null);
    const rows = body
      .map((r, i) => {
        const o = { id: i + 2 }; // row number in the Sheet, for reference
        cols.forEach((k, c) => { if (k) o[k] = String(r[c] ?? '').trim(); });
        return o;
      })
      .filter((o) => o.name);

    return Response.json({ rows, updated: new Date().toISOString() });
  } catch (e) {
    console.error('Sponsor sheet read failed:', e?.message);
        if (!rows.length) return Response.json({ rows, headers: head, firstRow: body[0] || [] });
    return Response.json({ rows, updated: new Date().toISOString() });
  }
}