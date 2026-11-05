// HireSmart application automation for Google Apps Script. Prepared by Ansh Raj for the TalentBridge HireSmart project (Task 8).
// Demo only: synthetic data, test mailbox, no real candidate records.
// ===== HireSmart application automation: core logic (pure functions, no Google services) =====
var HS_ROLES = ['Java Developer', 'QA Engineer', 'Business Analyst'];
var HS_CHANNELS = ['Careers page', 'LinkedIn', 'Employee referral', 'Job portal', 'Campus hiring', 'Recruitment agency', 'Other'];
var HS_COLUMNS = ['application_id', 'submitted_at', 'name', 'email', 'role', 'skills', 'experience_years', 'work_evidence', 'work_sample_url', 'channel', 'accommodation_contact', 'consent', 'stage', 'human_review_status', 'ack_status', 'ack_sent_at', 'notes'];

// Text from the form is DATA. Strip control characters, cap the length, and neutralise spreadsheet formulas.
function hsSanitize(value, maxLen) {
  var s = String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/\r\n?/g, '\n').trim();
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;      // a leading = + - @ would run as a formula in Google Sheets
  return s;
}
function hsFirstName(name) {
  var n = hsSanitize(name, 60).replace(/^'/, '').replace(/[^A-Za-zÀ-ɏऀ-ॿ' .-]/g, '').trim();
  var f = n.split(/\s+/)[0] || 'there';
  return f.slice(0, 30);
}
function hsIsEmail(e) { return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(String(e || '').trim()) && String(e).length <= 120; }
function hsIsUrl(u) { return !u || /^https?:\/\/[^\s]+$/i.test(String(u).trim()); }

// returns { ok, errors[], clean } ; the form should also mark these fields as required
function hsValidate(raw) {
  var errors = [];
  var clean = {
    name: hsSanitize(raw.name, 80), email: String(raw.email || '').trim().toLowerCase().slice(0, 120), role: String(raw.role || '').trim(),
    skills: hsSanitize(raw.skills, 300), experience_years: String(raw.experience_years == null ? '' : raw.experience_years).trim(),
    work_evidence: hsSanitize(raw.work_evidence, 600), work_sample_url: hsSanitize(raw.work_sample_url, 200), channel: String(raw.channel || '').trim(),
    accommodation_contact: raw.accommodation_contact === true || /^(yes|true|on|checked)/i.test(String(raw.accommodation_contact || '')) ? 'Yes' : 'No',
    consent: raw.consent === true || /^(yes|true|on|checked|i agree)/i.test(String(raw.consent || '')) ? 'Yes' : 'No',
  };
  if (!clean.name || clean.name.length < 2) errors.push('Full name is required.');
  if (!hsIsEmail(clean.email)) errors.push('A valid email address is required.');
  if (HS_ROLES.indexOf(clean.role) < 0) errors.push('Choose one of the open roles.');
  if (!clean.skills) errors.push('Please list your key skills.');
  if (clean.experience_years !== '' && !(Number(clean.experience_years) >= 0 && Number(clean.experience_years) <= 60)) errors.push('Experience must be a number between 0 and 60.');
  if (!hsIsUrl(clean.work_sample_url)) errors.push('Work sample must be a web link starting with http or https.');
  if (clean.channel && HS_CHANNELS.indexOf(clean.channel) < 0) clean.channel = 'Other';
  if (clean.consent !== 'Yes') errors.push('You must accept the privacy notice to apply.');
  return { ok: errors.length === 0, errors: errors, clean: clean };
}

function hsApplicationId(counter, date) { var y = (date || new Date()).getFullYear(); return 'HS-' + y + '-' + String(counter).padStart(4, '0'); }

// same email + same role within 30 days is flagged for a human, never auto-rejected
function hsIsDuplicate(rows, clean, now) {
  var DAY = 86400000;
  return rows.some(function (r) { return String(r.email).toLowerCase() === clean.email && r.role === clean.role && (now - new Date(r.submitted_at).getTime()) < 30 * DAY; });
}

function hsAcknowledgement(app, cfg) {
  var first = hsFirstName(app.name);
  var hr = (cfg && cfg.HR_CONTACT) || '[HR contact]';
  var subject = 'We have received your application for ' + app.role;
  var body = [
    'Hello ' + first + ',', '',
    'Thank you for applying for ' + app.role + ' at TalentBridge Technologies. Your application ID is ' + app.application_id + '.', '',
    'What happens next:',
    '1. A member of our recruitment team reviews your application against the job-related criteria published for the role. A person makes every decision; software only helps organise information.',
    '2. Our service target is a status update within three business days, where possible. Our illustrative target is to complete hiring in 38 days or less, though timelines vary by role.',
    '3. If we need more information we will contact you at this email address.', '',
    'Please keep your application ID for any question. To reach a person, contact ' + hr + '.',
    app.accommodation_contact === 'Yes' ? 'You asked for a private conversation about an adjustment. ' + hr + ' will contact you. Your request is confidential and does not affect the assessment.' : 'If you need an adjustment at any stage, contact ' + hr + '. Requests are confidential and do not affect the assessment.', '',
    'We use only the information you provided, for recruitment purposes, and access is limited to authorised recruitment staff. Please do not send identity documents or sensitive personal details by email.', '',
    'Kind regards,', 'TalentBridge Recruitment Team',
  ].join('\n');
  return { subject: subject, body: body };
}


