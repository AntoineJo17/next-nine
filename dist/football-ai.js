import {clamp,R,PITCH} from './physics.js?v=20-12';
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function laneClearance(from,to,defenders){const dx=to.x-from.x,dz=to.z-from.z,ll=dx*dx+dz*dz;return defenders.reduce((best,d)=>{const u=((d.x-from.x)*dx+(d.z-from.z)*dz)/(ll||1);if(u<.08||u>.96)return best;return Math.min(best,Math.hypot(d.x-from.x-u*dx,d.z-from.z-u*dz));},20);}
// Lot 1 · How good a shot is from here (0 = none): the angle between the posts, the distance and the open lanes.
export function goalView(p){const a=Math.atan2(-3.66-p.x,-20-p.z),b=Math.atan2(3.66-p.x,-20-p.z);return Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)));}
export function shotQuality(p,defenders){const d=distance(p,{x:0,z:-20});if(p.z>-4||d>17)return 0;const view=goalView(p);if(view<.36)return 0;const open=[-2.7,0,2.7].filter(x=>laneClearance(p,{x,z:-20},defenders)>.38).length;if(!open)return 0;const pressure=Math.min(4,...defenders.map(q=>distance(q,p)));return view*1.6+open*.18-d*.035+Math.min(pressure,2)*.08;}
export function canShoot(p,defenders){return shotQuality(p,defenders)>.55;}
// Lot 2 · Above about 72 % the strike rises sharply (see launch), so partners keep their shots between 62 and 75 %: on target from 6 to 17 m.
export function shotPower(p){const d=distance(p,{x:0,z:-20});return clamp(.62+d*.008,.62,.75);}
// Lot 2 · A partner never passes to a player standing offside (judged now, at the pass). A run that starts onside is fine.
export function offsidePosition(p,carrier,defenders,keeper){const zs=[keeper?.z??-19.25,...defenders.map(d=>d.z)].sort((a,b)=>a-b),line=zs.length>1?zs[1]:zs[0];return p.z<line-.05&&p.z<carrier.z&&p.z<(PITCH.far-20)/2;}
export function teamDecision(carrier,partners,defenders,keeper,preferred=null){
 // Lot 4 · The career player is only found when the ball will really reach him (open lane, nobody on him); otherwise the team builds without him.
 const heroOpen=p=>laneClearance(carrier,p,defenders)>(p===preferred?1.2:1.5)&&Math.min(20,...defenders.map(d=>distance(d,p)))>(p===preferred?1.7:2.4);
 partners=partners.filter(p=>p===carrier||!offsidePosition(p,carrier,defenders,keeper)&&(!p.isHero||heroOpen(p)));if(preferred&&!partners.includes(preferred))preferred=null;
 // 13 · personalities: a winger takes players on, a playmaker looks for the pass, a forward attacks the box.
 const style=carrier.style||'',mine=shotQuality(carrier,defenders);
 // A call (preferred) counts in the comparison; another partner must be clearly better placed to be found instead of shooting.
 const rank=p=>shotQuality(p,defenders)+(p===preferred?.45:0),better=partners.filter(p=>p!==carrier&&distance(p,carrier)>2&&laneClearance(carrier,p,defenders)>1.3&&rank(p)>mine+.35&&rank(p)>mine*1.3).sort((a,b)=>rank(b)-rank(a))[0];
 if(mine>.55&&!better){const targets=[-2.8,2.8,0].map(x=>({x,z:-21}));targets.sort((a,b)=>(laneClearance(carrier,b,defenders)*2+Math.abs(b.x-keeper.x))-(laneClearance(carrier,a,defenders)*2+Math.abs(a.x-keeper.x)));return {kind:'shot',target:targets[0],power:shotPower(carrier)};}
 if(better&&(better===preferred||mine>.55))return {kind:'pass',receiver:better,target:{x:better.x,z:better.z}};
 if(style==='ailier'&&Math.min(20,...defenders.map(d=>distance(d,carrier)))>1.8&&carrier.z>-15){const t={x:clamp(carrier.x*.85,-PITCH.W+1,PITCH.W-1),z:Math.max(-17,carrier.z-4.5)};if(laneClearance(carrier,t,defenders)>.9)return {kind:'carry',target:t};}
 const central=partners.filter(p=>p!==carrier&&p.z<-10&&Math.abs(p.x)<5).sort((a,b)=>a.z-b.z)[0];
 if(Math.abs(carrier.x)>8&&carrier.z<-7&&central&&laneClearance(carrier,central,defenders)<1.4)return {kind:'cross',receiver:central,target:{x:central.x,z:central.z}};
 const forward={x:clamp(carrier.x*.92,-PITCH.W+1,PITCH.W-1),z:Math.max(-18,carrier.z-4)},pressure=Math.min(20,...defenders.map(d=>distance(d,carrier)));
 const candidates=partners.filter(p=>p!==carrier&&distance(p,carrier)>2&&distance(p,carrier)<30).map(p=>{const lane=laneClearance(carrier,p,defenders),space=Math.min(8,...defenders.map(d=>distance(d,p))),progress=carrier.z-p.z;return {p,lane,score:Math.min(lane,4)*.7+space*.35+progress*.45-distance(p,carrier)*.07+shotQuality(p,defenders)*4+(p===preferred?2.2:p.isHero?1.6:0)-(p===carrier.lastPasser&&!p.isHero?3:0)-(progress< -3?3:0)};}).filter(c=>c.lane>.75);
 // V19 · A partner 12–35 m away behind a blocked lane can still be found with a lofted pass.
 candidates.sort((a,b)=>b.score-a.score);
 if(!candidates.length||candidates[0].score<2){const lofted=partners.filter(p=>p!==carrier&&distance(p,carrier)>12&&distance(p,carrier)<35&&laneClearance(carrier,p,defenders)<=.75&&p.z<carrier.z+4).map(p=>({p,lane:1,lob:true,score:Math.min(8,...defenders.map(d=>distance(d,p)))*.5+(carrier.z-p.z)*.3-(p===carrier.lastPasser?3:0)})).filter(c=>c.score>1.2);candidates.push(...lofted);}
 candidates.sort((a,b)=>b.score-a.score);
 // Carry into free space before passing sideways; a forward run by the player is preferred.
 if(pressure>2.6&&laneClearance(carrier,forward,defenders)>1.1&&(!candidates.length||candidates[0].score<(style==='meneur'?4.5:6.5)))return {kind:'carry',target:forward};
 if(candidates.length)return {kind:'pass',receiver:candidates[0].p,target:{x:candidates[0].p.x,z:candidates[0].p.z},lob:!!candidates[0].lob};
 return {kind:'carry',target:{x:clamp(carrier.x+(carrier.x<0?-1:1)*1.2,-PITCH.W+1,PITCH.W-1),z:Math.max(-16,carrier.z-1.8)}};
}
// Stable one-to-one marking persists for the whole touch, avoiding target oscillation.
// AUDIT-3 · A marker keeps his man while he is not clearly out of reach (beyond 9 m only if no free man is 4 m closer), the free men are shared out
// closest pair first so two markers never swap or cross their men, and the own goalkeeper (style 'gardien') is never marked.
const keepsMark=(d,m,markable,used,held)=>{const v=distance(d,m);if(v<9)return true;let best=Infinity;for(const p of markable)if(p!==m&&!used.has(p)&&!held.has(p))best=Math.min(best,distance(d,p));return v<best+4;};
function pairUp(free,markable,used,cost=distance){const pairs=[];for(const d of free)for(const p of markable)if(!used.has(p))pairs.push({d,p,c:cost(d,p)});pairs.sort((a,b)=>a.c-b.c);const done=new Set();for(const {d,p} of pairs){if(done.has(d)||used.has(p))continue;d.mark=p;used.add(p);done.add(d);}for(const d of free)if(!done.has(d))d.mark=null;}
const pressScore=(d,carrier)=>distance(d,carrier)+(d.z>carrier.z+.5?2.3:0)+(d.challenge?2:0);
export function assignMarkers(defenders,carrier,partners){const markable=partners.filter(p=>p!==carrier&&p.style!=='gardien'),used=new Set();let primary=-1,best=Infinity;defenders.forEach((d,i)=>{const v=pressScore(d,carrier);if(v<best){best=v;primary=i;}});/* Lot 2 · a marker keeps his man through a dribble, a pass or a reception unless he is out of reach. */const held=new Set(defenders.filter((x,i)=>i!==primary&&x.mark).map(x=>x.mark)),free=[];defenders.forEach((d,i)=>{if(i===primary){d.mark=null;return;}if(d.mark&&markable.includes(d.mark)&&!used.has(d.mark)&&keepsMark(d,d.mark,markable,used,held)){used.add(d.mark);return;}d.mark=null;free.push(d);});pairUp(free,markable,used,(d,p)=>distance(d,p)+Math.max(0,p.z-d.z)*.15);return primary;}
export function defensiveTarget(d,carrier,ball,primary,flying,intent){if(primary){if(flying){const t=clamp(distance(d,ball)/20,.04,.3);return {x:clamp(ball.x+(ball.vx||0)*t,-PITCH.W+.5,PITCH.W-.5),z:clamp(ball.z+(ball.vz||0)*t,-19,PITCH.far-2)};}const dx=intent.x-carrier.x,dz=intent.z-carrier.z,len=Math.hypot(dx,dz);if(len<.05)return {x:carrier.x+(carrier.vx||0)*.15,z:carrier.z-1.4};const ahead=Math.min(len,2.4);/* meet the carrier where the touch is going, from the goal side */return {x:carrier.x+dx/len*ahead+(carrier.vx||0)*.15,z:carrier.z+dz/len*ahead+(carrier.vz||0)*.15-.45};}if(d.cover){return {x:clamp(carrier.x*.75,-PITCH.W+3,PITCH.W-3),z:Math.max(-19,carrier.z-2.5)};}if(d.mark){const p=d.mark,dx=ball.x-p.x,dz=ball.z-p.z,len=Math.hypot(dx,dz)||1;return {x:p.x+dx/len*1.15,z:Math.min(p.z+dz/len*1.15,carrier.z-.8)};}return {x:clamp(carrier.x*.4+d.home.x*.6,-PITCH.W+1,PITCH.W-1),z:Math.max(-18,carrier.z-3)};}
// Relative swept collision: a fast ball cannot jump through a moving receiver.
export function sweptPlayerContact(before,after,p,radius=.65,height=1.55){const old=p.previous||p;const sx=before.x-old.x,sz=before.z-old.z,dx=(after.x-p.x)-sx,dz=(after.z-p.z)-sz,rr=radius+R;const aa=dx*dx+dz*dz,bb=2*(sx*dx+sz*dz),cc=sx*sx+sz*sz-rr*rr;let t=0;if(cc>0){const disc=bb*bb-4*aa*cc;if(aa<1e-12||disc<0)return null;t=(-bb-Math.sqrt(disc))/(2*aa);if(t<0||t>1)return null;}const y=before.y+(after.y-before.y)*t;if(y>height+R)return null;return {t,x:before.x+(after.x-before.x)*t,z:before.z+(after.z-before.z)*t,y};}

