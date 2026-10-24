import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot,KEY,progression as P} from './harness.mjs';
const LINES=[{goals:1,passes:3},{assists:1,passes:5,dribbles:2},{losses:6},{},{goals:2,assists:1,passes:10,dribbles:9,chances:3},{passes:2,losses:1},{goals:1,us:2,them:0},{assists:2,us:1,them:2,chances:2},{goals:3,us:3,them:0,passes:4},{losses:2},{goals:1,assists:1},{}];
const ENERGIES=[92,70,48,100,35,0,88,61,40,95,20,77];

function attendu(before,stats,sc){const m={goals:0,assists:0,passes:0,dribbles:0,chances:0,losses:0,us:0,them:0,runs:0,shots:0,...stats};
 const perf=P.performance(m),inst=P.coachInstruction(before),verdict=P.coachVerdict(inst,m,perf.rating),special=P.scenarioBonus(sc,m,perf.earned);
 return {earned:perf.earned+verdict.bonus+special.xp,trustDelta:verdict.trust};}

test('parcours de 12 journées (2 saisons) : bornes, monotonie et XP conformes à la formule du code à chaque match',()=>{
 const g=boot();let prev=g.career();
 LINES.forEach((stats,i)=>{
  const sc=P.matchScenario(prev.games),exp=attendu(prev,stats,sc);
  g.playMatch(stats,ENERGIES[i]);const now=g.career();
  assert.equal(now.games,prev.games+1,'un match de plus');
  assert.equal(now.goals,prev.goals+(stats.goals||0));assert.equal(now.assists,prev.assists+(stats.assists||0));
  assert.equal(now.xp,prev.xp+exp.earned,`XP du match ${i+1}`);assert.ok(exp.earned>=10,'au moins 10 XP par match');
  assert.equal(now.trust,Math.max(0,Math.min(100,prev.trust+exp.trustDelta)),'confiance');
  assert.equal(now.energy,ENERGIES[i],'énergie rendue par le match');
  for(const k of ['games','goals','assists','xp'])assert.ok(now[k]>=prev[k],'monotone '+k);
  assert.ok(now.energy>=0&&now.energy<=100);assert.ok(now.trust>=0&&now.trust<=100);assert.ok(Number.isInteger(now.trust));
  const rating=P.performance({goals:0,assists:0,passes:0,dribbles:0,chances:0,losses:0,...stats}).rating;assert.ok(rating>=3&&rating<=10,'note bornée');
  assert.ok(now.last.includes(`Note ${rating.toFixed(1).replace('.',',')}`),'note affichée dans le résumé');
  assert.ok(now.goals<=now.goals+now.assists);
  assert.deepEqual(JSON.parse(g.store[KEY]),now,'chaque match est enregistré');
  assert.equal(P.parseCareer(now).xp,now.xp,'l’état reste importable');
  prev=now;});
 assert.equal(prev.games,12);assert.equal(g.run('1+Math.floor(career.games/6)'),3,'saison 3 après 12 matchs');});

test('niveau et XP : developmentXP = baseLevel×700 + (xp − baseXP), niveau = min(39, ⌊dev/700⌋), l’indicateur affiche dev mod 700',()=>{
 const g=boot();
 for(let i=0;i<10;i++){g.playMatch({goals:i%3,assists:i%2,passes:i,dribbles:i%5});const c=g.career();
  const dev=c.baseLevel*P.LEVEL_XP+Math.max(0,c.xp-c.baseXP);assert.equal(g.run('developmentXP()'),dev);
  assert.equal(P.progressionLevel(dev),Math.min(39,Math.floor(dev/700)));assert.equal(g.run('60+progressionLevel(developmentXP())'),60+Math.min(39,Math.floor(dev/700)));
  g.run('refresh()');assert.equal(g.els.get('xpLabel').textContent,`${dev%700} / 700 XP`);assert.equal(g.els.get('day').textContent,`JOURNÉE ${c.games%6+1} / 6`);
  assert.ok(dev%700<700&&dev>=0);}});

