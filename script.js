/* ============================================================
   CHITKUL · KALPA · KINNAUR — Interactive JavaScript
   ============================================================ */

'use strict';

// ── Utility helpers ──────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ── Toast Notification System ────────────────────────────
const Toast = {
  container: null,
  queue: [],

  init() {
    this.container = $('#toastContainer');
  },

  show(message, type = 'info', duration = 3500) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast__text">${message}</span>
    `;
    this.container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });

    // Remove
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }
};

// ── Loader ───────────────────────────────────────────────
function initLoader() {
  const loader = $('#loader');
  if (!loader) return;

  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('hidden');
      loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    }, 1200);
  });
}

// ── Scroll Progress ──────────────────────────────────────
function initScrollProgress() {
  const bar = $('#scrollProgress');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = `${Math.min(pct, 100)}%`;
  }, { passive: true });
}

// ── Scroll Top Button ────────────────────────────────────
function initScrollTop() {
  const btn = $('#scrollTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });

  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ── Navbar ───────────────────────────────────────────────
function initNavbar() {
  const nav = $('#navbar');
  const hamburger = $('#hamburger');
  const navLinks = $('#navLinks');
  const links = $$('.nav__link');
  const heroSection = $('#home');

  if (!nav) return;

  // Scroll behaviour
  const handleScroll = () => {
    const scrolled = window.scrollY > 20;
    nav.classList.toggle('scrolled', scrolled);

    // Check if hero is in view
    if (heroSection) {
      const heroBottom = heroSection.getBoundingClientRect().bottom;
      nav.classList.toggle('at-hero', heroBottom > 60);
    }

    // Active link
    const sections = $$('section[id], footer[id]');
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 100;
      if (window.scrollY >= sectionTop) current = section.id;
    });
    links.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // Hamburger toggle
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen);
      navLinks.classList.toggle('open', isOpen);
    });
  }

  // Close on link click
  links.forEach(link => {
    link.addEventListener('click', () => {
      hamburger?.classList.remove('open');
      navLinks?.classList.remove('open');
    });
  });
}

// ── Hero Particles ───────────────────────────────────────
function initParticles() {
  const container = $('#heroParticles');
  if (!container) return;

  const COUNT = 60;
  for (let i = 0; i < COUNT; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * -100}%;
      width: ${Math.random() * 2 + 1}px;
      height: ${Math.random() * 2 + 1}px;
      animation-duration: ${Math.random() * 10 + 8}s;
      animation-delay: ${Math.random() * -15}s;
      opacity: ${Math.random() * 0.6 + 0.1};
    `;
    container.appendChild(p);
  }
}

// ── Countdown Timer ──────────────────────────────────────
function initCountdown() {
  const daysEl    = $('#cd-days');
  const hoursEl   = $('#cd-hours');
  const minsEl    = $('#cd-mins');
  const secsEl    = $('#cd-secs');
  const timerEl   = $('#countdown-timer');
  const departed  = $('#countdown-departed');

  if (!daysEl) return;

  // Target: 4 Dec 2025 20:00:00 IST (+05:30)
  const target = new Date('2025-12-04T20:00:00+05:30').getTime();

  const pad = n => String(Math.max(0, n)).padStart(2, '0');

  const prevVals = { days: '', hours: '', mins: '', secs: '' };

  function flipNumber(el, newVal) {
    if (el && el.textContent !== newVal) {
      el.style.transform = 'translateY(-8px)';
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = newVal;
        el.style.transform = 'translateY(8px)';
        setTimeout(() => {
          el.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
          el.style.transform = 'translateY(0)';
          el.style.opacity = '1';
        }, 20);
      }, 150);
    }
  }

  function update() {
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) {
      if (timerEl) timerEl.style.display = 'none';
      if (departed) departed.style.display = 'block';
      return;
    }

    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    const secs  = Math.floor((diff % 60000) / 1000);

    const dStr = pad(days), hStr = pad(hours), mStr = pad(mins), sStr = pad(secs);

    flipNumber(daysEl,  dStr);
    flipNumber(hoursEl, hStr);
    flipNumber(minsEl,  mStr);
    flipNumber(secsEl,  sStr);
  }

  update();
  setInterval(update, 1000);
}

