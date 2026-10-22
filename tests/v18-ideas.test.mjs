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
  run('updateCoach()');assert.match(run("$('coachLine').textContent"),/CONSIGNE · Passes réussies 0 \/ 3/);assert.match(run("$('coachPlayback').textContent"),/Combine/);assert.equal(run("$('coachLine').hidden"),false);
  run(`match.passes=${done?3:1};updateCoach();`);if(done)assert.match(run("$('coachPlayback').textContent"),/3 \/ 3 ✓/);
  const xp=run('career.xp'),earned=run('performance(match).earned'),change=run('coachVerdict(match.instruction,match,performance(match).rating).trust');run('finish()');
  assert.equal(run('career.xp')-xp,earned+(done?35:0));assert.equal(run('career.trust'),50+change);assert.ok(done?change>0:change<0);assert.match(run("$('resultCoach').textContent"),done?/Respectée/:/Pas respectée/);}
 const {run}=boot();run("$('play').onclick();windUp(action.hero,{x:4.4,z:-11.5},'low','hero');tick(1/2);beginRun({x:-2,z:-12});beginRun({x:-1,z:-13});");assert.equal(run('match.runs'),1,'adjusting the same run counts once');
 run("$('practice').onclick();");assert.equal(run('match.instruction'),null,'no instruction in training');});

test('23 · team tactics change the simulated match, not just a label',async()=>{
 const stats=tactic=>{let own=0,all=0,high=0,passes=0,h=0,n=0,against=0;for(let seed=1;seed<=40;seed++){const s=createTactical(seed*389+3,{levels:[60,60],energy:90,allowChances:false,tactic});for(let i=0;i<20000;i++){const e=stepTactical(s,1/60);if(s.owner.team===1&&i%10===0)for(const p of s.players)if(p.team===0&&p.i>0){h+=p.y;n++;}if(e?.type==='finish')break;}own+=s.possession[0];all+=s.possession[0]+s.possession[1];high+=s.wonHigh[0];passes+=s.passes[0];against+=s.score[1];}return {share:own/all,high,passes,height:h/n,against};};
 const eq=stats('equilibre'),press=stats('pressing'),counter=stats('contre'),keep=stats('possession');
 assert.ok(press.high>eq.high*1.5,`pressing wins the ball high: ${press.high} vs ${eq.high}`);assert.ok(press.height>eq.height+.05&&counter.height<eq.height-.03,'block height follows the tactic');
 assert.ok(keep.share>eq.share+.08&&keep.passes>eq.passes*1.2,'possession keeps the ball');assert.ok(keep.against<eq.against,'and concedes less');
 assert.ok(counter.against<eq.against,'a deep block concedes less than the balanced side');
 const {TACTICS,setTactic}=await import('../dist/tactical.js');const s=createTactical(5,{tactic:'pressing'});assert.equal(s.tactics[0],'pressing');setTactic(s,'nope');assert.equal(s.tactics[0],'equilibre');assert.equal(Object.keys(TACTICS).length,4);
 const {run}=boot();run("career.tactic='contre';$('play').onclick();");assert.equal(run('match.tactical.tactics[0]'),'contre');run("$('tacticBtn').onclick()");assert.equal(run('match.tactical.tactics[0]'),'possession','changed live during the match');assert.equal(run('career.tactic'),'possession');assert.match(run("$('tacticBtn').textContent"),/Possession/);});

test('24 · a substitute comes on during the match and his chances only start then',async()=>{
 const {squadRole}=await import('../dist/career.js');assert.equal(squadRole({trust:50,energy:90,games:3}).starter,true);
 const low=squadRole({trust:30,energy:90,games:3}),tired=squadRole({trust:60,energy:30,games:4});assert.equal(low.starter,false);assert.equal(tired.starter,false);assert.ok(low.entry>=58&&low.entry<=72);assert.match(low.reason,/confiance/);assert.match(tired.reason,/fraîcheur/);
 let after=0;for(let seed=1;seed<=30;seed++){const s=createTactical(seed*71+9,{levels:[60,60],energy:90,entryMinute:62});assert.equal(s.players[9].name,'Lambert');let subs=0;for(let i=0;i<20000;i++){const e=stepTactical(s,1/60);if(e?.type==='sub'){subs++;assert.ok(e.minute>=62);assert.equal(s.players[9].name,'Espoir');}if(e?.type==='chance'){assert.ok(s.minute>=62,'no chance before coming on');after++;resumeTactical(s,[],'miss',s.ball,11);}if(e?.type==='finish')break;}assert.equal(subs,1);}
 assert.ok(after>=30,'about one chance or more after coming on: '+after);
 const {run}=boot({name:'Remplaçant',games:3,goals:0,assists:0,xp:0,trust:20});assert.match(run("$('roleNote').textContent"),/Remplaçant/);
 run("$('play').onclick();beginInterval=originalInterval;beginInterval();");assert.equal(run('match.role.starter'),false);const energy=run('match.energy');
 for(let i=0;i<60000&&run("action.phase==='interval'&&!match.entered");i++)run('tick(1/60)');assert.ok(run('match.entered')>=58);assert.ok(energy-run('match.energy')<.01,'no energy spent on the bench');assert.equal(run("$('announceTitle').textContent"),'ENTRÉE EN JEU');assert.equal(run("$('announce').hidden"),false);});

