'use client';
import { useState } from 'react';
import Sheet from '@/components/Sheet';
import CarLoader from '@/components/CarLoader';
import { useApp } from '@/lib/store';
import { fmtDate, daysSince, todayISO, TAGS } from '@/lib/data';

const SORTS = { new: 'Newest first', old: 'Oldest first', due: 'Deadline, soonest', az: 'Title A to Z', za: 'Title Z to A' };
const cmp = {
  new: (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  old: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.id - a.id,
  az: (a, b) => a.title.localeCompare(b.title),
  za: (a, b) => b.title.localeCompare(a.title),
};
const DEF = { tag: 'all', who: 'all', dl: 'all', sort: 'new' };
const WORDS = { doc: ['document', 'Documents'], sub: ['submission', 'Submissions'] };

const fmtSize = (n) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
const isImage = (f) => /^image\//.test(f.type || '') || /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(f.name);
// Only web links. Anything else gets https:// put in front, so it cannot run as a script.
const fixLink = (s) => { const t = s.trim(); if (!t) return ''; return /^https?:\/\//i.test(t) ? t : `https://${t}`; };
const host = (u) => { try { return new URL(u).host; } catch { return u; } };
const isOver = (d) => !!d.due && !d.done && d.due < todayISO();
const dueLabel = (d) => {
  if (!d.due) return null;
  if (d.done) return ['Done', 'green'];
  const left = -daysSince(d.due);
  if (left < 0) return [`Overdue by ${-left} day${left < -1 ? 's' : ''}`, 'redt'];
  if (left === 0) return ['Due today', 'amber'];
  return [`Due ${fmtDate(d.due)}`, ''];
};
const attachText = (v) => (v?.file && v?.link ? 'File + link' : v?.file ? 'File' : v?.link ? 'Link' : null);

function AttachFields({ file, setFile, link, setLink }) {
  return (
    <>
      <label htmlFor="a1">File (optional)</label>
      <input id="a1" type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile({ name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f), raw: f }); }} />
      {file && <div className="m" style={{ marginTop: 8 }}>{file.name} ({fmtSize(file.size)})</div>}
      <label htmlFor="a2">Link (optional)</label>
      <input id="a2" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} />
    </>
  );
}

// Add (new item) and edit (title, description, tag, deadline). Files and links of an existing item go through versions.
function DocSheet({ kind, initial, onClose, onSave }) {
  const { say } = useApp();
  const isNew = !initial;
  const [title, setTitle] = useState(initial?.title || '');
  const [desc, setDesc] = useState(initial?.desc || '');
  const [tag, setTag] = useState(initial?.tag || 'Miscellaneous');
  const [due, setDue] = useState(initial?.due || '');
  const [file, setFile] = useState(null); const [link, setLink] = useState(''); const [copy, setCopy] = useState(false);
  const save = () => {
    if (!title.trim()) return say('Add a title');
    const base = { title: title.trim(), desc: desc.trim(), tag, due };
    onSave(isNew ? { ...base, kind, file, link: fixLink(link), copy } : base);
  };
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">{isNew ? `Add ${WORDS[kind][0]}` : `Edit ${WORDS[kind][0]}`}</h1>
      <label htmlFor="d1">Title</label><input id="d1" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor="d2">Description (optional)</label><textarea id="d2" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div className="fgrid">
        <div><label htmlFor="d3">Tag</label><select id="d3" value={tag} onChange={(e) => setTag(e.target.value)}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label htmlFor="d5">Deadline (optional)</label><input id="d5" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
      </div>
      {isNew && <AttachFields file={file} setFile={setFile} link={link} setLink={setLink} />}
      {isNew && kind === 'doc' && (
        <label className="chk" htmlFor="d6"><input id="d6" type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} /><span>Also add a copy to Submissions</span></label>
      )}
      <div className="two"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn grow" onClick={save}>{isNew ? 'Save' : 'Save changes'}</button></div>
    </Sheet>
  );
}

function VersionSheet({ next, onClose, onSave }) {
  const { say } = useApp();
  const [note, setNote] = useState(''); const [file, setFile] = useState(null); const [link, setLink] = useState('');
  const save = () => {
    if (!file && !link.trim()) return say('Attach a file or a link');
    onSave({ file, link: fixLink(link), note: note.trim() || `Version ${next}` });
  };
  return (
    <Sheet onClose={onClose}>
      <h1 className="sh">New version (v{next})</h1>
      <label htmlFor="v1">What changed (optional)</label><input id="v1" value={note} onChange={(e) => setNote(e.target.value)} />
      <AttachFields file={file} setFile={setFile} link={link} setLink={setLink} />
      <div className="m" style={{ marginTop: 8 }}>The previous version stays in the history.</div>
      <div className="two"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn grow" onClick={save}>Save version</button></div>
    </Sheet>
  );
}

