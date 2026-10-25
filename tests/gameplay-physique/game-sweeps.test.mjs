// AUDIT-1 · balayages dans le jeu réel (vm) : invariants but/arrêt/NaN et indépendance au découpage du temps.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {newGame,rng} from './_game.mjs';

const chunks=frame=>{const out=[];let rem=frame;while(rem>0){const d=Math.min(rem,1/120);out.push(d);rem-=d;}return out;};
const shoot=(g,c)=>{g.run(`const h=action.hero;h.x=${c.hx};h.z=${c.hz};attachBall(h);action.started=true;action.defenders.forEach((d,k)=>{d.x=30+k;d.z=40;});action.teammates.forEach(d=>{d.x=-30;d.z=30;});windUp(h,{x:${c.tx},z:${c.mode==='normal'?-21:-17}},'${c.mode}','hero',${c.spin},${c.mode==='normal'?c.power:null});`);};

test('jeu · 60 frappes/passes/lobs : pas de NaN, pas sous le sol, un seul but maximum, but ⇒ ligne franchie dans le cadre',()=>{
 const r=rng(424242);let goals=0;
 for(let i=0;i<60;i++){
  const c={mode:['normal','normal','lob','low'][i%4],hx:(r()-.5)*30,hz:-4+r()*25,tx:(r()-.5)*8,power:.2+r()*.8,spin:(r()-.5)*1.4};
  const g=newGame(i+1);g.setRandom(100+i);shoot(g,c);const o=g.drive({dts:i%2?1/120:chunks(1/30),maxT:12,afterT:.2});
  assert.equal(o.nan,false,'NaN #'+i);assert.ok(o.minY>=.22-1e-6,'ballon sous le sol #'+i);assert.ok(o.us<=1,'but compté deux fois #'+i);
  assert.ok(o.ended||o.ready,'action bloquée #'+i+' phase '+o.phase);
  if(c.mode==='normal'||c.mode==='lob')assert.ok(o.maxSpeed<45,'vitesse excessive #'+i+' '+o.maxSpeed);
  if(o.kind==='goal'){goals++;assert.ok(o.firstCross&&Math.abs(o.firstCross.x)<3.5&&o.firstCross.y<2.3,'but sans franchissement valide #'+i);}
  else if(o.firstCross&&Math.abs(o.firstCross.x)<3.3&&o.firstCross.y<2.1)assert.fail(`balle franchie dans le cadre mais issue "${o.kind}" #${i}: ${JSON.stringify(o.firstCross)} ${JSON.stringify(o.keeperAt)}`);
 }
 assert.ok(goals>=1,'le balayage contient au moins un but');
});

test('jeu · le découpage du temps ne change pas l’issue d’une frappe sans contact (1/120, 1/240, frames de 1/20, 1/30, 1/60, 1/144 s)',()=>{
 const r=rng(99);let same=0,total=0;
 for(let i=0;i<25;i++){
  const c={mode:'normal',hx:(r()-.5)*20,hz:2+r()*20,tx:(r()-.5)*9,power:.35+r()*.6,spin:0};const res=new Set();
  for(const dts of [1/120,1/240,chunks(1/20),chunks(1/30),chunks(1/60),chunks(1/144)]){const g=newGame(i+1);g.run('Math.random=()=>.5;');shoot(g,c);const o=g.drive({dts,maxT:12,afterT:.2});res.add(o.ended?o.kind:o.ready?'ready':'run');}
  total++;if(res.size===1)same++;
 }
 assert.ok(same/total>=.88,`issues identiques pour ${same}/${total} frappes`);
});

test('jeu · 40 passes entrantes (sol et lob) : la balle arrive toujours, sans NaN',()=>{
 const r=rng(8);
 for(let i=0;i<40;i++){const g=newGame(i+1);g.setRandom(i);const hx=(r()-.5)*30,hz=-10+r()*40,mx=hx+(r()-.5)*40,mz=hz+5+r()*25;
  g.run(`const h=action.hero;h.x=${hx};h.z=${hz};action.defenders.forEach((d,k)=>{d.x=${hx}+(k-3)*6;d.z=${hz}-${r()*12};});action.teammates.forEach(t=>{t.x=-30;t.z=40;});const m=action.teammates[0];m.x=${mx};m.z=${mz};beginIncomingFrom(m,'${i%2?'lob':'pass'}');`);
  const o=g.drive({dts:1/120,maxT:10,afterT:.2});assert.equal(o.nan,false);assert.ok(o.minY>=.22-1e-6);assert.ok(o.ended||o.ready,'passe sans suite #'+i+' '+o.phase);}
});
