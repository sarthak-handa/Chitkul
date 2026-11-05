/* ============================================================
   3D ROUTE SIMULATOR — MapLibre GL + real terrain + 3D buildings
   India → Himachal → real roads Delhi → Shimla → Sarahan →
   Kinnaur Gate → Chitkul → Kalpa → home, with drone views at stops.
   Falls back to the 2D simulator (simulator.js) without WebGL.
   Data: geo3d-data.js (window.GEO3D)
   ============================================================ */
(function () {
  'use strict';

  const host = document.getElementById('geoSim');
  if (!host) return;

  const ML_VER = '4.7.1';
  const ML_JS = `https://unpkg.com/maplibre-gl@${ML_VER}/dist/maplibre-gl.js`;
  const ML_CSS = `https://unpkg.com/maplibre-gl@${ML_VER}/dist/maplibre-gl.css`;
  const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  const EXAG = 1.5;

  const loadScript = src => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
  const webglOK = () => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  };
  let fellBack = false;
  async function fallback2D(reason) {
    if (fellBack) return; fellBack = true;
    console.warn('3D simulator unavailable, using 2D:', reason);
    host.innerHTML = '';
    host.classList.remove('geo-sim--3d');
    await loadScript('map-data.js');
    await loadScript('simulator.js');
  }
  if (!webglOK() || !window.GEO3D) { fallback2D('no WebGL / data'); return; }

  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = ML_CSS; document.head.appendChild(css);
  loadScript(ML_JS).then(() => { try { start(); } catch (e) { fallback2D(e); } }).catch(fallback2D);

  // ── helpers ────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const smooth = t => t * t * (3 - 2 * t);
  const angDiff = (a, b) => ((b - a + 540) % 360) - 180;
  const lineFC = coords => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords.length > 1 ? coords : [] } });
  const R = Math.PI / 180;
  const distKm = (a, b) => {
    const dLat = (b[1] - a[1]) * R, dLon = (b[0] - a[0]) * R;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * R) * Math.cos(b[1] * R) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  const heading = (a, b) => {
    const y = Math.sin((b[0] - a[0]) * R) * Math.cos(b[1] * R);
    const x = Math.cos(a[1] * R) * Math.sin(b[1] * R) - Math.sin(a[1] * R) * Math.cos(b[1] * R) * Math.cos((b[0] - a[0]) * R);
    return (Math.atan2(y, x) / R + 360) % 360;
  };

  // ── trip data ──────────────────────────────────────────
  const STOPS = {
    delhi:   { name: 'Delhi',        alt: 216,  day: 'Day 0 · Fri, Dec 4 · 8:00 PM', title: 'Delhi — Kashmere Gate ISBT', desc: 'Mission start. Board the overnight bus, dhaba dinner on NH44.', img: 'images/night-bus.jpg' },
    shimla:  { name: 'Shimla',       alt: 2205, day: 'Day 1 · Sat, Dec 5 · Morning', title: 'Shimla — Mountain Gateway', desc: 'Switch to the Traveller. Breakfast on the road to Sarahan.', img: 'images/hero.jpg' },
    sarahan: { name: 'Sarahan',      alt: 2165, day: 'Day 1 · Afternoon', title: 'Sarahan — Bhimakali Temple', desc: 'Wood-and-stone temple architecture above the Sutlej gorge.', img: 'images/bhimakali.jpg' },
    gate:    { name: 'Kinnaur Gate', alt: 1650, day: 'Day 1 · Late PM', title: 'Kinnaur Gate', desc: 'The ornate gateway into the Kinnaur district.', img: 'images/kinnaur-gate.jpg' },
    chitkul: { name: 'Chitkul',      alt: 3450, day: 'Day 1–2 · Dec 5–6', title: "Chitkul — India's Last Village", desc: 'ITBP camp, Baspa riverside, Aakhri Dhaba, Mathi Temple.', img: 'images/chitkul.jpg', major: true },
    kalpa:   { name: 'Kalpa',        alt: 2960, day: 'Day 3 · Mon, Dec 7', title: 'Kalpa — Kinner Kailash', desc: 'Sangla, Reckong Peo, Roghi cliffs and the sacred peaks at dusk.', img: 'images/kalpa.jpg', major: true },
    home:    { name: 'Delhi',        alt: 216,  day: 'Day 4–5 · Dec 8–9', title: 'Back to Delhi', desc: 'Kalpa → Shimla → overnight bus home. Memories for a lifetime.', img: 'images/sangla.jpg' },
  };
  // camera per leg: zoom / pitch while driving, sim-duration (ms at 1×)
  const LEG_CAM = {
    shimla:  { zoom: 8.4,  pitch: 50, dur: 7500 },
    sarahan: { zoom: 10.4, pitch: 60, dur: 7500 },
    gate:    { zoom: 11.8, pitch: 62, dur: 3600 },
    chitkul: { zoom: 10.9, pitch: 62, dur: 6800 },
    kalpa:   { zoom: 11.1, pitch: 62, dur: 6200 },
    home:    { zoom: 7.4,  pitch: 45, dur: 8000 },
  };
  const SEGMENTS = window.GEO3D.segments.map(s => {
    const c = s.coords;
    const cum = [0];
    for (let i = 1; i < c.length; i++) cum.push(cum[i - 1] + distKm(c[i - 1], c[i]));
    return { ...s, ...LEG_CAM[s.to], cum, len: cum[cum.length - 1] };
  });
  STOPS.delhi.ll = SEGMENTS[0].coords[0];
  SEGMENTS.forEach(s => { STOPS[s.to].ll = s.coords[s.coords.length - 1]; });
  const TOTAL_KM = SEGMENTS.reduce((s, g) => s + g.km, 0);
  const CHAPTERS = ['india', 'himachal', 'delhi', 'shimla', 'sarahan', 'gate', 'chitkul', 'kalpa', 'home'];
  const INDIA_B = [[68.1, 6.5], [97.4, 37.1]];
  const HP_B = [[75.6, 28.4], [79.0, 33.25]];

  function along(seg, km) {
    const { cum, coords } = seg;
    if (km <= 0) return { p: coords[0], i: 0 };
    if (km >= seg.len) return { p: coords[coords.length - 1], i: coords.length - 2 };
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < km) lo = m; else hi = m; }
    const t = (km - cum[lo]) / (cum[hi] - cum[lo] || 1);
    return { p: [lerp(coords[lo][0], coords[hi][0], t), lerp(coords[lo][1], coords[hi][1], t)], i: lo };
  }

  // ── markup (shared classes with the 2D version) ────────
  const TEMPLATE = `
<div class="geo-stage geo-stage--3d" id="geoStage">
  <div class="geo-map" id="geoMap"></div>
  <span class="geo-corner geo-corner--tl"></span><span class="geo-corner geo-corner--tr"></span>
  <span class="geo-corner geo-corner--bl"></span><span class="geo-corner geo-corner--br"></span>
  <div class="geo-hud geo-hud--tl">
    <span class="geo-hud__live"><i></i> <span id="geoPhase">LOADING 3D TERRAIN…</span></span>
    <span class="geo-hud__coords" id="geoCoords">—</span>
  </div>
  <div class="geo-hud geo-hud--tr">
    <div class="geo-stat"><span>DAY</span><b id="geoDay">—</b></div>
    <div class="geo-stat"><span>ALT</span><b><em id="geoAlt">216</em> m</b></div>
    <div class="geo-stat"><span>DIST</span><b><em id="geoDist">0</em> km</b></div>
  </div>
  <div class="geo-title" id="geoTitle" aria-live="polite"><h3 id="geoTitleMain"></h3><p id="geoTitleSub"></p></div>
  <div class="geo-card" id="geoCard">
    <img id="geoCardImg" src="" alt="">
    <div class="geo-card__body"><p class="geo-card__day" id="geoCardDay"></p><h4 id="geoCardTitle"></h4><p id="geoCardDesc"></p></div>
  </div>
  <div class="geo-explore" id="geoExplore" hidden>Drag to pan · right-drag / two fingers to tilt &amp; rotate</div>
  <button class="geo-start" id="geoStart"><span>▶</span> Launch 3D Simulation</button>
</div>
<div class="geo-bar">
  <div class="geo-progress"><div id="geoProgress"></div></div>
  <div class="geo-bar__row">
    <div class="geo-chips">
      <span class="geo-chip">India</span><span class="geo-chip">Himachal</span><span class="geo-chip">Delhi</span>
      <span class="geo-chip">Shimla</span><span class="geo-chip">Sarahan</span><span class="geo-chip">Kinnaur Gate</span>
      <span class="geo-chip">Chitkul</span><span class="geo-chip">Kalpa</span><span class="geo-chip">Home</span>
    </div>
    <div class="geo-controls">
      <button class="sim-btn sim-btn--play" id="geoPlay">▶ Play</button>
      <button class="sim-btn sim-btn--reset" id="geoReplay">↺ Replay</button>
      <button class="sim-btn sim-btn--reset geo-speed" id="geoSpeed" aria-label="Playback speed">2.5×</button>
      <button class="sim-btn sim-btn--reset geo-share" id="geoShare" aria-label="Copy link to this simulator">🔗 Share</button>
      <a class="sim-btn sim-btn--reset geo-open" id="geoOpen" href="simulator.html" target="_blank" rel="noopener" aria-label="Open simulator full screen">⛶ Full screen</a>
    </div>
  </div>
</div>`;

  function start() {
    const ml = window.maplibregl;
    host.innerHTML = TEMPLATE;
    host.classList.add('geo-sim--3d');
    const stage = $('geoStage');
    const ui = {
      phase: $('geoPhase'), coords: $('geoCoords'), day: $('geoDay'), alt: $('geoAlt'), dist: $('geoDist'),
      card: $('geoCard'), cardImg: $('geoCardImg'), cardDay: $('geoCardDay'), cardTitle: $('geoCardTitle'), cardDesc: $('geoCardDesc'),
      title: $('geoTitle'), titleMain: $('geoTitleMain'), titleSub: $('geoTitleSub'), explore: $('geoExplore'),
      start: $('geoStart'), play: $('geoPlay'), replay: $('geoReplay'), speed: $('geoSpeed'),
      progress: $('geoProgress'), chips: [...host.querySelectorAll('.geo-chip')],
    };

    const cam = { lng: 80.5, lat: 22.5, zoom: 2.4, pitch: 0, bearing: 0 };
    const map = new ml.Map({
      container: 'geoMap', style: STYLE,
      center: [cam.lng, cam.lat], zoom: cam.zoom, pitch: 0, bearing: 0,
      maxPitch: 76, fadeDuration: 0, attributionControl: false, cooperativeGestures: true,
    });
    map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-left');
    window.__geoMap = map; // handy for debugging in the console
    map.on('error', e => console.warn('map:', e && e.error && e.error.message));

    const HANDLERS = ['dragPan', 'scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch'];
    const setInteractive = on => {
      HANDLERS.forEach(h => map[h] && (on ? map[h].enable() : map[h].disable()));
      ui.explore.hidden = !on || !finished;
      stage.classList.toggle('is-explorable', on);
    };

    let mapReady;
    const ready = new Promise(res => { mapReady = res; });
    let failTimer = setTimeout(() => fallback2D('map load timeout'), 20000);

    map.on('load', () => {
      clearTimeout(failTimer);
      // terrain + relief
      map.addSource('dem', { type: 'raster-dem', tiles: [DEM], encoding: 'terrarium', tileSize: 256, maxzoom: 14,
        attribution: 'Terrain © Mapzen, AWS Open Data' });
      map.addSource('dem-hs', { type: 'raster-dem', tiles: [DEM], encoding: 'terrarium', tileSize: 256, maxzoom: 14 });
      const firstSymbol = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
      map.addLayer({ id: 'hillshade', type: 'hillshade', source: 'dem-hs',
        paint: { 'hillshade-exaggeration': 0.32, 'hillshade-shadow-color': '#5b5f8a', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#a5b4fc' } }, firstSymbol);
      map.setTerrain({ source: 'dem', exaggeration: EXAG });
      if (map.setSky) {
        try {
          map.setSky({ 'sky-color': '#b9d4ff', 'horizon-color': '#fbe3f1', 'fog-color': '#f8f9ff',
            'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.25, 'atmosphere-blend': 0.6 });
        } catch { /* older engines */ }
      }
      // we draw India's outlines ourselves — hide basemap boundaries & country labels
      map.getStyle().layers.forEach(l => {
        if (l['source-layer'] === 'boundary' || /^label_country/.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');
      });
      // colorful raised buildings
      if (map.getLayer('building-3d')) {
        map.setPaintProperty('building-3d', 'fill-extrusion-color',
          ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, '#e0e7ff', 8, '#c4b5fd', 20, '#f0abfc', 45, '#fda4af', 90, '#fdba74']);
        map.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.92);
      }

      // India states
      map.addSource('states', { type: 'geojson', data: window.GEO3D.states });
      const T = { duration: 1200, delay: 0 };
      map.addLayer({ id: 'st-fill', type: 'fill', source: 'states', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0, 'fill-opacity-transition': T } }, firstSymbol);
      map.addLayer({ id: 'st-line', type: 'line', source: 'states', paint: { 'line-color': '#6366f1', 'line-width': 1, 'line-opacity': 0, 'line-opacity-transition': T } }, firstSymbol);
      map.addLayer({ id: 'dl-fill', type: 'fill', source: 'states', filter: ['==', ['get', 'name'], 'Delhi'],
        paint: { 'fill-color': '#f97316', 'fill-opacity': 0, 'fill-opacity-transition': T } }, firstSymbol);
      map.addLayer({ id: 'hp-fill', type: 'fill', source: 'states', filter: ['==', ['get', 'name'], 'Himachal Pradesh'],
        paint: { 'fill-color': '#8b5cf6', 'fill-opacity': 0, 'fill-opacity-transition': T } }, firstSymbol);
      map.addLayer({ id: 'hp-glow', type: 'line', source: 'states', filter: ['==', ['get', 'name'], 'Himachal Pradesh'],
        paint: { 'line-color': '#a78bfa', 'line-width': 10, 'line-blur': 6, 'line-opacity': 0, 'line-opacity-transition': T } }, firstSymbol);
      map.addLayer({ id: 'hp-line', type: 'line', source: 'states', filter: ['==', ['get', 'name'], 'Himachal Pradesh'],
        paint: { 'line-color': '#7c3aed', 'line-width': 2.2, 'line-opacity': 0, 'line-opacity-transition': T } }, firstSymbol);

      // route: dashed preview + per-leg lines that grow as the vehicle drives
      map.addSource('ghost', { type: 'geojson', data: { type: 'FeatureCollection',
        features: SEGMENTS.filter(s => !s.ret).map(s => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: s.coords } })) } });
      map.addLayer({ id: 'ghost', type: 'line', source: 'ghost', layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#141a33', 'line-width': 1.6, 'line-dasharray': [2, 3], 'line-opacity': 0, 'line-opacity-transition': T } });
      SEGMENTS.forEach((s, k) => {
        map.addSource(`seg${k}`, { type: 'geojson', data: lineFC([]) });
        map.addLayer({ id: `seg${k}-glow`, type: 'line', source: `seg${k}`, layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-width': 13, 'line-blur': 7, 'line-opacity': 0.45, 'line-color': s.ret ? '#fdba74' : '#a78bfa' } });
        map.addLayer({ id: `seg${k}`, type: 'line', source: `seg${k}`, layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-width': 4.4, 'line-color': s.ret ? '#f97316' : '#ec4899' } });
      });
      mapReady();
    });

    // ── markers (HTML: labels stay crisp, pulses are compositor-animated) ──
    const mkEl = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };
    const markers = {};
    Object.entries(STOPS).forEach(([id, s]) => {
      if (id === 'home') return;
      const right = id !== 'sarahan';
      const el = mkEl(`g3-mk g3-mk--${id}${s.major ? ' is-major' : ''}${right ? '' : ' is-left'}`,
        `<span class="g3-mk__pulse"></span><span class="g3-mk__dot"></span>
         <span class="g3-mk__label"><b>${s.name}</b><small>${s.alt.toLocaleString('en-IN')} m</small></span>`);
      const mk = new ml.Marker({ element: el, anchor: 'center' }).setLngLat(s.ll).addTo(map);
      if (mk.setOpacity) mk.setOpacity('1', '0.9'); // keep stop labels readable even when a ridge is in front
      markers[id] = { el, m: mk };
    });
    const poiEl = mkEl('g3-poi', '<span>▲</span> Kinner Kailash · 6,050 m');
    new ml.Marker({ element: poiEl, anchor: 'left' }).setLngLat([78.372, 31.522]).addTo(map);
    const vehEl = mkEl('g3-veh', '<span class="g3-veh__halo"></span><svg viewBox="0 0 24 24"><path d="M12 2 20 21 12 16.5 4 21Z"/></svg>');
    const vehicle = new ml.Marker({ element: vehEl, anchor: 'center', rotationAlignment: 'map', pitchAlignment: 'map' })
      .setLngLat(STOPS.delhi.ll).addTo(map);

    // ── pausable clock (same model as the 2D sim) ─────────
    const DEFAULT_SPEED = 2.5;
    let clock = 0, paused = true, last = null, speed = DEFAULT_SPEED, token = 0, running = false, finished = false;
    const tickers = new Set();
    const ABORT = Symbol('abort');
    let rafId = null, lastCamKey = '';
    function frame(ts) {
      // allow big steps so slow GPUs keep real-time pace instead of crawling
      const dt = last == null ? 16 : Math.min(250, ts - last);
      last = ts;
      if (!paused) { clock += dt * speed; tickers.forEach(f => f(dt * speed)); }
      if (running) render();
      rafId = requestAnimationFrame(frame);
    }
    const startLoop = () => { if (rafId == null) { last = null; rafId = requestAnimationFrame(frame); } };
    const stopLoop = () => { if (rafId != null) cancelAnimationFrame(rafId); rafId = null; };
    function tween(dur, fn) {
      const my = token;
      return new Promise((res, rej) => {
        const t0 = clock;
        const tk = dt => {
          if (my !== token) { tickers.delete(tk); rej(ABORT); return; }
          const t = Math.min(1, (clock - t0) / dur);
          fn(t, dt);
          if (t >= 1) { tickers.delete(tk); res(); }
        };
        tickers.add(tk);
      });
    }
    const wait = ms => tween(Math.max(ms, 1600 * speed), () => {});
    // real-time wait for tiles (buildings/terrain) so drone views aren't empty
    const tilesSettled = (maxMs = 2500) => new Promise(res => {
      const my = token;
      let done = false;
      const fin = () => { if (!done) { done = true; res(my === token); } };
      map.once('idle', fin);
      setTimeout(fin, maxMs);
    }).then(ok => { if (!ok) throw ABORT; });

    function render() {
      const key = `${cam.lng.toFixed(6)},${cam.lat.toFixed(6)},${cam.zoom.toFixed(4)},${cam.pitch.toFixed(2)},${cam.bearing.toFixed(2)}`;
      if (key === lastCamKey) return;
      lastCamKey = key;
      map.jumpTo({ center: [cam.lng, cam.lat], zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing });
      ui.coords.textContent = `${cam.lat.toFixed(3)}°N  ${cam.lng.toFixed(3)}°E  ·  Z${cam.zoom.toFixed(1)}  ·  TILT ${Math.round(cam.pitch)}°`;
    }

    function flyTo(target, dur = 2000) {
      const a = { ...cam };
      const d = Math.hypot(target.lng - a.lng, target.lat - a.lat);
      // zoom out mid-flight when travelling far relative to the view (van Wijk-style arc)
      const W = stage.clientWidth || 1000;
      const zBoth = Math.log2((360 * W) / (512 * Math.max(d, 1e-6) * 1.6));
      const bump = clamp(Math.min(a.zoom, target.zoom) - zBoth, 0, 5);
      const db = angDiff(a.bearing, target.bearing ?? a.bearing);
      return tween(dur, t => {
        const e = easeInOut(t);
        cam.lng = lerp(a.lng, target.lng, e);
        cam.lat = lerp(a.lat, target.lat, e);
        cam.zoom = lerp(a.zoom, target.zoom, e) - bump * Math.sin(Math.PI * e);
        cam.pitch = lerp(a.pitch, target.pitch ?? a.pitch, e);
        cam.bearing = a.bearing + db * e;
      });
    }
    const fit = (b, extra = {}) => {
      const c = map.cameraForBounds(b, { padding: { top: 70, bottom: 40, left: 40, right: 40 } });
      return { lng: c.center.lng, lat: c.center.lat, zoom: c.zoom, pitch: 0, bearing: 0, ...extra };
    };

    // ── UI helpers ─────────────────────────────────────────
    const setPhase = t => { ui.phase.textContent = t; };
    const setChip = id => {
      const idx = CHAPTERS.indexOf(id);
      ui.chips.forEach((c, k) => { c.classList.toggle('done', k < idx); c.classList.toggle('active', k === idx); });
    };
    const setProgress = f => { ui.progress.style.width = `${(f * 100).toFixed(1)}%`; };
    function showTitle(main, sub) {
      ui.titleMain.textContent = main; ui.titleSub.textContent = sub || '';
      ui.title.classList.remove('show'); void ui.title.offsetWidth; ui.title.classList.add('show');
    }
    const hideTitle = () => ui.title.classList.remove('show');
    function showCard(s) {
      ui.card.classList.remove('show');
      ui.cardImg.src = s.img; ui.cardImg.alt = s.title;
      ui.cardDay.textContent = s.day; ui.cardTitle.textContent = s.title; ui.cardDesc.textContent = s.desc;
      ui.day.textContent = s.day.split('·')[0].trim();
      void ui.card.offsetWidth; ui.card.classList.add('show');
    }
    const hideCard = () => ui.card.classList.remove('show');
    const paint = (layer, prop, v) => { if (map.getLayer(layer)) map.setPaintProperty(layer, prop, v); };
    // drawn route = coordinates up to the vehicle; updates throttled to ~12/s (cheap for the worker)
    const legState = SEGMENTS.map(() => ({ t: -1e9, p: -1 }));
    function setLeg(k, p, force) {
      const s = SEGMENTS[k], st = legState[k];
      const now = performance.now();
      if (!force && p > 0 && p < 1 && now - st.t < 80) return;
      if (p === st.p) return;
      st.t = now; st.p = p;
      const src = map.getSource(`seg${k}`);
      if (!src) return;
      if (p <= 0) { src.setData(lineFC([])); return; }
      if (p >= 1) { src.setData(lineFC(s.coords)); return; }
      const { p: head, i } = along(s, p * s.len);
      src.setData(lineFC(s.coords.slice(0, i + 1).concat([head])));
    }
    const fadeZ = (v, z0 = 6.2, z1 = 8.6) => ['interpolate', ['linear'], ['zoom'], z0, v, z1, 0];
    function mapStage(level) { // 0 hidden, 1 india, 2 himachal focus
      paint('st-fill', 'fill-opacity', level === 0 ? 0 : fadeZ(level === 2 ? 0.3 : 0.55));
      paint('st-line', 'line-opacity', level === 0 ? 0 : ['interpolate', ['linear'], ['zoom'], 5, level === 2 ? 0.5 : 0.85, 10, 0.2]);
      paint('hp-fill', 'fill-opacity', level === 2 ? fadeZ(0.18) : 0);
      paint('hp-glow', 'line-opacity', level === 2 ? fadeZ(0.7, 7, 10) : 0);
      paint('hp-line', 'line-opacity', level === 2 ? ['interpolate', ['linear'], ['zoom'], 6, 1, 11, 0.55] : 0);
      paint('dl-fill', 'fill-opacity', level === 2 ? fadeZ(0.32, 7, 9.5) : 0);
    }
    const markersOn = on => Object.values(markers).forEach(m => m.el.classList.toggle('on', on));

    function altAt(ll, fallback) {
      try {
        const e = map.queryTerrainElevation(ll);
        const base = (map.transform && map.transform.elevation) || 0;
        if (e != null && isFinite(e)) { const m = (e + base) / EXAG; if (m > 50) return m; }
      } catch { /* terrain not ready */ }
      return fallback;
    }

    let kmDone = 0;
    function resetScene() {
      hideCard(); hideTitle(); ui.explore.hidden = true;
      SEGMENTS.forEach((_, k) => setLeg(k, 0, true));
      paint('ghost', 'line-opacity', 0);
      mapStage(0); markersOn(false);
      Object.values(markers).forEach(m => m.el.classList.remove('hit'));
      vehEl.classList.remove('on');
      kmDone = 0; ui.dist.textContent = '0'; ui.alt.textContent = '216'; ui.day.textContent = '—';
      setChip('none'); setProgress(0);
      Object.assign(cam, { lng: 80.5, lat: 22.5, zoom: 2.2, pitch: 0, bearing: 0 });
      lastCamKey = ''; render();
    }

    // ── the sequence ───────────────────────────────────────
    async function sequence() {
      const nStages = 2 + SEGMENTS.length;
      setPhase('SCANNING · REPUBLIC OF INDIA'); setChip('india');
      mapStage(1);
      showTitle('India', 'Initialising 3D geospatial uplink');
      await flyTo(fit(INDIA_B), 2600);
      setProgress(0.5 / nStages);
      await wait(600);

      setPhase('TARGET LOCK · HIMACHAL PRADESH'); setChip('himachal');
      mapStage(2);
      paint('ghost', 'line-opacity', 0.55);
      showTitle('Himachal Pradesh', 'Dev Bhoomi · Land of the Gods');
      await flyTo(fit(HP_B, { pitch: 38, bearing: -12 }), 3000);
      markersOn(true);
      setProgress(1.5 / nStages);
      await wait(1500);
      hideTitle();

      // Delhi street-level drone view
      setPhase('MISSION START · DELHI'); setChip('delhi');
      const d = STOPS.delhi.ll;
      await flyTo({ lng: d[0], lat: d[1], zoom: 15.4, pitch: 66, bearing: -20 }, 3000);
      markers.delhi.el.classList.add('hit');
      vehicle.setLngLat(d); vehEl.classList.add('on');
      showCard(STOPS.delhi);
      setProgress(2 / nStages);
      await droneOrbit(2200);

      for (let k = 0; k < SEGMENTS.length; k++) {
        const seg = SEGMENTS[k], to = STOPS[seg.to];
        hideCard();
        setPhase(seg.ret ? 'RETURN VECTOR · HOME' : `EN ROUTE → ${to.name.toUpperCase()}`);
        await drive(seg, k, nStages);
        if (markers[seg.to]) markers[seg.to].el.classList.add('hit');
        ui.alt.textContent = to.alt.toLocaleString('en-IN'); // official altitude on arrival
        setChip(seg.to);
        setPhase(seg.ret ? 'TOUCHDOWN · DELHI' : `ARRIVED · ${to.name.toUpperCase()}`);
        showCard(to);
        if (to.major) showTitle(to.name, `${to.alt.toLocaleString('en-IN')} m above sea level`);
        if (!seg.ret) {
          const ll = to.ll;
          await flyTo({ lng: ll[0], lat: ll[1], zoom: 15.2, pitch: 68, bearing: cam.bearing + 25 }, 1800);
          await droneOrbit(2400);
        } else {
          await wait(1200);
        }
        hideTitle();
      }

      hideCard(); vehEl.classList.remove('on');
      setPhase('MISSION COMPLETE');
      await flyTo(fit(HP_B, { pitch: 42, bearing: -14 }), 3200);
      showTitle('Mission complete', `${TOTAL_KM.toLocaleString('en-IN')} km · 6 days · peak 3,450 m`);
      setProgress(1);
      if (typeof Toast !== 'undefined') Toast.show('Journey simulated! Drag the 3D map to explore 🏔', 'success', 4000);
    }

    async function droneOrbit(ms) {
      await tilesSettled(2500);
      const b0 = cam.bearing;
      await tween(Math.max(ms, 1600 * speed), t => { cam.bearing = b0 + 55 * smooth(t); });
    }

    async function drive(seg, k, nStages) {
      const c0 = seg.coords[0];
      const h0 = heading(c0, along(seg, Math.min(seg.len, 3)).p);
      await flyTo({ lng: c0[0], lat: c0[1], zoom: seg.zoom, pitch: seg.pitch, bearing: seg.ret ? -10 : h0 }, seg.ret ? 1600 : 1400);
      const startKm = kmDone;
      const from = STOPS[seg.from], to = STOPS[seg.to];
      let lastAltT = 0;
      await tween(seg.dur, (t, dt) => {
        const e = smooth(t);
        const km = e * seg.len;
        const { p } = along(seg, km);
        const look = along(seg, Math.min(seg.len, km + Math.max(2, seg.len * 0.035))).p;
        const hdg = heading(p, look);
        setLeg(k, e);
        vehicle.setLngLat(p).setRotation(hdg);
        // chase camera: slightly ahead of the vehicle, turning with the road
        const kf = 1 - Math.exp(-dt / 260);
        const tx = lerp(p[0], look[0], 0.35), ty = lerp(p[1], look[1], 0.35);
        cam.lng += (tx - cam.lng) * kf;
        cam.lat += (ty - cam.lat) * kf;
        cam.zoom += (seg.zoom - 0.35 * Math.sin(Math.PI * e) - cam.zoom) * kf;
        cam.pitch += (seg.pitch - cam.pitch) * kf;
        if (!seg.ret) cam.bearing += angDiff(cam.bearing, hdg) * (1 - Math.exp(-dt / 900));
        kmDone = startKm + seg.km * e;
        ui.dist.textContent = Math.round(kmDone).toLocaleString('en-IN');
        if (clock - lastAltT > 120) {
          lastAltT = clock;
          ui.alt.textContent = Math.round(altAt(p, lerp(from.alt, to.alt, easeOut(e)))).toLocaleString('en-IN');
        }
        setProgress((2 + k + e) / nStages);
      });
      setLeg(k, 1, true);
    }

    // ── controls ───────────────────────────────────────────
    function setPaused(p) {
      paused = p;
      ui.play.textContent = p ? '▶ Resume' : '⏸ Pause';
      stage.classList.toggle('is-paused', p && running);
      if (running) setInteractive(false);
    }
    async function run() {
      await ready;
      token++; tickers.clear();
      finished = false;
      setInteractive(false);
      resetScene();
      running = true;
      ui.start.classList.add('hide');
      setPaused(false);
      startLoop();
      try {
        await sequence();
        running = false; finished = true;
        ui.play.textContent = '▶ Play Again';
        setInteractive(true);
      } catch (e) { if (e !== ABORT) { console.error(e); } }
    }
    ui.start.addEventListener('click', run);
    ui.replay.addEventListener('click', run);
    ui.play.addEventListener('click', () => { if (!running) { run(); return; } setPaused(!paused); });
    ui.speed.addEventListener('click', () => {
      speed = speed === 2.5 ? 5 : speed === 5 ? 1 : 2.5;
      ui.speed.textContent = `${speed}×`;
    });

    // share + standalone page link
    const standalone = document.body.classList.contains('sim-page');
    const shareBtn = $('geoShare');
    shareBtn.addEventListener('click', async () => {
      const url = standalone ? location.href.split('#')[0]
        : new URL(location.protocol === 'file:' ? 'simulator.html' : 'simulator', location.href).href;
      const label = shareBtn.textContent;
      try {
        if (navigator.share && matchMedia('(hover: none)').matches) {
          await navigator.share({ title: 'Chitkul · Kalpa 3D Route Simulator', text: 'Fly our trip route in 3D, from Delhi to Chitkul & Kalpa', url });
          return;
        }
        await navigator.clipboard.writeText(url);
        shareBtn.textContent = '✓ Link copied';
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        window.prompt('Copy this link:', url);
      }
      setTimeout(() => { shareBtn.textContent = label; }, 2000);
    });
    if (standalone) $('geoOpen').remove();
    else $('geoOpen').href = location.protocol === 'file:' ? 'simulator.html' : '/simulator';

    // preload stop photos
    Object.values(STOPS).forEach(s => { const im = new Image(); im.src = s.img; });

    // lifecycle: autoplay once visible, pause when scrolled away
    setInteractive(false);
    ready.then(() => { setPhase('READY · PRESS LAUNCH'); resetScene(); });
    let autoStarted = false, autoPaused = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    new IntersectionObserver(entries => entries.forEach(en => {
      document.body.classList.toggle('sim-in-view', en.isIntersecting && en.intersectionRatio > 0.3);
      if (en.isIntersecting) {
        const vis = en.intersectionRect.height / Math.min(en.boundingClientRect.height, window.innerHeight);
        if (!autoStarted && !reduce && vis > 0.4) { autoStarted = true; run(); }
        if (autoPaused) { autoPaused = false; setPaused(false); }
        startLoop();
      } else {
        if (running && !paused) { autoPaused = true; setPaused(true); }
        stopLoop();
      }
    }), { threshold: Array.from({ length: 21 }, (_, k) => k / 20) }).observe(stage);
  }
})();
