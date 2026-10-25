"""Reproduction visuelle : balle rasante qui traverse le gardien en plongeon (pose figée à elapsed=.35 s).
Usage : python browser_keeper_dive.py <dossier_sortie> [ballX]   (serveur dist sur 8781)"""
import sys, json, time, pathlib
from playwright.sync_api import sync_playwright
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
BALLX = float(sys.argv[2]) if len(sys.argv) > 2 else -0.5

def patch(route):
    resp = route.fetch(); body = resp.text()
    body += "\n;window.__g={get action(){return action},get match(){return match},tick,windUp,attachBall,setup};\n"
    route.fulfill(response=resp, body=body, headers={**resp.headers, 'cache-control': 'no-store'})

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'])
    page = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2).new_page()
    page.route('**/game.js*', patch)
    page.goto('http://127.0.0.1:8781/', wait_until='load')
    page.wait_for_function("document.getElementById('play') && !document.getElementById('play').disabled", timeout=60000)
    page.click('#play'); page.wait_for_function('window.__g && window.__g.action')
    page.evaluate("""(bx)=>{const g=window.__g;g.match.index=1;g.setup();const a=g.action;a.started=true;a.ready=false;a.defenders.forEach(d=>{d.x=30;d.z=40});a.teammates.forEach(d=>{d.x=-30;d.z=30});
      a.hero.x=0;a.hero.z=-6;const k=a.keeper;k.state='dive';k.elapsed=.35;k.dir=-1;k.diveStartX=0;k.diveDX=-.68;k.diveT=.3;k.jump=.2;k.noReact=true;
      a.ball={x:bx,y:.22,z:-16.5,vx:0,vy:0,vz:-2.2,age:0,bounces:0,spin:0};a.phase='flight';a.flying=true;a.shotBy='hero';a.kicker=a.hero;a.loose=false;a.flightTime=0;a.contactIgnore=null;
      window.__freeze=true;(function f(){if(window.__freeze&&!a.ended)k.elapsed=.35;requestAnimationFrame(f);})();window.__trace=[];(function t(){const b=a.ball;window.__trace.push([+performance.now().toFixed(0),+b.x.toFixed(2),+b.y.toFixed(2),+b.z.toFixed(2),a.ended?a.outcomeKind:'',k.x,k.state]);requestAnimationFrame(t);})();}""", BALLX)
    n = 0
    for _ in range(80):
        z = page.evaluate("window.__g.action.ball.z")
        ended = page.evaluate("window.__g.action.ended")
        print(round(z, 2), page.evaluate("window.__g.action.keeper.state"), page.evaluate("window.__g.action.keeper.elapsed"), ended)
        if z < -18.4 and n < 5:
            page.screenshot(path=str(OUT / f'dive_{n}.png')); n += 1
        if ended and n >= 3: break
        time.sleep(0.12)
    page.screenshot(path=str(OUT / 'dive_fin.png'))
    print(json.dumps({'kind': page.evaluate("window.__g.action.outcomeKind"), 'msg': page.evaluate("document.getElementById('feedback').textContent"),
                      'keeper': page.evaluate("({x:window.__g.action.keeper.x,tilt:window.__g.action.keeper.tilt,y:window.__g.action.keeper.y,reach:window.__g.action.keeper.reach})"),
                      'trace': page.evaluate("window.__trace.filter((_,i)=>i%6==0).slice(-25)")}, ensure_ascii=False))
    br.close()