export function refreshDefence(defenders,carrier,partners,current=-1){if(!defenders.length)return -1;const score=d=>pressScore(d,carrier);let selected=defenders.reduce((best,d,i)=>score(d)<score(defenders[best])?i:best,0);if(current>=0&&defenders[current]&&score(defenders[current])<score(defenders[selected])+.4)selected=current;// Lot 1 · Jobs are kept: the cover stays the cover and a marker keeps his man unless he is clearly out of reach.
 const wasCover=defenders.find(d=>d.cover);for(const d of defenders)d.cover=false;const choices=defenders.filter((d,i)=>i!==selected&&d.z<carrier.z+.5).sort((a,b)=>distance(a,carrier)-distance(b,carrier));let cover=choices[0];if(wasCover&&choices.includes(wasCover)&&cover&&distance(wasCover,carrier)<distance(cover,carrier)+2.5)cover=wasCover;if(cover)cover.cover=true;
 const markable=partners.filter(p=>p!==carrier&&p.style!=='gardien'),used=new Set(),free=[],held=new Set(defenders.filter((x,i)=>i!==selected&&!x.cover&&x.mark).map(x=>x.mark));for(const [i,d] of defenders.entries()){if(i===selected||d.cover){d.mark=null;continue;}if(d.mark&&markable.includes(d.mark)&&!used.has(d.mark)&&keepsMark(d,d.mark,markable,used,held)){used.add(d.mark);continue;}d.mark=null;free.push(d);}
 pairUp(free,markable,used);return selected;}

