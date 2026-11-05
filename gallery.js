/* ============================================================
   SHARED GALLERY — Google-Photos-style album on Vercel Blob
   Upload photos & videos (direct to storage), browse by date,
   full-screen viewer, share links, download, delete, multi-select.
   ============================================================ */

const API = '/api';
// Browser build of the Vercel Blob client (matches package.json ^0.27).
const BLOB_CLIENT = 'https://cdn.jsdelivr.net/npm/@vercel/blob@0.27.3/dist/client.js/+esm';
const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const MULTIPART_OVER = 50 * 1024 * 1024;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp|mkv|avi|ogv)$/i;

const STATIC = [
  ['images/bhimakali.jpg', 'Bhimakali Temple, Sarahan'],
  ['images/chitkul.jpg', "Chitkul — India's Last Village"],
  ['images/baspa-valley.jpg', 'Baspa Valley from ITBP Camp'],
  ['images/kinnaur-gate.jpg', 'Kinnaur Gate'],
  ['images/kinner-kailash.jpg', 'Kinner Kailash Sacred Peaks'],
  ['images/kalpa.jpg', 'Kalpa Village'],
  ['images/roghi.jpg', 'Roghi Suicide Point, Kalpa'],
  ['images/sangla.jpg', 'Sangla Valley'],
  ['images/night-bus.jpg', 'Overnight Mountain Journey'],
].map(([src, caption]) => ({
  id: 'highlight:' + src, url: src, downloadUrl: src, thumb: src, name: caption,
  type: 'image', remote: false, size: 0, uploadedAt: null,
}));

