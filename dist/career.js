import {clamp} from './physics.js?v=20-9s';
export const LEVEL_XP=700;
// 21 · Playing position: it decides where the player's chances come from.
export const POSITIONS={BU:{label:'Avant-centre',short:'BU'},AIL:{label:'Ailier droit',short:'AIL'},MOC:{label:'Meneur de jeu',short:'MOC'}};
export function progressionLevel(xp=0){return Math.min(39,Math.floor(xp/LEVEL_XP));}
export function attributes(xp=0){const level=progressionLevel(xp);return {finishing:60+level,passing:60+level,control:60+level,speed:4.4+level*.02,force:1+level*.004,curve:1+level*.005};}
export function performance(m){const rating=clamp(5+m.goals*1.1+m.assists*.8+m.passes*.16+Math.min(m.dribbles,8)*.10+m.chances*.22-m.losses*.35,3,10);return {rating,earned:Math.max(10,20+m.goals*30+m.assists*24+Math.min(m.passes,10)*4+Math.min(m.dribbles,8)*3+m.chances*5-m.losses*3)};}
export const FACE_KEYS=['lipFull','lipHeight','chin','eyes','lipRed','lipWidth','noseWidth','noseLength','noseOut','jaw','cheekBones','cheekFull','faceWidth','faceLength','forehead','eyeSize','neck','age'];
// The look chosen for the starting player: thin lips, slightly wide-open eyes, a light red on the lips; every other setting is neutral.
export const FACE_DEFAULT=Object.freeze({lipFull:-.6,lipHeight:-.5,chin:0,eyes:.35,lipRed:.15,...Object.fromEntries(FACE_KEYS.slice(5).map(k=>[k,0]))});
// Ready-made faces for the locker: each one replaces every slider, the player then fine-tunes from there.
export const FACE_PRESETS=Object.freeze([['Départ',{...FACE_DEFAULT}],
 ['Fin',{lipFull:-.5,lipHeight:-.4,jaw:-.3,noseWidth:-.4,noseLength:.1,cheekBones:.3,cheekFull:-.4,faceWidth:-.3,faceLength:.2,eyes:.35,lipRed:.15}],
 ['Athlète',{lipFull:-.4,lipHeight:-.3,chin:.3,jaw:.5,cheekBones:.5,cheekFull:-.3,faceWidth:.2,forehead:.1,neck:.4,age:.3,eyes:.2,lipRed:.1}],
 ['Rond',{lipFull:.1,chin:-.2,jaw:.1,eyeSize:.2,noseWidth:.2,cheekFull:.6,faceWidth:.4,faceLength:-.3,age:-.3,eyes:.4,lipRed:.2}],
 ['Jeune',{lipFull:.2,eyeSize:.3,noseLength:-.3,noseWidth:-.2,cheekFull:.3,chin:-.1,age:-.6,eyes:.4,lipRed:.25}],
 ['Dur',{lipFull:-.5,lipHeight:-.3,chin:.4,jaw:.6,noseLength:.2,noseOut:.3,cheekFull:-.5,forehead:.2,neck:.3,age:.6,eyes:-.1,lipRed:.05}]].map(([n,f])=>[n,Object.freeze({...Object.fromEntries(FACE_KEYS.map(k=>[k,0])),...f})]));