test('25 · both sides make three changes, and the coach can take the player off',async()=>{
 const {heroOff}=await import('../dist/tactical.js');
 for(let seed=1;seed<=12;seed++){const s=createTactical(seed*53+1,{levels:[60,60],energy:90,allowChances:false});const changes=[];for(let i=0;i<20000;i++){const e=stepTactical(s,1/60);if(e?.type==='change')changes.push(e);if(e?.type==='finish')break;}
  for(const team of [0,1])assert.equal(changes.filter(c=>c.team===team).length,3,'three changes for each side');assert.ok(changes.every(c=>c.minute>=58&&c.minute<=85));
  assert.equal(s.players[9].since,undefined,'the career player is never changed by the simulation');assert.equal(s.players[0].since,undefined);assert.ok(s.players.filter(p=>p.since!=null).every(p=>['Caron','Mercier','Perrin','Fontaine','Girard','Bonnet'].includes(p.name)));}
 const s=createTactical(9,{levels:[60,60],energy:90});for(let i=0;i<4000;i++){const e=stepTactical(s,1/60);if(e?.type==='chance')resumeTactical(s,[],'miss',s.ball,11);}heroOff(s);assert.equal(s.players[9].name,'Lambert');for(let i=0;i<20000;i++){const e=stepTactical(s,1/60);assert.notEqual(e?.type,'chance','no chance once taken off');if(e?.type==='finish')break;}
 const {run}=boot();run("$('play').onclick();beginInterval=originalInterval;beginInterval();match.tactical.allowChances=false;match.tactical.wantChances=false;");
 for(let i=0;i<60000&&run('match&&match.tactical.minute<61');i++)run('tick(1/60)');run('match.energy=25;');for(let i=0;i<600&&run('!match.left');i++)run('tick(1/60)');
 assert.ok(run('match.left')>=60);assert.equal(run("$('announceTitle').textContent"),'SORTIE');assert.match(run("$('announceText').textContent"),/À bout de forces/);const energy=run('match.energy');
 for(let i=0;i<80000&&run('!!match');i++)run('tick(1/60)');assert.equal(run('!!match'),false);assert.match(run("$('resultDetail').textContent"),/Sorti à la \d+′/);assert.ok(Math.abs(run('career.energy')-energy)<.01,'no energy spent after going off');});

