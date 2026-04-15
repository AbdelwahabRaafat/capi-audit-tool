/* ════════════════════════════════════════════════
   Landing page JS — scroll reveal + nav effects
   ════════════════════════════════════════════════ */

// ── Scroll-reveal ──
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, i * 80);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
reveals.forEach(el => observer.observe(el));

// ── Navbar scroll effect ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    navbar.style.boxShadow = '0 8px 40px rgba(0,0,0,0.4)';
  } else {
    navbar.style.boxShadow = 'none';
  }
}, { passive: true });

// ── Mobile menu ──
function toggleMenu() {
  const menu  = document.getElementById('mobileMenu');
  const burgerBtn = document.getElementById('hamburger');
  menu.classList.toggle('open');
  burgerBtn.classList.toggle('open');
}

// ── Smooth scroll for # links ──
document.querySelectorAll('a[href^="#"]').forEach(el => {
  el.addEventListener('click', e => {
    const target = document.querySelector(el.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Funnel bars animate in when visible ──
const funnelBars = document.querySelectorAll('.funnel-bar');
const funnelObs  = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // Bars already have width set via inline style; just make them visible
      entry.target.style.opacity = '1';
      funnelObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });
funnelBars.forEach(b => {
  b.style.opacity = '0';
  b.style.transition = 'opacity 0.6s ease, width 1s ease';
  funnelObs.observe(b);
});

// ── Crisis stat bars fill on scroll ──
const cstatFills = document.querySelectorAll('.cstat-fill');
const cstatObs   = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const targetW = el.style.width;
      el.style.width = '0%';
      requestAnimationFrame(() => {
        el.style.transition = 'width 1.2s cubic-bezier(0.4,0,0.2,1)';
        el.style.width = targetW;
      });
      cstatObs.unobserve(el);
    }
  });
}, { threshold: 0.5 });
cstatFills.forEach(el => cstatObs.observe(el));

// ── Active nav link highlight on scroll ──
const sections  = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('.nav-link');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
  });
  navLinks.forEach(link => {
    link.style.color = link.getAttribute('href') === `#${current}` ? '#818cf8' : '';
    link.style.background = link.getAttribute('href') === `#${current}` ? 'rgba(99,102,241,0.08)' : '';
  });
}, { passive: true });

// ── Lead Modal ──
const LEAD_API = window.location.protocol === 'file:'
  ? 'https://idyllic-alpaca-f5e25b.netlify.app/.netlify/functions/send-lead'
  : '/.netlify/functions/send-lead';

let _currentService = '';

function openLeadModal(service) {
  _currentService = service || '';
  document.getElementById('leadModalService').textContent = service || 'General Inquiry';
  document.getElementById('leadForm').style.display    = 'block';
  document.getElementById('leadSuccess').style.display = 'none';
  document.getElementById('leadError').style.display   = 'none';
  document.getElementById('leadSubmitBtn').disabled    = false;
  document.getElementById('leadSubmitBtn').textContent = 'Send My Request \u2192';

  // Auto-fill Audit ID if user completed the audit in this session
  const auditIdField = document.getElementById('leadAuditId');
  if (auditIdField && window._auditResults && window._auditResults.auditId) {
    auditIdField.value = window._auditResults.auditId;
  }

  const modal = document.getElementById('leadModal');
  modal.style.display = 'flex';
  setTimeout(() => { modal.style.opacity = '1'; }, 10);
  document.body.style.overflow = 'hidden';
}

function closeLeadModal() {
  const modal = document.getElementById('leadModal');
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLeadModal();
});

async function submitLeadForm() {
  const name       = (document.getElementById('leadName').value || '').trim();
  const email      = (document.getElementById('leadEmail').value || '').trim();
  const websiteUrl = (document.getElementById('leadWebsite').value || '').trim();
  const adSpend    = (document.getElementById('leadAdSpend') ? document.getElementById('leadAdSpend').value : '') || '';
  const platform   = (document.getElementById('leadPlatform') ? document.getElementById('leadPlatform').value : '') || '';
  const auditId    = (document.getElementById('leadAuditId') ? document.getElementById('leadAuditId').value : '').trim();
  const message    = (document.getElementById('leadMessage') ? document.getElementById('leadMessage').value : '').trim();
  const errEl      = document.getElementById('leadError');
  const btn        = document.getElementById('leadSubmitBtn');

  if (!email || !email.includes('@')) {
    errEl.textContent = 'Please enter a valid business email.';
    errEl.style.display = 'block';
    return;
  }
  if (!adSpend) {
    errEl.textContent = 'Please select your monthly ad spend range.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  btn.disabled    = true;
  btn.textContent = 'Sending\u2026';

  try {
    await fetch(LEAD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, websiteUrl, service: _currentService, adSpend, platform, auditId, message }),
    });
    document.getElementById('leadSuccessEmail').textContent = email;
    document.getElementById('leadForm').style.display    = 'none';
    document.getElementById('leadSuccess').style.display = 'block';
  } catch (_) {
    document.getElementById('leadSuccessEmail').textContent = email;
    document.getElementById('leadForm').style.display    = 'none';
    document.getElementById('leadSuccess').style.display = 'block';
  }
}


