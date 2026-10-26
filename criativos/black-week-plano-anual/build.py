"""Gera criativo.html a partir do template, posicionando os anéis de GPS e o callout sobre a tag da coleira."""
import json, math, sys

p = json.loads(sys.argv[1])
s = open('criativo.tpl.html', encoding='utf-8').read()
tx, ty = p['tag']
lx, ly = p['lead']
dx, dy = tx - lx, ty - ly
rep = {'__TX__': tx, '__TY__': ty, '__LX__': lx, '__LY__': ly,
       '__LW__': round(math.hypot(dx, dy) - 80),
       '__LA__': round(math.degrees(math.atan2(dy, dx)), 2),
       '__CX__': p['call'][0], '__CY__': p['call'][1]}
for k, v in rep.items():
    s = s.replace(k, str(v))
if 'stampcss' in p:
    s = s.replace('.stamp { position: absolute; right: 52px; top: 540px; width: 190px; height: 190px;', p['stampcss'])
open('criativo.html', 'w', encoding='utf-8').write(s)
