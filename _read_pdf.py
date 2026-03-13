from pypdf import PdfReader
import re
p = r'd:/КП/методичка по вкр.pdf'
r = PdfReader(p)
text = '\n'.join((pg.extract_text() or '') for pg in r.pages)
print('PAGES=', len(r.pages), 'CHARS=', len(text))
keys = ['Оглавление','Содержание','Глава 1','ГЛАВА 1','Раздел 1']
for k in keys:
    i=text.find(k)
    if i!=-1:
        print('\n===',k,'===')
        print(text[max(0,i-250):i+2000].replace('\n',' '))

print('\n=== LINES ===')
for line in text.splitlines():
    l=line.strip()
    if re.search(r'(глава\s*1|раздел\s*1|теорет|аналит|проект|обзор|постановка задачи)', l, flags=re.I):
        if len(l)>4:
            print(l)
