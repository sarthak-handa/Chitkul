/* ============================================================
   GEO ROUTE SIMULATOR — cinematic India → Himachal → Route zoom
   Depends on map-data.js (window.MAP_DATA)
   ============================================================ */
(function () {
  'use strict';

  const DATA = window.MAP_DATA;
  const stage = document.getElementById('geoStage');
  if (!DATA || !stage) return;

  const NS = 'http://www.w3.org/2000/svg';
  const { K, LON0, LAT0, C } = DATA.proj;
  const proj = ([lon, lat]) => [(lon - LON0) * K * C, (LAT0 - lat) * K];
  const unproj = (x, y) => [x / (K * C) + LON0, LAT0 - y / K];
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const $ = id => document.getElementById(id);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const smooth = t => t * t * (3 - 2 * t);

  // ── Trip data ──────────────────────────────────────────
  const STOPS = {
    delhi:   { name: 'Delhi',        ll: [77.228, 28.667], alt: 216,  day: 'Day 0 · Dec 4 · 8:00 PM', title: 'Delhi — Kashmere Gate ISBT', desc: 'Mission start. Board the overnight bus, dhaba dinner on NH44.', img: 'images/night-bus.jpg' },
    shimla:  { name: 'Shimla',       ll: [77.172, 31.104], alt: 2205, day: 'Day 1 · Dec 5 · Morning', title: 'Shimla — Mountain Gateway', desc: 'Switch to the Traveller. Breakfast on the road to Sarahan.', img: 'images/hero.jpg' },
    sarahan: { name: 'Sarahan',      ll: [77.797, 31.507], alt: 2165, day: 'Day 1 · Afternoon', title: 'Sarahan — Bhimakali Temple', desc: 'Wood-and-stone temple architecture above the Sutlej gorge.', img: 'images/bhimakali.jpg' },
    gate:    { name: 'Kinnaur Gate', ll: [77.880, 31.555], alt: 1650, day: 'Day 1 · Late PM', title: 'Kinnaur Gate', desc: 'The ornate gateway into the Kinnaur district.', img: 'images/kinnaur-gate.jpg' },
    chitkul: { name: 'Chitkul',      ll: [78.437, 31.352], alt: 3450, day: 'Day 1–2 · Dec 5–6', title: "Chitkul — India's Last Village", desc: 'ITBP camp, Baspa riverside, Aakhri Dhaba, Mathi Temple.', img: 'images/chitkul.jpg', major: true },
    kalpa:   { name: 'Kalpa',        ll: [78.254, 31.541], alt: 2960, day: 'Day 3 · Dec 7', title: 'Kalpa — Kinner Kailash', desc: 'Sangla, Reckong Peo, Roghi cliffs and the sacred peaks at dusk.', img: 'images/kalpa.jpg', major: true },
    home:    { name: 'Delhi',        ll: [77.228, 28.667], alt: 216,  day: 'Day 4–5 · Dec 8–9', title: 'Back to Delhi', desc: 'Kalpa → Shimla → overnight bus home. Memories for a lifetime.', img: 'images/sangla.jpg' },
  };

  // via points follow the real highways (NH44 → NH5 → Sangla road)
  const SEGMENTS = [
    { from: 'delhi', to: 'shimla', km: 350, zoom: 75, dur: 6500,
      via: [[77.228, 28.667], [77.02, 28.99], [76.97, 29.39], [76.99, 29.69], [76.85, 29.97], [76.78, 30.36], [76.82, 30.64], [76.93, 30.82], [77.01, 30.90], [77.10, 30.92], [77.12, 31.00], [77.172, 31.104]] },
    { from: 'shimla', to: 'sarahan', km: 170, zoom: 38, dur: 5200,
      via: [[77.172, 31.104], [77.25, 31.10], [77.36, 31.12], [77.46, 31.26], [77.47, 31.33], [77.55, 31.40], [77.63, 31.45], [77.69, 31.48], [77.77, 31.52], [77.797, 31.507]] },
    { from: 'sarahan', to: 'gate', km: 22, zoom: 15, dur: 2600,
      via: [[77.797, 31.507], [77.78, 31.522], [77.83, 31.54], [77.88, 31.555]] },
    { from: 'gate', to: 'chitkul', km: 100, zoom: 30, dur: 5200,
      via: [[77.88, 31.555], [77.98, 31.54], [78.07, 31.525], [78.18, 31.50], [78.22, 31.45], [78.26, 31.42], [78.31, 31.405], [78.36, 31.39], [78.437, 31.352]] },
    { from: 'chitkul', to: 'kalpa', km: 65, zoom: 24, dur: 4600,
      via: [[78.437, 31.352], [78.36, 31.39], [78.31, 31.405], [78.26, 31.42], [78.22, 31.45], [78.18, 31.50], [78.22, 31.525], [78.272, 31.535], [78.254, 31.541]] },
    { from: 'kalpa', to: 'home', km: 580, zoom: 150, dur: 7000, ret: true,
      via: [[78.254, 31.541], [78.272, 31.535], [78.22, 31.525], [78.18, 31.50], [78.07, 31.525], [77.98, 31.54], [77.88, 31.555], [77.77, 31.52], [77.63, 31.45], [77.55, 31.40], [77.46, 31.26], [77.36, 31.12], [77.172, 31.104], [77.12, 31.00], [77.01, 30.90], [76.93, 30.82], [76.82, 30.64], [76.78, 30.36], [76.85, 29.97], [76.99, 29.69], [76.97, 29.39], [77.02, 28.99], [77.228, 28.667]] },
  ];
  const TOTAL_KM = SEGMENTS.reduce((s, g) => s + g.km, 0);
  const CHAPTERS = ['india', 'himachal', 'delhi', 'shimla', 'sarahan', 'gate', 'chitkul', 'kalpa', 'home'];

  // ── DOM ────────────────────────────────────────────────
  const svg = $('geoSvg');
  const ui = {
    phase: $('geoPhase'), coords: $('geoCoords'), day: $('geoDay'), alt: $('geoAlt'), dist: $('geoDist'),
    card: $('geoCard'), cardImg: $('geoCardImg'), cardDay: $('geoCardDay'), cardTitle: $('geoCardTitle'), cardDesc: $('geoCardDesc'),
    title: $('geoTitle'), titleMain: $('geoTitleMain'), titleSub: $('geoTitleSub'),
    start: $('geoStart'), play: $('geoPlay'), replay: $('geoReplay'), speed: $('geoSpeed'),
    progress: $('geoProgress'), chips: [...document.querySelectorAll('.geo-chip')],
  };

  // ── Build SVG scene ────────────────────────────────────
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <filter id="gGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="gGlowBig" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="gHpFill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563ff" stop-opacity=".22"/><stop offset=".55" stop-color="#8b5cf6" stop-opacity=".2"/><stop offset="1" stop-color="#ec4899" stop-opacity=".22"/>
    </linearGradient>`;

  const world = el('g', { class: 'geo-world' }, svg);

  // graticule
  const grat = el('g', { class: 'geo-grat' }, world);
  const gratMinor = el('g', { class: 'geo-grat geo-grat--minor' }, world);
  for (let lon = 50; lon <= 116; lon++) {
    const [x] = proj([lon, 0]);
    el('line', { x1: x, x2: x, y1: proj([0, 50])[1], y2: proj([0, -8])[1] }, grat);
  }
  for (let lat = -8; lat <= 50; lat++) {
    const y = proj([0, lat])[1];
    el('line', { x1: proj([50, 0])[0], x2: proj([116, 0])[0], y1: y, y2: y }, grat);
  }
  for (let v = 75; v <= 80; v += 0.1) {
    const [x] = proj([v, 0]);
    el('line', { x1: x, x2: x, y1: proj([0, 33.5])[1], y2: proj([0, 28])[1] }, gratMinor);
  }
  for (let v = 28; v <= 33.5; v += 0.1) {
    const y = proj([0, v])[1];
    el('line', { x1: proj([75, 0])[0], x2: proj([80, 0])[0], y1: y, y2: y }, gratMinor);
  }

  // states
  const statesG = el('g', { class: 'geo-states' }, world);
  let i = 0, hpPath = null;
  for (const [name, d] of Object.entries(DATA.states)) {
    const cls = name === 'Himachal Pradesh' ? 'geo-state geo-state--hp'
      : name === 'Delhi' ? 'geo-state geo-state--dl' : 'geo-state';
    const p = el('path', { d, class: cls, style: `--i:${i++}` }, statesG);
    if (name === 'Himachal Pradesh') hpPath = p;
  }
  // HP re-drawn on top for the glow layer
  const hpGlow = el('path', { d: DATA.states['Himachal Pradesh'], class: 'geo-hp-glow' }, world);

  // target reticle around HP
  const hpBox = hpPath.getBBox();
  const hpC = [hpBox.x + hpBox.width / 2, hpBox.y + hpBox.height / 2];
  const reticle = el('g', { class: 'geo-reticle', transform: `translate(${hpC[0]},${hpC[1]})` }, world);
  const rR = Math.max(hpBox.width, hpBox.height) * 0.62;
  el('circle', { r: rR, class: 'geo-reticle__ring' }, reticle);
  el('circle', { r: rR * 1.12, class: 'geo-reticle__ring geo-reticle__ring--dash' }, reticle);
  [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([a, b]) =>
    el('line', { x1: a * rR * 0.9, y1: b * rR * 0.9, x2: a * rR * 1.25, y2: b * rR * 1.25, class: 'geo-reticle__tick' }, reticle));

  // route geometry
  const routeG = el('g', { class: 'geo-route' }, world);
  const catmull = pts => {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let k = 0; k < pts.length - 1; k++) {
      const p0 = pts[k - 1] || pts[k], p1 = pts[k], p2 = pts[k + 1], p3 = pts[k + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(3)} ${c1[1].toFixed(3)} ${c2[0].toFixed(3)} ${c2[1].toFixed(3)} ${p2[0].toFixed(3)} ${p2[1].toFixed(3)}`;
    }
    return d;
  };
  SEGMENTS.forEach(seg => {
    const pts = seg.via.map(proj);
    seg.d = catmull(pts);
    el('path', { d: seg.d, class: 'geo-ghost' + (seg.ret ? ' geo-ghost--ret' : '') }, routeG);
    const probe = el('path', { d: seg.d, fill: 'none' }, svg);
    const L = probe.getTotalLength();
    const n = Math.max(80, Math.ceil(L * 8));
    seg.samples = [];
    for (let s = 0; s <= n; s++) {
      const p = probe.getPointAtLength((s / n) * L);
      seg.samples.push([p.x, p.y]);
    }
    probe.remove();
    seg.glow = el('polyline', { class: 'geo-trail-glow' + (seg.ret ? ' is-ret' : ''), points: '' }, routeG);
    seg.line = el('polyline', { class: 'geo-trail' + (seg.ret ? ' is-ret' : ''), points: '' }, routeG);
  });

  // screen-space overlays (constant pixel size, scaled each frame)
  const overlayG = el('g', { class: 'geo-overlay' }, world);
  const scaled = [];
  const addScaled = (pos, build, cls) => {
    const g = el('g', { class: cls }, overlayG);
    build(g);
    scaled.push({ g, pos });
    return g;
  };

  // point of interest: Kinner Kailash
  const poi = addScaled(proj([78.37, 31.52]), g => {
    el('path', { d: 'M0 -9 L8 5 L-8 5 Z', class: 'geo-poi__tri' }, g);
    const t = el('text', { x: 12, y: 4, class: 'geo-poi__label' }, g);
    t.textContent = 'KINNER KAILASH · 6,050 m';
  }, 'geo-poi');

  const markers = {};
  Object.entries(STOPS).forEach(([id, s]) => {
    if (id === 'home') return;
    s.xy = proj(s.ll);
    markers[id] = addScaled(s.xy, g => {
      el('circle', { r: 16, class: 'geo-mk__pulse' }, g);
      el('circle', { r: s.major ? 7 : 5.5, class: 'geo-mk__ring' }, g);
      el('circle', { r: s.major ? 3.2 : 2.6, class: 'geo-mk__dot' }, g);
      const right = id !== 'sarahan';
      const lab = el('text', { x: right ? 13 : -13, y: -9, class: 'geo-mk__label', 'text-anchor': right ? 'start' : 'end' }, g);
      lab.textContent = s.name.toUpperCase();
      const sub = el('text', { x: right ? 13 : -13, y: 5, class: 'geo-mk__sub', 'text-anchor': right ? 'start' : 'end' }, g);
      sub.textContent = `${s.alt.toLocaleString('en-IN')} m`;
    }, 'geo-mk geo-mk--' + id);
  });
  STOPS.home.xy = STOPS.delhi.xy;

  // vehicle
  const vehicle = addScaled([0, 0], g => {
    el('circle', { r: 14, class: 'geo-veh__halo' }, g);
    const body = el('g', { class: 'geo-veh__body' }, g);
    el('path', { d: 'M9 0 L-6 -6 L-3 0 L-6 6 Z', class: 'geo-veh__arrow' }, body);
  }, 'geo-veh');
  const vehBody = vehicle.querySelector('.geo-veh__body');

  // ── Camera ─────────────────────────────────────────────
  const cam = { x: 0, y: 0, w: 1000 };
  let aspect = 16 / 9, pxW = 1000;
  const measure = () => {
    const r = stage.getBoundingClientRect();
    pxW = r.width || 1000;
    aspect = (r.width || 16) / (r.height || 9);
  };
  const fit = ([x0, y0, x1, y1], pad = 1.15) => ({
    x: (x0 + x1) / 2, y: (y0 + y1) / 2,
    w: Math.max(x1 - x0, (y1 - y0) * aspect) * pad,
  });
  const INDIA = () => fit(DATA.bounds, 1.08);
  const HP_VIEW = () => {
    const d = STOPS.delhi.xy;
    return fit([Math.min(hpBox.x, d[0]), hpBox.y, hpBox.x + hpBox.width, Math.max(hpBox.y + hpBox.height, d[1])], 1.2);
  };

  function render() {
    const h = cam.w / aspect;
    svg.setAttribute('viewBox', `${cam.x - cam.w / 2} ${cam.y - h / 2} ${cam.w} ${h}`);
    const s = cam.w / pxW;
    for (const o of scaled) o.g.setAttribute('transform', `translate(${o.pos[0]},${o.pos[1]}) scale(${s})`);
    // level-of-detail fades
    svg.style.setProperty('--minor', Math.max(0, Math.min(1, (90 - cam.w) / 60)).toFixed(2));
    poi.style.opacity = Math.max(0, Math.min(1, (70 - cam.w) / 30)).toFixed(2);
    svg.style.setProperty('--lod-minor', Math.max(0, Math.min(1, (110 - cam.w) / 40)).toFixed(2));
    svg.style.setProperty('--lod-sub', Math.max(0, Math.min(1, (200 - cam.w) / 60)).toFixed(2));
    const [lon, lat] = unproj(cam.x, cam.y);
    ui.coords.textContent = `${lat.toFixed(3)}°N  ${lon.toFixed(3)}°E  ·  Z${(1000 / cam.w).toFixed(1)}x`;
  }

  // ── Pausable clock ─────────────────────────────────────
  let clock = 0, paused = true, last = null, speed = 1, token = 0, running = false;
  const tickers = new Set();
  const ABORT = Symbol('abort');
  function frame(ts) {
    const dt = last == null ? 16 : Math.min(64, ts - last);
    last = ts;
    if (!paused) {
      clock += dt * speed;
      tickers.forEach(f => f(dt * speed));
    }
    render();
    rafId = requestAnimationFrame(frame);
  }
  let rafId = null;
  const startLoop = () => { if (rafId == null) { last = null; rafId = requestAnimationFrame(frame); } };
  const stopLoop = () => { if (rafId != null) cancelAnimationFrame(rafId); rafId = null; };

  function tween(dur, fn) {
    const my = token;
    return new Promise((res, rej) => {
      const start = clock;
      const tk = dt => {
        if (my !== token) { tickers.delete(tk); rej(ABORT); return; }
        const t = Math.min(1, (clock - start) / dur);
        fn(t, dt);
        if (t >= 1) { tickers.delete(tk); res(); }
      };
      tickers.add(tk);
    });
  }
  const wait = ms => tween(ms, () => {});

  function flyTo(target, dur = 2000) {
    const a = { ...cam };
    const dist = Math.hypot(target.x - a.x, target.y - a.y);
    const bump = Math.min(0.9, dist / Math.max(a.w, target.w)) * 0.8;
    return tween(dur, t => {
      const e = easeInOut(t);
      cam.x = lerp(a.x, target.x, e);
      cam.y = lerp(a.y, target.y, e);
      cam.w = Math.exp(lerp(Math.log(a.w), Math.log(target.w), e)) * (1 + bump * Math.sin(Math.PI * e));
    });
  }

  // ── UI helpers ─────────────────────────────────────────
  const setPhase = txt => { ui.phase.textContent = txt; };
  const setChip = id => {
    const idx = CHAPTERS.indexOf(id);
    ui.chips.forEach((c, k) => {
      c.classList.toggle('done', k < idx);
      c.classList.toggle('active', k === idx);
    });
  };
  let progBase = 0;
  const setProgress = f => { ui.progress.style.width = `${(f * 100).toFixed(1)}%`; };
  function showTitle(main, sub) {
    ui.titleMain.textContent = main;
    ui.titleSub.textContent = sub || '';
    ui.title.classList.remove('show');
    void ui.title.offsetWidth;
    ui.title.classList.add('show');
  }
  const hideTitle = () => ui.title.classList.remove('show');
  function showCard(s) {
    ui.card.classList.remove('show');
    ui.cardImg.src = s.img;
    ui.cardImg.alt = s.title;
    ui.cardDay.textContent = s.day;
    ui.cardTitle.textContent = s.title;
    ui.cardDesc.textContent = s.desc;
    ui.day.textContent = s.day.split('·')[0].trim();
    void ui.card.offsetWidth;
    ui.card.classList.add('show');
  }
  const hideCard = () => ui.card.classList.remove('show');
  const svgState = (...cls) => {
    svg.classList.remove('st-scan', 'st-focus', 'st-route', 'st-done');
    cls.forEach(c => svg.classList.add(c));
  };

  let kmDone = 0;
  function resetScene() {
    hideCard(); hideTitle();
    svgState();
    SEGMENTS.forEach(s => { s.line.setAttribute('points', ''); s.glow.setAttribute('points', ''); });
    Object.values(markers).forEach(m => m.classList.remove('on', 'hit'));
    vehicle.classList.remove('on');
    kmDone = 0;
    ui.dist.textContent = '0';
    ui.alt.textContent = '216';
    ui.day.textContent = '—';
    setChip('none'); setProgress(0);
    measure();
    Object.assign(cam, INDIA());
    cam.w *= 1.6;
  }

  // ── The sequence ───────────────────────────────────────
  async function sequence() {
    const nStages = 2 + SEGMENTS.length;
    // 1 · India
    setPhase('SCANNING · REPUBLIC OF INDIA');
    setChip('india');
    svgState('st-scan');
    showTitle('INDIA', 'Initialising geospatial uplink');
    await flyTo(INDIA(), 2600);
    setProgress(0.5 / nStages);
    await wait(600);

    // 2 · Himachal
    setPhase('TARGET LOCK · HIMACHAL PRADESH');
    setChip('himachal');
    svgState('st-scan', 'st-focus');
    showTitle('HIMACHAL PRADESH', 'Dev Bhoomi · Land of the Gods');
    await flyTo(HP_VIEW(), 2800);
    Object.values(markers).forEach(m => m.classList.add('on'));
    setProgress(1.5 / nStages);
    await wait(1500);
    hideTitle();

    // 3 · Delhi
    setPhase('MISSION START · DELHI');
    setChip('delhi');
    svgState('st-scan', 'st-focus', 'st-route');
    await flyTo({ x: STOPS.delhi.xy[0], y: STOPS.delhi.xy[1], w: 45 }, 2200);
    markers.delhi.classList.add('hit');
    showCard(STOPS.delhi);
    vehicle.classList.add('on');
    vehicle_place(SEGMENTS[0], 0);
    setProgress(2 / nStages);
    await wait(1800);

    // 4 · Legs
    for (let k = 0; k < SEGMENTS.length; k++) {
      const seg = SEGMENTS[k];
      const to = STOPS[seg.to];
      hideCard();
      setPhase(seg.ret ? 'RETURN VECTOR · HOME' : `EN ROUTE → ${to.name.toUpperCase()}`);
      await drive(seg, k, nStages);
      if (markers[seg.to]) markers[seg.to].classList.add('hit');
      setChip(seg.to);
      setPhase(seg.ret ? 'TOUCHDOWN · DELHI' : `ARRIVED · ${to.name.toUpperCase()}`);
      showCard(to);
      if (to.major) showTitle(to.name.toUpperCase(), `${to.alt.toLocaleString('en-IN')} m above sea level`);
      await wait(seg.ret ? 1200 : 2100);
      hideTitle();
    }

    // 5 · Finale
    hideCard();
    vehicle.classList.remove('on');
    setPhase('MISSION COMPLETE');
    svgState('st-scan', 'st-focus', 'st-route', 'st-done');
    await flyTo(HP_VIEW(), 2600);
    showTitle('MISSION COMPLETE', `${TOTAL_KM.toLocaleString('en-IN')} km · 6 days · peak 3,450 m`);
    setProgress(1);
    if (typeof Toast !== 'undefined') Toast.show('Journey simulated! Chitkul & Kalpa await 🏔', 'success', 4000);
  }

  function vehicle_place(seg, idx) {
    const S = seg.samples;
    const p = S[idx], q = S[Math.min(S.length - 1, idx + 2)], o = S[Math.max(0, idx - 2)];
    vehicle.__pos = p;
    scaled.find(x => x.g === vehicle).pos = p;
    const ang = Math.atan2(q[1] - o[1], q[0] - o[0]) * 180 / Math.PI;
    vehBody.setAttribute('transform', `rotate(${ang.toFixed(1)})`);
  }

  async function drive(seg, k, nStages) {
    const S = seg.samples;
    const from = STOPS[seg.from], to = STOPS[seg.to];
    // ease camera into the leg's zoom before rolling
    await flyTo({ x: S[0][0], y: S[0][1], w: seg.zoom }, seg.ret ? 1200 : 800);
    const startKm = kmDone;
    await tween(seg.dur, (t, dt) => {
      const e = smooth(t);
      const f = e * (S.length - 1);
      const idx = Math.floor(f);
      const frac = f - idx;
      const a = S[idx], b = S[Math.min(S.length - 1, idx + 1)];
      const head = [lerp(a[0], b[0], frac), lerp(a[1], b[1], frac)];
      const pts = S.slice(0, idx + 1).concat([head]).map(p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ');
      seg.line.setAttribute('points', pts);
      seg.glow.setAttribute('points', pts);
      vehicle_place(seg, idx);
      scaled.find(x => x.g === vehicle).pos = head;
      // follow-cam with slight look-ahead
      const ahead = S[Math.min(S.length - 1, idx + Math.ceil(S.length * 0.06))];
      const tx = lerp(head[0], ahead[0], 0.5), ty = lerp(head[1], ahead[1], 0.5);
      const kf = 1 - Math.exp(-dt / 220);
      cam.x += (tx - cam.x) * kf;
      cam.y += (ty - cam.y) * kf;
      cam.w += (seg.zoom * (1 + 0.15 * Math.sin(Math.PI * e)) - cam.w) * kf;
      // telemetry
      kmDone = startKm + seg.km * e;
      ui.dist.textContent = Math.round(kmDone).toLocaleString('en-IN');
      ui.alt.textContent = Math.round(lerp(from.alt, to.alt, easeOut(e))).toLocaleString('en-IN');
      setProgress((2 + k + e) / nStages);
    });
  }

  // ── Controls ───────────────────────────────────────────
  function setPaused(p) {
    paused = p;
    ui.play.textContent = p ? '▶ Resume' : '⏸ Pause';
    stage.classList.toggle('is-paused', p && running);
  }

  async function run() {
    token++;
    tickers.clear();
    resetScene();
    running = true;
    stage.classList.add('is-live');
    ui.start.classList.add('hide');
    ui.play.disabled = false;
    setPaused(false);
    try {
      await sequence();
      running = false;
      ui.play.textContent = '▶ Play Again';
      ui.play.dataset.done = '1';
    } catch (e) {
      if (e !== ABORT) throw e;
    }
  }

  ui.start.addEventListener('click', run);
  ui.replay.addEventListener('click', run);
  ui.play.addEventListener('click', () => {
    if (!running) { delete ui.play.dataset.done; run(); return; }
    setPaused(!paused);
  });
  ui.speed.addEventListener('click', () => {
    speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
    ui.speed.textContent = `${speed}×`;
  });

  // ── Lifecycle: render only when visible, autoplay once ──
  resetScene();
  Object.assign(cam, INDIA());
  render();
  let autoStarted = false, autoPaused = false;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  new IntersectionObserver(entries => {
    entries.forEach(en => {
      document.body.classList.toggle('sim-in-view', en.isIntersecting && en.intersectionRatio > 0.3);
      if (en.isIntersecting) {
        startLoop();
        const vis = en.intersectionRect.height / Math.min(en.boundingClientRect.height, window.innerHeight);
        if (!autoStarted && !reduce && vis > 0.4) { autoStarted = true; run(); }
        if (autoPaused) { autoPaused = false; setPaused(false); }
      } else {
        if (running && !paused) { autoPaused = true; setPaused(true); }
        stopLoop();
      }
    });
  }, { threshold: Array.from({ length: 21 }, (_, k) => k / 20) }).observe(stage);

  window.addEventListener('resize', () => { measure(); render(); });
})();
