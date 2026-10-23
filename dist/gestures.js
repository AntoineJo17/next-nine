import {clamp} from './physics.js?v=20-7';
export const LOB_HOLD_MS=480;
export function targetGesture(elapsed,teammate=false){return elapsed>=LOB_HOLD_MS?'lob':teammate?'pass':'dribble';}

export function lateralSkill(points,elapsed){if(points.length<2||elapsed>650)return null;const a=points[0],b=points[points.length-1],dx=b.x-a.x,dy=b.y-a.y;return Math.abs(dx)>=38&&Math.abs(dx)>Math.abs(dy)*1.8?{kind:'rake',side:Math.sign(dx)}:null;}

// Goal-centred slingshot: aim stays editable; horizontal movement never adds spin.
export function assistedShot(start,current){const dx=current.x-start.x,dy=current.y-start.y;return {target:{x:clamp(-dx/Math.max(45,dy)*5.5,-5.2,5.2),z:-21},power:clamp(.28+Math.max(0,dy)/140*.72,.28,1),active:dy>=18};}
