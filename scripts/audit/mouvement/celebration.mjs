// Célébration : où le buteur s'arrête-t-il, à quelle vitesse, après combien de temps ? (usage : node scripts/audit/mouvement/celebration.mjs)
import {boot} from '../../../tests/gameplay-mouvement/harness-reel.mjs';
const {run}=boot();
const toReady=()=>{if(!run('!!match'))run("$('play').onclick();");for(let k=0;k<20000&&!run('!!action&&action.ready&&!action.ended');k++){run('action?(action.phase==="interval"?(action.interval.fast=true,tick(.04)):action.ended?(action.after>1.2?$("continue").onclick():tick(1/60)):tick(1/60)):0');}};
toReady();
console.log('action prête',run('action.phase'));
for(const [x,z] of [[0,-8],[0,0],[0,8],[-12,15],[10,25],[0,40]]){
 run(`{const a=action;a.hero.x=${x};a.hero.z=${z};a.hero.vx=0;a.hero.vz=-5;a.hero.speed=5;a.ready=false;a.started=true;a.phase='flight';a.flying=true;a.shotBy='hero';a.ball={x:0,y:1,z:-19,vx:0,vy:0,vz:-5,age:0,bounces:0};resolve(true,'BUT','hero','goal');}`);
 let t=0,at=null,vAt=0,snaps=[];
 while(t<12&&!run('action.celebration?.phase==="perform"')){run('tick(1/120)');t+=1/120;}
 const c=JSON.parse(run('JSON.stringify({id:action.celebration.id,kind:action.celebration.kind,time:action.celebration.time,tx:action.celebration.target.x,tz:action.celebration.target.z,x:action.hero.x,z:action.hero.z,vx:action.hero.vx,vz:action.hero.vz,sp:action.hero.speed})'));
 const dist=Math.hypot(c.x-c.tx,c.z-c.tz),v=Math.hypot(c.vx,c.vz);
 console.log(`départ (${x},${z}) célébration ${c.id}/${c.kind} : « perform » après ${c.time.toFixed(2)} s, à ${dist.toFixed(1)} m de la cible, vitesse logique ${v.toFixed(1)} m/s -> arrêt net ${v>1.5&&dist>1?'OUI (arrêt brutal en pleine course)':'non'}`);
 // on repart sur une nouvelle action : on force un nouveau match
 run("{action.ended=true;action.after=2;$('continue').onclick();}");
 toReady();
}
