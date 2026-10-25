"""Lot 12 · mouvement : mesure du déplacement RENDU (positions affichées) image par image dans Chromium, sans arrêt sur anomalie.
Usage : python rendu.py <sortie.json> [nb_images=6000] [fps=60] [graine=12345] [port=8791]
Prérequis : python3 -m http.server <port> (racine du dépôt) ; URL .../dist/index.html. Boucle synchrone à pas fixe (comme observe.py)."""
import sys, json, time
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]; N = int(sys.argv[2]) if len(sys.argv) > 2 else 6000
FPS = float(sys.argv[3]) if len(sys.argv) > 3 else 60; SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 12345; PORT = int(sys.argv[5]) if len(sys.argv) > 5 else 8791
INJECT = r"""
;(()=>{
 window.__ev2=[];window.__st={};let seed=__SEED__;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return (seed%2147483648)/2147483648;};
 {let r=__SEED__*7+1;Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}
 const origTick=tick;tick=()=>{};let origRender=null,T=0,prev=null;
 function players(){const e=engine;if(!e||!action||!e.hero)return null;
  return [['hero',action.hero,e.hero],...(action.teammates||[]).map((p,i)=>['t'+i,p,e.teammates?.[i]]),...action.defenders.map((p,i)=>['d'+i,p,e.defenders?.[i]])].map(([n,p,r])=>r&&({n,x:p.x,z:p.z,sp:p.speed||0,ch:p.challenge?p.challenge.kind:null,rx:r.sx,rz:r.sz}));}
 function autopilot(){if(action.ready&&!action.ended&&!action.callPause){const h=action.hero,k=rnd();try{if(action.phase==='aerial'){if(k<.5)windUp(h,{x:(rnd()-.5)*6,z:-21},'normal','hero',0,.4+rnd()*.6);else{action.aerial=null;controlAgain('c');beginDribble({x:h.x+(rnd()-.5)*5,z:h.z-1-rnd()*4});}}else if(k<.3)windUp(h,{x:(rnd()-.5)*6,z:-21},'normal','hero',0,.4+rnd()*.6);else if(k<.85)beginDribble({x:h.x+(rnd()-.5)*5,z:h.z-1-rnd()*4});else{const t=action.teammates[Math.floor(rnd()*action.teammates.length)];windUp(h,{x:t.x,z:t.z},'low','hero');}}catch(e){}}}
 const grp=n=>n==='hero'?'hero':n[0]==='t'?'mate':'def';
 window.__runFrames=(n,fps)=>{const dt=1/fps;if(!origRender){origRender=engine.render.bind(engine);}
  for(let f=0;f<n;f++){
   if(!match){try{$('back').onclick();}catch(e){}$('play').onclick();continue;}
   if(!action)continue;
   if(action.phase==='interval'){action.interval.fast=true;origTick(.04);continue;}
   autopilot();
   let rem=dt;while(rem>1e-9){const d=Math.min(rem,1/120);origTick(d);rem-=d;}
   if(!guideOpen)recordFrame(action,dt);
   if(action){origRender(action,dt,T);T+=dt;}
   if(action?.ended&&!match?.training&&action.after>continueDelay(action)&&!action.autoNext){action.autoNext=true;$('continue').onclick();}
   const pl=players();if(!pl||!action)continue;if(!action.__id)action.__id=Math.random();
   if(prev&&prev.id===action.__id&&prev.pl.length===pl.length){
    for(let i=0;i<pl.length;i++){const a=pl[i],b=prev.pl[i];if(!a||!b)continue;const j=Math.hypot(a.rx-b.rx,a.rz-b.rz),l=Math.hypot(a.x-b.x,a.z-b.z),g=grp(a.n),k=g+'/'+action.phase;
     const s=window.__st[k]||(window.__st[k]={n:0,max:0,over25:0,over15:0,maxLag:0});s.n++;if(j>s.max)s.max=j;if(j>.25)s.over25++;if(j>.15)s.over15++;
     const lag=Math.hypot(a.rx-a.x,a.rz-a.z);if(lag>s.maxLag)s.maxLag=lag;
     if(j>.25&&window.__ev2.length<300)window.__ev2.push({f,n:a.n,ph:action.phase,fr:!!action.frozen,render:+j.toFixed(2),logic:+l.toFixed(2),ch:a.ch,sim:+action.sim.toFixed(2)});}}
   prev={id:action.__id,pl};}
  return {stop:false};};
})();
"""

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        page = ctx.new_page()
        def patch(route):
            resp = route.fetch(); body = resp.text()
            route.fulfill(response=resp, body=body + INJECT.replace('__SEED__', str(SEED)))
        page.route('**/game.js*', patch)
        logs = []
        page.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error',) else None)
        page.on('pageerror', lambda e: logs.append('pageerror: ' + str(e)))
        page.goto(f'http://127.0.0.1:{PORT}/dist/index.html', wait_until='load')
        page.wait_for_function("document.getElementById('play') && !document.getElementById('play').disabled", timeout=90000)
        page.click('#play')
        done = 0; t0 = time.time()
        while done < N and time.time() - t0 < 900:
            page.evaluate(f"window.__runFrames({min(300, N - done)}, {FPS})"); done += 300
        data = page.evaluate("({st:window.__st,ev:window.__ev2})")
        json.dump({'st': data['st'], 'ev': data['ev'], 'logs': logs}, open(OUT, 'w'))
        for k in sorted(data['st']):
            s = data['st'][k]; print(k.ljust(22), 'n=%d max=%.2f >25cm=%d >15cm=%d retardMax=%.2f' % (s['n'], s['max'], s['over25'], s['over15'], s['maxLag']))
        by = {}
        for e in data['ev']:
            kk = e['n'][0] + '/' + e['ph'] + ('/fr' if e['fr'] else ''); by[kk] = by.get(kk, 0) + 1
        print('evenements >25cm/image', by); print('erreurs', logs[:5])
        for e in data['ev'][:12]: print(e)
        page.close(); ctx.close(); b.close()

if __name__ == '__main__':
    main()
