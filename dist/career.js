import {clamp} from './physics.js';
export const LEVEL_XP=700;
export function progressionLevel(xp=0){return Math.min(39,Math.floor(xp/LEVEL_XP));}
export function attributes(xp=0){const level=progressionLevel(xp);return {finishing:60+level,passing:60+level,control:60+level,speed:3.7+level*.018,force:1+level*.004,curve:1+level*.005};}
export function performance(m){const rating=clamp(5+m.goals*1.1+m.assists*.8+m.passes*.16+Math.min(m.dribbles,8)*.10+m.chances*.22-m.losses*.35,3,10);return {rating,earned:Math.max(10,20+m.goals*30+m.assists*24+Math.min(m.passes,10)*4+Math.min(m.dribbles,8)*3+m.chances*5-m.losses*3)};}
export function parseCareer(input){const s=typeof input==='string'?JSON.parse(input):input;if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>20||!['games','goals','assists','xp'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0&&s[k]<=10000000))throw Error('Sauvegarde invalide');return {energy:Number.isFinite(s.energy)?clamp(s.energy,0,100):100,baseXP:Number.isSafeInteger(s.baseXP)&&s.baseXP>=0&&s.baseXP<=s.xp?s.baseXP:s.xp,baseLevel:Number.isInteger(s.baseLevel)&&s.baseLevel>=0&&s.baseLevel<=39?s.baseLevel:Math.min(39,Math.floor(s.xp/100)),name:s.name,games:s.games,goals:s.goals,assists:s.assists,xp:s.xp,last:typeof s.last==='string'?s.last.slice(0,350):'',skin:/^#[0-9a-f]{6}$/i.test(s.skin)?s.skin:'#c98b62',hair:/^#[0-9a-f]{6}$/i.test(s.hair)?s.hair:'#28231e',number:Number.isInteger(s.number)?clamp(s.number,1,99):9,weakFoot:Number.isFinite(s.weakFoot)?clamp(s.weakFoot,.3,.95):.45,chem:s.chem&&typeof s.chem==='object'?Object.fromEntries(Object.entries(s.chem).filter(([k,v])=>/^\d{1,2}$/.test(k)&&Number.isInteger(v)&&v>=0&&v<=60).slice(0,20)):{}};}
export function makeTimeline(random=Math.random){const events=[];for(const minute of [9,34,49,68,79,90]){const r=random();if(r<.16)events.push({minute,side:'us'});else if(r<.36)events.push({minute,side:'them'});}return events;}
export function advanceMatch(m,minute){const lines=[];for(const e of m.events){if(e.minute>m.minute&&e.minute<=minute){m[e.side]++;lines.push(`${e.minute}′ · But ${e.side==='us'?'d’AC Rivage':'adverse'}`);}}m.minute=minute;return lines;}
export const profiles=[{name:'Équilibrée',press:1,reach:1.7},{name:'Pressing haut',press:1.14,reach:1.9},{name:'Bloc prudent',press:.85,reach:1.5}];
export function matchScenarios(pool,games){return [0,1,2].map(i=>pool[(games*3+i)%pool.length]);}

export function fatigueFactor(energy){return .75+.25*clamp(energy,0,100)/100;}
export function spendEnergy(energy,cost){return clamp(energy-Math.max(0,cost),0,100);}

export const matchStartEnergy=energy=>Math.max(85,Number.isFinite(energy)?clamp(energy,0,100):100);
export const teamLevels=games=>[60+Math.min(8,Math.floor(games/12)),[58,64,61,55,67,60][games%6]];
