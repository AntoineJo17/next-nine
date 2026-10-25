"""Observation réelle : lance le jeu dans Chromium (GPU metal), expose l'état interne par interception de game.js
(sans modifier le fichier du dépôt), pilote la boucle à la main (tick fixe) et enregistre les 22 joueurs + le ballon.
usage: python probe.py <graine> <sortie_dir> [scripts_js]
"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 1
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/ia-out'
os.makedirs(OUT, exist_ok=True)
BASE = 'http://localhost:8783/'
HOOK = ("\n;window.__nn={get match(){return match},get action(){return action},get engine(){return engine},tick,beginDribble,windUp,controlAgain,resolve,laneClearance,"
        "stopLoop(){cancelAnimationFrame(frameHandle)},render(dt){engine.render(action,dt,time);}, get career(){return career}};\n")
SEEDJS = """(()=>{let s=%d>>>0;Math.random=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};})();""" % SEED

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844})
        page = await ctx.new_page()
        logs = []
        page.on('console', lambda m: logs.append(m.type + ': ' + m.text[:200]))
        page.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)[:300]))
        await page.add_init_script(SEEDJS)
        async def patch(route):
            r = await route.fetch()
            body = await r.text()
            if os.environ.get('GAME_PATCHES'):
                for pt in json.load(open(os.environ['GAME_PATCHES'])):
                    assert body.count(pt['old']) == 1, pt['id']
                    body = body.replace(pt['old'], pt['new'])
            await route.fulfill(response=r, body=body + HOOK)
        await page.route('**/game.js*', patch)
        await page.goto(BASE + 'index.html')
        await page.wait_for_function("!document.querySelector('#play').disabled", timeout=30000)
        await page.click('#play')
        await asyncio.sleep(1)
        await page.evaluate('__nn.stopLoop()')
        info = await page.evaluate('({phase:__nn.action.phase,minute:__nn.match.minute})')
        print('start', info)
        await page.evaluate('window.__policy="%s";window.__episodes=%s' % (sys.argv[3] if len(sys.argv)>3 else 'smart', sys.argv[4] if len(sys.argv)>4 else '12'))
        res = await page.evaluate(open(os.path.join(os.path.dirname(__file__), 'probe_drive.js')).read())
        json.dump(res, open(os.path.join(OUT, 'run.json'), 'w'))
        print(res['summary']);print([(e['kind'],e.get('outcome'),e.get('endedAt'),len(e['frames'])) for e in res['episodes']])
        print('logs', logs[:10])
        await page.screenshot(path=os.path.join(OUT, 'end.png'))
        await b.close()
asyncio.run(main())