const $ = id => document.getElementById(id);
const toast = (m, t = 'info', d) => (typeof Toast !== 'undefined' ? Toast.show(m, t, d) : console.log(m));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtBytes = b => (b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB'
  : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const typeOf = name => (VIDEO_EXT.test(name) ? 'video' : 'image');
const displayName = pathname => pathname.replace(/^gallery\//, '').replace(/-[A-Za-z0-9]{16,}(?=\.[^.]+$)/, '');

const el = {
  root: $('gp'), groups: $('gpGroups'), stats: $('gpStats'), input: $('gpInput'), uploads: $('gpUploads'),
  drop: $('gpDrop'), selToggle: $('gpSelectToggle'), selbar: $('gpSelbar'), selCount: $('gpSelCount'),
  viewer: $('gpViewer'), vStage: $('gpVStage'), vTitle: $('gpVTitle'), vSub: $('gpVSub'), vDownload: $('gpVDownload'),
  info: $('gpInfo'), confirm: $('gpConfirm'),
};
if (!el.root) throw new Error('gallery markup missing');

const state = {
  remote: [], filter: 'all', selecting: false, selected: new Set(),
  online: location.protocol !== 'file:', error: null, loaded: false, uploading: 0, viewIdx: -1,
  // the album list is CDN-cached for ~1 min, so remember our own recent changes and re-apply them
  added: new Map(), deleted: new Set(),
};
const RECENT_MS = 15 * 60 * 1000;

const allItems = () => [...state.remote, ...STATIC];
const visible = () => allItems().filter(i => state.filter === 'all' || i.type === state.filter);
const byId = id => allItems().find(i => i.id === id);

/* ── Data ─────────────────────────────────────────────── */
async function refresh(quiet) {
  if (!state.online) { state.loaded = true; render(); return; }
  try {
    const r = await fetch(`${API}/list`, { cache: 'no-store' });
    const j = await r.json();
    if (!j.success) throw new Error(j.error || 'Album storage is not connected');
    const local = new Map(state.remote.map(i => [i.id, i]));
    const listed = j.items
      .filter(b => !state.deleted.has(b.pathname))
      .map(b => ({
        id: b.pathname, url: b.url, downloadUrl: b.downloadUrl, size: b.size, uploadedAt: b.uploadedAt,
        thumb: b.thumb || local.get(b.pathname)?.thumb || null,
        name: displayName(b.pathname), type: typeOf(b.pathname), remote: true,
      }));
    // keep our own just-uploaded items until the cached list catches up
    const have = new Set(listed.map(i => i.id));
    const now = Date.now();
    const mine = [...state.added.values()].filter(a => now - a.t < RECENT_MS && !have.has(a.item.id)).map(a => a.item);
    state.remote = [...mine, ...listed];
    state.error = null;
  } catch (e) {
    state.error = e.message;
    if (!quiet) console.warn('Gallery list failed:', e);
  }
  state.loaded = true;
  render();
}

/* ── Rendering ────────────────────────────────────────── */
function dayLabel(iso) {
  const d = new Date(iso), today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function tileHTML(it) {
  const sel = state.selected.has(it.id);
  const media = it.type === 'video' && !it.thumb
    ? `<video src="${esc(it.url)}#t=0.5" preload="metadata" muted playsinline></video>`
    : `<img src="${esc(it.thumb || it.url)}" alt="${esc(it.name)}" loading="lazy" decoding="async">`;
  return `<div class="gp-tile${sel ? ' is-selected' : ''}" data-id="${esc(it.id)}" role="button" tabindex="0" aria-label="${esc(it.name)}">
    ${media}
    ${it.type === 'video' ? '<span class="gp-tile__play" aria-hidden="true">▶</span>' : ''}
    <button class="gp-tile__check" type="button" aria-label="Select" aria-pressed="${sel}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></button>
  </div>`;
}

function render() {
  const items = visible();
  const remote = items.filter(i => i.remote);
  const statics = items.filter(i => !i.remote);

  // stats line
  const photos = state.remote.filter(i => i.type === 'image').length;
  const videos = state.remote.filter(i => i.type === 'video').length;
  const bytes = state.remote.reduce((s, i) => s + i.size, 0);
  if (!state.loaded) el.stats.textContent = 'Loading album…';
  else if (!state.online) el.stats.textContent = 'Shared uploads work on the live site (not from a local file).';
  else if (state.error) el.stats.textContent = `Couldn't reach the album: ${state.error}`;
  else el.stats.textContent = `${photos} photo${photos === 1 ? '' : 's'} · ${videos} video${videos === 1 ? '' : 's'} · ${fmtBytes(bytes || 0)} used`;
  el.stats.classList.toggle('is-error', !!(state.error || !state.online));

  // groups by upload day
  const groups = new Map();
  for (const it of remote) {
    const k = dayLabel(it.uploadedAt);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  let html = '';
  if (state.loaded && state.online && !state.error && !remote.length && state.filter !== 'image') {
    html += `<div class="gp-empty"><b>No ${state.filter === 'video' ? 'videos' : 'uploads'} yet</b><span>Be the first — tap Upload or drop files here.</span></div>`;
  }
  for (const [label, list] of groups) {
    html += `<section class="gp-group"><h3 class="gp-date">${esc(label)} <span>${list.length}</span></h3><div class="gp-grid">${list.map(tileHTML).join('')}</div></section>`;
  }
  if (statics.length) {
    html += `<section class="gp-group"><h3 class="gp-date">Trip highlights <span>${statics.length}</span></h3><div class="gp-grid">${statics.map(tileHTML).join('')}</div></section>`;
  }
  el.groups.innerHTML = html;
  updateSelbar();
}

/* ── Selection ────────────────────────────────────────── */
function setSelecting(on) {
  state.selecting = on;
  if (!on) state.selected.clear();
  el.root.classList.toggle('is-selecting', on);
  el.selToggle.textContent = on ? 'Done' : 'Select';
  render();
}
function toggleSel(id) {
  if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
  if (!state.selecting) { state.selecting = true; el.root.classList.add('is-selecting'); el.selToggle.textContent = 'Done'; }
  const t = el.groups.querySelector(`.gp-tile[data-id="${CSS.escape(id)}"]`);
  if (t) {
    t.classList.toggle('is-selected', state.selected.has(id));
    t.querySelector('.gp-tile__check').setAttribute('aria-pressed', state.selected.has(id));
  }
  updateSelbar();
}
function updateSelbar() {
  const n = state.selected.size;
  el.selbar.hidden = n === 0;
  el.selCount.textContent = `${n} selected`;
}
const selectedItems = () => [...state.selected].map(byId).filter(Boolean);

/* ── Actions: share / download / delete ───────────────── */
const linkFor = it => `${location.origin}${location.pathname}#photo=${encodeURIComponent(it.id)}`;

async function share(items) {
  if (!items.length) return;
  const links = items.map(linkFor);
  const isTouch = matchMedia('(hover: none)').matches;
  try {
    if (isTouch && navigator.share) {
      // Try sharing the actual files (WhatsApp/Instagram etc.), fall back to links.
      const small = items.filter(i => i.type === 'image' || i.size < 40 * 1048576);
      if (small.length === items.length && items.length <= 10 && navigator.canShare) {
        try {
          const files = await Promise.all(items.map(async i => {
            const b = await (await fetch(i.url)).blob();
            return new File([b], i.name, { type: b.type });
          }));
          if (navigator.canShare({ files })) { await navigator.share({ files, title: 'Chitkul · Kalpa trip' }); return; }
        } catch (e) { if (e.name === 'AbortError') return; }
      }
      await navigator.share({ title: 'Chitkul · Kalpa trip', text: items.length > 1 ? links.join('\n') : undefined, url: items.length === 1 ? links[0] : undefined });
      return;
    }
    await navigator.clipboard.writeText(links.join('\n'));
    toast(items.length > 1 ? `${items.length} links copied` : 'Link copied — paste it anywhere to share', 'success', 2500);
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    window.prompt('Copy this link:', links.join(' '));
  }
}

function download(items) {
  items.forEach((it, k) => setTimeout(() => {
    const a = document.createElement('a');
    a.href = it.downloadUrl || it.url;
    a.download = it.name;
    a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }, k * 400));
  if (items.length > 1) toast(`Downloading ${items.length} files…`, 'info', 2500);
}

function confirmBox(title, text) {
  return new Promise(res => {
    $('gpConfirmTitle').textContent = title;
    $('gpConfirmText').textContent = text;
    el.confirm.hidden = false;
    const done = v => { el.confirm.hidden = true; ok.removeEventListener('click', y); cancel.removeEventListener('click', n); res(v); };
    const ok = $('gpConfirmOk'), cancel = $('gpConfirmCancel');
    const y = () => done(true), n = () => done(false);
    ok.addEventListener('click', y); cancel.addEventListener('click', n);
    ok.focus();
  });
}

async function remove(items) {
  const deletable = items.filter(i => i.remote);
  if (!deletable.length) { toast('Trip highlights are part of the site and can\'t be deleted.', 'warning'); return false; }
  const n = deletable.length;
  const ok = await confirmBox(`Delete ${n} item${n > 1 ? 's' : ''}?`,
    `This permanently removes ${n > 1 ? 'them' : 'it'} from the shared album for everyone.`);
  if (!ok) return false;
  try {
    const r = await fetch(`${API}/delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: deletable.map(i => i.url) }),
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.error || 'Delete failed');
    const gone = new Set(deletable.map(i => i.id));
    gone.forEach(id => { state.deleted.add(id); state.added.delete(id); });
    state.remote = state.remote.filter(i => !gone.has(i.id));
    gone.forEach(id => state.selected.delete(id));
    render();
    toast(`Deleted ${n} item${n > 1 ? 's' : ''}`, 'success', 2200);
    return true;
  } catch (e) {
    toast(`Couldn't delete: ${e.message}`, 'error', 4000);
    return false;
  }
}

/* ── Uploads ──────────────────────────────────────────── */
let blobClient = null;
const getClient = async () => (blobClient ||= await import(BLOB_CLIENT));
// test hook: lets automated tests replace the network upload
const doUpload = (...a) => (window.__gpUpload ? window.__gpUpload(...a) : getClient().then(m => m.upload(...a)));

async function makeThumb(file) {
  const MAX = 480;
  const toJpeg = (src, w, h) => new Promise(res => {
    const k = Math.min(1, MAX / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    c.toBlob(b => res(b), 'image/jpeg', 0.82);
  });
  if (file.type.startsWith('image/') || !VIDEO_EXT.test(file.name)) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return toJpeg(bmp, bmp.width, bmp.height);
  }
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = rej; setTimeout(rej, 10000); });
    v.currentTime = Math.min(1, (v.duration || 2) / 3);
    await new Promise((res, rej) => { v.onseeked = res; setTimeout(rej, 10000); });
    return toJpeg(v, v.videoWidth, v.videoHeight);
  } finally { URL.revokeObjectURL(url); }
}

function uploadRow(file) {
  const row = document.createElement('div');
  row.className = 'gp-up';
  row.innerHTML = `<span class="gp-up__name">${esc(file.name)}</span><span class="gp-up__size">${fmtBytes(file.size)}</span>
    <div class="gp-up__bar"><i></i></div><span class="gp-up__pct">0%</span>`;
  el.uploads.hidden = false;
  el.uploads.prepend(row);
  return {
    set: p => { row.querySelector('i').style.width = p + '%'; row.querySelector('.gp-up__pct').textContent = Math.round(p) + '%'; },
    done: ok => {
      row.classList.add(ok ? 'is-done' : 'is-failed');
      row.querySelector('.gp-up__pct').textContent = ok ? '✓' : 'Failed';
      setTimeout(() => { row.remove(); if (!el.uploads.children.length) el.uploads.hidden = true; }, ok ? 2500 : 8000);
    },
  };
}

async function uploadOne(file) {
  const ui = uploadRow(file);
  let safe = file.name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_') || 'file';
  if (!/\.[a-z0-9]+$/i.test(safe)) safe += file.type.startsWith('video/') ? '.mp4' : '.jpg';
  try {
    const blob = await doUpload(`gallery/${safe}`, file, {
      access: 'public',
      handleUploadUrl: `${API}/upload`,
      contentType: file.type || undefined,
      multipart: file.size > MULTIPART_OVER,
      onUploadProgress: e => ui.set(e.percentage * 0.95),
    });
    let thumb = null;
    try {
      const t = await makeThumb(file);
      if (t) {
        const tb = await doUpload(`thumbs/${blob.pathname}.jpg`, t, { access: 'public', handleUploadUrl: `${API}/upload`, contentType: 'image/jpeg' });
        thumb = tb.url;
      }
    } catch { /* thumbnail is optional (e.g. HEIC on non-Apple browsers) */ }
    ui.set(100); ui.done(true);
    const item = {
      id: blob.pathname, url: blob.url, downloadUrl: blob.downloadUrl, size: file.size,
      uploadedAt: new Date().toISOString(), thumb, name: displayName(blob.pathname),
      type: file.type.startsWith('video/') || VIDEO_EXT.test(file.name) ? 'video' : 'image', remote: true,
    };
    state.remote.unshift(item);
    state.added.set(item.id, { item, t: Date.now() });
    render();
    return true;
  } catch (e) {
    console.error('Upload failed', e);
    ui.done(false);
    toast(`"${file.name}" failed: ${e.message || 'upload error'}`, 'error', 5000);
    return false;
  }
}

async function handleFiles(fileList) {
  if (!state.online) { toast('Uploading works on the live site — open the deployed link.', 'warning', 4000); return; }
  const files = [...fileList].filter(f => {
    const ok = f.type.startsWith('image/') || f.type.startsWith('video/') || VIDEO_EXT.test(f.name);
    if (!ok) toast(`"${f.name}" isn't a photo or video.`, 'warning');
    else if (f.size > MAX_BYTES) toast(`"${f.name}" is over 2 GB.`, 'error');
    return ok && f.size <= MAX_BYTES;
  });
  if (!files.length) return;
  state.uploading += files.length;
  let okCount = 0, i = 0;
  const worker = async () => { while (i < files.length) { if (await uploadOne(files[i++])) okCount++; } };
  await Promise.all([worker(), worker(), worker()]); // 3 at a time
  state.uploading -= files.length;
  if (okCount) toast(`${okCount} item${okCount > 1 ? 's' : ''} added to the shared album 🎉`, 'success', 3000);
  el.input.value = '';
}

/* ── Viewer ───────────────────────────────────────────── */
function openViewer(id) {
  const list = visible();
  const idx = list.findIndex(i => i.id === id);
  if (idx < 0) return;
  state.viewIdx = idx;
  el.viewer.hidden = false;
  document.body.style.overflow = 'hidden';
  showView();
}
function showView() {
  const list = visible();
  const it = list[state.viewIdx];
  if (!it) return closeViewer();
  el.vStage.innerHTML = it.type === 'video'
    ? `<video src="${esc(it.url)}" controls autoplay playsinline></video>`
    : `<img src="${esc(it.url)}" alt="${esc(it.name)}">`;
  el.vTitle.textContent = it.name;
  el.vSub.textContent = it.uploadedAt ? new Date(it.uploadedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Trip highlight';
  el.vDownload.href = it.downloadUrl || it.url;
  el.vDownload.setAttribute('download', it.name);
  $('gpVDelete').hidden = !it.remote;
  $('gpVPrev').hidden = state.viewIdx === 0;
  $('gpVNext').hidden = state.viewIdx === list.length - 1;
  if (!el.info.hidden) fillInfo(it);
  if (it.remote) history.replaceState(null, '', `#photo=${encodeURIComponent(it.id)}`);
  // preload neighbours
  [list[state.viewIdx + 1], list[state.viewIdx - 1]].forEach(n => { if (n && n.type === 'image') new Image().src = n.url; });
}
function fillInfo(it) {
  const media = el.vStage.firstElementChild;
  const dims = media && (media.naturalWidth || media.videoWidth) ? `${media.naturalWidth || media.videoWidth} × ${media.naturalHeight || media.videoHeight}` : '—';
  el.info.innerHTML = `<h4>Details</h4><dl>
    <dt>Name</dt><dd>${esc(it.name)}</dd>
    <dt>Type</dt><dd>${it.type === 'video' ? 'Video' : 'Photo'}</dd>
    <dt>Size</dt><dd>${it.size ? fmtBytes(it.size) : '—'}</dd>
    <dt>Dimensions</dt><dd>${dims}</dd>
    <dt>Uploaded</dt><dd>${it.uploadedAt ? new Date(it.uploadedAt).toLocaleString() : 'Part of the site'}</dd></dl>`;
}
function step(d) {
  const n = state.viewIdx + d;
  if (n < 0 || n >= visible().length) return;
  state.viewIdx = n; showView();
}
function closeViewer() {
  el.viewer.hidden = true;
  el.vStage.innerHTML = '';
  document.body.style.overflow = '';
  if (location.hash.startsWith('#photo=')) history.replaceState(null, '', location.pathname + location.search);
}

/* ── Events ───────────────────────────────────────────── */
el.input.addEventListener('change', () => handleFiles(el.input.files));
el.selToggle.addEventListener('click', () => setSelecting(!state.selecting));
document.querySelectorAll('.gp-tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.gp-tab').forEach(x => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); });
  state.filter = t.dataset.filter;
  render();
}));

