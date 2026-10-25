"""Captures PNG de l'occasion 3D : au début (ballon en l'air/passe) et après quelques secondes de conduite.
usage: python shots.py <graine> <dossier> [nb_captures] [seconde_apres_depart,...]
"""
import asyncio, sys, os
from playwright.async_api import async_playwright
SEED = int(sys.argv[1]); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
TIMES = [float(x) for x in (sys.argv[3] if len(sys.argv) > 3 else '0,1,2.5').split(',')]
HOOK = ("\n;window.__nn={get match(){return match},get action(){return action},get engine(){return engine},tick,beginDribble,windUp,controlAgain,resolve,laneClearance,"
        "stopLoop(){cancelAnimationFrame(frameHandle)},render(dt){engine.render(action,dt,time);}, get career(){return career}};\n")
SEEDJS = """(()=>{let s=%d>>>0;Math.random=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};})();""" % SEED
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844})
        page = await ctx.new_page()
        await page.add_init_script(SEEDJS)
        async def patch(route):
            r = await route.fetch(); body = await r.text()
            await route.fulfill(response=r, body=body + HOOK)
        await page.route('**/game.js*', patch)
        await page.goto('http://localhost:8783/index.html')
        await page.wait_for_function("!document.querySelector('#play').disabled", timeout=30000)
        await page.click('#play'); await asyncio.sleep(1)
        await page.evaluate('__nn.stopLoop()')
        # avance jusqu'à la première occasion jouable
        kind = await page.evaluate("""()=>{const nn=__nn;let guard=0;while(guard++<20){let s=0;while(nn.action&&nn.action.phase==='interval'&&s++<60*60*8)nn.tick(1/60);
          if(!nn.action)return null;const k=nn.action.chanceKind;if(['open','wing','playmaker'].includes(k))return k;nn.resolve(false,'skip',null,'miss');document.getElementById('continue').onclick();}return null}""")
        print('kind', kind)
        if not kind: await b.close(); return
        t_prev = 0.0
        for i, T in enumerate(TIMES):
            await page.evaluate("""(T)=>{const nn=__nn,a=nn.action;let guard=0;while(a.sim<T&&guard++<60*30&&!a.ended){const h=a.hero;if(a.phase==='aerial')nn.controlAgain('ok');
              else if(a.phase==='ready'){let best=null,bs=-1e9;for(let ang=-100;ang<=100;ang+=20){const ba=Math.atan2(-h.x,-20-h.z),aa=ba+ang*Math.PI/180,tx=h.x+Math.sin(aa)*5,tz=h.z+Math.cos(aa)*5;if(Math.abs(tx)>32||tz<-18.5)continue;const clear=Math.min(12,...a.defenders.map(d=>Math.hypot(d.x-tx,d.z-tz)));const sc=clear*1.2-Math.abs(ang)/40-Math.hypot(tx,tz+20)*.5;if(sc>bs){bs=sc;best={x:tx,z:tz};}}nn.beginDribble(best);}
              nn.tick(1/60);} nn.render(1/60);}""", T)
            await asyncio.sleep(.3)
            await page.evaluate('__nn.render(1/60)')
            await page.screenshot(path=os.path.join(OUT, 'seed%d-t%s.png' % (SEED, str(T).replace('.', '_'))))
        await b.close()
asyncio.run(main())
