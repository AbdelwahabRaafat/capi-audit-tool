/* ════════════════════════════════════════════════
   SIGNAL AUDIT — SCORING ENGINE (i18n-aware)
   ════════════════════════════════════════════════ */

const state = { currentStep: 0, totalSteps: 5, answers: {}, emailSent: false };

/* API endpoint — switches automatically between local dev and production.
   If testing on localhost/file, replace the URL below with your actual Netlify site URL. */
const API_URL = window.location.hostname === 'localhost' || window.location.protocol === 'file:'
  ? 'https://YOUR-NETLIFY-SITE.netlify.app/.netlify/functions/send-report'
  : '/.netlify/functions/send-report';

// ── NAVIGATION ──
function goToStep(n) {
  if (state.currentStep === 0 && n === 1) {
    const name = document.getElementById('clientName').value.trim();
    const biz  = document.getElementById('businessName').value.trim();
    if (!name || !biz) {
      shakeElement(document.getElementById('startBtn'));
      pulseLabel(!name ? 'clientName' : 'businessName');
      return;
    }
  }
  if (n === 5) computeAndRenderResults();
  document.getElementById(`step-${state.currentStep}`).classList.remove('active');
  state.currentStep = n;
  document.getElementById(`step-${n}`).classList.add('active');
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgress() {
  const pct = state.currentStep === 0 ? 0 : (state.currentStep / (state.totalSteps - 1)) * 100;
  document.getElementById('progressBar').style.width = pct + '%';
}

function shakeElement(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.4s cubic-bezier(.36,.07,.19,.97)';
  if (!document.getElementById('shakeKeyframes')) {
    const style = document.createElement('style');
    style.id = 'shakeKeyframes';
    style.textContent = '@keyframes shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-6px)}40%,60%{transform:translateX(6px)}}';
    document.head.appendChild(style);
  }
}

function pulseLabel(inputId) {
  const input = document.getElementById(inputId);
  input.style.borderColor = 'rgba(239,68,68,0.6)';
  input.focus();
  setTimeout(() => { input.style.borderColor = ''; }, 2000);
}

// ── OPTION SELECTION ──
function selectOption(el) {
  el.parentElement.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  state.answers[el.dataset.q] = el.dataset.v;
}

// ── CHECKBOX HELPER ──
function getCheckboxValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

// ── SCORING ENGINE ──
function computeScore() {
  const a = state.answers;
  let score = 10;
  const issues = [];
  const opportunities = [];
  let signalLoss = 5;

  // Pixel
  if (a.pixel === 'no' || a.pixel === 'unsure') {
    issues.push({ severity: 'high', icon: '🚫',
      title: t('issue_noPixel_title'), body: t('issue_noPixel_body'), badge: t('issue_noPixel_badge') });
    score -= 3; signalLoss += 40;
  } else if (a.pixel === 'partial') {
    issues.push({ severity: 'mid', icon: '⚠️',
      title: t('issue_partialPixel_title'), body: t('issue_partialPixel_body'), badge: t('issue_partialPixel_badge') });
    score -= 1.5; signalLoss += 20;
  }

  // CAPI
  if (a.capi === 'no') {
    issues.push({ severity: 'high', icon: '🔌',
      title: t('issue_noCapi_title'), body: t('issue_noCapi_body'), badge: t('issue_noCapi_badge') });
    score -= 2.5; signalLoss += 35;
    opportunities.push({ icon: '⚡', title: t('opp_capi_title'), body: t('opp_capi_body') });
  } else if (a.capi === 'unsure') {
    issues.push({ severity: 'mid', icon: '❓',
      title: t('issue_unsureCapi_title'), body: t('issue_unsureCapi_body'), badge: t('issue_unsureCapi_badge') });
    score -= 1; signalLoss += 15;
  }

  // Deduplication
  if ((a.pixel === 'yes' || a.pixel === 'partial') && a.capi === 'yes' && (a.dedup === 'no' || a.dedup === 'probably')) {
    const isConf = a.dedup === 'probably';
    issues.push({ severity: isConf ? 'mid' : 'high', icon: '🔁',
      title: isConf ? t('issue_dedupUnconf_title') : t('issue_dedup_title'),
      body:  isConf ? t('issue_dedupUnconf_body')  : t('issue_dedup_body'),
      badge: isConf ? t('issue_dedupUnconf_badge') : t('issue_dedup_badge') });
    score -= isConf ? 0.8 : 2; signalLoss += isConf ? 5 : 15;
    opportunities.push({ icon: '🔧', title: t('opp_dedup_title'), body: t('opp_dedup_body') });
  }

  // CAPI method
  if (a.capiMethod === 'gateway') {
    issues.push({ severity: 'low', icon: '🌐',
      title: t('issue_gateway_title'), body: t('issue_gateway_body'), badge: t('issue_gateway_badge') });
    score -= 0.5; signalLoss += 5;
  } else if (a.capiMethod === 'partner') {
    issues.push({ severity: 'low', icon: '🔗',
      title: t('issue_partner_title'), body: t('issue_partner_body'), badge: t('issue_partner_badge') });
    score -= 0.5;
  }

  // Identity data
  const identityChecks = getCheckboxValues('q_identity');
  const identityScore  = identityChecks.filter(v => ['email','phone','name','city','zip','fbclid'].includes(v)).length;
  if (identityScore === 0) {
    issues.push({ severity: 'high', icon: '👤',
      title: t('issue_noIdentity_title'), body: t('issue_noIdentity_body'), badge: t('issue_noIdentity_badge') });
    score -= 2.5; signalLoss += 25;
  } else if (identityScore <= 2) {
    issues.push({ severity: 'mid', icon: '👤',
      title: t('issue_lowIdentity_title'),
      body: `${t('issue_lowIdentity_badgePrefix')} ${identityScore} ${t('issue_lowIdentity_badgeSuffix')}`,
      badge: t('issue_lowIdentity_badge') });
    score -= 1; signalLoss += 10;
    opportunities.push({ icon: '✨', title: t('opp_enrichment_title'), body: t('opp_enrichment_body') });
  }

  // EMQ
  if (a.emq === 'low') {
    issues.push({ severity: 'high', icon: '📉',
      title: t('issue_lowEmq_title'), body: t('issue_lowEmq_body'), badge: t('issue_lowEmq_badge') });
    score -= 1; signalLoss += 10;
  } else if (a.emq === 'unknown') {
    issues.push({ severity: 'mid', icon: '🔍',
      title: t('issue_unknownEmq_title'), body: t('issue_unknownEmq_body'), badge: t('issue_unknownEmq_badge') });
    score -= 0.5;
    opportunities.push({ icon: '📊', title: t('opp_monitoring_title'), body: t('opp_monitoring_body') });
  }

  // CRM
  if (a.crm && a.crm !== 'none') {
    const crmName = a.crm === 'sheets'
      ? t('issue_crm_sheets')
      : a.crm.charAt(0).toUpperCase() + a.crm.slice(1);
    issues.push({ severity: 'mid', icon: '📋',
      title: t('issue_crm_title'),
      body:  `${t('opp_crm_prefix')}${crmName}${t('opp_crm_suffix')} — ${t('opp_crm_body')}`,
      badge: t('issue_crm_badge') });
    score -= 0.8; signalLoss += 8;
    const crmLabel = a.crm === 'sheets' ? t('opp_crm_sheets') : a.crm.charAt(0).toUpperCase() + a.crm.slice(1);
    opportunities.push({ icon: '🔗',
      title: `${t('opp_crm_prefix')}${crmLabel}${t('opp_crm_suffix')}`,
      body: t('opp_crm_body') });
  }

  // Offline
  if (a.offline === 'yes_unsynced') {
    issues.push({ severity: 'high', icon: '🏪',
      title: t('issue_offlineUnsynced_title'), body: t('issue_offlineUnsynced_body'), badge: t('issue_offlineUnsynced_badge') });
    score -= 1.5; signalLoss += 15;
    opportunities.push({ icon: '🏪', title: t('opp_offline_title'), body: t('opp_offline_body') });
  }

  // Events Manager monitoring
  if (a.eventsmanager === 'never' || a.eventsmanager === 'unknown') {
    issues.push({ severity: 'low', icon: '👁️',
      title: t('issue_noMonitor_title'), body: t('issue_noMonitor_body'), badge: t('issue_noMonitor_badge') });
    score -= 0.3;
  }

  // Spend weight
  const spendMultiplier = { '0': 1, '1': 1.1, '2': 1.2, '3': 1.35 }[a.spend] || 1;
  signalLoss = Math.min(Math.round(signalLoss * spendMultiplier), 75);
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  // Positive opportunities
  if (a.capi === 'yes' && a.dedup === 'yes' && identityScore >= 4) {
    opportunities.push({ icon: '🏆', title: t('opp_solidBase_title'), body: t('opp_solidBase_body') });
  }
  if (a.email_list === 'large' || a.email_list === 'medium') {
    opportunities.push({ icon: '📧', title: t('opp_email_title'), body: t('opp_email_body') });
  }

  return { score, issues, opportunities, signalLoss };
}

// ── RENDER RESULTS ──
function computeAndRenderResults() {
  const { score, issues, opportunities, signalLoss } = computeScore();

  const circumference = 2 * Math.PI * 82;
  const offset = circumference - (score / 10) * circumference;
  const ringFill = document.getElementById('ringFill');

  let ringColor, gradeKey, descKey;
  if (score >= 8)      { ringColor = '#22c55e'; gradeKey = 'grade_strong';   descKey = 'desc_strong'; }
  else if (score >= 6) { ringColor = '#f59e0b'; gradeKey = 'grade_moderate'; descKey = 'desc_moderate'; }
  else if (score >= 4) { ringColor = '#f97316'; gradeKey = 'grade_high';     descKey = 'desc_high'; }
  else                 { ringColor = '#ef4444'; gradeKey = 'grade_critical';  descKey = 'desc_critical'; }

  ringFill.style.stroke = ringColor;
  setTimeout(() => { ringFill.style.strokeDashoffset = offset; }, 100);
  document.getElementById('scoreGrade').textContent = t(gradeKey);
  document.getElementById('scoreDesc').textContent  = t(descKey);
  document.getElementById('lossValue').textContent  = `~${signalLoss}% ${t('issues_section').toLowerCase()}`;

  // Animate score number
  let current = 0;
  const step = score / 40;
  const interval = setInterval(() => {
    current = Math.min(current + step, score);
    document.getElementById('scoreNumber').textContent = current.toFixed(1);
    if (current >= score) clearInterval(interval);
  }, 30);

  // Issues
  const issuesList = document.getElementById('issuesList');
  issuesList.innerHTML = '';
  document.getElementById('issueCount').textContent = `${issues.length}`;
  issues.forEach(issue => {
    const div = document.createElement('div');
    div.className = `issue-item severity-${issue.severity}`;
    div.innerHTML = `
      <div class="issue-icon">${issue.icon}</div>
      <div>
        <div class="issue-title">${issue.title}</div>
        <div class="issue-body">${issue.body}</div>
        <span class="issue-badge">${issue.badge}</span>
      </div>`;
    issuesList.appendChild(div);
  });

  // Opportunities
  const oppList = document.getElementById('opportunitiesList');
  oppList.innerHTML = '';
  opportunities.forEach(opp => {
    const div = document.createElement('div');
    div.className = 'opp-item';
    div.innerHTML = `
      <div class="opp-icon">${opp.icon}</div>
      <div>
        <div class="opp-title">${opp.title}</div>
        <div class="opp-body">${opp.body}</div>
      </div>`;
    oppList.appendChild(div);
  });

  // Headline with business name
  const bizName = document.getElementById('businessName').value.trim();
  const defaultH = t('results_default_h');
  document.getElementById('resultsHeadline').textContent =
    bizName ? `${defaultH} — ${bizName}` : defaultH;

  /* Pre-fill email from step 0 */
  const emailField = document.getElementById('reportEmailField');
  if (emailField && !emailField.value) {
    const stepEmail = document.getElementById('auditorEmail');
    if (stepEmail && stepEmail.value) emailField.value = stepEmail.value;
  }

  window._auditResults = { score, issues, opportunities, signalLoss, gradeKey, descKey };
}

// ── EMAIL REPORT (primary CTA) ──
async function emailReport() {
  const btn     = document.getElementById('emailReportBtn');
  const statusEl = document.getElementById('emailStatus');
  const email   = (document.getElementById('reportEmailField') || document.getElementById('auditorEmail') || {}).value || '';
  const trimmedEmail = email.trim();

  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    statusEl.innerHTML = `<span style="color:#ef4444">${t('email_invalid')}</span>`;
    return;
  }

  /* UI: loading */
  btn.disabled = true;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span>${t('email_sending')}</span>`;
  statusEl.innerHTML = '';

  if (!document.getElementById('spinKeyframes')) {
    const s = document.createElement('style');
    s.id = 'spinKeyframes';
    s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }

  try {
    /* Step 1 — generate PDF blob */
    statusEl.innerHTML = `<span style="color:#94a3b8">${t('email_generating')}</span>`;
    const pdfBase64 = await generatePDFBase64();

    /* Step 2 — POST to Netlify function */
    statusEl.innerHTML = `<span style="color:#94a3b8">${t('email_uploading')}</span>`;
    const R = window._auditResults;

    let responseOk = false;
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         document.getElementById('clientName').value.trim(),
          email:        trimmedEmail,
          businessName: document.getElementById('businessName').value.trim(),
          websiteUrl:   document.getElementById('websiteUrl').value.trim(),
          score:        R.score,
          gradeKey:     R.gradeKey,
          signalLoss:   R.signalLoss,
          issues:       R.issues,
          pdfBase64,
        }),
      });
      /* Treat any 2xx as success — function may time out AFTER successfully sending */
      if (response.status >= 200 && response.status < 300) responseOk = true;
      else {
        let result = {};
        try { result = await response.json(); } catch (_) {}
        throw new Error(result.error || `HTTP ${response.status}`);
      }
    } catch (fetchErr) {
      /* If it was a network timeout but status was already 2xx, treat as success */
      if (!responseOk) throw fetchErr;
    }

    /* Step 3 — success */
    state.emailSent = true;
    btn.disabled = true;
    btn.innerHTML = `✓ <span>${t('email_sent_btn')}</span>`;
    btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
    statusEl.innerHTML = `<span style="color:#86efac;font-size:13px">✉️ ${t('email_sent_msg')} <strong>${trimmedEmail}</strong> — ${t('email_check_spam') || 'Check your spam/junk folder if not visible in inbox.'}</span>`;

    /* Always show fallback download link after send */
    document.getElementById('directDownloadWrap').style.display = 'block';

  } catch (err) {
    console.error('Email send failed:', err);
    /* If email may have gone through anyway (e.g. timeout), show ambiguous message */
    btn.disabled = false;
    btn.innerHTML = `✗ <span>${t('email_failed_btn')}</span>`;
    statusEl.innerHTML = `<span style="color:#fca5a5;font-size:13px">${t('email_failed_msg')} — <a href="#" onclick="directDownload();return false;" style="color:#818cf8;text-decoration:underline">${t('email_failed_download')}</a></span>`;
  }
}

// ── GENERATE PDF AS BASE64 (used by email flow) ──
function generatePDFBase64() {
  return new Promise((resolve, reject) => {
    try {
      const doc = buildPDFDoc();
      const pdfOutput = doc.output('datauristring');
      /* strip the data:application/pdf;base64, prefix */
      const base64 = pdfOutput.split(',')[1];
      resolve(base64);
    } catch (e) {
      reject(e);
    }
  });
}

// ── DIRECT DOWNLOAD (fallback) ──
function directDownload() {
  const doc = buildPDFDoc();
  const bizName = document.getElementById('businessName').value.trim() || 'Report';
  const today   = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  doc.save(`Signal-Audit-${bizName.replace(/\s+/g,'-')}-${today.replace(/\s/g,'-')}.pdf`);
}

// ── EMOJI STRIPPER (jsPDF Helvetica cannot render emoji — outputs gibberish) ──
function stripEmoji(str) {
  if (!str) return '';
  // Remove emoji & non-latin symbols that jsPDF can't render
  return String(str)
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u2702-\u27B0]/gu,      '')
    .replace(/[\u24C2-\u{1F251}]/gu,   '')
    .replace(/\uFE0F/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu,'')
    .trim();
}

// ── PDF GENERATION (shared builder) ──
function buildPDFDoc() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const R   = window._auditResults;
  const clientName   = stripEmoji(document.getElementById('clientName').value.trim()   || 'Client');
  const businessName = stripEmoji(document.getElementById('businessName').value.trim() || 'Business');
  const websiteUrl   = document.getElementById('websiteUrl').value.trim() || 'N/A';
  const today        = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const W = 210;
  const PAGE_BG   = [15, 20, 35];   // dark navy — used as page background
  const CARD_BG   = [22, 30, 50];   // slightly lighter card
  const TEXT_HEAD = [255, 255, 255]; // white headings
  const TEXT_BODY = [200, 210, 228]; // light-blue-gray body text (high contrast on dark)
  const TEXT_MUTE = [160, 175, 200]; // muted label text
  let y = 0;

  // ── PAGE BACKGROUND ──
  doc.setFillColor(...PAGE_BG);
  doc.rect(0, 0, W, 297, 'F');

  // ── HEADER BAND ──
  doc.setFillColor(40, 40, 120);
  doc.rect(0, 0, W, 54, 'F');
  // Purple pill label
  doc.setFillColor(99, 102, 241);
  doc.roundedRect(14, 12, 52, 8, 2, 2, 'F');
  doc.setTextColor(...TEXT_HEAD);
  doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.text(stripEmoji(t('pdf_tagline')), 18, 18);
  // Business name
  doc.setFontSize(17); doc.setFont('helvetica', 'bold');
  doc.text(businessName, 14, 34);
  // Meta line
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_MUTE);
  const metaLine = `${stripEmoji(t('pdf_prepared'))}: ${clientName}  |  ${websiteUrl}  |  ${today}`;
  doc.text(metaLine, 14, 44);
  // Self-assessment disclaimer
  doc.setFontSize(6.5); doc.setTextColor(180, 190, 220);
  doc.text('Self-Assessment Report — Based on answers provided by the advertiser', 14, 51);
  y = 62;

  // ── SCORE BOX ──
  const scoreRGB = R.score >= 8 ? [34,197,94] : R.score >= 6 ? [245,158,11] : R.score >= 4 ? [249,115,22] : [239,68,68];
  doc.setFillColor(...CARD_BG);
  doc.roundedRect(14, y, W - 28, 40, 4, 4, 'F');
  doc.setDrawColor(...scoreRGB); doc.setLineWidth(0.6);
  doc.roundedRect(14, y, W - 28, 40, 4, 4, 'S');
  // Big score number
  doc.setFontSize(34); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreRGB);
  doc.text(`${R.score.toFixed(1)}`, 28, y + 26);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_MUTE);
  doc.text('/10', 28, y + 34);
  // Grade label
  const gradeText = stripEmoji(t(R.gradeKey));
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreRGB);
  doc.text(gradeText, 76, y + 16);
  // Description
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_BODY);
  const descLines = doc.splitTextToSize(stripEmoji(t(R.descKey)), 118);
  doc.text(descLines, 76, y + 24);
  y += 48;

  // ── SIGNAL LOSS BANNER ──
  doc.setFillColor(80, 20, 20);
  doc.roundedRect(14, y, W - 28, 16, 3, 3, 'F');
  doc.setDrawColor(239, 68, 68); doc.setLineWidth(0.3);
  doc.roundedRect(14, y, W - 28, 16, 3, 3, 'S');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 200, 200);
  doc.text(stripEmoji(t('pdf_signal_loss')), 22, y + 7);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 100, 100);
  doc.text(`~${R.signalLoss}%`, 22, y + 14);
  y += 24;

  // ── ISSUES ──
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_HEAD);
  doc.text(`${stripEmoji(t('pdf_issues_found'))} (${R.issues.length})`, 14, y); y += 8;

  const sevCfg = {
    high: { bg: [65, 18, 18],  border: [239, 68,  68],  badgeText: [255, 180, 180] },
    mid:  { bg: [55, 38, 10],  border: [245, 158, 11],  badgeText: [255, 220, 120] },
    low:  { bg: [20, 22, 60],  border: [99,  102, 241], badgeText: [180, 190, 255] },
  };

  R.issues.forEach(issue => {
    const c   = sevCfg[issue.severity] || sevCfg.low;
    const titleClean = stripEmoji(issue.title);
    const bodyClean  = stripEmoji(issue.body);
    const badgeClean = stripEmoji(issue.badge).toUpperCase();
    const bodyLines  = doc.splitTextToSize(bodyClean, W - 48);
    const boxH       = 9 + bodyLines.length * 4.8 + 10;
    if (y + boxH > 278) { doc.addPage(); doc.setFillColor(...PAGE_BG); doc.rect(0,0,W,297,'F'); y = 18; }
    doc.setFillColor(...c.bg);
    doc.roundedRect(14, y, W - 28, boxH, 3, 3, 'F');
    doc.setDrawColor(...c.border); doc.setLineWidth(0.35);
    doc.roundedRect(14, y, W - 28, boxH, 3, 3, 'S');
    // Title
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_HEAD);
    doc.text(titleClean, 20, y + 8);
    // Body
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_BODY);
    doc.text(bodyLines, 20, y + 14);
    // Badge
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...c.badgeText);
    doc.text(badgeClean, 20, y + boxH - 3);
    y += boxH + 5;
  });

  y += 4;

  // ── OPPORTUNITIES ──
  if (R.opportunities.length > 0) {
    if (y + 18 > 272) { doc.addPage(); doc.setFillColor(...PAGE_BG); doc.rect(0,0,W,297,'F'); y = 18; }
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT_HEAD);
    doc.text(`${stripEmoji(t('pdf_actions'))} (${R.opportunities.length})`, 14, y); y += 8;
    R.opportunities.forEach(opp => {
      const titleClean = stripEmoji(opp.title);
      const bodyClean  = stripEmoji(opp.body);
      const bodyLines  = doc.splitTextToSize(bodyClean, W - 48);
      const boxH       = 9 + bodyLines.length * 4.8 + 4;
      if (y + boxH > 278) { doc.addPage(); doc.setFillColor(...PAGE_BG); doc.rect(0,0,W,297,'F'); y = 18; }
      doc.setFillColor(12, 32, 20);
      doc.roundedRect(14, y, W - 28, boxH, 3, 3, 'F');
      doc.setDrawColor(34, 180, 94); doc.setLineWidth(0.35);
      doc.roundedRect(14, y, W - 28, boxH, 3, 3, 'S');
      doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(120, 240, 160);
      doc.text(titleClean, 20, y + 8);
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_BODY);
      doc.text(bodyLines, 20, y + 14);
      y += boxH + 5;
    });
  }

  // ── FOOTER CTA ──
  if (y + 32 > 278) { doc.addPage(); doc.setFillColor(...PAGE_BG); doc.rect(0,0,W,297,'F'); y = 18; }
  y += 8;
  doc.setFillColor(30, 30, 75);
  doc.roundedRect(14, y, W - 28, 30, 4, 4, 'F');
  doc.setDrawColor(99, 102, 241); doc.setLineWidth(0.3);
  doc.roundedRect(14, y, W - 28, 30, 4, 4, 'S');
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(200, 205, 255);
  doc.text(stripEmoji(t('pdf_cta_1')), 22, y + 10);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_BODY);
  const ctaLines = doc.splitTextToSize(stripEmoji(t('pdf_cta_2')), W - 44);
  doc.text(ctaLines, 22, y + 17);
  doc.setTextColor(140, 150, 255);
  doc.text(stripEmoji(t('pdf_cta_3')), 22, y + 27);

  return doc;
}

// ── RESTART ──
function restartAudit() {
  state.answers = {}; state.emailSent = false;
  document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  ['clientName','businessName','websiteUrl','auditorEmail','reportEmailField'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const emailStatus = document.getElementById('emailStatus');
  if (emailStatus) emailStatus.innerHTML = '';
  const downloadWrap = document.getElementById('directDownloadWrap');
  if (downloadWrap) downloadWrap.style.display = 'none';
  const btn = document.getElementById('emailReportBtn');
  if (btn) { btn.disabled = false; btn.style.background = ''; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> <span>${t('btn_email_report')}</span>`; }
  goToStep(0);
}

updateProgress();
