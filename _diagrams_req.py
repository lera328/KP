from pypdf import PdfReader
import re
p = r'd:/КП/методичка по вкр.pdf'
text='\n'.join((pg.extract_text() or '') for pg in PdfReader(p).pages)
keys=['диаграмм','UML','IDEF','DFD','ER','прецедент','вариант','класс','последовательност','деятельност','компонент','развёрт','граф состоян']
found=set()
for k in keys:
    for m in re.finditer(k, text, flags=re.I):
        s=max(0,m.start()-120)
        e=min(len(text),m.end()+400)
        chunk=text[s:e].replace('\n',' ')
        key=chunk[:80]
        if key not in found:
            found.add(key)
            print('\n---',k,'---')
            print(chunk)