test('26 · special scenarios: derby, comeback, last matchday, rain and red cards',async()=>{
 const {matchScenario,scenarioBonus}=await import('../dist/career.js');
 assert.deepEqual([0,1,2,4,5,6,8,10,11].map(matchScenario),[null,null,'remontada','derby','finale',null,'remontada','derby','finale']);const rain=Array.from({length:30},(_,g)=>matchScenario(g)).filter(x=>x==='pluie').length;assert.ok(rain>=3&&rain<=8,'rain now and then: '+rain);
 assert.equal(scenarioBonus('remontada',{us:2,them:1},100).xp,60);assert.equal(scenarioBonus('remontada',{us:1,them:1},100).xp,0);assert.equal(scenarioBonus('derby',{us:0,them:0},100).xp,20);
 // Comeback: the match starts at the 55th minute, 0–1, and the score stays consistent with the goal list.
 const {run}=boot({name:'Comeback',games:2,goals:0,assists:0,xp:0});assert.match(run("$('scenarioNote').textContent"),/REMONTADA/);run("$('play').onclick();beginInterval=originalInterval;beginInterval();");
 assert.ok(run('match.tactical.minute')>=55);assert.equal(run('match.them'),1);assert.equal(run("$('announceTitle').textContent"),'REMONTADA');
 for(let i=0;i<200000&&run('!!match');i++){if(run('action.ready&&!action.ended'))run("windUp(action.hero,{x:0,z:-21},'normal','hero',0,.6)");if(run('action.ended&&action.after>1')){run("$('continue').onclick()");continue;}run('tick(1/60)');}
 const [us,them]=run('career.last').match(/(\d+) – (\d+)/).slice(1).map(Number),ev=run("$('resultEvents').textContent");assert.ok(them>=1);assert.equal((ev.match(/Adversaire/g)||[]).length,them,ev);assert.equal((ev.match(/AC Rivage/g)||[]).length,us,ev);assert.match(run("$('resultScenario').textContent"),/Remontada/);
 // Red card: the player leaves the pitch, is never served again and is not drawn.
 let reds=0;for(let seed=1;seed<=60;seed++){const s=createTactical(seed*131+7,{levels:[60,60],energy:90,allowChances:false,redCards:true});for(let i=0;i<20000;i++){const e=stepTactical(s,1/60);if(e?.type==='red'){reds++;const p=s.players.find(q=>q.out);assert.ok(p&&p.i>=1&&p.i<=7&&!(p.team===0&&p.i===9));}if(s.pass)assert.ok(!s.pass.to.out);assert.ok(!s.owner.out);if(e?.type==='finish')break;}}
 assert.ok(reds>=2&&reds<=12,'red cards stay rare: '+reds+' in 60 matches');
 const rainy=boot({name:'Pluie',games:3,goals:0,assists:0,xp:0});rainy.run("$('play').onclick();");assert.equal(rainy.run('match.scenario'),'pluie');assert.equal(rainy.run('match.tactical.rain'),true);
 const derby=boot({name:'Derby',games:4,goals:0,assists:0,xp:0});derby.run("$('play').onclick();");assert.equal(derby.run('match.levels[1]'),derby.run('teamLevels(4)[1]')+3);});

test('27 · commentary lines are short and follow the context',async()=>{
 const {commentLine,commentKey,COMMENT_POOLS}=await import('../dist/commentary.js');
 for(const [key,pool] of Object.entries(COMMENT_POOLS))for(const line of pool){const out=line.replace(/\{(\w+)\}/g,(_,k)=>k==='name'?'Antoine-Jo':k==='team'?'L’adversaire':k==='in'||k==='out'?'Chevalier':'2');assert.ok(out.length<=50,`${key}: "${out}" is ${out.length} characters`);}
 assert.equal(commentKey('goal_us',{us:1,them:1}),'goal_us_equal');assert.equal(commentKey('goal_us',{us:2,them:1}),'goal_us_lead');assert.equal(commentKey('goal_them',{us:0,them:2}),'goal_them_more');
 assert.match(commentLine('hero_goal',{name:'Antoine',goals:2,us:2,them:0}),/Doublé pour Antoine/);assert.match(commentLine('hero_goal',{name:'Antoine',goals:1,us:2,them:1,minute:88}),/au bout du temps/);
 assert.match(commentLine('late',{us:0,them:1},()=>0),/égaliser/);assert.match(commentLine('kickoff',{scenario:'derby'},()=>0),/Derby/);assert.equal(commentLine('nothing'),'');
 const {run}=boot({name:'Antoine',games:1,goals:0,assists:0,xp:0});run("$('play').onclick();");assert.equal(run("$('commentary').hidden"),false);
 let g;for(let x=-3.2;x<=3.2&&!g;x+=.4){const b=boot({name:'Antoine',games:1,goals:0,assists:0,xp:0});b.run(`$('play').onclick();match.index=1;setup();windUp(action.hero,{x:${x},z:-21},'normal','hero');`);for(let i=0;i<650&&!b.run('action.ended');i++)b.run('tick(1/120)');if(b.run("action.outcomeKind==='goal'"))g=b;}
 assert.ok(g);assert.match(g.run("$('commentary').textContent"),/Antoine/,'the goal is announced with the player name');});