// ── Timeline Scroll Reveal ───────────────────────────────
function initTimeline() {
  const items = $$('.timeline__item');
  if (!items.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, i * 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  items.forEach(item => observer.observe(item));
}

// ── Generic Reveal ───────────────────────────────────────
function initReveal() {
  const reveals = $$('.reveal');
  if (!reveals.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => observer.observe(el));
}

// ── Gallery ──────────────────────────────────────────────
function initGallery() {
  const dropzone   = $('#dropzone');
  const fileInput  = $('#fileInput');
  const grid       = $('#galleryGrid');
  const lightbox   = $('#lightbox');
  const lbImg      = $('#lightboxImg');
  const lbCaption  = $('#lightboxCaption');
  const lbClose    = $('#lightboxClose');
  const lbPrev     = $('#lightboxPrev');
  const lbNext     = $('#lightboxNext');

  if (!dropzone || !grid) return;

  let lightboxItems = [];
  let lightboxIndex = 0;

  // ─ Drag & Drop ─
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  // ─ File Input ─
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  // ─ Click on dropzone ─
  dropzone.addEventListener('click', (e) => {
    if (!e.target.closest('label')) fileInput.click();
  });

  // ─ Handle Files ─
  function handleFiles(files) {
    if (!files || files.length === 0) return;

    const validFiles = [...files].filter(f => {
      if (!f.type.match(/image\/(jpeg|jpg|png|webp)/i)) {
        Toast.show(`"${f.name}" is not a supported image format.`, 'warning');
        return false;
      }
      if (f.size > 50 * 1024 * 1024) {
        Toast.show(`"${f.name}" exceeds 50 MB limit.`, 'error');
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    Toast.show(`Loading ${validFiles.length} photo${validFiles.length > 1 ? 's' : ''}...`, 'info', 2000);

    validFiles.forEach((file, idx) => {
      setTimeout(() => {
        const reader = new FileReader();
        reader.onload = (e) => {
          addGalleryItem(e.target.result, file.name.replace(/\.[^.]+$/, ''));
        };
        reader.readAsDataURL(file);
      }, idx * 80);
    });

    setTimeout(() => {
      Toast.show(`${validFiles.length} photo${validFiles.length > 1 ? 's' : ''} added to gallery! 🎉`, 'success');
      // Reset input
      fileInput.value = '';
    }, validFiles.length * 80 + 500);
  }

  // ─ Add gallery item ─
  function addGalleryItem(src, caption) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.dataset.caption = caption;

    const img = document.createElement('img');
    img.src = src;
    img.alt = caption;
    img.loading = 'lazy';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';

    const overlay = document.createElement('div');
    overlay.className = 'gallery-item__overlay';
    overlay.innerHTML = `📸 ${caption}`;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'gallery-item__delete';
    deleteBtn.innerHTML = '✕';
    deleteBtn.title = 'Remove photo';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      item.style.transform = 'scale(0.85)';
      item.style.opacity = '0';
      setTimeout(() => {
        item.remove();
        updateLightboxItems();
        Toast.show('Photo removed from gallery.', 'info', 2000);
      }, 300);
    });

    item.appendChild(img);
    item.appendChild(overlay);
    item.appendChild(deleteBtn);

    // Animate in
    item.style.opacity = '0';
    item.style.transform = 'scale(0.9)';
    item.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    grid.appendChild(item);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        item.style.opacity = '1';
        item.style.transform = 'scale(1)';
      });
    });

    // Lightbox click
    item.addEventListener('click', () => openLightbox(item));
    updateLightboxItems();
  }

  // ─ Lightbox ─
  function updateLightboxItems() {
    lightboxItems = $$('.gallery-item', grid);
  }

  function openLightbox(item) {
    const idx = lightboxItems.indexOf(item);
    if (idx === -1) return;
    lightboxIndex = idx;
    showLightboxItem(lightboxIndex);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function showLightboxItem(idx) {
    const item = lightboxItems[idx];
    if (!item) return;

    // Get image src
    const img = item.querySelector('img');
    const placeholder = item.querySelector('.gallery-placeholder');

    if (img) {
      lbImg.src = img.src;
      lbImg.alt = item.dataset.caption || '';
      lbImg.style.display = 'block';
    } else if (placeholder) {
      lbImg.style.display = 'none';
    }

    lbCaption.textContent = item.dataset.caption || '';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  if (lbPrev) lbPrev.addEventListener('click', () => {
    lightboxIndex = (lightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
    showLightboxItem(lightboxIndex);
  });
  if (lbNext) lbNext.addEventListener('click', () => {
    lightboxIndex = (lightboxIndex + 1) % lightboxItems.length;
    showLightboxItem(lightboxIndex);
  });

  document.addEventListener('keydown', (e) => {
    if (!lightbox?.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lbPrev?.click();
    if (e.key === 'ArrowRight') lbNext?.click();
  });

  // Click existing placeholder items
  updateLightboxItems();
  lightboxItems.forEach(item => {
    item.addEventListener('click', () => openLightbox(item));
  });
}

// ── Route Simulator ──────────────────────────────────────
function initSimulator() {
  const playBtn    = $('#simPlay');
  const resetBtn   = $('#simReset');
  const progressFill = $('#simProgressFill');
  const simLocation  = $('#simLocation');
  const simDesc      = $('#simDesc');
  const simDayText   = $('#simDayText');
  const steps        = $$('.sim-step');
  const traveller    = $('#traveller');

  if (!playBtn) return;

  // Waypoints: [x, y, location, desc, dayText]
  const waypoints = [
    { x: 60,  y: 325, location: '🏠 Delhi — Starting Point',     desc: 'Kashmere Gate ISBT · Dec 4, Evening',          day: 'Day 0 · Night Departure' },
    { x: 200, y: 300, location: '🏔 Shimla — Mountain Gateway',   desc: 'Switch to Traveller · Dec 5, Morning',          day: 'Day 1 · Shimla Arrival' },
    { x: 350, y: 290, location: '🛕 Sarahan — Bhimakali Temple',  desc: 'Ancient temple visit · Kinnaur Gate',           day: 'Day 1 · Sarahan' },
    { x: 460, y: 280, location: '🚪 Kinnaur Gate',               desc: 'Gateway to the valley of Kinnaur',              day: 'Day 1 · Kinnaur Entry' },
    { x: 580, y: 268, location: '🏘️ Chitkul — Last Village',     desc: 'India\'s last village · 3600m altitude',        day: 'Day 1–2 · Chitkul' },
    { x: 680, y: 260, location: '⛰️ Kalpa — Kinner Kailash',     desc: 'Sacred peaks · Roghi Point · Apple Village',   day: 'Day 3 · Kalpa' },
  ];

  let currentStep = 0;
  let animating = false;
  let animTimeout = null;

  function setStep(idx, animate = true) {
    const wp = waypoints[idx];
    if (!wp) return;

    // Move traveller
    if (traveller) {
      if (animate) {
        traveller.style.transition = 'transform 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      }
      traveller.setAttribute('transform', `translate(${wp.x - 15}, ${wp.y - 22})`);
    }

    // Update progress bar
    const pct = (idx / (waypoints.length - 1)) * 100;
    if (progressFill) progressFill.style.width = `${pct}%`;

    // Update steps
    steps.forEach((s, i) => s.classList.toggle('active', i <= idx));

    // Update info
    if (simLocation) simLocation.textContent = wp.location;
    if (simDesc) simDesc.textContent = wp.desc;
    if (simDayText) simDayText.textContent = wp.day;

    currentStep = idx;
  }

  function playJourney() {
    if (animating) return;
    animating = true;
    playBtn.textContent = '⏸ Playing...';
    playBtn.disabled = true;

    function next(idx) {
      if (idx >= waypoints.length) {
        animating = false;
        playBtn.textContent = '▶ Play Again';
        playBtn.disabled = false;
        Toast.show('Journey complete! Chitkul & Kalpa await! 🏔', 'success', 4000);
        return;
      }
      setStep(idx, true);

      // Show pulse on current dot
      const svgDots = document.querySelectorAll('#routeSvg circle');
      if (svgDots[idx]) {
        svgDots[idx].style.animation = 'none';
        svgDots[idx].setAttribute('r', '14');
        setTimeout(() => svgDots[idx].setAttribute('r', idx === 4 ? '12' : (idx === 5 ? '11' : '8')), 400);
      }

      animTimeout = setTimeout(() => next(idx + 1), 1500);
    }

    setStep(0, false);
    animTimeout = setTimeout(() => next(1), 800);
  }

  function resetJourney() {
    clearTimeout(animTimeout);
    animating = false;
    playBtn.textContent = '▶ Play Journey';
    playBtn.disabled = false;
    if (traveller) traveller.style.transition = 'none';
    setStep(0, false);
    Toast.show('Route reset to Delhi!', 'info', 2000);
  }

  playBtn.addEventListener('click', () => {
    if (playBtn.textContent.includes('Again')) {
      resetJourney();
      setTimeout(playJourney, 100);
    } else {
      playJourney();
    }
  });

  resetBtn?.addEventListener('click', resetJourney);

  // Init
  setStep(0, false);
}

// ── Packing Checklist ────────────────────────────────────
function initChecklist() {
  const grid        = $('#checklistGrid');
  const fillEl      = $('#checklistFill');
  const countEl     = $('#checklistCount');
  const emojiEl     = $('#checklistEmoji');
  const resetBtn    = $('#checklistReset');
  const checkAllBtn = $('#checklistCheckAll');

  if (!grid) return;

  const checkboxes = $$('input[type="checkbox"]', grid);
  const STORAGE_KEY = 'chitkul-kalpa-checklist';

  const emojis = {
    0:   { emoji: '🎒', label: 'Start packing!' },
    25:  { emoji: '📦', label: 'Good start!' },
    50:  { emoji: '👍', label: 'Halfway there!' },
    75:  { emoji: '🔥', label: 'Almost ready!' },
    100: { emoji: '✅', label: 'All packed! Let\'s go!' }
  };

  function getEmoji(pct) {
    const thresholds = [100, 75, 50, 25, 0];
    for (const t of thresholds) {
      if (pct >= t) return emojis[t];
    }
    return emojis[0];
  }

  function updateProgress() {
    const checked = checkboxes.filter(cb => cb.checked).length;
    const total   = checkboxes.length;
    const pct     = total > 0 ? Math.round((checked / total) * 100) : 0;

    if (fillEl) fillEl.style.width = `${pct}%`;
    if (countEl) countEl.textContent = `${checked} of ${total} items packed (${pct}%)`;

    const { emoji } = getEmoji(pct);
    if (emojiEl) emojiEl.textContent = emoji;

    // Milestone toasts
    if (pct === 100 && checked === total) {
      Toast.show('🎉 All packed! Ready for Chitkul & Kalpa!', 'success', 4000);
    }
  }

  function saveState() {
    const state = {};
    checkboxes.forEach(cb => { state[cb.dataset.id] = cb.checked; });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      checkboxes.forEach(cb => {
        if (saved[cb.dataset.id]) cb.checked = true;
      });
    } catch(e) {}
  }

  // Listen to changes
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      updateProgress();
      saveState();
      if (cb.checked) {
        const label = cb.closest('label')?.textContent?.trim();
        if (label) Toast.show(`✓ ${label} packed!`, 'success', 1800);
      }
    });
  });

  // Reset
  resetBtn?.addEventListener('click', () => {
    checkboxes.forEach(cb => cb.checked = false);
    updateProgress();
    saveState();
    Toast.show('Checklist reset!', 'info', 2000);
  });

  // Check all
  checkAllBtn?.addEventListener('click', () => {
    const anyUnchecked = checkboxes.some(cb => !cb.checked);
    checkboxes.forEach(cb => cb.checked = anyUnchecked);
    updateProgress();
    saveState();
    Toast.show(anyUnchecked ? '✅ All items checked!' : 'All items unchecked.', anyUnchecked ? 'success' : 'info', 2500);
  });

  loadState();
  updateProgress();
}

// ── Smooth Scroll ────────────────────────────────────────
function initSmoothScroll() {
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;
        const top = target.getBoundingClientRect().top + window.scrollY - navH;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Toast.init();
  initLoader();
  initScrollProgress();
  initScrollTop();
  initNavbar();
  initParticles();
  initCountdown();
  initTimeline();
  initReveal();
  initGallery();
  initSimulator();
  initChecklist();
  initSmoothScroll();

  // Welcome toast after load
  setTimeout(() => {
    Toast.show('🏔 Welcome to Sarthak\'s Chitkul Kalpa trip site!', 'info', 3500);
  }, 2000);
});

