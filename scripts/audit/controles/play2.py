"""Joue un match complet au toucher (CDP) avec des gestes variés ; journalise phases, erreurs, incohérences. PNG aux moments clés."""
import sys, time, json, random
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pw import *

OUT = sys.argv[1]
SEED = int(sys.argv[2]) if len(sys.argv) > 2 else 1
LIMIT = float(sys.argv[3]) if len(sys.argv) > 3 else 400
rnd = random.Random(SEED)


def press_btn(s, sel):
    b = s.page.locator(sel).bounding_box()
    if b:
        s.tap(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)


with sync_playwright() as p:
    s = Session(p)
    pg = s.page
    press_btn(s, '#play')
    time.sleep(0.6)
    t0 = time.time()
    log = []
    seen = set()
    shots = 0
    sped = 0
    last_phase = None
    chances = 0
    hung = 0
    last_frame = None
    last_frame_t = time.time()
    while time.time() - t0 < LIMIT:
        st = s.state()
        if not st.get('action'):
            sc = pg.evaluate("[...document.querySelectorAll('section')].filter(x=>!x.hidden).map(x=>x.id)")
            log.append((round(time.time() - t0, 1), 'screen', sc))
            break
        ph = st['phase']
        key = ph
        if ph != last_phase:
            log.append((round(time.time() - t0, 1), ph, st['minute'], st['us'], st['them'], round(st['energy'], 1)))
            last_phase = ph
            if key not in seen:
                seen.add(key)
                pg.screenshot(path=f'{OUT}/s{SEED}_{ph}.png')
        # boucle figée ? (handle rAF doit changer)
        if st['frame'] != last_frame:
            last_frame = st['frame']; last_frame_t = time.time()
        elif time.time() - last_frame_t > 3:
            log.append((round(time.time() - t0, 1), 'LOOP FROZEN', ph))
            pg.screenshot(path=f'{OUT}/s{SEED}_frozen.png')
            break
        if ph == 'interval':
            if sped < 2 and st['minute'] > 3:
                press_btn(s, '#skipPlayback'); sped += 1
            time.sleep(0.2)
            continue
        if st['ended']:
            time.sleep(0.3)
            continue
        if st['ready'] or ph in ('aerial', 'dribble'):
            chances += 1
            hero, ball, mates = st['hero'], st['ball'], st['mates']
            k = rnd.random()
            if k < .35 and ball:
                # frappe : on prend la balle et on tire vers soi
                dx = rnd.uniform(-60, 60)
                s.drag(ball['x'], ball['y'], ball['x'] + dx, ball['y'] + rnd.uniform(60, 130), steps=10)
            elif k < .6 and mates:
                m = rnd.choice(mates)
                if 0 < m['x'] < 390 and 0 < m['y'] < 844:
                    s.tap(m['x'], m['y'])
            elif hero:
                s.tap(hero['x'] + rnd.uniform(-80, 80), hero['y'] - rnd.uniform(40, 160))
            time.sleep(0.15)
            pg.screenshot(path=f'{OUT}/s{SEED}_c{chances}.png') if chances % 9 == 1 else None
        else:
            # phases d'action sans contrôle : toucher au hasard pour courir/appel
            if ph in ('offball', 'press', 'choice') or st['callPause']:
                if st['hero'] and rnd.random() < .4:
                    s.tap(st['hero']['x'] + rnd.uniform(-90, 90), st['hero']['y'] - rnd.uniform(0, 120))
            time.sleep(0.1)
    print(json.dumps(log, ensure_ascii=False))
    print('chances', chances, 'errors', s.errors, [c for c in s.console if 'PCFSoft' not in c[1]][:5])
    final = pg.evaluate("(()=>{const g=window.__g;return {career:g.career,screens:[...document.querySelectorAll('section')].filter(x=>!x.hidden).map(x=>x.id),res:document.getElementById('resultScore').textContent,ev:document.getElementById('resultEvents').textContent,det:document.getElementById('resultDetail').textContent}})()")
    print(json.dumps(final, ensure_ascii=False))
    pg.screenshot(path=f'{OUT}/s{SEED}_end.png')
    s.close()
