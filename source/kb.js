const fs = require('fs'), path = require('path');
const faq = JSON.parse(fs.readFileSync(path.join(__dirname, 'faq_final.json'), 'utf8'));
const policy = [
  { id: 'POL01', question: 'Will a career gap hurt my application?', answer: 'No. A career gap alone does not lower an assessment. We assess job-related evidence only.', human_step: false, source: 'Fair-hiring statement in the job descriptions' },
  { id: 'POL02', question: 'How many years of experience do I need?', answer: 'Job descriptions list must-have skills rather than a minimum number of years. Read the must-have list for the role and apply if you meet it.', human_step: false, source: 'Fair-hiring statement in the job descriptions' },
];
// FAQ05 (accommodation) and FAQ37 (accessibility adjustment) are the same topic and route to the same HR contact
faq.find((f) => f.id === 'FAQ05').same_as = ['FAQ37'];
faq.find((f) => f.id === 'FAQ37').same_as = ['FAQ05'];
module.exports = { faq, policy };