const A = { display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 10 };

export default function Documents() {
  const { me, ready, docs, addDoc, updateDoc, deleteDoc, addVersion, toggleDone, canEdit } = useApp();
  const [tab, setTab] = useState('doc');
  const [q, setQ] = useState(''); const [f, setF] = useState(DEF); const [showF, setShowF] = useState(false);
  const [adding, setAdding] = useState(false); const [edit, setEdit] = useState(null); const [viewId, setViewId] = useState(null); const [newVer, setNewVer] = useState(false);
  const [viewer, setViewer] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const needle = q.trim().toLowerCase();
  const inTab = docs.filter((d) => d.kind === tab);
  const list = inTab.filter((d) => {
    const c = d.versions[0];
    return (!needle || `${d.title} ${d.desc || ''} ${d.author} ${d.tag} ${c?.file?.name || ''} ${c?.link || ''}`.toLowerCase().includes(needle)) &&
      (f.tag === 'all' || d.tag === f.tag) && (f.who === 'all' || d.authorId === me) &&
      (f.dl === 'all' || (f.dl === 'over' ? isOver(d) : !!d.due));
  }).sort(cmp[f.sort]);
  const active = ['tag', 'who', 'dl'].filter((k) => f[k] !== DEF[k]).length;
  const vd = docs.find((d) => d.id === viewId);
  const cur = vd?.versions[0];
  const n = (k) => docs.filter((d) => d.kind === k).length;
  const del = () => { if (window.confirm(`Delete this ${WORDS[vd.kind][0]} and all its versions? This cannot be undone.`)) { deleteDoc(vd.id); setViewId(null); } };

  return (
    <>
      <h1>Documents</h1>
      <div className="glass seg" style={{ marginTop: 18 }}>
        <button className={tab === 'doc' ? 'on' : ''} onClick={() => setTab('doc')}>Documents ({n('doc')})</button>
        <button className={tab === 'sub' ? 'on' : ''} onClick={() => setTab('sub')}>Submissions ({n('sub')})</button>
      </div>

      <div className="srow">
        <input aria-label={`Search ${WORDS[tab][1].toLowerCase()}`} placeholder="Search title, notes, person" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn ghost" onClick={() => setShowF((s) => !s)}>Filters{active > 0 && ` (${active})`}</button>
        <button className="btn" onClick={() => setAdding(true)}>Add</button>
      </div>
      {showF && (
        <div className="glass" style={{ padding: 16, marginBottom: 10 }}>
          <div className="fgrid">
            <div><label htmlFor="g1">Tag</label><select id="g1" value={f.tag} onChange={set('tag')}><option value="all">All</option>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label htmlFor="g2">Added by</label><select id="g2" value={f.who} onChange={set('who')}><option value="all">Everyone</option><option value="me">Me</option></select></div>
            <div><label htmlFor="g4">Deadline</label><select id="g4" value={f.dl} onChange={set('dl')}><option value="all">All</option><option value="has">Has a deadline</option><option value="over">Overdue</option></select></div>
            <div><label htmlFor="g3">Sort by</label><select id="g3" value={f.sort} onChange={set('sort')}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <button className="btn ghost full" style={{ marginTop: 14 }} onClick={() => { setF(DEF); setQ(''); }}>Clear all</button>
        </div>
      )}
      <div className="cnt"><span className="m">{list.length === inTab.length ? `${list.length} ${WORDS[tab][1].toLowerCase()}` : `${list.length} of ${inTab.length} shown`}</span></div>

      <div className="glass pad">
        {list.length === 0 && <div className="empty">{ready ? (inTab.length ? 'Nothing matches.' : 'Nothing here yet. Tap Add to start.') : <CarLoader />}</div>}
        {list.map((d) => {
          const dl = dueLabel(d), at = attachText(d.versions[0]);
          return (
            <div className="row click" key={d.id} role="button" tabIndex={0} onClick={() => setViewId(d.id)} onKeyDown={(e) => e.key === 'Enter' && setViewId(d.id)}>
              <div className="grow">
                <div className="t">{d.title}</div>
                <div className="m" suppressHydrationWarning>{fmtDate(d.date)}, {d.tag}, {d.author}</div>
                {dl && <div className={`m ${dl[1]}`} suppressHydrationWarning>{dl[0]}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {at && <span className="tag">{at}</span>}
                {d.versions.length > 1 && <div className="m" style={{ marginTop: 4 }}>v{d.versions[0].n}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {adding && <DocSheet kind={tab} onClose={() => setAdding(false)} onSave={async (d) => { if (await addDoc(d, !!d.copy)) setAdding(false); }} />}
      {edit && <DocSheet kind={edit.kind} initial={edit} onClose={() => setEdit(null)} onSave={async (d) => { if (await updateDoc(edit.id, d)) setEdit(null); }} />}
      {viewer && (
        <Sheet onClose={() => setViewer(null)}>
          <h1 className="sh">{viewer.title}</h1>
          <div className="m" style={{ marginTop: 4 }}>{viewer.file.name}</div>
          <img className="viewer" src={viewer.file.url} alt={viewer.file.name} />
          <div className="two">
            <a className="btn grow" href={viewer.file.url} download={viewer.file.name}>Download</a>
            <button className="btn ghost grow" onClick={() => setViewer(null)}>Close</button>
          </div>
        </Sheet>
      )}
      {newVer && vd && <VersionSheet next={(cur?.n || 0) + 1} onClose={() => setNewVer(false)} onSave={async (v) => { if (await addVersion(vd.id, v)) setNewVer(false); }} />}

      {vd && !newVer && !viewer && (
        <Sheet onClose={() => setViewId(null)}>
          <h1 className="sh">{vd.title}</h1>
          <div className="m" style={{ marginTop: 8 }} suppressHydrationWarning>{fmtDate(vd.date)}, {vd.tag}</div>
          <div className="m" style={{ marginTop: 4 }}>Added by {vd.author}</div>
          {dueLabel(vd) && <div className={`m ${dueLabel(vd)[1]}`} style={{ marginTop: 4 }} suppressHydrationWarning>Deadline: {fmtDate(vd.due)} ({dueLabel(vd)[0]})</div>}
          {vd.due && canEdit(vd) && <button className="btn ghost full" style={{ marginTop: 12 }} onClick={() => toggleDone(vd.id)}>{vd.done ? 'Mark as not done' : 'Mark as done'}</button>}

          <div className="m" style={{ margin: '18px 0 6px' }}>Description</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{vd.desc || <span className="m">No description.</span>}</div>

          <div className="m" style={{ margin: '18px 0 6px' }}>Current version (v{cur?.n})</div>
          {!cur?.file && !cur?.link && <span className="m">Nothing attached yet.</span>}
          {cur?.file && (<>
            <div>{cur.file.name} <span className="m">({fmtSize(cur.file.size)})</span></div>
            <div className="two" style={{ marginTop: 10 }}>
              {isImage(cur.file) && <button className="btn grow" onClick={() => setViewer({ file: cur.file, title: vd.title })}>View</button>}
              <a className="btn ghost grow" href={cur.file.url} download={cur.file.name}>Download</a>
            </div>
          </>)}
          {cur?.link && <a className="btn ghost full" style={A} href={cur.link} target="_blank" rel="noreferrer">Open link: {host(cur.link)}</a>}
          {canEdit(vd) && <button className="btn ghost full" style={{ marginTop: 10 }} onClick={() => setNewVer(true)}>Upload a new version</button>}

          {vd.versions.length > 1 && (<>
            <div className="m" style={{ margin: '18px 0 6px' }}>Earlier versions</div>
            {vd.versions.slice(1).map((v) => (
              <div key={v.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                <div className="t">v{v.n}, <span suppressHydrationWarning>{fmtDate(v.date)}</span>, {v.author}</div>
                <div className="m">{v.note}</div>
                {v.file && (
                  <div>{v.file.name} <span className="m">({fmtSize(v.file.size)})</span>{' '}
                    {isImage(v.file) && <button className="lnk" onClick={() => setViewer({ file: v.file, title: `${vd.title}, v${v.n}` })}>View</button>}{' '}
                    <a className="lnk" href={v.file.url} download={v.file.name} style={{ textDecoration: 'none' }}>Download</a>
                  </div>
                )}
                {v.link && <a className="lnk" style={{ display: 'block' }} href={v.link} target="_blank" rel="noreferrer">{host(v.link)}</a>}
              </div>
            ))}
          </>)}

          {canEdit(vd) && (
            <div className="two" style={{ marginTop: 20 }}>
              <button className="btn ghost grow" onClick={() => { setEdit(vd); setViewId(null); }}>Edit</button>
              <button className="btn ghost grow" style={{ color: 'var(--red2)' }} onClick={del}>Delete</button>
            </div>
          )}
          <button className="btn full" style={{ marginTop: 12 }} onClick={() => setViewId(null)}>Close</button>
        </Sheet>
      )}
    </>
  );
}
