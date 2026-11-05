import csv, glob, json, os, re
P = r'C:\Hiresmart\HireSmart_Demo_Pack'
here = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(here, 'data.json'), encoding='utf-8'))

# raw resume text (for display and for scoring pasted text)
raw = {}
for f in sorted(glob.glob(P + r'\sample_resumes\*.txt')):
    t = open(f, encoding='utf-8').read()
    cid = re.search(r'Candidate ID:\s*(\w+)', t).group(1)
    raw[cid] = t
for r in D['resumes']:
    r['raw'] = raw[r['id']]

# prompt library
md = open(P + r'\templates\prompt_library.md', encoding='utf-8').read()
prompts = []
for block in re.split(r'^## ', md, flags=re.M)[1:]:
    lines = block.strip().split('\n')
    m = re.match(r'(\d+)\.\s*(.+)', lines[0])
    d = {'n': int(m.group(1)), 'title': m.group(2).strip()}
    for ln in lines[1:]:
        mm = re.match(r'(ROLE|CONTEXT|TASK|FORMAT|GUARDRAIL):\s*(.+)', ln)
        if mm:
            d[mm.group(1).lower()] = mm.group(2).strip()
    prompts.append(d)
D['prompts'] = prompts

# knowledge base = final FAQ + policy statements + handover rules
faq = json.load(open(os.path.join(here, 'faq_final.json'), encoding='utf-8'))
for f in faq:
    f['human_step'] = bool(f['human_step'])
    f['question'] = f['question']
for f in faq:
    if f['id'] == 'FAQ05': f['same_as'] = ['FAQ37']
    if f['id'] == 'FAQ37': f['same_as'] = ['FAQ05']
policy = [
    {'id': 'POL01', 'question': 'Will a career gap hurt my application?', 'answer': 'No. A career gap alone does not lower an assessment. We assess job-related evidence only.', 'human_step': False, 'source': 'Fair-hiring statement in the job descriptions'},
    {'id': 'POL02', 'question': 'How many years of experience do I need?', 'answer': 'Job descriptions list must-have skills rather than a minimum number of years. Read the must-have list for the role and apply if you meet it.', 'human_step': False, 'source': 'Fair-hiring statement in the job descriptions'},
]
D['kb'] = {'faq': faq, 'policy': policy}

# evaluation summary produced by the test scripts
ev = json.load(open(os.path.join(here, 'eval_summary.json'), encoding='utf-8'))
D['eval'] = ev
for name in ['test_scoring', 'test_automation', 'test_gas_sim']:
    j = json.load(open(os.path.join(here, name + '.json'), encoding='utf-8'))
    D['eval'][name] = {'pass': j['pass'], 'total': j['total']}
json.dump(D, open(os.path.join(here, 'data_full.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('data_full.json', os.path.getsize(os.path.join(here, 'data_full.json')), 'bytes;', len(prompts), 'prompts;', len(faq), 'faq')

# knowledge file deliverables
kbdir = r'C:\Hiresmart\Task8_Prototype\knowledge_base'
json.dump({'name': 'HireSmart approved knowledge base', 'version': '1.0 draft', 'owner': 'HR Project Lead (draft by Ansh Raj)', 'note': 'Answers are drafts pending HR approval. Text in [square brackets] needs HR input. Synthetic scenario.',
           'faq': faq, 'policy_statements': policy}, open(kbdir + r'\hireSmart_knowledge_base.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('knowledge base json written')
