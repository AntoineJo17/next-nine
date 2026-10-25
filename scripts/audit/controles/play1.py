import sys, time, json
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pw import *

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
with sync_playwright() as p:
    s = Session(p)
    pg = s.page
    print('loaded', s.state())
    pg.screenshot(path=OUT + '/home.png')
    box = pg.locator('#play').bounding_box()
    s.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    time.sleep(1.0)
    print('after play', s.state())
    pg.screenshot(path=OUT + '/m0.png')
    # accélérer
    sk = pg.locator('#skipPlayback').bounding_box()
    t0 = time.time()
    last = None
    while time.time() - t0 < 60:
        st = s.state()
        ph = st.get('phase')
        if ph != last:
            print(round(time.time() - t0, 1), ph, st.get('minute'), st.get('us'), st.get('them'), st.get('ready'))
            last = ph
        if ph == 'ready':
            pg.screenshot(path=OUT + '/ready.png')
            break
        time.sleep(0.25)
    print('errors', s.errors, s.console[:5])
    s.close()