let pressTimer = null, pressedId = null, longPressed = false;
el.groups.addEventListener('pointerdown', e => {
  const t = e.target.closest('.gp-tile'); if (!t) return;
  longPressed = false; pressedId = t.dataset.id;
  pressTimer = setTimeout(() => { longPressed = true; toggleSel(pressedId); navigator.vibrate?.(15); }, 480);
});
['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach(ev => el.groups.addEventListener(ev, e => {
  if (ev === 'pointermove' && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return;
  clearTimeout(pressTimer);
}));
el.groups.addEventListener('click', e => {
  const t = e.target.closest('.gp-tile'); if (!t) return;
  if (longPressed) { longPressed = false; return; }
  const id = t.dataset.id;
  if (e.target.closest('.gp-tile__check') || state.selecting) toggleSel(id);
  else openViewer(id);
});
el.groups.addEventListener('keydown', e => {
  const t = e.target.closest('.gp-tile');
  if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); state.selecting ? toggleSel(t.dataset.id) : openViewer(t.dataset.id); }
});

$('gpSelClear').addEventListener('click', () => setSelecting(false));
$('gpSelShare').addEventListener('click', () => share(selectedItems()));
$('gpSelDownload').addEventListener('click', () => download(selectedItems()));
$('gpSelDelete').addEventListener('click', async () => { if (await remove(selectedItems())) setSelecting(false); });

