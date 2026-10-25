(async()=>{
 const nn=window.__nn;const POLICY=window.__policy||'smart';const MAXS=window.__maxsec||30;const EPIS=window.__episodes||4;
 const out={episodes:[],summary:{policy:POLICY}};
 const dt=1/60;const r2=v=>+v.toFixed(2);
 for(let ep=0;ep<EPIS;ep++){
  let steps=0;
  while(nn.action&&nn.action.phase==='interval'&&steps<60*60*8){nn.tick(dt);steps++;}
  if(!nn.action||nn.action.phase==='interval'||nn.match.minute>=89.5){out.summary.stop={ph:nn.action&&nn.action.phase,min:nn.match&&nn.match.minute,ep};break;}
  const a=nn.action;
  const E={ep,kind:a.chanceKind||null,minute:+nn.match.minute.toFixed(1),frames:[],log:[]};
  const snap=()=>({t:r2(a.sim||0),ph:a.phase,ready:!!a.ready,ended:!!a.ended,pi:a.pressIndex,
   h:[r2(a.hero.x),r2(a.hero.z)],b:[r2(a.ball.x),r2(a.ball.z),r2(a.ball.y)],k:[r2(a.keeper.x),r2(a.keeper.z),a.keeper.state,r2(a.keeper.speed||0)],
   D:a.defenders.map(d=>[r2(d.x),r2(d.z),r2(d.speed||0),d.cover?1:0,d.mark?a.teammates.indexOf(d.mark):-1,d.challenge?1:0,d.mark&&d.mark.tacticalId%11===0?1:0]),pc:a.pressCarrier?[r2(a.pressCarrier.x),r2(a.pressCarrier.z)]:null,
   T:a.teammates.map(d=>[r2(d.x),r2(d.z),r2(d.speed||0)]),off:a.offsideLine!=null?r2(a.offsideLine):null});
  E.initial=snap();E.nD=a.defenders.length;E.nT=a.teammates.length;
  const playable=['open','wing','playmaker','cross','press'].includes(E.kind);
  let acts=0;
  if(!playable){nn.resolve(false,'skip',null,'miss');out.episodes.push(E);document.getElementById('continue').onclick();continue;}
  for(let i=0;i<60*MAXS&&!a.ended;i++){
   const ph=a.phase,h=a.hero;
   if(ph==='press'&&a.pressCarrier){a.runTarget={x:a.pressCarrier.x,z:a.pressCarrier.z};a.ready=false;a.started=true;}
   if(ph==='aerial'){nn.controlAgain('ok');}
   else if(ph==='ready'&&acts<60){
    acts++;
    const goalD=Math.hypot(h.x,h.z+20);
    if(POLICY==='smart'){
     if(goalD<16&&h.z<-6&&acts>1&&nn.laneClearance(h,{x:0,z:-20},a.defenders)>1.0){const tx=a.keeper.x>0?-2.5:2.5;nn.windUp(h,{x:tx,z:-20.4},'normal','hero');E.log.push(i+' shot');}
     else{ // meilleure direction : loin des défenseurs, vers le but
      let best=null,bs=-1e9;for(let ang=-100;ang<=100;ang+=20){const r=ang*Math.PI/180,gx=-h.x,gz=-20-h.z,gl=Math.hypot(gx,gz)||1,ba=Math.atan2(gx,gz),aa=ba+r,tx=h.x+Math.sin(aa)*5,tz=h.z+Math.cos(aa)*5;if(Math.abs(tx)>32||tz<-18.5)continue;
       const clear=Math.min(12,...a.defenders.map(d=>Math.hypot(d.x-tx,d.z-tz)));const sc=clear*1.2-Math.abs(ang)/40+(-tz)*0-(Math.hypot(tx,tz+20)*.5);if(sc>bs){bs=sc;best={x:tx,z:tz};}}
      nn.beginDribble(best||{x:h.x,z:h.z-4});}
    }
    else if(POLICY==='sideways'){nn.beginDribble({x:h.x>0?-30:30,z:h.z-1});}
    else if(POLICY==='back'){nn.beginDribble({x:h.x,z:h.z+9});}
   }
   nn.tick(dt);
   if(i%2===0)E.frames.push(snap());
  }
  E.outcome=a.outcomeKind||null;E.ended=!!a.ended;E.endedAt=r2(a.sim||0);E.acts=acts;
  if(!a.ended){nn.resolve(false,'timeout',null,'miss');}
  out.episodes.push(E);
  document.getElementById('continue').onclick();
 }
 return out;
})()