// ===== Google Apps Script glue: Form -> Sheet -> acknowledgement email =====
// Install: Google Form -> Responses -> link to a Sheet -> Extensions -> Apps Script -> paste this file.
// Then run setupSheet() once, add the trigger (Triggers -> Add -> onFormSubmit -> From form -> On form submit), and run testSubmission().
var CONFIG = {
  SHEET_NAME: 'Applications',
  TEST_MODE: true,                              // true = every acknowledgement goes to TEST_MAILBOX only (keep true for the demo)
  TEST_MAILBOX: 'your-test-mailbox@gmail.com',  // use a test mailbox, never a real candidate address in the demo
  SENDER_NAME: 'TalentBridge Recruitment (demo)',
  HR_CONTACT: '[HR contact]',                   // replace with the real HR contact email before go-live
};
// The form question titles must match these exactly (Form -> question title).
var FORM_FIELDS = {
  name: 'Full name', email: 'Email address', role: 'Role applying for', skills: 'Key skills', experience_years: 'Years of relevant experience (optional)',
  work_evidence: 'Describe one piece of relevant work', work_sample_url: 'Link to a work sample (optional)', channel: 'How did you hear about this role?',
  accommodation_contact: 'Please contact me privately about an adjustment', consent: 'I have read the privacy notice and agree',
};

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sh.getLastRow() === 0) { sh.appendRow(HS_COLUMNS); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HS_COLUMNS.length).setFontWeight('bold'); }
  PropertiesService.getScriptProperties().setProperty('counter', String(Math.max(0, sh.getLastRow() - 1)));
}

function first_(namedValues, title) { var v = namedValues[title]; return v && v.length ? v[0] : ''; }

function onFormSubmit(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!sh) { setupSheet(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME); }
    var raw = {}; Object.keys(FORM_FIELDS).forEach(function (k) { raw[k] = first_(e.namedValues, FORM_FIELDS[k]); });
    var v = hsValidate(raw);
    var props = PropertiesService.getScriptProperties();
    var n = Number(props.getProperty('counter') || 0) + 1; props.setProperty('counter', String(n));
    var existing = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, HS_COLUMNS.length).getValues().map(function (r) { var o = {}; HS_COLUMNS.forEach(function (c, i) { o[c] = r[i]; }); return o; }) : [];
    var app = Object.assign({}, v.clean, { application_id: hsApplicationId(n), submitted_at: new Date().toISOString(), stage: 'Applied', human_review_status: 'Pending', ack_status: 'Pending', ack_sent_at: '', notes: '' });
    if (!v.ok) { app.stage = 'Needs a person: invalid input'; app.notes = v.errors.join(' '); app.ack_status = 'Not sent'; }
    else if (hsIsDuplicate(existing, v.clean, Date.now())) { app.notes = 'Possible duplicate (same email and role within 30 days). A person should check; do not reject automatically.'; }
    sh.appendRow(HS_COLUMNS.map(function (c) { return app[c]; }));
    var row = sh.getLastRow();
    if (v.ok) {
      try {
        var ack = hsAcknowledgement(app, CONFIG);
        MailApp.sendEmail({ to: CONFIG.TEST_MODE ? CONFIG.TEST_MAILBOX : app.email, subject: (CONFIG.TEST_MODE ? '[TEST] ' : '') + ack.subject, body: ack.body, name: CONFIG.SENDER_NAME });
        sh.getRange(row, HS_COLUMNS.indexOf('ack_status') + 1, 1, 2).setValues([['Sent', new Date().toISOString()]]);
      } catch (err) { sh.getRange(row, HS_COLUMNS.indexOf('ack_status') + 1).setValue('Failed: ' + String(err).slice(0, 80)); }
    }
  } finally { lock.releaseLock(); }
}

// Run this from the editor to test without submitting the form (sends to TEST_MAILBOX only).
function testSubmission() {
  var nv = {}; var sample = { name: 'Demo Candidate', email: CONFIG.TEST_MAILBOX, role: 'QA Engineer', skills: 'Manual testing, test cases, SQL', experience_years: '2', work_evidence: 'Wrote regression test cases for a demo app.', work_sample_url: '', channel: 'Careers page', accommodation_contact: '', consent: 'I agree' };
  Object.keys(FORM_FIELDS).forEach(function (k) { nv[FORM_FIELDS[k]] = [sample[k]]; });
  onFormSubmit({ namedValues: nv });
}
