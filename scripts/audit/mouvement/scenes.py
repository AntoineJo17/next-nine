"""Scènes ciblées dans Chromium réel : célébration d'un but lointain, plongeon du gardien. PNG régulièrement + trace image par image.
Usage : python scenes.py <dossier_png> <scene: celebration|keeper> [fps=60]"""
import sys, json
OUTDIR, SCENE = sys.argv[1], sys.argv[2]; FPS = float(sys.argv[3]) if len(sys.argv) > 3 else 60
sys.argv = ['observe', '/dev/null']
import observe
from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        page = ctx.new_page()
        def patch(route):
            resp = route.fetch(); body = resp.text()
            route.fulfill(response=resp, body=body + observe.INJECT.replace('__SEED__', '4242'))
        page.route('**/game.js*', patch)
        errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.goto('http://127.0.0.1:8782/index.html', wait_until='load')
        page.wait_for_function("document.getElementById('play') && !document.getElementById('play').disabled", timeout=90000)
        page.evaluate("window.__noauto=true")
        page.click('#play')
        for _ in range(200):
            page.evaluate("window.__runFrames(30, 60)")
            if page.evaluate("__ev(\"!!action && action.ready && !action.ended && action.phase!=='interval'\")"): break
        trace = []
        def steps(n, every, tag):
            for k in range(0, n, every):
                page.evaluate(f"window.__runFrames({every}, {FPS})")
                page.screenshot(path=f'{OUTDIR}/{SCENE}_{tag}_{k:04d}.png')
                trace.append(page.evaluate("__ev(`(()=>{const a=action;return a?{ph:a.phase,hero:[a.hero.x,a.hero.z,a.hero.angle,a.hero.speed],cel:a.celebration?{id:a.celebration.id,ph:a.celebration.phase,t:a.celebration.time}:null,gk:[a.keeper.state,a.keeper.y,a.keeper.tilt],cam:[engine.camera.position.x,engine.camera.position.y,engine.camera.position.z]}:null})()`)"))
        if SCENE == 'celebration':
            page.evaluate("__ev(`{const a=action;a.hero.x=-6;a.hero.z=8;a.hero.vx=0;a.hero.vz=-5;a.hero.speed=5;a.ready=false;a.started=true;a.phase='flight';a.flying=true;a.shotBy='hero';a.ball={x:0,y:1,z:-19,vx:0,vy:0,vz:-5,age:0,bounces:0};resolve(true,'BUT','hero','goal');}`)")
            steps(420, 20, 'but')
        else:
            page.evaluate("__ev(`{const a=action;a.hero.x=1;a.hero.z=-8;a.ball={x:1,y:.3,z:-8.5,vx:0,vy:0,vz:0,age:0,bounces:0};windUp(a.hero,{x:2.2,z:-21},'normal','hero',0,.45);}`)")
            steps(240, 6, 'tir')
        json.dump(trace, open(f'{OUTDIR}/{SCENE}_trace.json', 'w'))
        print('trace', len(trace), 'erreurs', errs[:3])
        page.close(); ctx.close(); b.close()
main()