export function parseFace(f){const o={};for(const k of FACE_KEYS)o[k]=f&&Number.isFinite(f[k])?Math.round(clamp(f[k],-1,1)*20)/20:FACE_DEFAULT[k];return o;}
export function parseCareer(input){const s=typeof input==='string'?JSON.parse(input):input;if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>20||!['games','goals','assists','xp'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0&&s[k]<=10000000))throw Error('Sauvegarde invalide');return {energy:Number.isFinite(s.energy)?clamp(s.energy,0,100):100,baseXP:Number.isSafeInteger(s.baseXP)&&s.baseXP>=0&&s.baseXP<=s.xp?s.baseXP:s.xp,baseLevel:Number.isInteger(s.baseLevel)&&s.baseLevel>=0&&s.baseLevel<=39?s.baseLevel:Math.min(39,Math.floor(s.xp/100)),name:s.name,games:s.games,goals:s.goals,assists:s.assists,xp:s.xp,last:typeof s.last==='string'?s.last.slice(0,350):'',face:parseFace(s.face),skin:/^#[0-9a-f]{6}$/i.test(s.skin)?s.skin:'#c98b62',hair:/^#[0-9a-f]{6}$/i.test(s.hair)?s.hair:'#28231e',hairStyle:['court','degrade','boucles','afro','plaque','chignon','rase','crane'].includes(s.hairStyle)?s.hairStyle:'degrade',beard:['','barbe3j','barbe','bouc'].includes(s.beard)?s.beard:'',brow:/^#[0-9a-f]{6}$/i.test(s.brow)?s.brow:'',beardColor:/^#[0-9a-f]{6}$/i.test(s.beardColor)?s.beardColor:'',number:Number.isInteger(s.number)?clamp(s.number,1,99):9,position:typeof s.position==='string'&&Object.hasOwn(POSITIONS,s.position)?s.position:'BU',tactic:['equilibre','pressing','contre','possession'].includes(s.tactic)?s.tactic:'equilibre',sound:s.sound!==false,trust:Number.isFinite(s.trust)?clamp(Math.round(s.trust),0,100):50,weakFoot:Number.isFinite(s.weakFoot)?clamp(s.weakFoot,.3,.95):.45,chem:s.chem&&typeof s.chem==='object'?Object.fromEntries(Object.entries(s.chem).filter(([k,v])=>/^\d{1,2}$/.test(k)&&Number.isInteger(v)&&v>=0&&v<=60).slice(0,20)):{}};}
export function makeTimeline(random=Math.random){const events=[];for(const minute of [9,34,49,68,79,90]){const r=random();if(r<.16)events.push({minute,side:'us'});else if(r<.36)events.push({minute,side:'them'});}return events;}
export function advanceMatch(m,minute){const lines=[];for(const e of m.events){if(e.minute>m.minute&&e.minute<=minute){m[e.side]++;lines.push(`${e.minute}′ · But ${e.side==='us'?'d’AC Rivage':'adverse'}`);}}m.minute=minute;return lines;}
export const profiles=[{name:'Équilibrée',press:1,reach:1.7},{name:'Pressing haut',press:1.14,reach:1.9},{name:'Bloc prudent',press:.85,reach:1.5}];
export function matchScenarios(pool,games){return [0,1,2].map(i=>pool[(games*3+i)%pool.length]);}

export function fatigueFactor(energy){return .75+.25*clamp(energy,0,100)/100;}
export function spendEnergy(energy,cost){return clamp(energy-Math.max(0,cost),0,100);}

export const matchStartEnergy=energy=>Math.max(85,Number.isFinite(energy)?clamp(energy,0,100):100);
export const teamLevels=games=>[60+Math.min(8,Math.floor(games/12)),[58,64,61,55,67,60][games%6]];

// 22 · Coach instructions: one per match, chosen from the position's pool. Respecting it earns XP and the coach's trust.
export const INSTRUCTIONS={appels:{short:'Appels',text:'Fais des appels après tes passes.',goal:2,stat:m=>m.runs||0},combine:{short:'Passes réussies',text:'Combine : réussis tes passes.',goal:3,stat:m=>m.passes||0},tir:{short:'Frappes',text:'Tente ta chance : frappe au but.',goal:3,stat:m=>m.shots||0},dribble:{short:'Dribbles',text:'Provoque : élimine en dribble.',goal:3,stat:m=>m.dribbles||0},decisif:{short:'Buts et passes D.',text:'Sois décisif : marque ou fais marquer.',goal:1,stat:m=>(m.goals||0)+(m.assists||0)},securite:{short:'Pertes',text:'Pas de cadeau : une perte de balle au plus.',goal:1,stat:m=>m.losses||0,max:true}};
const COACH_POOL={BU:['tir','appels','decisif','securite'],AIL:['dribble','combine','decisif','tir'],MOC:['combine','securite','appels','decisif']};
export function coachInstruction(career){const pool=COACH_POOL[career.position]||COACH_POOL.BU;return pool[(career.games||0)%pool.length];}
export function instructionProgress(id,m){const r=INSTRUCTIONS[id];if(!r)return null;const value=r.stat(m);return {id,text:r.text,short:r.short,value,goal:r.goal,max:!!r.max,done:r.max?value<=r.goal:value>=r.goal,label:r.max?`${value} perte(s) · ${r.goal} au plus`:`${Math.min(value,r.goal)} / ${r.goal}`};}
// Trust moves with the instruction and the rating; it decides who starts (24) and who is taken off (25).
export function coachVerdict(id,m,rating){const p=instructionProgress(id,m);if(!p)return {bonus:0,trust:0,done:false};return {bonus:p.done?35:0,trust:(p.done?8:-5)+(rating>=7?3:rating<5.5?-3:0),done:p.done,text:p.text};}

// 24 · Squad role, decided before the pre-match recovery: low trust or tired legs start on the bench.
export function squadRole(career){const trust=Number.isFinite(career.trust)?career.trust:50,energy=Number.isFinite(career.energy)?career.energy:100;if(trust>=40&&energy>=45)return {starter:true,entry:0,reason:''};return {starter:false,entry:58+((career.games||0)*17)%15,reason:trust<40?'Le coach te laisse sur le banc : regagne sa confiance.':'Tu manques de fraîcheur : le coach te garde pour la fin du match.'};}

// 26 · Special scenarios, fixed by the fixture: derby, comeback from the 55th minute, last matchday, rain.
export const SCENARIOS={derby:{title:'DERBY',text:'Contre l’Étoile du Port, tout le stade pousse. XP ×1,2.'},remontada:{title:'REMONTADA',text:'Mené 0–1 à la 55e : renverse le match. +60 XP en cas de victoire.'},finale:{title:'DERNIÈRE JOURNÉE',text:'La victoire ou rien : +50 XP si Rivage gagne.'},pluie:{title:'SOUS LA PLUIE',text:'Terrain glissant : contrôles et passes plus difficiles.'}};
export function matchScenario(games=0){const d=games%6;if(games>0&&d===2)return 'remontada';if(d===4)return 'derby';if(d===5)return 'finale';if(games>0&&(d===1||d===3)&&(games*7)%5<2)return 'pluie';return null;}
export function scenarioBonus(id,m,earned){if(id==='derby')return {xp:Math.round(earned*.2),text:'Derby : +'+Math.round(earned*.2)+' XP'};if(id==='remontada')return m.us>m.them?{xp:60,text:'Remontada réussie : +60 XP'}:{xp:0,text:'Remontada manquée'};if(id==='finale')return m.us>m.them?{xp:50,text:'Dernière journée gagnée : +50 XP'}:{xp:0,text:'Dernière journée sans victoire'};return {xp:0,text:''};}

// 29 · V19: 15 goal celebrations drawn at random: dances, acrobatic figures (the team comes after) and classics.
// Lot 2 · Modern celebrations (the labels stay internal: the game no longer names them on screen).
export const CELEBRATIONS=[{id:'siu',label:'SAUT PIVOTÉ',kind:'figure'},{id:'salto',label:'SALTO ARRIÈRE',kind:'figure'},{id:'vrille',label:'LA VRILLE',kind:'figure'},
 {id:'griddy',label:'DANSE',kind:'danse'},{id:'croises',label:'BRAS CROISÉS',kind:'classique'},{id:'meditation',label:'MÉDITATION',kind:'classique'},{id:'ouverts',label:'BRAS OUVERTS',kind:'classique'},
 {id:'tempe',label:'DOIGT SUR LA TEMPE',kind:'classique'},{id:'calma',label:'CALME',kind:'classique'},{id:'pouce',label:'POUCE',kind:'classique'},{id:'nom',label:'LE NOM DANS LE DOS',kind:'classique'},
 {id:'ecusson',label:'BAISER SUR L’ÉCUSSON',kind:'classique'},{id:'glissade',label:'GLISSADE À GENOUX',kind:'classique'},{id:'chut',label:'CHUT !',kind:'classique'},{id:'coeur',label:'LE CŒUR',kind:'classique'}];
export function pickCelebration(random=Math.random){return CELEBRATIONS[Math.floor(random()*CELEBRATIONS.length)%CELEBRATIONS.length];}
