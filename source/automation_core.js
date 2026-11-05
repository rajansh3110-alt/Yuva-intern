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

if (typeof module !== 'undefined' && module.exports) module.exports = { hsSanitize, hsFirstName, hsIsEmail, hsValidate, hsApplicationId, hsIsDuplicate, hsAcknowledgement, HS_ROLES, HS_COLUMNS, HS_CHANNELS };
