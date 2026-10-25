"""Mesure ergonomique : un toucher posé SUR le corps visible d'un coéquipier est-il reconnu ? (vrai moteur 3D, 390x844)
Usage : hit-test.py <dossier_png>"""
import sys, time, json
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pw import *

PROJ = '''
(()=>{const g=window.__g,e=g.engine,a=g.action;e.camera.updateMatrixWorld();e.camera.updateProjectionMatrix();
const M=e.camera.projectionMatrix.elements,V=e.camera.matrixWorldInverse.elements;
const r=e.canvas.getBoundingClientRect();
const P=(x,y,z)=>{const vx=V[0]*x+V[4]*y+V[8]*z+V[12],vy=V[1]*x+V[5]*y+V[9]*z+V[13],vz=V[2]*x+V[6]*y+V[10]*z+V[14],vw=V[3]*x+V[7]*y+V[11]*z+V[15];
const cx=M[0]*vx+M[4]*vy+M[8]*vz+M[12]*vw,cy=M[1]*vx+M[5]*vy+M[9]*vz+M[13]*vw,cw=M[3]*vx+M[7]*vy+M[11]*vz+M[15]*vw;
return {x:r.left+(cx/cw+1)/2*r.width,y:r.top+(1-cy/cw)/2*r.height}};
const out=[];const tm=g.ev('teammateAt');
for(const t of a.teammates){const feet=P(t.x,0,t.z),head=P(t.x,1.8,t.z),sh=P(t.x+.3,1.4,t.z),sh2=P(t.x-.3,1.4,t.z);
 const width=Math.abs(sh.x-sh2.x);const cx=feet.x;
 if(head.y<0||feet.y>r.height||feet.x<0||feet.x>r.width)continue;
 let hit=0,n=0;
 for(let k=0;k<=10;k++){const y=head.y+(feet.y-head.y)*k/10;for(const dx of [-1,0,1]){const x=cx+dx*width/2;n++;if(tm({x,y})===t)hit++;}}
 out.push({number:t.number,height:Math.round(feet.y-head.y),width:Math.round(width),hitRate:Math.round(hit/n*100)/100,chest:g.engine.actorScreen(t)})}
return {teammates:out,ball:e.ballScreen(),heroFeet:P(a.hero.x,0,a.hero.z)}})()
'''

with sync_playwright() as p:
    s = Session(p)
    pg = s.page
    b = pg.locator('#play').bounding_box()
    s.tap(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)
    t0 = time.time(); got = 0
    while time.time() - t0 < 200 and got < 3:
        st = s.state()
        if st.get('action') and st['ready']:
            r = s.js(PROJ)
            print(json.dumps(r))
            cover = s.js('''(()=>{const W=innerWidth,H=innerHeight,c={},tot={n:0,canvas:0};for(let y=4;y<H;y+=16)for(let x=4;x<W;x+=16){const el=document.elementFromPoint(x,y);tot.n++;const id=el?(el.id||el.className||el.tagName):'none';if(el&&el.id==='pitch')tot.canvas++;else c[id]=(c[id]||0)+1}return {tot,c}})()''')
            print('COVER', json.dumps(cover))
            pg.screenshot(path=sys.argv[1] + f'/hit{got}.png')
            got += 1
            s.js("window.__g.ev('beginInterval()')")
            time.sleep(1)
        time.sleep(.2)
    print('errors', s.errors)
    s.close()