test('passage de niveau : exactement 700 XP de développement donnent +1, et jamais au-delà de 39',()=>{
 assert.equal(P.progressionLevel(699),0);assert.equal(P.progressionLevel(700),1);assert.equal(P.progressionLevel(1e9),39);assert.equal(P.attributes(1e9).finishing,99);
 const g=boot({name:'A',games:5,goals:1,assists:1,xp:680,baseXP:0,baseLevel:0});g.playMatch({goals:1});assert.ok(g.run('progressionLevel(developmentXP())')>=1,'le niveau monte au passage des 700 XP');
 assert.match(g.els.get('reward').textContent,/Niveau général \+1/);});

test('ancienne carrière : le niveau général acquis n’est jamais perdu en jouant (niveau de développement non décroissant)',()=>{
 const g=boot({name:'Vieux',games:30,goals:20,assists:10,xp:1234});const lvl0=g.run('progressionLevel(developmentXP())');assert.equal(lvl0,12);
 let last=lvl0;for(let i=0;i<8;i++){g.playMatch({losses:9});const l=g.run('progressionLevel(developmentXP())');assert.ok(l>=last);last=l;}});

test('les attributs croissent de façon monotone avec l’XP et restent bornés',()=>{let p=P.attributes(0);for(let xp=0;xp<=30000;xp+=350){const a=P.attributes(xp);for(const k of Object.keys(a))assert.ok(a[k]>=p[k]);assert.ok(a.finishing<=99);p=a;}});

test('énergie : récupération entre journées jamais sous 85 %, fatigue bornée, dépense jamais négative',()=>{
 assert.equal(P.matchStartEnergy(0),85);assert.equal(P.matchStartEnergy(100),100);assert.equal(P.matchStartEnergy(NaN),100);assert.equal(P.matchStartEnergy(120),100);
 assert.equal(P.spendEnergy(10,50),0);assert.equal(P.spendEnergy(50,-9),50);assert.ok(P.fatigueFactor(0)===.75&&P.fatigueFactor(100)===1);
 const g=boot({name:'A',games:0,goals:0,assists:0,xp:0,energy:10});g.run("$('play').onclick();");assert.equal(g.run('match.energy'),85);assert.equal(g.run('career.energy'),85);});

test('confiance : le coach ne descend jamais sous 0 ni ne dépasse 100 sur une longue série de défaites ou de réussites',()=>{
 const g=boot({name:'A',games:0,goals:0,assists:0,xp:0,trust:3});for(let i=0;i<8;i++){g.playMatch({losses:8});assert.ok(g.career().trust>=0);}
 const h=boot({name:'A',games:0,goals:0,assists:0,xp:0,trust:97});for(let i=0;i<8;i++){h.playMatch({goals:3,assists:2,passes:10,dribbles:8,chances:5,us:3,them:0});assert.ok(h.career().trust<=100);}});

test('même match résolu deux fois : finish() est idempotent, le match ne compte qu’une fois',()=>{const g=boot();g.run("$('play').onclick();match.goals=1;finish();finish();");assert.equal(g.run('career.games'),1);assert.equal(g.run('career.goals'),1);});

test('un match abandonné (quitter) ne compte pas, mais conserve l’énergie dépensée',()=>{const g=boot();g.run("$('play').onclick();match.energy=55;match.goals=2;$('leave').onclick();");assert.equal(g.run('career.games'),0);assert.equal(g.run('career.goals'),0);assert.equal(g.run('career.xp'),0);assert.equal(g.run('career.energy'),55);});

test('l’entraînement ne modifie ni les matchs, ni l’XP, ni l’énergie, ni la confiance',()=>{const g=boot();const before=g.career();g.run("$('practice').onclick();");g.run("match.energy=1;match.goals=3;$('leave').onclick();");assert.deepEqual(g.career(),before);});
