/* HireSmart dummy resume scoring (advisory only).
 * Scores ONLY the "Skills stated" and "Relevant project/work evidence" text against the published role rubric.
 * Years of experience, name, education and every other line are ignored. The result is never a decision. */
(function (root) {
  'use strict';
  var RUBRIC = [
    { key: 'must', name: 'Role-relevant must-have skills', max: 30 },
    { key: 'project', name: 'Relevant project or work evidence', max: 25 },
    { key: 'solve', name: 'Problem-solving evidence', max: 20 },
    { key: 'comm', name: 'Communication and documentation evidence', max: 15 },
    { key: 'nice', name: 'Role-specific nice-to-have skills (bonus)', max: 10 },
  ];
  var ROLES = {
    'Java Developer': {
      must: [['Java and OOP', /\b(java|oop|object[- ]oriented)\b/i], ['REST APIs', /\b(rest(ful)?|apis?|endpoints?|microservices?)\b/i], ['SQL', /\bsql\b/i], ['Git or version control', /\b(git|version control|pull requests?)\b/i], ['Collaboration', /\b(collaborat\w*|worked with|code reviews?|pair\w*|team\w*)\b/i]],
      nice: [['Spring Boot', /\bspring\b/i], ['Cloud deployment', /\b(cloud|aws|azure|gcp|deploy\w*)\b/i], ['Automated testing', /\b(unit tests?|junit|automated test\w*|test automation)\b/i], ['CI/CD tools', /\b(ci\/cd|jenkins|pipelines?)\b/i]],
    },
    'QA Engineer': {
      must: [['Test cases and execution', /\b(test cases?|test scenarios?|regression|manual testing|test plan\w*|test execution|testing project)\b/i], ['Defect reporting', /\b(defects?|bugs?|reproducible)\b/i], ['SQL or data validation', /\b(sql|data validation)\b/i], ['Attention to detail and collaboration', /\b(attention to detail|collaborat\w*|worked with|reviewed|evidence)\b/i]],
      nice: [['API testing', /\b(api testing|rest apis?)\b/i], ['Automation frameworks', /\b(automation|automated|flaky)\b/i], ['Jira', /\bjira\b/i], ['CI/CD tools', /\b(ci\/cd|jenkins|pipelines?)\b/i]],
    },
    'Business Analyst': {
      must: [['Clear written communication', /\b(communicat\w*|documented|documentation|summari[sz]ed|prepared|notes|reports?)\b/i], ['Requirements elicitation and documentation', /\b(requirements?|user stor\w*|acceptance criteria|stakeholders?|elicit\w*|uat)\b/i], ['Spreadsheet or data interpretation', /\b(excel|spreadsheets?|sql|kpis?|data|survey\w*|dashboards?)\b/i], ['Process mapping and gaps', /\b(process map\w*|workflow|mapped|process)\b/i]],
      nice: [['SQL', /\bsql\b/i], ['User stories', /\buser stor\w*/i], ['Process modelling', /\b(process (map|model)\w*|workflow|mapped)\b/i], ['Dashboard tools', /\b(dashboards?|power ?bi|tableau|looker)\b/i]],
    },
  };
  var VERBS = /\b(built|developed|designed|documented|implemented|validated|maintained|mapped|prepared|supported|created|completed|translated|improved|wrote|summari[sz]ed|reviewed|participated|delivered|tested)\b/gi;
  var ARTIFACTS = /\b(api|module|test cases?|defects?|workflow|acceptance criteria|requirements|reports?|uat|microservices?|app|application|process map|kpi|endpoints?|unit tests?|test automation|dashboard)\b/gi;
  var SOLVE = [/\bproblem[- ]solving\b/i, /\b(debug\w*|troubleshoot\w*|investigat\w*)\b/i, /\b(improv\w*|optimi[sz]\w*)\b/i, /\b(flaky|reproducib\w*)\b/i, /\b(fix\w*|resolv\w*)\b/i, /\b(validat\w*|analy[sz]\w*|gaps?)\b/i, /\b(mapp\w*|translat\w*)\b/i];
  var COMM = [/\b(documented|documentation)\b/i, /\b(wrote|written|prepared|notes)\b/i, /\b(summari[sz]ed|reports?)\b/i, /\bcommunicat\w*/i, /\b(acceptance criteria|test evidence)\b/i];
  var INJ = /(ignore|disregard|forget|override)\s+(all\s+|any\s+|your\s+|the\s+|previous\s+)*(rules?|instructions?|rubric|polic\w+)|\bhire\s+me\b|give\s+(me|this\s+(candidate|resume))\s+(a\s+)?(full|top|perfect|100|5\/5)|you\s+are\s+now\b|system\s+prompt/i;
  // value-bearing personal details only (the standard training note that lists forbidden traits must not trigger this)
  var TRAITS = /\bage[d]?\s*[:=]?\s*\d{2}\b|\b\d{2}\s*years?\s*old\b|\b(married|unmarried)\b|\b(male|female)\b|\b(hindu|muslim|christian|sikh)\b|\b(iit|iim)\b|premier\s+universit|career\s+break/i;

  function uniq(arr) { return Array.from(new Set(arr.map(function (s) { return s.toLowerCase(); }))); }
  function matches(re, text) { return uniq((text.match(new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g')) || [])); }

  // read only the two scored sections; everything else is ignored
  function parse(raw) {
    var text = String(raw || '');
    var role = (text.match(/Target role:\s*(.+)/i) || [])[1];
    var skills = (text.match(/Skills stated:\s*(.+)/i) || [])[1] || '';
    var ev = (text.match(/Relevant project\/work evidence:\s*\n?([^\n]+)/i) || [])[1] || '';
    var years = (text.match(/Relevant experience:\s*(.+)/i) || [])[1] || '';
    var id = (text.match(/Candidate ID:\s*(\w+)/i) || [])[1] || '';
    var scored = (skills + ' ' + ev).trim();
    var ignoredText = text.replace(/Skills stated:.*\n?/i, '').replace(/Relevant project\/work evidence:\s*\n?[^\n]*\n?/i, '').replace(/TRAINING NOTE:[^\n]*\n[^\n]*/i, '');
    return { id: id, role: role ? role.trim() : '', years: years.trim(), skills: skills.trim(), evidence: ev.trim(), scoredText: scored, ignoredText: ignoredText };
  }

  function band(total) {
    if (total >= 75) return { label: 'Strong evidence on record', action: 'Read first in the queue' };
    if (total >= 60) return { label: 'Meets the bar', action: 'Read in full' };
    return { label: 'Limited evidence on record', action: 'Read in full and ask the candidate for missing evidence' };
  }

  function score(input) {
    var r = typeof input === 'string' ? parse(input) : input;
    var rk = Object.keys(ROLES).filter(function (k) { return k.toLowerCase() === String(r.role || '').trim().toLowerCase(); })[0];
    var cfg = rk ? ROLES[rk] : null;
    if (rk) r.role = rk;
    var out = { id: r.id, role: r.role, years: r.years, flags: [], criteria: [], total: 0, band: null, ask: [], ignored: ['Years of experience', 'Name, education, photograph and any personal details', 'Resume formatting and wording style'], advisory: true };
    if (!cfg) { out.flags.push('Role not recognised: no score produced'); return out; }
    var text = r.scoredText || ((r.skills || '') + ' ' + (r.evidence || ''));
    // 1 must-have
    var mHit = cfg.must.filter(function (m) { return m[1].test(text); }), mMiss = cfg.must.filter(function (m) { return !m[1].test(text); });
    var c1 = 30 * mHit.length / cfg.must.length;
    // 2 project evidence
    var verbs = matches(VERBS, r.evidence || text), arts = matches(ARTIFACTS, r.evidence || text);
    var c2 = (r.evidence ? 10 : 0) + Math.min(verbs.length, 2) * 4 + Math.min(arts.length, 2) * 3.5;
    // 3 problem solving
    var sHit = SOLVE.filter(function (re) { return re.test(text); });
    var c3 = Math.min(sHit.length, 3) * (20 / 3);
    // 4 communication
    var cHit = COMM.filter(function (re) { return re.test(text); });
    var c4 = Math.min(cHit.length, 3) * 5;
    // 5 nice-to-have
    var nHit = cfg.nice.filter(function (n) { return n[1].test(text); });
    var c5 = 10 * nHit.length / cfg.nice.length;
    var pts = [c1, c2, c3, c4, c5].map(function (x) { return Math.round(x * 10) / 10; });
    out.criteria = [
      { name: RUBRIC[0].name, max: 30, points: pts[0], evidence: mHit.map(function (m) { return m[0]; }), missing: mMiss.map(function (m) { return m[0]; }) },
      { name: RUBRIC[1].name, max: 25, points: pts[1], evidence: [].concat(verbs.length ? ['actions: ' + verbs.slice(0, 3).join(', ')] : [], arts.length ? ['artifacts: ' + arts.slice(0, 3).join(', ')] : []), missing: r.evidence ? [] : ['No work evidence line'] },
      { name: RUBRIC[2].name, max: 20, points: pts[2], evidence: sHit.length ? [sHit.length + ' problem-solving signal' + (sHit.length > 1 ? 's' : '')] : [], missing: sHit.length ? [] : ['No problem-solving example stated'] },
      { name: RUBRIC[3].name, max: 15, points: pts[3], evidence: cHit.length ? [cHit.length + ' communication or documentation signal' + (cHit.length > 1 ? 's' : '')] : [], missing: cHit.length ? [] : ['No documentation or communication evidence stated'] },
      { name: RUBRIC[4].name, max: 10, points: pts[4], evidence: nHit.map(function (n) { return n[0]; }), missing: cfg.nice.filter(function (n) { return !n[1].test(text); }).map(function (n) { return n[0]; }) },
    ];
    out.total = Math.round(pts.reduce(function (a, b) { return a + b; }, 0) * 10) / 10;
    out.band = band(out.total);
    out.ask = mMiss.map(function (m) { return 'Please tell us about your experience with ' + m[0].toLowerCase() + '.'; });
    if (INJ.test(r.ignoredText + ' ' + text)) out.flags.push('Instruction found inside the resume. Treated as data and ignored (rule SR7).');
    if (TRAITS.test(r.ignoredText)) out.flags.push('Personal details present. Not scored (rule SR5).');
    return out;
  }

  var api = { score: score, parse: parse, RUBRIC: RUBRIC, ROLES: Object.keys(ROLES) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HireSmartScoring = api;
})(typeof self !== 'undefined' ? self : this);