// Lot 12 · ia — Off the ball, a partner no longer waits on his post: around the place his shape gives him (anchor) he looks for the spot where he can really be found
// (open lane from the ball, space from the markers, onside, not on a team-mate), a winger/full-back overlaps outside the carrier, and the forwards slide between the
// defenders, level with the offside line. The spot is deterministic and sticky (kept unless clearly worse) so nobody jitters. Defenders stay behind the ball.
export const roleOf=id=>{const i=(((id|0)%11)+11)%11;return i===0?'gk':i<=4?'def':i<=7?'mid':'fwd';};
export function supportScore(c,carrier,defenders,o){
 const role=o.role,lane=Math.min(4,laneClearance(carrier,c,defenders)),space=Math.min(7,defenders.reduce((m,d)=>Math.min(m,distance(d,c)),20)),dc=distance(c,carrier);
 let s=lane*1.0+space*.55;if(space<1.4)s-=(1.4-space)*14;
 if(dc<5)s-=(5-dc)*.9;else if(dc>24)s-=(dc-24)*.25;
 const ahead=carrier.z-c.z;if(role!=='def'){s+=clamp(ahead,-4,10)*(role==='fwd'?.12:.07);if(ahead<-4)s-=(-4-ahead)*.7;if(c.z>o.anchor.z+1.5)s-=(c.z-o.anchor.z-1.5)*.9;}
 s-=distance(c,o.anchor)*(role==='def'?.34:role==='mid'?.22:.18);
 if(c.z<o.line+.3&&c.z<carrier.z&&c.z<(PITCH.far-20)/2)s-=8;
 if(role==='def'&&c.z<carrier.z+1.5&&!o.fullback)s-=4;
 if(role==='fwd'){const off=c.z-o.line;if(off>=.3&&off<3)s+=.7;}
 for(const m of o.mates){const d=distance(c,m);if(d<4.5)s-=(4.5-d)*.8;}
 return s;
}
export function supportSpot(t,carrier,defenders,o={}){
 const role=roleOf(t.tacticalId??5);if(role==='gk'||!carrier)return null;
 const anchor=o.anchor||t.home||t,line=o.line??-99,mates=o.mates||[],tactic=o.tactic||'';
 const reach=(role==='def'?5:role==='mid'?8:10)*(tactic==='possession'?.85:1)*(tactic==='contre'&&role==='fwd'?1.15:1),W=PITCH.W-1.8;
 const id=((t.tacticalId|0)%11+11)%11,ctx={role,anchor,line,mates,fullback:(id===1||id===4)&&carrier.z<(PITCH.far-20)/2&&Math.abs(carrier.x)>8},cands=[];
 for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++)cands.push({x:anchor.x+ix*reach/2,z:anchor.z+iz*reach/2*(iz>0?.8:1)});
 // Overlap: a wide player of the carrier's side runs past him on the outside.
 if(Math.abs(carrier.x)>8&&Math.sign(carrier.x)===Math.sign(anchor.x||carrier.x)&&distance(t,carrier)<26)cands.push({x:carrier.x+Math.sign(carrier.x)*5,z:carrier.z-(role==='def'?0:3.5),overlap:true});
 // Show for the ball between the lines: just behind the offside line, in the gap.
 if(role==='fwd')for(const dx of [-8,-4,0,4,8])cands.push({x:carrier.x+dx,z:line+1});
 let best=null,bs=-Infinity;
 for(const c of cands){c.x=clamp(c.x,-W,W);c.z=clamp(c.z,-18,PITCH.far-2);if(distance(c,anchor)>(c.overlap?14:reach*1.45))continue;const s=supportScore(c,carrier,defenders,ctx)+(c.overlap?4.5:0);if(s>bs){bs=s;best=c;}}
 if(!best)return null;
 if(o.previous&&supportScore(o.previous,carrier,defenders,ctx)>=bs-.6)return {x:o.previous.x,z:o.previous.z};
 return {x:best.x,z:best.z};
}
