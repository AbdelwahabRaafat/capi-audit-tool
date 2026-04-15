/* ════════════════════════════════════════════════
   SIGNAL AUDIT — SCORING ENGINE (i18n-aware)
   ════════════════════════════════════════════════ */

const state = { currentStep: 0, totalSteps: 5, answers: {}, emailSent: false };

/* API endpoint — switches automatically between local dev and production */
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

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Send failed');

    /* Step 3 — success */
    state.emailSent = true;
    btn.innerHTML = `✅ <span>${t('email_sent_btn')}</span>`;
    btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
    statusEl.innerHTML = `<span style="color:#86efac;font-size:13px">✉️ ${t('email_sent_msg')} <strong>${trimmedEmail}</strong></span>`;

    /* Show fallback download link */
    document.getElementById('directDownloadWrap').style.display = 'block';

  } catch (err) {
    console.error('Email send failed:', err);
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4l16 16M4 20L20 4"/></svg> <span>${t('email_failed_btn')}</span>`;
    statusEl.innerHTML = `<span style="color:#fca5a5;font-size:13px">${t('email_failed_msg')} <a href="#" onclick="directDownload();return false;" style="color:#818cf8;text-decoration:underline">${t('email_failed_download')}</a></span>`;
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

// ── PDF GENERATION (shared builder) ──
function buildPDFDoc() {
  const R   = window._auditResults;
  const clientName   = document.getElementById('clientName').value.trim()   || 'Client';
  const businessName = document.getElementById('businessName').value.trim() || 'Business';
  const websiteUrl   = document.getElementById('websiteUrl').value.trim()   || '—';
  const today        = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const W = 210;
  let y = 0;

  // Header
  doc.setFillColor(8, 11, 20);
  doc.rect(0, 0, W, 52, 'F');
  doc.setFillColor(99, 102, 241);
  doc.roundedRect(16, 14, 50, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.text(t('pdf_tagline'), 20, 20);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text(businessName, 16, 35);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`${t('pdf_prepared')}: ${clientName}  |  ${websiteUrl}  |  ${today}`, 16, 44);
  y = 62;

  // Score box
  const scoreColor = R.score >= 8 ? [34,197,94] : R.score >= 6 ? [245,158,11] : R.score >= 4 ? [249,115,22] : [239,68,68];
  doc.setFillColor(20, 24, 40);
  doc.roundedRect(16, y, W - 32, 38, 4, 4, 'F');
  doc.setDrawColor(...scoreColor); doc.setLineWidth(0.5);
  doc.roundedRect(16, y, W - 32, 38, 4, 4, 'S');
  doc.setFontSize(36); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreColor);
  doc.text(`${R.score.toFixed(1)}`, 30, y + 24);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('/10', 30, y + 32);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.setTextColor(241, 245, 249);
  const gradeText = t(R.gradeKey).replace(/[🟢🟡🟠🔴]/gu, '').trim();
  doc.text(gradeText, 76, y + 16);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const descLines = doc.splitTextToSize(t(R.descKey), 110);
  doc.text(descLines, 76, y + 23);
  y += 46;

  // Signal loss
  doc.setFillColor(60, 20, 20);
  doc.roundedRect(16, y, W - 32, 14, 3, 3, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(252, 165, 165);
  doc.text(t('pdf_signal_loss'), 24, y + 6);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(239, 68, 68);
  doc.text(`~${R.signalLoss}%`, 24, y + 12);
  y += 22;

  // Issues
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(241, 245, 249);
  doc.text(`${t('pdf_issues_found')} (${R.issues.length})`, 16, y); y += 7;

  const sevColors = {
    high: { bg: [60,15,15], border: [239,68,68], badge: [252,165,165] },
    mid:  { bg: [50,35,10], border: [245,158,11], badge: [252,211,77] },
    low:  { bg: [20,20,50], border: [99,102,241], badge: [165,180,252] }
  };

  R.issues.forEach(issue => {
    const c = sevColors[issue.severity];
    const desc = doc.splitTextToSize(issue.body, W - 52);
    const boxH = 8 + desc.length * 4.5 + 8;
    if (y + boxH > 280) { doc.addPage(); y = 20; }
    doc.setFillColor(...c.bg);
    doc.roundedRect(16, y, W - 32, boxH, 3, 3, 'F');
    doc.setDrawColor(...c.border); doc.setLineWidth(0.3);
    doc.roundedRect(16, y, W - 32, boxH, 3, 3, 'S');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(241, 245, 249);
    doc.text(`${issue.icon} ${issue.title}`, 22, y + 7);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
    doc.text(desc, 22, y + 13);
    doc.setFillColor(...c.badge);
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 40);
    doc.text(issue.badge.toUpperCase(), 22, y + boxH - 3);
    y += boxH + 4;
  });

  y += 4;

  // Opportunities
  if (R.opportunities.length > 0) {
    if (y + 16 > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(241, 245, 249);
    doc.text(`${t('pdf_actions')} (${R.opportunities.length})`, 16, y); y += 7;
    R.opportunities.forEach(opp => {
      const desc = doc.splitTextToSize(opp.body, W - 52);
      const boxH = 8 + desc.length * 4.5 + 4;
      if (y + boxH > 280) { doc.addPage(); y = 20; }
      doc.setFillColor(10, 25, 15);
      doc.roundedRect(16, y, W - 32, boxH, 3, 3, 'F');
      doc.setDrawColor(34, 197, 94); doc.setLineWidth(0.3);
      doc.roundedRect(16, y, W - 32, boxH, 3, 3, 'S');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(134, 239, 172);
      doc.text(`${opp.icon} ${opp.title}`, 22, y + 7);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
      doc.text(desc, 22, y + 13);
      y += boxH + 4;
    });
  }

  // Footer CTA
  if (y + 28 > 280) { doc.addPage(); y = 20; }
  y += 6;
  doc.setFillColor(30, 30, 60);
  doc.roundedRect(16, y, W - 32, 26, 4, 4, 'F');
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(165, 180, 252);
  doc.text(t('pdf_cta_1'), 24, y + 9);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
  doc.text(doc.splitTextToSize(t('pdf_cta_2'), W - 40), 24, y + 16);
  doc.setTextColor(99, 102, 241);
  doc.text(t('pdf_cta_3'), 24, y + 23);

  return doc;
}
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
