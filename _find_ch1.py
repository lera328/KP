from pypdf import PdfReader
import re
p = r'd:/КП/методичка по вкр.pdf'
text='\n'.join((pg.extract_text() or '') for pg in PdfReader(p).pages)
keys=[
    'В первом разделе',
    'Во втором разделе',
    'В третьем разделе',
    'должны быть',
    'аналитический обзор',
    'постановка задачи',
    'обзор по теме'
]
for k in keys:
    for m in re.finditer(re.escape(k), text, flags=re.I):
        s=max(0,m.start()-260)
        e=min(len(text),m.end()+700)
        print('\n===',k,'===')
        print(text[s:e].replace('\n',' '))
        break
