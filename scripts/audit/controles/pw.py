"""Aides Playwright pour l'audit des contrôles (viewport mobile, tactile via CDP, crochets window.__g)."""
import json, time
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:8784/index.html'
ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']


class Session:
    def __init__(self, p, w=390, h=844):
        self.browser = p.chromium.launch(args=ARGS)
        self.ctx = self.browser.new_context(viewport={'width': w, 'height': h}, has_touch=True, is_mobile=True, device_scale_factor=2)
        self.page = self.ctx.new_page()
        self.errors = []
        self.console = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.on('console', lambda m: self.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        self.page.add_init_script("window.__raf={loop:0,other:0};const _r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>_r(t=>{if(cb.name==='loop')window.__raf.loop++;else window.__raf.other++;cb(t)});")
        self.cdp = self.ctx.new_cdp_session(self.page)
        self.page.goto(URL)
        self.page.wait_for_function('window.__g && !document.getElementById("play").disabled', timeout=30000)

    def close(self):
        self.browser.close()

    def js(self, expr):
        return self.page.evaluate(expr)

    # --- tactile bas niveau (CDP) ---
    def tstart(self, x, y, id=1):
        self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': id}]})

    def tmove(self, pts):
        self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y, 'id': i} for (x, y, i) in pts]})

    def tend(self):
        self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})

    def tcancel(self):
        self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchCancel', 'touchPoints': []})

    def drag(self, x0, y0, x1, y1, steps=8, wait=0.02):
        self.tstart(x0, y0)
        for i in range(1, steps + 1):
            self.tmove([(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, 1)])
            time.sleep(wait)
        self.tend()

    def tap(self, x, y):
        self.page.touchscreen.tap(x, y)

    def state(self):
        return self.js('''(()=>{const g=window.__g,a=g.action,m=g.match;if(!a||!m)return {screen:[...document.querySelectorAll('main > section, section')].filter(s=>!s.hidden).map(s=>s.id).join(',')||'?',action:null,match:null};
          const sc=p=>{try{return g.engine.actorScreen(p)}catch(e){return null}};
          return {action:true,phase:a.phase,ready:a.ready,ended:a.ended,minute:m.minute,us:m.us,them:m.them,goals:m.goals,assists:m.assists,energy:m.energy,
          hero:sc(a.hero),ball:sc(a.ball),mates:(a.teammates||[]).map(sc),drag:!!g.drag,guide:g.guideOpen,replay:!!g.replay,callPause:!!a.callPause,
          frame:g.frameHandle,xp:g.career.xp,games:g.career.games,training:m.training}})()''')
