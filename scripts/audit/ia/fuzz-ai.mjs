// Fuzz déterministe des décisions de football-ai.js sur des configurations réalistes d'occasion (moitié adverse).
import {refreshDefence,assignMarkers,defensiveTarget,teamDecision,laneClearance,offsidePosition,shotQuality} from '../../../dist/football-ai.js';
let n=12345;const rnd=()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};
const U=(a,b)=>a+rnd()*(b-a);
const cfg=()=>{const carrier={x:U(-25,25),z:U(-14,30),vx:0,vz:0};
 const defenders=Array.from({length:10},(_,i)=>{const d={x:U(-28,28),z:U(-19,25)};d.home={x:d.x,z:d.z};return d;});
 const mates=Array.from({length:10},(_,i)=>({x:U(-28,28),z:i===0?83:U(-15,40),tacticalId:i===0?0:i,style:''}));
 return {carrier,defenders,mates,keeper:{x:U(-2,2),z:-19.25}};};
const out={};const inc=(k,v=1)=>out[k]=(out[k]||0)+v;
const N=4000;
for(let t=0;t<N;t++){const {carrier,defenders,mates,keeper}=cfg();
 // A. primaires discordants
 const partners=[carrier,...mates];const pi1=refreshDefence(defenders.map(d=>({...d})),carrier,partners,-1);
 const ds=defenders.map(d=>({...d}));const pi2=assignMarkers(ds,carrier,mates);if(pi1!==pi2)inc('primaryDisagree');
 // B. un défenseur qui marque le gardien allié (idx 0, z=83)
 const ds2=defenders.map(d=>({...d}));refreshDefence(ds2,carrier,partners,-1);if(ds2.some(d=>d.mark===mates[0]))inc('refresh_marksOwnKeeper');
 const ds3=defenders.map(d=>({...d}));assignMarkers(ds3,carrier,mates);if(ds3.some(d=>d.mark===mates[0]))inc('assign_marksOwnKeeper');
 // doublons de marquage
 const marks=ds2.map(d=>d.mark).filter(Boolean);if(new Set(marks).size!==marks.length)inc('dupMarks');
 // marqueur qui marque à plus de 25 m
 if(ds2.some(d=>d.mark&&Math.hypot(d.x-d.mark.x,d.z-d.mark.z)>25))inc('farMark_refresh');
 // C. decisions
 mates.forEach(m=>{m.isHero=false;});const hero=mates[1];hero.isHero=true;
 const dec=teamDecision(carrier,mates.slice(1),defenders,keeper,null);inc('dec_'+dec.kind);
 if(dec.kind==='pass'){const r=dec.receiver;if(!(laneClearance(carrier,r,defenders)>0.75-1e-9)&&!dec.lob)inc('pass_blockedLane');if(offsidePosition(r,carrier,defenders,keeper))inc('pass_toOffside');if(r.z>carrier.z+4)inc('pass_backward4m+');if(Math.abs(r.x)>34||r.z<-20||r.z>85)inc('pass_outsidePitch');}
 if(dec.kind==='shot'){if(Math.abs(dec.target.x)>3.7)inc('shot_wide');if(carrier.z>-4)inc('shot_tooDeep');}
 if(['carry'].includes(dec.kind)){const T=dec.target;if(Math.abs(T.x)>34||T.z<-20)inc('carry_outside');}
 // D. defensiveTarget valeurs dans le terrain
 ds2.forEach((d,i)=>{const T=defensiveTarget(d,carrier,{x:carrier.x,z:carrier.z-.5,vx:0,vz:0},i===pi1,false,{x:carrier.x,z:carrier.z-3});if(!Number.isFinite(T.x)||!Number.isFinite(T.z))inc('target_nan');else{if(Math.abs(T.x)>34.01||T.z<-20||T.z>85)inc('target_outside');}});
}
console.log({N,...out});
