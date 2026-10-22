import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createTactical,stepTactical,resumeTactical} from '../dist/tactical.js';import {parseCareer} from '../dist/career.js';
// Same game boot as the controller tests, written to its own helper file so parallel test files never race.
const src=fs.readFileSync(new URL('./career.test.mjs',import.meta.url),'utf8');
fs.writeFileSync(new URL('./_boot-v18.mjs',import.meta.url),src.slice(0,src.indexOf('function boot'))+'export '+src.slice(src.indexOf('function boot'),src.indexOf('\ntest(')));
const {boot}=await import('./_boot-v18.mjs');
const chancesOf=(options,seeds=30)=>{const out=[];for(let seed=1;seed<=seeds;seed++){const s=createTactical(seed*613+11,{levels:[60,60],energy:90,...options});for(let i=0;i<20000;i++){const o=s.owner,e=stepTactical(s,1/60);if(e?.type==='shot')assert.ok(!(o.team===0&&o.i===s.hero),'the career dot never shoots alone');if(e?.type==='chance'){out.push(e);resumeTactical(s,[],'miss',s.ball,11);}if(e?.type==='finish')break;}}return out;};

test('21 · chances follow the playing position: box for a striker, flank for a winger, last pass for a playmaker',()=>{
 const bu=chancesOf({position:'BU'}),ail=chancesOf({position:'AIL'}),moc=chancesOf({position:'MOC'});
 assert.ok(bu.every(e=>e.heroId===9)&&ail.every(e=>e.heroId===10)&&moc.every(e=>e.heroId===6),'the hero dot matches the position');
 assert.ok(!bu.some(e=>['wing','playmaker'].includes(e.kind)),'a striker keeps striker chances');
 const wing=ail.filter(e=>e.kind==='wing').length;assert.ok(wing>=ail.length*.35,`winger: ${wing} one-against-one chances out of ${ail.length}`);
 assert.ok(!moc.some(e=>e.kind==='cross'),'a playmaker is never the target of a cross');assert.ok(moc.filter(e=>e.kind==='playmaker').length>=moc.length*.5);
 for(const list of [bu,ail,moc])assert.ok(list.length>=30*2.5,'about three chances a match or more: '+list.length);
 assert.equal(createTactical(1,{position:'AIL'}).players[10].name,'Espoir');assert.equal(createTactical(1,{position:'AIL'}).players[9].name,'Blanc');});

test('21 · the position is saved, validated and drives the 3D set-up',()=>{
 assert.equal(parseCareer({name:'A',games:0,goals:0,assists:0,xp:0,position:'AIL'}).position,'AIL');assert.equal(parseCareer({name:'A',games:0,goals:0,assists:0,xp:0,position:'GK'}).position,'BU');
 for(const [position,kind] of [['AIL','wing'],['MOC','playmaker']]){const {run}=boot();run(`career.position='${position}';$('play').onclick();`);assert.equal(run('match.tactical.position'),position);
  run(`{const t=match.tactical,h=t.players[t.hero];h.x=${position==='AIL'?.86:.5};h.y=${position==='AIL'?.68:.58};t.chances=1;startTacticalChance({kind:'${kind}',heroId:h.id,passerId:null,ball:{x:h.x,y:h.y}});}`);
  assert.equal(run('action.chanceKind'),kind);assert.equal(run('action.hero.number'),run('career.number'),'the shirt number follows the player');
  const goal=run('Math.hypot(action.hero.x,action.hero.z+20)');
  if(kind==='wing'){assert.ok(run('Math.abs(action.hero.x)>=9'),'starts on the flank');assert.ok(run('action.defenders.some(d=>Math.hypot(d.x-action.hero.x,d.z-action.hero.z)<4.5&&d.z<action.hero.z)'),'a full-back stands goal-side');assert.ok(run('action.teammates.filter(t=>Math.abs(t.x)<4&&t.z<-11).length')>=2,'two forwards in the box');}
  else{assert.ok(goal>=19&&goal<=27,'shoots from distance: '+goal);assert.ok(run('action.teammates.filter(t=>t.z<action.hero.z-7).length')>=2,'forwards waiting on the last line');}
 }});

test('22 · the coach gives a position-based instruction, counts it live and rewards it at full time',async()=>{
 const {coachInstruction,instructionProgress,coachVerdict}=await import('../dist/career.js');
 assert.notEqual(coachInstruction({position:'BU',games:0}),coachInstruction({position:'BU',games:1}),'it changes from one match to the next');
 assert.equal(coachInstruction({position:'MOC',games:0}),'combine');assert.equal(instructionProgress('securite',{losses:2}).done,false);assert.equal(instructionProgress('combine',{passes:3}).done,true);
 assert.deepEqual([coachVerdict('combine',{passes:3},7.2).trust,coachVerdict('combine',{passes:1},5).trust],[11,-8]);
 for(const done of [true,false]){const {run}=boot();run("career.position='MOC';$('play').onclick();");assert.equal(run('match.instruction'),'combine');
  run('updateCoach()');assert.match(run("$('coachLine').textContent"),/CONSIGNE · Combine.* 0 \/ 3/);assert.equal(run("$('coachLine').hidden"),false);
  run(`match.passes=${done?3:1};updateCoach();`);if(done)assert.match(run("$('coachPlayback').textContent"),/3 \/ 3 ✓/);
  const xp=run('career.xp'),earned=run('performance(match).earned'),change=run('coachVerdict(match.instruction,match,performance(match).rating).trust');run('finish()');
  assert.equal(run('career.xp')-xp,earned+(done?35:0));assert.equal(run('career.trust'),50+change);assert.ok(done?change>0:change<0);assert.match(run("$('resultCoach').textContent"),done?/Respectée/:/Pas respectée/);}
 const {run}=boot();run("$('play').onclick();windUp(action.hero,{x:4.4,z:-11.5},'low','hero');tick(1/2);beginRun({x:-2,z:-12});beginRun({x:-1,z:-13});");assert.equal(run('match.runs'),1,'adjusting the same run counts once');
 run("$('practice').onclick();");assert.equal(run('match.instruction'),null,'no instruction in training');});