test('28 · the crowd builds up with the match and reacts to goals and near misses',async()=>{
 const {crowdLevel,Ambience}=await import('../dist/audio.js');
 const calm=crowdLevel({minute:10,us:0,them:0});assert.ok(crowdLevel({minute:10,danger:1})>calm+.2,'danger near a box');assert.ok(crowdLevel({minute:86,us:1,them:1})>crowdLevel({minute:20,us:1,them:1}),'late in a tight match');
 assert.ok(crowdLevel({minute:86,us:4,them:0})<crowdLevel({minute:86,us:1,them:1}),'a settled match is quieter');assert.ok(crowdLevel({minute:30,scenario:'derby'})>crowdLevel({minute:30}));
 for(let i=0;i<200;i++){const v=crowdLevel({minute:Math.random()*90,danger:Math.random()*2,chance:Math.random()<.5,us:3,them:3,scenario:'derby'});assert.ok(v>=0&&v<=.95);}
 // A minimal Web Audio stand-in records the scheduled gain targets.
 const param=()=>({value:0,targets:[],setTargetAtTime(v,t){this.targets.push(v);},cancelScheduledValues(){}}),node=()=>({gain:param(),frequency:param(),Q:param(),connect(){},start(){},stop(){}});
 globalThis.AudioContext=class{constructor(){this.currentTime=0;this.sampleRate=8000;this.destination={};}createBuffer(c,l){return {getChannelData:()=>new Float32Array(l)};}createBufferSource(){return node();}createBiquadFilter(){return node();}createGain(){return node();}createOscillator(){return node();}resume(){}};
 try{const a=new Ambience();assert.equal(a.start(),true);a.setLevel(.8);const g=a.master.gain.targets;assert.ok(Math.abs(g.at(-1)-.45)<1e-9);a.goal();const roar=g.at(-2);assert.ok(roar>.9,'goal roar');a.setLevel(.1);assert.ok(Math.abs(g.at(-2)-roar)<1e-9,'the roar is not cut by the crowd bed');
  a.setEnabled(false);assert.equal(g.at(-1),0,'muted');const n=g.length;a.goal();assert.equal(g.length,n,'no sound when muted');}finally{delete globalThis.AudioContext;}
 const {run}=boot();assert.equal(run("$('soundToggle').textContent"),'🔊');run("$('soundToggle').onclick()");assert.equal(run('career.sound'),false);assert.equal(run("$('soundToggle').textContent"),'🔇');assert.equal(run('ambience.enabled'),false);run("$('play').onclick();");assert.equal(run('!!match'),true,'a match starts without Web Audio');});

test('29 · celebrations follow the context of the goal',async()=>{
 const {celebrationFor}=await import('../dist/career.js');
 assert.equal(celebrationFor({goals:1,careerGoals:0,us:1,them:0}).type,'jump');assert.equal(celebrationFor({goals:2,careerGoals:5,us:2,them:0}).type,'point');assert.equal(celebrationFor({goals:3,us:3,them:0}).type,'hat');
 assert.equal(celebrationFor({goals:1,careerGoals:4,us:2,them:1,minute:86}).type,'slide');assert.equal(celebrationFor({goals:1,careerGoals:4,us:1,them:1,minute:40}).type,'ball');assert.equal(celebrationFor({goals:1,careerGoals:4,us:1,them:2}).type,'ball');
 assert.equal(celebrationFor({goals:1,careerGoals:4,us:1,them:0,scenario:'derby'}).type,'crowd');assert.equal(celebrationFor({teammate:true,us:1,them:0}).type,'hug');assert.equal(celebrationFor({goals:1,careerGoals:4,us:1,them:0}).type,'plane');
 const scored=(prep)=>{for(let x=-3.2;x<=3.2;x+=.4){const g=boot({name:'Antoine',games:1,goals:4,assists:0,xp:0});g.run(`$('play').onclick();match.index=1;setup();${prep}windUp(action.hero,{x:${x},z:-21},'normal','hero');`);for(let i=0;i<650&&!g.run('action.ended');i++)g.run('tick(1/120)');if(g.run("action.outcomeKind==='goal'"))return g;}};
 const late=scored("match.minute=86;match.us=1;match.them=1;");assert.ok(late);assert.equal(late.run('action.celebration.type'),'slide');assert.match(late.run("$('announceText').textContent"),/GLISSADE/);
 const start=late.run('Math.hypot(action.hero.x-action.celebration.target.x,action.hero.z-action.celebration.target.z)'),mates=late.run('action.teammates.map(t=>Math.hypot(t.x-action.hero.x,t.z-action.hero.z)).filter(d=>d<20).reduce((s,d)=>s+d,0)');
 for(let i=0;i<300;i++)late.run('tick(1/120)');assert.ok(late.run('Math.hypot(action.hero.x-action.celebration.target.x,action.hero.z-action.celebration.target.z)')<start-3,'the scorer runs to the corner flag');
 for(let i=0;i<300;i++)late.run('tick(1/120)');assert.equal(late.run('action.hero.celebrate'),'slide','and slides on his knees');
 const level=scored("match.minute=50;match.us=0;match.them=1;");assert.equal(level.run('action.celebration.type'),'ball');assert.equal(level.run('action.hero.celebrate'),false,'no celebration after an equaliser');});
