"""Observation navigateur réelle : tirs/passes dans le vrai moteur, trajectoire image par image.
Usage : python browser_observe.py <worktree>/dist-url-port-8781 <sortie_dir>   (serveur déjà lancé sur 8781)
Aucune modification des fichiers du jeu : game.js est patché à la volée via page.route pour exposer l'état interne."""
import sys, json, time, pathlib
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8781/'
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT.mkdir(parents=True, exist_ok=True)
SCENARIOS = json.loads(sys.argv[2]) if len(sys.argv) > 2 else [
    {'name': 'centre', 'hx': 0, 'hz': 8, 'tx': 0.0, 'power': 0.62, 'mode': 'normal'},
    {'name': 'poteau_gauche', 'hx': 4, 'hz': 10, 'tx': -3.75, 'power': 0.6, 'mode': 'normal'},
    {'name': 'lucarne', 'hx': 0, 'hz': 12, 'tx': 3.2, 'power': 0.8, 'mode': 'normal'},
    {'name': 'lob', 'hx': -6, 'hz': 14, 'tx': 1.0, 'power': None, 'mode': 'lob'},
    {'name': 'passe_basse', 'hx': -6, 'hz': 14, 'tx': 5.0, 'power': None, 'mode': 'low'},
]

def patch(route):
    resp = route.fetch()
    body = resp.text()
    body += "\n;window.__g={get action(){return action},get match(){return match},tick,windUp,attachBall,setup,get career(){return career}};\n"
    route.fulfill(response=resp, body=body, headers={**resp.headers, 'cache-control': 'no-store'})

REC = """
window.__rec=[];window.__recOn=false;
(function loop(){ if(window.__recOn){const a=window.__g.action,b=a&&a.ball;if(b)window.__rec.push([performance.now(),b.x,b.y,b.z,b.vx||0,b.vy||0,b.vz||0,a.phase,a.ended?a.outcomeKind:'',a.keeper.x,a.keeper.z,a.keeper.state]);}
 requestAnimationFrame(loop);})();
"""

def main():
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'])
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        page = ctx.new_page()
        logs = []
        page.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
        page.route('**/game.js*', patch)
        page.goto(BASE, wait_until='load')
        page.wait_for_function("document.getElementById('play') && !document.getElementById('play').disabled", timeout=60000)
        page.click('#play')
        page.wait_for_function('window.__g && window.__g.action', timeout=30000)
        page.evaluate(REC)
        results = []
        for sc in SCENARIOS:
            page.evaluate("""(sc)=>{const g=window.__g;g.match.index=1;g.setup();const a=g.action;const h=a.hero;h.x=sc.hx;h.z=sc.hz;g.attachBall(h);a.started=true;
              a.defenders.forEach(d=>{d.x=30;d.z=40});a.teammates.forEach(d=>{d.x=-30;d.z=30});window.__rec.length=0;window.__recOn=true;
              g.windUp(h,{x:sc.tx,z:sc.mode==='lob'?-17:-21},sc.mode,'hero',0,sc.power);}""", sc)
            shots = 0
            t0 = time.time()
            while time.time() - t0 < 14:
                st = page.evaluate("({ended:window.__g.action.ended,after:window.__g.action.after||0,ready:window.__g.action.ready})")
                if st['ended'] and st['after'] > 1.2:
                    break
                if st['ready']:
                    break
                time.sleep(0.15)
                # capture une image pendant le vol
                if shots < 6 and page.evaluate("window.__g.action.flying") and time.time() - t0 > 0.5 + shots * 0.35:
                    page.screenshot(path=str(OUT / f"{sc['name']}_{shots}.png")); shots += 1
            page.screenshot(path=str(OUT / f"{sc['name']}_fin.png"))
            rec = page.evaluate("window.__rec.slice()")
            page.evaluate("window.__recOn=false")
            fps = (len(rec) - 1) / ((rec[-1][0] - rec[0][0]) / 1000) if len(rec) > 2 else 0
            kind = rec[-1][8] if rec else ''
            results.append({'scenario': sc, 'frames': len(rec), 'fps': round(fps, 1), 'outcome': kind, 'msg': page.evaluate("document.getElementById('feedback').textContent")})
            (OUT / f"{sc['name']}.json").write_text(json.dumps(rec))
        print(json.dumps(results, indent=1, ensure_ascii=False))
        print('\n'.join(logs[:20]))
        br.close()

main()
