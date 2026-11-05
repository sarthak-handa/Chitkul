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

  // Target: 4 Dec 2026 20:00:00 IST (+05:30)
  const target = new Date('2026-12-04T20:00:00+05:30').getTime();

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

// ── Cursor spotlight ─────────────────────────────────────
function initSpotlight() {
  const spot = $('#fxSpot');
  if (!spot || matchMedia('(hover: none)').matches) return;
  let x = -999, y = -999, raf = null;
  window.addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    if (!raf) raf = requestAnimationFrame(() => {
      spot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = null;
    });
  }, { passive: true });
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
  initChecklist();
  initSmoothScroll();
  initSpotlight();

  // Fade in hero background image when loaded
  const heroBgImg = document.querySelector('.hero__bg-img');
  if (heroBgImg) {
    if (heroBgImg.complete) {
      heroBgImg.classList.add('loaded');
    } else {
      heroBgImg.addEventListener('load', () => heroBgImg.classList.add('loaded'));
    }
  }

  // Welcome toast after load
  setTimeout(() => {
    Toast.show('🏔 Welcome to Sarthak\'s Chitkul Kalpa trip site!', 'info', 3500);
  }, 2000);
});

