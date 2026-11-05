import json, os
here = os.path.dirname(os.path.abspath(__file__))
r = lambda n: open(os.path.join(here, n), encoding='utf-8').read()
html = r('app.html')
data = r('data_full.json')
auto = '\n'.join(l for l in r('automation_core.js').split('\n') if not l.startswith('if (typeof module'))
parts = {'/*__DATA__*/': data.replace('</', '<\\/'), '/*__ASSISTANT__*/': r('assistant.js'), '/*__SCORING__*/': r('scoring.js'), '/*__AUTOMATION__*/': auto, '/*__APP__*/': r('app.js')}
for k, v in parts.items():
    assert k in html, k
    html = html.replace(k, v)
out = r'C:\Hiresmart\Task8_Prototype\HireSmart_Prototype.html'
open(out, 'w', encoding='utf-8').write(html)
print('written', out, os.path.getsize(out), 'bytes')
