"""Fuzzing navigateur réel : gestes tactiles/souris aléatoires, boutons, rotation, sur le vrai moteur 3D.
Usage : fuzz-browser.py <dossier_png> <graine> <durée_s> [calm]
Détecte : pageerror, console.error, boucle figée (compteur rAF 'loop' immobile), état incohérent."""
import sys, time, json, random
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pw import *

OUT, SEED, DUR = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
CALM = len(sys.argv) > 4 and sys.argv[4] == 'calm'
R = random.Random(SEED)
BTN = ['#skipPlayback', '#tacticBtn', '#gestureHelp', '#guideClose', '#menuToggle', '#replayBtn', '#continue', '#curveLeft', '#curveRight', '#curveNone',
       '#rpPlay', '#rpBack', '#rpFwd', '#rpRestart', '#replaySkip', '#oneTwo', '#wideView', '#soundToggle', '#lessonRetry']
if not CALM:
    BTN += ['#leave', '#leave']

def tap_sel(s, sel):
    loc = s.page.locator(sel)
    loc.scroll_into_view_if_needed(timeout=3000)
    b = loc.bounding_box()
    s.tap(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)


with sync_playwright() as p:
    s = Session(p)
    pg = s.page
    W, H = 390, 844
    t0 = time.time()
    ev = 0
    stats = {'games': 0, 'starts': 0, 'rot': 0, 'leaves': 0}
    last_loop = s.js('window.__raf.loop'); last_t = time.time()
    frozen = False
    issues = []
    fingers = {}
    from collections import deque
    trail = deque(maxlen=25)
    nid = 1

    def vis_ids():
        return s.js('[...document.querySelectorAll("section")].filter(x=>!x.hidden).map(x=>x.id)')

    while time.time() - t0 < DUR:
        ev += 1
        try:
            scr = vis_ids()
        except Exception as e:
            issues.append(('PAGE UNRESPONSIVE (vis_ids)', str(e)[:150], list(trail))); break
        # démarrer / enchaîner
        if 'home' in scr:
            trail.append(('tap play', scr))
            try:
                tap_sel(s, '#play')
            except Exception as e:
                issues.append(('TAP PLAY FAILED', str(e).splitlines()[0][:150], list(trail), s.js('({a:!!window.__g.action,m:!!window.__g.match,vw:innerWidth,vh:innerHeight,scr:[...document.querySelectorAll("section")].filter(x=>!x.hidden).map(x=>x.id)})')))
                pg.screenshot(path=f'{OUT}/fb{SEED}_tapfail.png'); break
            stats['starts'] += 1
            time.sleep(.3); continue
        if 'result' in scr:
            stats['games'] += 1
            tap_sel(s, '#back'); time.sleep(.2); continue
        st = s.state()
        if st.get('action') is None:
            time.sleep(.1); continue
        # accélérer la simulation
        if st['phase'] == 'interval' and R.random() < .2:
            s.js('if(window.__g.action&&window.__g.action.interval)window.__g.action.interval.speed=2')
        r = R.random()
        try:
            if r < .45 and st['phase'] != 'interval':
                # geste : balle / joueur / coéquipier / hasard
                hero, ball = st.get('hero'), st.get('ball')
                k = R.random()
                if k < .4 and ball: x0, y0 = ball['x'] + R.uniform(-15, 15), ball['y'] + R.uniform(-15, 15)
                elif k < .55 and hero: x0, y0 = hero['x'] + R.uniform(-20, 20), hero['y'] + R.uniform(-20, 20)
                elif k < .75 and st.get('mates'):
                    m = R.choice(st['mates']); x0, y0 = m['x'], m['y']
                else: x0, y0 = R.uniform(0, W), R.uniform(0, H)
                x1, y1 = x0 + R.uniform(-150, 150), y0 + R.uniform(-150, 200)
                trail.append(('gesture', st['phase'], round(x0), round(y0), round(x1), round(y1)))
                mode = R.random()
                if mode < .6:
                    s.drag(x0, y0, x1, y1, steps=R.randint(1, 10), wait=R.choice([0, .01, .03]))
                elif mode < .75:
                    s.tstart(x0, y0); s.tmove([(x1, y1, 1)]); time.sleep(R.choice([.05, .6, 1.1])); s.tcancel()
                elif mode < .85:
                    s.tstart(x0, y0)
                    s.cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0, 'id': 1}, {'x': x1, 'y': y1, 'id': 2}]})
                    time.sleep(.1); s.tend()
                elif mode < .93:
                    s.tstart(x0, y0); time.sleep(R.choice([.2, 1.0, 1.5])); s.tmove([(x1, y1, 1)]); s.tend()
                else:
                    pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x1, y1, steps=3); pg.mouse.up()
            elif r < .7:
                sel = R.choice(BTN)
                trail.append(('btn', sel, st['phase']))
                loc = pg.locator(sel)
                if loc.count() and loc.first.is_visible():
                    b = loc.first.bounding_box()
                    if b: s.tap(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)
                    if sel == '#leave': stats['leaves'] += 1
            elif r < .73 and not CALM:
                stats['rot'] += 1
                trail.append(('rotate',))
                if R.random() < .5: pg.set_viewport_size({'width': 844, 'height': 390}); W, H = 844, 390
                else: pg.set_viewport_size({'width': 390, 'height': 844}); W, H = 390, 844
            else:
                time.sleep(R.choice([.05, .1, .3]))
        except Exception as e:
            issues.append(('exc', str(e)[:200]))
        # contrôles
        lp = s.js('window.__raf.loop')
        if lp == last_loop:
            if time.time() - last_t > 2.5 and not frozen:
                frozen = True
                issues.append(('LOOP FROZEN', round(time.time() - t0, 1), s.errors[-1:] if s.errors else None))
                pg.screenshot(path=f'{OUT}/fb{SEED}_frozen.png')
                break
        else:
            last_loop = lp; last_t = time.time()
        inv = s.js('(()=>{const g=window.__g,a=g.action,m=g.match;const o=[];if(!!a!==!!m)o.push("action/match");if(m&&(m.energy<0||m.energy>100||!isFinite(m.energy)))o.push("energy "+m.energy);if(a&&a.ball&&![a.ball.x,a.ball.y,a.ball.z].every(isFinite))o.push("ball NaN");if(!m&&g.drag)o.push("drag résiduel");if(!isFinite(g.career.xp)||g.career.energy<0)o.push("carrière");return o})()')
        if inv:
            issues.append(('INV', round(time.time() - t0, 1), inv))
            pg.screenshot(path=f'{OUT}/fb{SEED}_inv.png')
        if s.errors:
            issues.append(('PAGEERROR', s.errors[:3])); pg.screenshot(path=f'{OUT}/fb{SEED}_err.png'); break
    print('seed', SEED, 'events', ev, stats, 'dur', round(time.time() - t0))
    print('issues', json.dumps(issues, ensure_ascii=False)[:3000])
    print('console', [c for c in s.console if 'PCFSoft' not in c[1]][:6])
    print('career', s.js('({games:window.__g.career.games,xp:window.__g.career.xp,energy:window.__g.career.energy})'))
    s.close()
