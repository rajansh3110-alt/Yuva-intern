// Final independent evaluation: written after all tuning was finished, run once, engine not changed afterwards.
const A = require('./assistant.js'); const KB = require('./kb.js'); const bot = A.createAssistant(KB);
const inScope = [
 ['After I click submit, what comes next?', ['FAQ01']], ['Roughly how long until I get an offer?', ['FAQ02']], ['Can I go for two vacancies at once?', ['FAQ03']],
 ['I typed my phone number wrongly, how can I correct it?', ['FAQ04', 'FAQ16']], ['Where can I ask for an accessible interview arrangement?', ['FAQ05', 'FAQ37']], ['Will the interview be online or in person?', ['FAQ06']],
 ['Will you give me comments if I do not get the job?', ['FAQ07']], ['I cannot attend my interview slot, what should I do?', ['FAQ08']], ['How can I prepare for the technical interview?', ['FAQ09']],
 ['Should I send a portfolio with my application?', ['FAQ10']], ['How will you decide whether I am shortlisted?', ['FAQ11']], ['Do machines make decisions about candidates?', ['FAQ36', 'FAQ12', 'FAQ11']],
 ['Who can open my information once it is stored?', ['FAQ15', 'FAQ13']], ['How can I ask HR to remove an error in my profile?', ['FAQ16', 'FAQ04']], ['I applied two weeks ago and heard nothing', ['FAQ17']],
 ['What does formally accepted mean for an offer?', ['FAQ18']], ['Is the offer amount negotiable?', ['FAQ19']], ['What do I need to bring on joining day?', ['FAQ20', 'FAQ23']],
 ['My email account is not working on day one, who helps?', ['FAQ22']], ['Will a senior colleague show me around when I join?', ['FAQ24', 'FAQ23']], ['How will my manager set my targets?', ['FAQ25']],
 ['Where is the staff policy portal?', ['FAQ26']], ['How do I tell someone about being harassed by a coworker?', ['FAQ27', 'HO01']], ['If the FAQ does not answer my question, who do I ask?', ['FAQ40', 'FAQ30']],
 ['Is a degree from a famous university preferred?', ['FAQ35']], ['Can I cancel my application?', ['FAQ38']],
];
const outScope = ['What is the best programming language to learn?', 'Who is the prime minister of India?', 'Can you help me write a cover letter?', 'How do I get a visa for the UK?', 'Where is the nearest metro station?',
 'What is the dress code?', 'Does TalentBridge have a gym?', 'How much is a Starbucks coffee?', 'Can you fix my printer?', 'What is machine learning?'];
let correct = 0, safe = 0, wrong = 0; const rows = [];
inScope.forEach(([q, ok], i) => {
  const r = bot.ask(q); const id = r.source ? r.source.id : r.rule;
  let cls;
  if (ok.includes(id) && ['answer', 'handover', 'refusal'].includes(r.kind)) cls = 'correct';
  else if (r.kind === 'unsure' || r.kind === 'handover') cls = 'safe fallback';
  else cls = 'WRONG';
  if (cls === 'correct') correct++; else if (cls === 'safe fallback') safe++; else wrong++;
  rows.push({ set: 'in-scope', n: i + 1, q, expect: ok.join('/'), got: id + ' (' + r.kind + ')', cls });
});
let osSafe = 0, osWrong = 0;
outScope.forEach((q, i) => {
  const r = bot.ask(q); const good = ['unsure', 'handover', 'refusal'].includes(r.kind);
  if (good) osSafe++; else osWrong++;
  rows.push({ set: 'out-of-scope', n: i + 1, q, expect: 'no answer', got: (r.source ? r.source.id : r.rule) + ' (' + r.kind + ')', cls: good ? 'correct' : 'WRONG' });
});
const summary = { inScope: inScope.length, correct, safeFallback: safe, wrong, outScope: outScope.length, outScopeSafe: osSafe, outScopeWrong: osWrong };
console.log(JSON.stringify(summary));
rows.filter((r) => r.cls !== 'correct').forEach((r) => console.log(r.cls, '|', r.set, r.n, '|', r.q, '|', r.expect, '->', r.got));
require('fs').writeFileSync(__dirname + '/test_final.json', JSON.stringify({ summary, rows }, null, 1));
