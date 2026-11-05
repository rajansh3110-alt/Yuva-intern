
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
