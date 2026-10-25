"""Captures de la simulation tactique 2D (vue des 22 points) à plusieurs minutes. usage: python shots2d.py <graine> <dossier> <tactique>"""
import asyncio, sys, os
from playwright.async_api import async_playwright
SEED = int(sys.argv[1]); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
HOOK = ("\n;window.__nn={get match(){return match},get action(){return action},tick,stopLoop(){cancelAnimationFrame(frameHandle)},draw(){drawTactical(document.getElementById('tacticalPitch'),match.tactical)}};\n")
SEEDJS = """(()=>{let s=%d>>>0;Math.random=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};})();""" % SEED
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'])
        page = await (await b.new_context(viewport={'width': 390, 'height': 844})).new_page()
        await page.add_init_script(SEEDJS)
        async def patch(route):
            r = await route.fetch(); body = await r.text(); await route.fulfill(response=r, body=body + HOOK)
        await page.route('**/game.js*', patch)
        await page.goto('http://localhost:8783/index.html')
        await page.wait_for_function("!document.querySelector('#play').disabled", timeout=30000)
        await page.click('#play'); await asyncio.sleep(.5); await page.evaluate('__nn.stopLoop()')
        for i in range(3):
            await page.evaluate("""()=>{const nn=__nn;let s=0;while(nn.action.phase==='interval'&&s++<90)nn.tick(1/60);if(nn.action.phase!=='interval'){nn.resolve&&0;}nn.draw();}""")
            await asyncio.sleep(.2)
            await page.screenshot(path=os.path.join(OUT, '2d-seed%d-%d.png' % (SEED, i)))
        await b.close()
asyncio.run(main())
