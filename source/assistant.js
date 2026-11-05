/* HireSmart Ask HR assistant engine.
 * Deterministic, auditable: answers only from the approved knowledge base, applies hand-over and refusal rules first,
 * treats candidate text as untrusted data. Runs in the browser and in Node (for automated tests). */
(function (root) {
  'use strict';

  var STOP = new Set(('a an the and or but if then so of to in on at by for with from as is are was were be been am do does did can could would should will shall may might must i me my we our you your it its this that these those there here what which who whom how when where why not no yes any some about into over under up down out off than too very just also please tell know want need get got have has had having like kind many much once usually really still ask people someone anyone back').split(' ').filter(function (w) { return w !== 'why'; }));
  // synonym groups: every raw word in a group maps to one canonical token (lets paraphrases match approved wording)
  var GROUPS = {
    job: 'job jobs role roles position positions vacancy vacancies posting postings jd description descriptions opening openings',
    application: 'application applications apply applying applied submit submitted submission submitting',
    candidate: 'candidate candidates applicant applicants jobseeker',
    resume: 'resume resumes cv cvs',
    hiring: 'hire hires hired hiring recruit recruitment recruiting recruited',
    recruiter: 'recruiter recruiters',
    reject: 'reject rejected rejection decline declined unsuccessful unselected',
    feedback: 'feedback reason reasons explain explanation why',
    long: 'days weeks duration timeline timescale time typical average',
    reschedule: 'reschedule rescheduled postpone postponed moved move shift shifted',
    prepare: 'prepare prepared preparing ready preparation',
    interview: 'interview interviews interviewer interviewers round rounds',
    format: 'format formats type types style',
    assess: 'assess assessed assessment assessments evaluate evaluated evaluation evaluating judge judged scored scoring rate rated review reviewed',
    ai: 'ai artificial intelligence algorithm software chatbot bot',
    use: 'use used uses using',
    copy: 'copy copies download downloaded',
    automatic: 'automatic automatically auto',
    data: 'data information details record records personal',
    see: 'see view look looks read visible',
    modify: 'fix fixed change changed edit edited modify amend mistake',
    update: 'update updates updated news',
    noupdate: 'noupdate heard hear reply replied response respond',
    receive: 'receive received heard hear',
    negotiate: 'negotiate negotiated negotiation negotiating bargain',
    documents: 'document documents paperwork papers checklist',
    joining: 'joining join joined start starting begin',
    access: 'laptop computer login account password',
    buddy: 'buddy buddies mentor assigned assign',
    onboarding: 'onboarding settle settling induction orientation',
    goal: 'goal goals objective objectives priority priorities target targets',
    policy: 'policy policies handbook rules',
    harassment: 'harassment harassed harass bullying bullied',
    human: 'human person agent representative',
    contact: 'contact speak talk reach call',
    correct: 'correct corrected correction',
    withdraw: 'withdraw withdrawn withdrawing cancel cancelled',
    accommodation: 'accommodation accommodations adjustment adjustments accessibility accessible disability',
    college: 'college colleges university universities institute institution',
    refer: 'refer referred referral referrals referrer',
    keep: 'keep kept retain retained retention store stored',
    prefer: 'prefer prefers preferred favour favor favours favors',
    incorrect: 'incorrect wrong inaccurate error errors seem seems seemed outdated',
    status: 'status stand stands standing progress outcome',
    mean: 'mean means meaning define definition count counts',
  };
  var CANON = {};
  Object.keys(GROUPS).forEach(function (c) { GROUPS[c].split(' ').forEach(function (w) { CANON[w] = c; }); });
  var PHRASES = [[/\bno\s+one\b/g, ' '],[/\bupdate\s+(my\s+|the\s+|an?\s+)?(application|details|resume|cv|profile)\b/g, ' modify application '], [/\b(no|any|an?|the|latest)\s+update\b/g, ' noupdate '], [/\b(not\s+heard|heard\s+back|hear\s+back|no\s+(reply|response|news)|replied|not\s+replied)\b/g, ' noupdate '],
    [/\b(change|move|shift|reschedul\w+)\s+(the\s+|my\s+)?(date|time|day|slot)\b/g, ' reschedule '], [/\b(see|view|read|download|get)\s+(a\s+|the\s+|my\s+)?(full\s+|current\s+|complete\s+)?(copy\s+of\s+)?(the\s+)?(job\s+(description|post|posting|ad)|jd)\b/g, ' copy job '],
    [/\bcomputer\s+(program|system|software|algorithm)\b/g, ' ai '], [/\bpull\s+(my\s+)?(application|name|candidacy)\s+out\b/g, ' withdraw '], [/\bfirst\s+day\b/g, ' day 1 '], [/\bfirst\s+week\b/g, ' day 7 '], [/\bnot\s+(been\s+)?(selected|shortlisted|chosen|successful|hired)\b/g, ' reject '], [/\bturn(ed)?\s+down\b/g, ' reject '],
    [/\bpull(ed)?\s+out\b/g, ' withdraw '], [/\bsettle\s+in\b/g, ' onboarding '], [/\bdo\s+you\s+hold\b/g, ' '], [/\bwhat\s+kind\b/g, ' format '],
    [/\bnice[\s-]*to[\s-]*have\b/g, ' nicetohave '], [/\bmust[\s-]*have\b/g, ' musthave ']];

  function stem(w) {
    if (w.length <= 3) return w;
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    return w.replace(/(ing|ed|es|s|e)$/, function (m) { return w.length - m.length >= 3 && !(m === 's' && /ss$/.test(w)) ? '' : m; });
  }
  function tokens(text) {
    var t = String(text || '').toLowerCase().replace(/[’']/g, '');
    PHRASES.forEach(function (p) { t = t.replace(p[0], p[1]); });
    var out = [];
    t.replace(/[^a-z0-9]+/g, ' ').split(' ').forEach(function (w) {
      if (!w || STOP.has(w)) return;
      var s = CANON[w] || stem(w);
      if (s && !STOP.has(s)) out.push(s);
    });
    return out;
  }

  // ---------- safety rules (checked before retrieval) ----------
  var PROTECTED = /\b(age|aged|old|older|young|younger|gender|male|female|man|men|woman|women|caste|religion|religious|hindu|muslim|christian|sikh|marital|married|unmarried|pregnan\w*|photo(graph)?|nationality|disabilit\w*|college|university|iit|institute|accent)\b/i;
  var RANK_VERB = /\b(rank|sort|filter|shortlist|screen|select|exclude|prefer|pick|eliminate|score|grade|order)\b/i;
  var PEOPLE = /\b(candidates?|applicants?|resumes?|cvs?|people|profiles?|freshers?)\b/i;
  var INJECTION = [
    /ignore\s+(all\s+|any\s+|your\s+|the\s+|previous\s+|prior\s+|these\s+|those\s+)*(rules?|instructions?|polic(y|ies)|guardrails?|guidelines?|rubric|prompt)/i,
    /disregard\s+(all\s+|any\s+|your\s+|the\s+|previous\s+|prior\s+)*(rules?|instructions?|polic(y|ies)|rubric)/i,
    /forget\s+(all\s+|your\s+|the\s+|previous\s+)*(rules?|instructions?)/i,
    /you\s+are\s+now\b/i, /act\s+as\s+(if|an?\s+(unrestricted|different))/i, /pretend\s+(to\s+be|you\s+are)/i,
    /(reveal|show|print|repeat)\s+(me\s+)?(your\s+|the\s+)?(system\s+)?(prompt|instructions)/i, /developer\s+mode|jailbreak/i,
    /override\s+(the\s+)?(rules?|policy|rubric|scor\w+)/i, /(give|award|assign)\s+(me|this\s+candidate)\s+(a\s+)?(full|top|perfect|5\/5|100)/i, /\bhire\s+me\b/i,
  ];
  var AUTO_DECISION = [
    /\b(reject|decline|drop|eliminate|disqualify)\b[^.?!]{0,40}\b(all|everyone|every|anyone|candidates|applicants)\b[^.?!]{0,50}\b(below|under|less\s+than|lower\s+than|beneath)\b/i,
    /\b(below|under|less\s+than|lower\s+than)\b[^.?!]{0,30}\b(score|rating|cut-?off|threshold|\d{2})\b[^.?!]{0,40}\b(reject|decline|drop|eliminate|disqualify|auto)/i,
    /\bset\s+(up\s+)?(an?\s+)?auto[- ]?(reject|decline|screen)/i, /\blet\s+(the\s+)?(ai|bot|software|system)\s+(decide|reject|hire|choose)/i,
    /\b(automatically|auto)\s+(reject|decline|hire|shortlist)\b[^.?!]{0,30}\b(candidates|applicants|resumes|all|everyone|below|under)\b/i,
    /\brecommend\b[^.?!]{0,30}\b(hire|hiring|reject)\b/i, /\bshould\s+(we|i)\s+(hire|reject)\b/i,
  ];

  var HANDOVER = [
    { id: 'HO01', topic: 'Harassment, discrimination or bullying', urgent: false, route: 'Designated HR contact or formal reporting channel', test: /\b(harass\w*|bully\w*|bullied|discriminat\w*|assault\w*|abus(e|ed|ive)|hostile\s+(work|environment)|threat(en\w*)?|inappropriate\s+(comment|touch|behaviou?r)|unfair(ly)?\s+treat\w*|molest\w*|treated\s+(unfairly|differently)|because\s+of\s+my\s+(religion|caste|gender|age|race|disability|marital\s+status))\b/i,
      text: 'Thank you for telling me. This is a serious matter that needs a person, not a chatbot. Please contact the designated HR contact or the formal reporting channel straight away. I cannot investigate or judge what happened.' },
    { id: 'HO02', topic: 'Safety and emergencies', urgent: true, route: 'Emergency services, then safety lead and HR', test: /\b(unsafe|danger(ous)?|emergency|accident|fire|violen\w*|injur\w*|someone\s+is\s+hurt|am\s+hurt)\b/i,
      text: 'If anyone is in immediate danger, please contact local emergency services now. Then tell the safety lead and your HR contact. I am passing this to a person.' },
    { id: 'HO03', topic: 'Health and medical', urgent: false, route: 'HR contact; qualified medical support', test: /\b(medic(al|ine|ation)|diagnos\w*|symptoms?|illness|sick|unwell|doctor|headache|fever|pain|depress\w*|anxiety|mental\s+health|pregnan\w*|health\s+(issue|problem|condition))\b/i,
      text: 'I cannot give medical advice or diagnose anything. For your health, please contact a qualified medical professional. If this affects your work or an interview, the HR contact can discuss adjustments with you privately.' },
    { id: 'HO04', topic: 'Pay and payroll disputes', urgent: false, route: 'Authorized payroll or HR team, confidential channel', test: /\b(payroll|payslip|salary\s+(dispute|issue|problem|not\s+(credited|received|paid)|was\s+not|is\s+missing|missing)|deduction|underpaid|not\s+(been\s+)?paid|overtime\s+(pay|dispute)|pay\s+dispute|dispute\s+(about|over|with)?\s*(my\s+)?(pay|salary)|reimbursement\s+(dispute|not))/i,
      text: 'Pay questions need to be handled privately by the authorized payroll or HR team through the official confidential channel. Please do not share bank or salary details here. I am passing this to a person.' },
    { id: 'HO05', topic: 'Legal advice', urgent: false, route: 'HR or legal contact', test: /\b(lawyer|legal\s+advice|sue|lawsuit|court|is\s+this\s+(legal|lawful)|labou?r\s+law|my\s+legal\s+rights|contract\s+(is\s+)?(legal|valid|enforceable))\b/i,
      text: 'I cannot give legal advice. I can only share approved general information. For a personal legal question, please contact the HR or legal contact, or a qualified professional.' },
    { id: 'HO06', topic: 'Complaints and grievances', urgent: false, route: 'HR lead', test: /\b(complain\w*|grievance|formal\s+complaint|raise\s+(a\s+)?complaint|escalate\s+(a\s+)?(complaint|issue))\b/i,
      text: 'I have noted that you want to raise a complaint. I cannot assess it or defend anyone. Please contact the HR lead, who will handle it properly. I am passing this to a person.' },
    { id: 'HO07', topic: 'Privacy and data requests', urgent: false, route: 'HR privacy contact', test: /\b(delete\s+my\s+(data|record|information|details|profile)|erase\s+my|right\s+to\s+be\s+forgotten|who\s+(has|have)\s+(seen|access(ed)?)\s+my|data\s+(breach|leak)|my\s+data\s+was\s+(leaked|shared))/i,
      text: 'Data requests are handled by the HR privacy contact through the approved process. I cannot delete or change records myself, and I cannot promise an outcome or quote a retention period that has not been approved. Please contact the HR privacy contact.' },
    { id: 'HO08', topic: 'Application status and decisions', urgent: false, route: 'Recruiter', test: /\b((status|progress|outcome|result)\s+(of|on|for)\s+my\s+(application|interview)|my\s+(application|interview)\s+(status|progress|outcome|result)|where\s+is\s+my\s+application|(have|has)\s+(you|anyone|they)\s+(received|reviewed|seen|looked\s+at)\s+my\s+(application|cv|resume)|(has|have)\s+my\s+(application|cv|resume)\s+been\s+(shortlisted|selected|reviewed|seen|processed|rejected|accepted)|did\s+i\s+(get|make)\s+(the\s+job|it|selected|shortlisted)|why\s+(was|am)\s+i\s+(rejected|not\s+(selected|shortlisted|hired)))\b/i,
      text: 'I cannot see live application records, so I cannot give a status or the reason for a decision. Please contact your recruiter with your application ID. Our service target is a status update within three business days, where possible.' },
    { id: 'HO09', topic: 'Stale or conflicting policy', urgent: false, route: 'Content owner or HR', test: /\b((conflict|contradict|differ|disagree|mismatch|inconsisten)\w*[^.?!]{0,50}(policy|faq|document|answer|information)|(policy|faq|document|answer|information)[^.?!]{0,50}(conflict|contradict|differ|disagree|newer|outdated|out\s+of\s+date|stale|updated)|which\s+(one\s+)?is\s+(right|correct|current))\b/i,
      text: 'If two sources disagree, I should not guess. The approved policy must be confirmed by HR. I will flag this for the content owner. Please ask HR to confirm the current version.' },
    { id: 'HO10', topic: 'Pay range, benefits and leave (not in approved information)', urgent: false, route: 'Recruiter', test: /\b(what\s+(salary|pay|compensation|benefits?|perks|leave|insurance)\b|(salary|pay|ctc|compensation|package|stipend)\s+(range|band|offered|for\s+(this|the)\s+(role|job|position))|how\s+much\s+(do|does|will|would|is)[^.?!]{0,40}(pay|salary|earn|paid)|what\s+(is|are)\s+(the\s+)?(salary|pay|benefits?|perks|leave\s+(policy|days)|insurance)|(benefits?|leave|insurance|bonus|notice\s+period|probation)\s+(policy|details|information|offered|include))\b/i,
      text: 'Pay, formal benefits and leave are confirmed by HR for each role and are not part of the information I am approved to share. Please ask the recruiter. I am passing the question to a person.' },
  ];

  function createAssistant(kb) {
    var docs = kb.faq.concat(kb.policy || []).map(function (d) {
      return { id: d.id, question: d.question, answer: d.answer, human: !!d.human_step, same: d.same_as || [], source: d.source || 'Approved HR FAQ', qt: tokens(d.question), at: tokens(d.answer) };
    });
    var df = {};
    docs.forEach(function (d) { new Set(d.qt.concat(d.at)).forEach(function (t) { df[t] = (df[t] || 0) + 1; }); });
    var N = docs.length;
    function idf(t) { return Math.log(1 + N / (1 + (df[t] || 0))) + 0.2; }

    var qVocab = new Set();
    docs.forEach(function (d) { d.qt.forEach(function (t) { qVocab.add(t); }); });
    function wt(t) { return (qVocab.has(t) ? 1 : 0.35) * idf(t); }   // words seen only inside answers carry less weight

    function retrieve(text) {
      var qt = Array.from(new Set(tokens(text)));
      var known = qt.filter(function (t) { return df[t]; });
      if (!known.length) return null;
      var total = known.reduce(function (a, t) { return a + wt(t); }, 0);
      var unknownRatio = (qt.length - known.length) / qt.length;
      var scored = [];
      docs.forEach(function (d) {
        var qs = new Set(d.qt), as = new Set(d.at), s = 0, hitQ = 0;
        known.forEach(function (t) {
          if (qs.has(t)) { s += wt(t); hitQ++; } else if (as.has(t)) { s += 0.3 * wt(t); }
        });
        var cover = s / total;
        var qSet = Array.from(qs);
        var qCover = qSet.length ? qSet.filter(function (t) { return known.indexOf(t) >= 0; }).length / qSet.length : 0;
        var score = (0.65 * cover + 0.35 * qCover) * (1 - 0.3 * unknownRatio);
        scored.push({ doc: d, score: score, cover: cover, hitQ: hitQ });
      });
      scored.sort(function (a, b) { return b.score - a.score; });
      var best = scored[0];
      best.sparse = known.length < 2 && unknownRatio >= 0.5;   // one shared word amid unfamiliar words is not enough to answer
      // near-duplicate FAQs (same_as) are the same topic, so the margin is measured against the best *different* topic
      var other = scored.filter(function (x) { return x.doc.id !== best.doc.id && best.doc.same.indexOf(x.doc.id) < 0; })[0];
      best.margin = best.score - (other ? other.score : 0);
      return best;
    }

    function clean(text) {
      return String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
    }

    function ask(raw) {
      var text = clean(raw);
      var res = { input: text, kind: 'unsure', text: '', source: null, confidence: null, handover: null, flags: [], rule: null };
      if (!text) { res.kind = 'empty'; res.text = 'Please type your question and I will look for an approved answer.'; return res; }

      // 1. untrusted instructions inside the message are detected and ignored
      var work = text;
      var injected = INJECTION.some(function (re) { return re.test(work); });
      if (injected) {
        res.flags.push('injection_ignored');
        INJECTION.forEach(function (re) { work = work.replace(new RegExp(re.source, 'ig'), ' '); });
        work = work.replace(/\s+/g, ' ').replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/g, '');
        if (tokens(work).length < 2) {
          res.kind = 'refusal'; res.rule = 'INJECTION'; res.confidence = null;
          res.text = 'I cannot change my rules or follow instructions inside a message. I only answer from approved HR information, and people make every hiring decision. Please ask me an HR question or contact a person.';
          return res;
        }
      }

      // 2. protected traits used to rank or filter people
      if (RANK_VERB.test(work) && PEOPLE.test(work) && PROTECTED.test(work)) {
        res.kind = 'refusal'; res.rule = 'PROTECTED_TRAITS'; res.flags.push('protected_trait_request');
        res.handover = { topic: 'Requests to use protected traits', route: 'Talent Acquisition Lead if repeated', urgent: false };
        res.text = 'I cannot rank, filter or assess people using age, gender, caste, religion, marital status, photograph, college or similar traits. I can help with the job-related rubric instead: must-have skills, relevant work evidence, problem-solving and communication evidence.';
        return res;
      }

      // 3. automatic decisions and hire / no-hire recommendations
      if (AUTO_DECISION.some(function (re) { return re.test(work); })) {
        res.kind = 'refusal'; res.rule = 'AUTO_DECISION'; res.flags.push('automatic_decision_request');
        res.handover = { topic: 'Automatic decisions', route: 'Hiring manager', urgent: false };
        res.text = 'I cannot reject, shortlist or recommend hiring anyone automatically. A score is advisory only. A human reviewer must read the full application, record a job-related reason and make the decision.';
        return res;
      }

      // 4. sensitive topics are handed to a person
      for (var i = 0; i < HANDOVER.length; i++) {
        if (HANDOVER[i].test.test(work)) {
          var h = HANDOVER[i];
          res.kind = 'handover'; res.rule = h.id; res.text = h.text;
          res.handover = { topic: h.topic, route: h.route, urgent: h.urgent };
          return res;
        }
      }

      // 5. small talk
      if (/^(hi|hello|hey|good\s+(morning|afternoon|evening)|namaste)\b[\s!.]*$/i.test(work)) { res.kind = 'greeting'; res.text = 'Hello. I am the TalentBridge Ask HR assistant. I answer from approved HR information and hand sensitive topics to a person. What would you like to know?'; return res; }
      if (/^(thanks?|thank\s+you|ok(ay)?|great)\b[\s!.]*$/i.test(work)) { res.kind = 'greeting'; res.text = 'You are welcome. If you need a person, contact your recruiter or HR contact.'; return res; }

      // 6. retrieve from the approved knowledge base
      var m = retrieve(work);
      if (!m || m.score < 0.40 || m.hitQ === 0 || m.sparse) {
        res.kind = 'unsure'; res.rule = 'NO_MATCH'; res.confidence = 'Low';
        res.handover = { topic: 'Question not in approved information', route: 'Recruiter or HR contact', urgent: false };
        res.text = 'I am not sure I have an approved answer to that, and I do not want to guess. Please contact your recruiter or the HR contact, and I will note that this question was missing from the FAQ.';
        res.flags.push('no_approved_answer');
        return res;
      }
      var conf = m.score >= 0.70 && m.margin >= 0.08 ? 'High' : (m.score >= 0.48 && m.margin >= 0.04 ? 'Medium' : 'Low');
      res.kind = 'answer'; res.text = m.doc.answer; res.confidence = conf; res.rule = 'FAQ';
      res.source = { id: m.doc.id, question: m.doc.question, origin: m.doc.source };
      if (m.doc.human) { res.handover = { topic: 'Handled by HR', route: 'HR contact', urgent: false }; res.flags.push('human_step'); }
      if (conf === 'Low') { res.kind = 'unsure'; res.rule = 'LOW_CONFIDENCE'; res.flags.push('low_confidence'); res.text = 'I found a possible match but I am not confident it answers your question, so I will not guess. Closest approved topic: “' + m.doc.question + '”. Please contact your recruiter or HR contact to be sure.'; res.handover = { topic: 'Low confidence', route: 'Recruiter or HR contact', urgent: false }; }
      return res;
    }

    return { ask: ask, tokens: tokens, size: docs.length, _retrieve: retrieve };
  }

  var api = { createAssistant: createAssistant, tokens: tokens, HANDOVER_RULES: HANDOVER.map(function (h) { return { id: h.id, topic: h.topic, route: h.route, urgent: h.urgent }; }) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HireSmartAssistant = api;
})(typeof self !== 'undefined' ? self : this);
