"""Scénarios ciblés dans le vrai navigateur. Usage : play3.py <dossier_png> <scénario>"""
import sys, time, json
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pw import *

OUT, SC = sys.argv[1], sys.argv[2]


def center(s, sel):
    b = s.page.locator(sel).bounding_box()
    return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2


def wait_phase(s, phases, timeout=60):
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = s.state()
        if st.get('action') and st['phase'] in phases:
            return st
        time.sleep(0.05)
    return None


def raf_rate(s, secs=1.0):
    return s.js('''new Promise(r=>{let n=0;const t0=performance.now();const o=window.requestAnimationFrame;window.__rafn=0;const f=()=>{n++;if(performance.now()-t0<%d)o.call(window,f);else r(n/((performance.now()-t0)/1000))};o.call(window,f)})''' % int(secs * 1000))


def loop_rate(s):
    a = s.js('window.__raf.loop'); time.sleep(1.0); b = s.js('window.__raf.loop'); return b - a


def listeners(s):
    return s.js('window.__g.ev("1")') and None


with sync_playwright() as p:
    s = Session(p)
    pg = s.page
    res = {}
    if SC == 'dbl':
        # double tap sur Jouer
        x, y = center(s, '#play')
        pg.touchscreen.tap(x, y); pg.touchscreen.tap(x, y)
        time.sleep(0.8)
        st = s.state()
        res['state'] = st
        res['energy'] = s.js('window.__g.career.energy')
        res['feedback'] = s.js('document.getElementById("feedback").textContent')
        # triple clic via DOM direct pour vérifier la garde de startMatch
        s.js('window.__g.ev("startMatch(false);startMatch(false)")')
        time.sleep(0.5)
        res['after_js_double'] = s.state()
    elif SC == 'relaunch':
        out = []
        for i in range(6):
            x, y = center(s, '#play')
            s.tap(x, y)
            time.sleep(1.2 + i * .5)
            st = s.state()
            before = s.js('({xp:window.__g.career.xp,games:window.__g.career.games,e:window.__g.career.energy})')
            lx, ly = center(s, '#leave')
            s.tap(lx, ly)
            time.sleep(0.4)
            after = s.js('({xp:window.__g.career.xp,games:window.__g.career.games,e:window.__g.career.energy,a:!!window.__g.action,m:!!window.__g.match,home:!document.getElementById("home").hidden,announce:!document.getElementById("announce").hidden,goalc:!document.getElementById("goalCelebration").hidden})')
            out.append((st.get('phase'), round(st.get('minute') or 0, 1), before, after, loop_rate(s)))
        res['rounds'] = out
    elif SC == 'gest':
        x, y = center(s, '#play'); s.tap(x, y)
        st = wait_phase(s, ['ready', 'aerial'], 120)
        res['phase'] = st and st['phase']

        def snap():
            return s.js('(()=>{const g=window.__g,a=g.action;return {phase:a&&a.phase,ready:a&&a.ready,drag:!!g.drag,aim:g.engine.aim.visible,mode:g.mode,feedback:document.getElementById("feedback").textContent.slice(0,50)}})()')
        res['t0'] = snap()
        b = st['ball']
        # a) deux doigts
        s.tstart(b['x'], b['y'], 1)
        s.tmove([(b['x'], b['y'] + 40, 1)])
        m = [q for q in st['mates'] if 0 < q['x'] < 390 and 0 < q['y'] < 844][0]
        s.cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': b['x'], 'y': b['y'] + 40, 'id': 1}, {'x': m['x'], 'y': m['y'], 'id': 2}]})
        time.sleep(.1)
        res['a_two_fingers_down'] = snap()
        s.cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': [{'x': b['x'], 'y': b['y'] + 40, 'id': 1}]})
        time.sleep(.2)
        res['a_after_finger2_up'] = snap()
        s.cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        time.sleep(.5)
        res['a_after_all_up'] = snap()
        # b) annulation
        s.js("window.__g.ev(\"controlAgain('test')\")"); time.sleep(.2)
        st = s.state(); b = st['ball']
        s.tstart(b['x'], b['y']); s.tmove([(b['x'] + 20, b['y'] + 60, 1)]); time.sleep(.1)
        res['b_during'] = snap()
        s.tcancel(); time.sleep(.3)
        res['b_after_cancel'] = snap()
        # c) relâché hors fenêtre
        s.tstart(b['x'], b['y']); s.tmove([(b['x'] + 10, b['y'] + 50, 1)])
        s.tmove([(-80, 1200, 1)]); time.sleep(.1)
        res['c_outside_during'] = snap()
        s.tend(); time.sleep(.5)
        res['c_after_release'] = snap()
        for k, v in res.items():
            print(k, v)
    elif SC == 'leak':
        x, y = center(s, '#play'); s.tap(x, y)
        time.sleep(1.5)
        probe = '''(()=>{const e=window.__g.engine,r=e.renderer||e.r||e.rend;const i=r&&r.info;return {geo:i&&i.memory.geometries,tex:i&&i.memory.textures,prog:i&&i.programs&&i.programs.length,calls:i&&i.render.calls,children:e.scene.children.length,heap:performance.memory&&Math.round(performance.memory.usedJSHeapSize/1e6)}})()'''
        res['start'] = s.js(probe)
        for rnd in range(4):
            s.js('window.__g.ev("(()=>{for(let i=0;i<25;i++){setup(true);}})()")')
            time.sleep(1.0)
            res['after%d' % ((rnd + 1) * 25)] = s.js(probe)
        # quitter / relancer 6 fois
        for i in range(6):
            lx, ly = center(s, '#leave'); s.tap(lx, ly); time.sleep(.3)
            x, y = center(s, '#play'); s.tap(x, y); time.sleep(1.0)
        res['after_relaunch6'] = s.js(probe)
        for k, v in res.items():
            print(k, v)
    elif SC == 'rotate':
        x, y = center(s, '#play'); s.tap(x, y)
        st = wait_phase(s, ['ready', 'aerial'], 90)
        res['phase'] = st and st['phase']
        pg.screenshot(path=OUT + '/rot_a.png')
        pg.set_viewport_size({'width': 844, 'height': 390})
        time.sleep(0.8)
        pg.screenshot(path=OUT + '/rot_b.png')
        st2 = s.state(); res['land'] = {'hero': st2.get('hero'), 'ball': st2.get('ball')}
        # geste en paysage : tirer depuis la balle
        b = st2['ball']
        s.drag(b['x'], b['y'], b['x'], b['y'] + 70)
        time.sleep(.6)
        res['after_shot'] = s.state().get('phase')
        pg.set_viewport_size({'width': 390, 'height': 844})
        time.sleep(0.8)
        pg.screenshot(path=OUT + '/rot_c.png')
    elif SC == 'hidden':
        x, y = center(s, '#play'); s.tap(x, y)
        time.sleep(3)
        m0 = s.state()['minute']
        # simule onglet masqué : document.hidden=true + rAF suspendu 8 s
        s.js('Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"))')
        time.sleep(4)
        m1 = s.state()['minute']
        s.js('Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});document.dispatchEvent(new Event("visibilitychange"))')
        time.sleep(1)
        m2 = s.state()['minute']
        res['minutes'] = [m0, m1, m2]
    elif SC == 'newtab':
        x, y = center(s, '#play'); s.tap(x, y)
        time.sleep(3)
        m0 = s.state()['minute']
        p2 = s.ctx.new_page(); p2.goto('about:blank'); p2.bring_to_front()
        time.sleep(4)
        res['hidden_state'] = pg.evaluate('document.hidden')
        m1 = pg.evaluate('window.__g.match.minute')
        pg.bring_to_front(); time.sleep(1.5)
        m2 = s.state()['minute']
        res['minutes'] = [m0, m1, m2]
        p2.close()
    print(json.dumps(res, ensure_ascii=False, default=str))
    print('errors', s.errors, [c for c in s.console if 'PCFSoft' not in c[1]][:5])
    s.close()
