"""Observation réelle dans Chromium (WebGL/Metal) : enregistre image par image les positions LOGIQUES (action) et RENDUES (engine) de tous les joueurs.
Usage : python observe.py <sortie.json> [nb_images=6000] [dossier_png] [fps=60] [graine=12345]
Prérequis : serveur `python3 -m http.server 8782 --directory <worktree>/dist`. Rien n'est modifié sur disque : game.js est patché à la volée (page.route).
La boucle du jeu est neutralisée (tick et engine.render du loop() deviennent des no-op) et REMPLACÉE par une boucle synchrone à pas fixe 1/fps :
mêmes appels que loop() (tick par sous-pas 1/120, recordFrame, engine.render(action,dt,time)), mais indépendante de la charge CPU de la machine.
Un pilote automatique joue des actions aléatoires ; à chaque anomalie de rendu la scène est figée et un PNG est pris."""
import sys, json, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]; N = int(sys.argv[2]) if len(sys.argv) > 2 else 6000; PNG = sys.argv[3] if len(sys.argv) > 3 else None
FPS = float(sys.argv[4]) if len(sys.argv) > 4 else 60; SEED = int(sys.argv[5]) if len(sys.argv) > 5 else 12345
INJECT = r"""
;(()=>{
 const rec=[];window.__rec=rec;window.__flags=[];let seed=__SEED__;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return (seed%2147483648)/2147483648;};
 // Math.random du jeu (simulation tactique, duels...) rendu déterministe
 {let r=__SEED__*7+1;Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}
 const origTick=tick;tick=()=>{};let origRender=null,T=0,lastRow=null,cool=0;
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 function players(){const e=engine;if(!e||!action||!e.hero)return null;const L=[['hero',action.hero,e.hero],...(action.teammates||[]).map((p,i)=>['t'+i,p,e.teammates?.[i]]),...action.defenders.map((p,i)=>['d'+i,p,e.defenders?.[i]]),['gk',action.keeper,e.keeper]];
  return L.map(([n,p,r])=>r&&({n,x:p.x,z:p.z,ang:p.angle,sp:p.speed||0,ch:p.challenge?p.challenge.kind:null,cel:p.celebrate||0,rx:r.g.position.x,rz:r.g.position.z,ry:r.g.position.y,rrot:r.g.rotation.y,gait:r.gaitSpeed||0}));}
 function autopilot(){if(window.__noauto)return;if(action.ready&&!action.ended&&!action.callPause){const h=action.hero,k=rnd();try{if(k<.4)windUp(h,{x:(rnd()-.5)*6,z:-21},'normal','hero',0,.4+rnd()*.6);else if(k<.85)beginDribble({x:h.x+(rnd()-.5)*5,z:h.z-1-rnd()*4});else{const t=action.teammates[Math.floor(rnd()*action.teammates.length)];windUp(h,{x:t.x,z:t.z},'low','hero');}}catch(e){}}}
 window.__ev=s=>eval(s);window.__runFrames=(n,fps)=>{const dt=1/fps;if(!origRender){origRender=engine.render.bind(engine);engine.render=()=>{};}
  for(let f=0;f<n;f++){
   if(!match){try{$('back').onclick();}catch(e){}$('play').onclick();continue;}
   if(!action)continue;
   if(action.phase==='interval'){action.interval.fast=true;origTick(.04);continue;}
   autopilot();
   let rem=dt;while(rem>1e-9){const d=Math.min(rem,1/120);origTick(d);rem-=d;}
   if(!guideOpen)recordFrame(action,dt);
   if(action){origRender(action,dt,T);T+=dt;}
   if(action?.ended&&!match?.training&&action.after>continueDelay(action)&&!action.autoNext){action.autoNext=true;$('continue').onclick();}
   const pl=players();if(!pl||!action)continue;const cam=engine.camera;if(!action.__id)action.__id=Math.random();const row={id:action.__id,i:f,ph:action.phase,end:!!action.ended,fr:!!action.frozen,cam:[cam.position.x,cam.position.y,cam.position.z],pl};rec.push(row);if(rec.length>60000)rec.shift();
   if(lastRow&&lastRow.id===row.id&&lastRow.pl.length===pl.length&&!row.fr&&!lastRow.fr){
    for(let i=0;i<pl.length;i++){const a=pl[i],b=lastRow.pl[i];if(!a||!b)continue;const j=Math.hypot(a.rx-b.rx,a.rz-b.rz),jy=Math.abs(a.ry-b.ry),da=Math.abs(wrap(a.rrot-b.rrot));
     let kind=null;if(j>.5)kind='saut-rendu '+j.toFixed(2)+'m';else if(jy>.3)kind='saut-vertical '+jy.toFixed(2)+'m';else if(da>1.5&&a.n!=='gk')kind='rotation-rendue '+(da*57.3|0)+'deg';
     if(kind&&cool<=0){window.__flags.push({f,n:a.n,kind,ph:action.phase,ch:a.ch,cel:a.cel});cool=30;return {stop:true,f};}}}
   cool--;lastRow=row;}
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
        page.goto('http://127.0.0.1:8782/index.html', wait_until='load')
        page.wait_for_function("document.getElementById('play') && !document.getElementById('play').disabled", timeout=90000)
        page.click('#play')
        done = 0; shots = 0; t0 = time.time()
        while done < N and time.time() - t0 < 900:
            r = page.evaluate(f"window.__runFrames({min(300, N - done)}, {FPS})")
            done += 300 if not r['stop'] else (r['f'] + 1)
            if r['stop'] and PNG and shots < 14:
                page.screenshot(path=f'{PNG}/anomalie_{shots:02d}.png'); shots += 1
        data = page.evaluate("({rec:window.__rec,flags:window.__flags})")
        json.dump({'rec': data['rec'], 'flags': data['flags'], 'logs': logs, 'fps': FPS}, open(OUT, 'w'))
        print('images', len(data['rec']), 'drapeaux', len(data['flags']), 'pngs', shots, 'erreurs', logs[:5])
        page.close(); ctx.close(); b.close()

if __name__ == '__main__':
    main()
