import {clamp} from './physics.js?v=19-2';
export const LOB_HOLD_MS=480;
// Signed bend relative to the straight pull. A straight drag has no spin.
export function gestureSpin(points){
 if(points.length<3)return 0;const first=points[0],last=points[points.length-1],dx=last.x-first.x,dy=last.y-first.y,length=Math.hypot(dx,dy);if(length<26)return 0;
 let bend=0;for(const p of points){const side=-(dx*(p.y-first.y)-dy*(p.x-first.x))/length;if(Math.abs(side)>Math.abs(bend))bend=side;}
 return Math.abs(bend)<8?0:clamp(Math.sign(bend)*(Math.abs(bend)-8)/45,-1,1);
}
export function targetGesture(elapsed,teammate=false){return elapsed>=LOB_HOLD_MS?'lob':teammate?'pass':'dribble';}

// Lock the shot heading at the start of the pull. The final lateral hook adds spin.
export function hookedShot(points){
 const start=points[0],end=points[points.length-1];if(!start||!end)return null;
 const lock=points.find(p=>Math.hypot(p.x-start.x,p.y-start.y)>=32)||end;
 const dx=lock.x-start.x,dy=lock.y-start.y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
 const ex=end.x-start.x,ey=end.y-start.y,power=Math.max(0,ex*ux+ey*uy),side=ex*uy-ey*ux;
 const spin=Math.abs(side)<7?0:clamp(Math.sign(side)*(Math.abs(side)-7)/45,-1,1);
 return {pull:{x:start.x+ux*power,y:start.y+uy*power},spin,power,locked:length>=32};
}
export function lateralSkill(points,elapsed){if(points.length<2||elapsed>650)return null;const a=points[0],b=points[points.length-1],dx=b.x-a.x,dy=b.y-a.y;return Math.abs(dx)>=38&&Math.abs(dx)>Math.abs(dy)*1.8?{kind:'rake',side:Math.sign(dx)}:null;}

// Goal-centred slingshot: aim stays editable; horizontal movement never adds spin.
export function assistedShot(start,current){const dx=current.x-start.x,dy=current.y-start.y;return {target:{x:clamp(-dx/Math.max(45,dy)*5.5,-5.2,5.2),z:-21},power:clamp(.28+Math.max(0,dy)/140*.72,.28,1),active:dy>=18};}

export const EFFECT_HOLD_MS=380;
export function heldShot(drag,current,now){
 const shot=assistedShot(drag.start,current);
 if(drag.effectLock){return {...drag.effectLock,spin:clamp((current.x-drag.effectLock.point.x)/65,-.8,.8),locked:true};}
 if(!drag.stablePoint||Math.hypot(current.x-drag.stablePoint.x,current.y-drag.stablePoint.y)>5){drag.stablePoint={...current};drag.stableSince=now;}
 if(shot.active&&now-drag.stableSince>=EFFECT_HOLD_MS){drag.effectLock={target:{...shot.target},power:shot.power,point:{...current}};return {...drag.effectLock,spin:0,locked:true,newLock:true};}
 return {...shot,spin:0,locked:false};
}