$('gpVClose').addEventListener('click', closeViewer);
$('gpVPrev').addEventListener('click', () => step(-1));
$('gpVNext').addEventListener('click', () => step(1));
$('gpVShare').addEventListener('click', () => share([visible()[state.viewIdx]]));
$('gpVInfo').addEventListener('click', () => { el.info.hidden = !el.info.hidden; if (!el.info.hidden) fillInfo(visible()[state.viewIdx]); });
$('gpVDelete').addEventListener('click', async () => {
  const it = visible()[state.viewIdx];
  if (await remove([it])) { if (state.viewIdx >= visible().length) state.viewIdx--; visible().length ? showView() : closeViewer(); }
});
document.addEventListener('keydown', e => {
  if (el.viewer.hidden || !el.confirm.hidden) return;
  if (e.key === 'Escape') closeViewer();
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});
// swipe between items on touch screens
let sx = null;
el.vStage.addEventListener('pointerdown', e => { sx = e.clientX; });
el.vStage.addEventListener('pointerup', e => { if (sx != null && Math.abs(e.clientX - sx) > 60) step(e.clientX < sx ? 1 : -1); sx = null; });
el.vStage.addEventListener('click', e => { if (e.target === el.vStage) closeViewer(); });

// drag & drop onto the album
const section = document.getElementById('gallery');
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
section.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; el.root.classList.add('is-dragging'); });
section.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
section.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; el.root.classList.remove('is-dragging'); } });
section.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; el.root.classList.remove('is-dragging');
  handleFiles(e.dataTransfer.files);
});

// pick up other people's uploads when you come back to the tab (no background polling —
// every list costs one of the 2,000 monthly "advanced operations" on the free plan)
let lastRefresh = 0;
const softRefresh = () => {
  if (document.hidden || state.uploading || Date.now() - lastRefresh < 2 * 60 * 1000) return;
  lastRefresh = Date.now(); refresh(true);
};
window.addEventListener('focus', softRefresh);
document.addEventListener('visibilitychange', softRefresh);

/* ── Boot ─────────────────────────────────────────────── */
render();
refresh().then(() => {
  lastRefresh = Date.now();
  // deep link: #photo=<id> opens that item directly
  const m = location.hash.match(/^#photo=(.+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (byId(id)) {
      section.scrollIntoView();
      openViewer(id);
    } else if (state.loaded) toast('That photo is no longer in the album.', 'warning', 3500);
  }
});
