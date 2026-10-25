// AUDIT-3 · simulation tactique à 22 joueurs : invariants sur des matchs complets déterministes, effet mesurable des niveaux et des tactiques,
// cohérence de setTactic / resumeTactical. Lancer : node --test tests/gameplay-ia/*.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createTactical,stepTactical,resumeTactical,setTactic,TACTICS,offsideLine,tacticalToWorld,worldToTactical} from '../../dist/tactical.js';

function play(seed,opts={},hook){const s=createTactical(seed,opts);let n=0;
 for(let k=0;k<400000;k++){const e=stepTactical(s,1/60);n++;if(e?.type==='finish')break;if(hook?.(s,e,k)===false)break;}return s;}
const finite=v=>Number.isFinite(v);

test('22 joueurs et ballon restent finis et dans le terrain pendant des matchs complets (options, cartons, remplacements, changements de tactique)',()=>{
 const bad=[];
 for(let seed=1;seed<=10;seed++){
  play(seed*3+1,{redCards:true,rain:seed%3===0,position:['BU','AIL','MOC'][seed%3],startMinute:seed%4===0?55:0,levels:[50+seed*3,70-seed*2],tactic:Object.keys(TACTICS)[seed%4],opponentTactic:Object.keys(TACTICS)[(seed+1)%4]},(s,e,k)=>{
   if(k%1500===0)setTactic(s,Object.keys(TACTICS)[(k/1500+seed)%4|0]);
   if(e?.type==='chance')resumeTactical(s,[],'save',s.ball,undefined);
   for(const p of s.players)if(!finite(p.x)||!finite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)bad.push({seed,k,id:p.id,x:p.x,y:p.y});
   if(!finite(s.ball.x)||!finite(s.ball.y)||s.ball.x<0||s.ball.x>1||s.ball.y<0||s.ball.y>1)bad.push({seed,k,ball:s.ball});
   if(s.owner.out)bad.push({seed,k,owner:s.owner.name});
  });}
 assert.deepEqual(bad.slice(0,3),[]);
});

test('le porteur est toujours collé au ballon hors passe et tir, et la possession ne reste jamais bloquée plus de 6 secondes',()=>{
 let worstGap=0,worstHold=0;
 for(let seed=1;seed<=8;seed++){let owner=null,since=0;
  play(seed*5+2,{allowChances:false},(s)=>{if(s.owner!==owner){owner=s.owner;since=s.elapsed;}worstHold=Math.max(worstHold,s.elapsed-since);
   if(!s.pass&&!s.shot&&s.goalHold<=0)worstGap=Math.max(worstGap,Math.hypot(s.owner.x-s.ball.x,s.owner.y-s.ball.y));});}
 assert.ok(worstGap<.02,'écart ballon-porteur '+worstGap);assert.ok(worstHold<6,'possession bloquée '+worstHold.toFixed(1)+' s');
});

test('un niveau supérieur donne la possession, les tirs et les buts (écart 80 contre 40 sur 12 matchs)',()=>{
 let g=[0,0],sh=[0,0],po=[0,0];
 for(let seed=1;seed<=12;seed++){const s=play(seed*7+1,{levels:[80,40],allowChances:false});for(const t of[0,1]){g[t]+=s.score[t];sh[t]+=s.shots[t];po[t]+=s.possession[t];}}
 assert.ok(sh[0]>sh[1]*2,'tirs '+sh);assert.ok(po[0]>po[1],'possession '+po);assert.ok(g[0]>=g[1],'buts '+g);
});

test('chaque tactique a un effet mesurable : la possession fait circuler le ballon, le pressing récupère plus de ballons',()=>{
 const stat=tac=>{let passes=0,won=0,wonHigh=0;for(let seed=1;seed<=8;seed++){const s=play(seed*11+3,{tactic:tac,levels:[60,60],allowChances:false});passes+=s.passes[0];won+=s.won[0];wonHigh+=s.wonHigh[0];}return {passes,won,wonHigh};};
 const eq=stat('equilibre'),poss=stat('possession'),press=stat('pressing');
 assert.ok(poss.passes>eq.passes*1.1,'passes possession/équilibre '+poss.passes+'/'+eq.passes);
 assert.ok(press.won>eq.won*1.1,'ballons gagnés pressing/équilibre '+press.won+'/'+eq.won);
});

test('setTactic ignore une tactique inconnue (équilibrée) et agit immédiatement sans toucher aux positions',()=>{
 const s=createTactical(5,{});const before=JSON.stringify(s.players.map(p=>[p.x,p.y]));
 setTactic(s,'inconnue');assert.equal(s.tactics[0],'equilibre');setTactic(s,'pressing');assert.equal(s.tactics[0],'pressing');setTactic(s,'contre',1);assert.equal(s.tactics[1],'contre');
 assert.equal(JSON.stringify(s.players.map(p=>[p.x,p.y])),before);
 for(let k=0;k<600;k++)stepTactical(s,1/60);assert.ok(s.players.every(p=>finite(p.x)&&finite(p.y)));
});

test('resumeTactical : reprise cohérente après chaque issue de l\'occasion 3D (but, arrêt, raté, tacle, hors-jeu)',()=>{
 for(const outcome of['goal','save','miss','tackle','offside']){
  const s=play(9,{allowChances:true,levels:[70,50]},(st,e)=>e?.type==='chance'?false:undefined);
  assert.ok(s.paused,'une occasion doit se présenter');
  const actors=s.players.filter(p=>!p.out).map(p=>({tacticalId:p.id,...tacticalToWorld(p)}));
  const defender=s.players.find(p=>p.team===1&&p.i>0);
  const ball=tacticalToWorld(s.ball);const before=s.score[0];
  resumeTactical(s,actors,outcome,{...ball,y:.22},outcome==='tackle'||outcome==='offside'?defender.id:undefined);
  assert.equal(s.paused,false);assert.equal(s.pass,null);assert.equal(s.shot,null);assert.equal(s.score[0],before+(outcome==='goal'?1:0));
  assert.ok(s.owner&&!s.owner.out);
  if(outcome!=='goal'){assert.ok(Math.hypot(s.owner.x-s.ball.x,s.owner.y-s.ball.y)<1e-9,'le ballon suit le nouveau porteur');}
  for(let k=0;k<1200;k++){const e=stepTactical(s,1/60);if(e?.type==='chance'){resumeTactical(s,[],'save',s.ball,undefined);}}
  assert.ok(s.players.every(p=>finite(p.x)&&finite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));}
});

test('la ligne de hors-jeu est celle de l\'avant-dernier défenseur, gardien compris, dans les deux sens',()=>{
 const s=createTactical(3,{});
 s.players.forEach(p=>{p.y=p.team===1?.9:.2;});s.players[11].y=.97;s.players[12].y=.86;// adversaire : gardien .97, dernier défenseur .9 (plusieurs), un à .86
 const ys=s.players.filter(p=>p.team===1).map(p=>p.y).sort((a,b)=>b-a);
 assert.equal(offsideLine(s,0),ys[1]);
 s.players.forEach(p=>{p.y=p.team===0?.1:.8;});s.players[0].y=.03;
 const yz=s.players.filter(p=>p.team===0).map(p=>p.y).sort((a,b)=>a-b);
 assert.equal(offsideLine(s,1),yz[1]);
});
