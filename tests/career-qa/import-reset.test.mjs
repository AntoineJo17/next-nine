import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot,KEY,progression as P} from './harness.mjs';
// Fixture « IMPORT QA » reconstituée depuis la capture de l'audit (QA-07) : journée 3/6, 2 matchs, 1 but, indicateur 0 / 700 XP.
const IMPORT_QA={name:'IMPORT QA',games:2,goals:1,assists:0,xp:0};
const wrap=c=>JSON.stringify({format:'next-nine',version:1,career:c});

test('IMPORT QA : 2 matchs, 1 but, 0 XP donnent JOURNÉE 3 / 6 et 0 / 700 XP — cohérent avec le code, un but n’impose aucune valeur d’XP',async()=>{
 const g=boot();assert.match(await g.importText(wrap(IMPORT_QA)),/importée/);
 g.run('refresh()');assert.equal(g.els.get('day').textContent,'JOURNÉE 3 / 6');assert.equal(g.els.get('xpLabel').textContent,'0 / 700 XP');
 assert.equal(g.run('career.games'),2);assert.equal(g.run('career.goals'),1);assert.equal(g.run('career.xp'),0);assert.equal(g.run('career.name'),'IMPORT QA');
 assert.equal(g.run('60+progressionLevel(developmentXP())'),60);});

test('IMPORT QA : le prochain match (journée 3) reprend la progression normale — XP > 0, niveau cohérent',async()=>{
 const g=boot();await g.importText(wrap(IMPORT_QA));g.playMatch({goals:1,passes:2});
 assert.equal(g.run('career.games'),3);assert.equal(g.run('career.goals'),2);assert.ok(g.run('career.xp')>=10);
 g.run('refresh()');assert.equal(g.els.get('day').textContent,'JOURNÉE 4 / 6');assert.equal(g.els.get('xpLabel').textContent,`${g.run('developmentXP()')%700} / 700 XP`);});

test('IMPORT QA : la même carrière avec XP > 0 sans baseXP (ancien format) affiche 0 / 700 XP par conception — le niveau général est figé dans baseLevel',async()=>{
 const g=boot();await g.importText(wrap({...IMPORT_QA,xp:250}));
 assert.equal(g.run('career.baseLevel'),2);assert.equal(g.run('career.baseXP'),250);g.run('refresh()');assert.equal(g.els.get('xpLabel').textContent,'0 / 700 XP');assert.equal(g.run('60+progressionLevel(developmentXP())'),62);});

test('IMPORT QA : avec baseXP et baseLevel explicites, l’indicateur compte l’XP gagnée depuis la base',async()=>{
 const g=boot();await g.importText(wrap({...IMPORT_QA,xp:250,baseXP:100,baseLevel:1}));g.run('refresh()');assert.equal(g.els.get('xpLabel').textContent,'150 / 700 XP');assert.equal(g.run('60+progressionLevel(developmentXP())'),61);});

test('IMPORT QA : round-trip exact — export de la carrière importée puis réimport donne le même état',async()=>{
 const a=boot();await a.importText(wrap(IMPORT_QA));const b=boot();await b.importText(a.exportFile());assert.deepEqual(b.career(),a.career());});

test('rechargement : fermer puis rouvrir le jeu restitue exactement la carrière enregistrée',()=>{
 const a=boot();a.playMatch({goals:1,assists:1,passes:3});a.run("career.number=17;career.brow='#221100';career.beardColor='#331a0d';career.beard='bouc';career.face.jaw=.4;career.name='Kylian';save();");
 const saved=a.career(),raw=a.store[KEY];const b=boot(null,{rawStore:raw});
 for(const k of Object.keys(saved))assert.deepEqual(b.career()[k],saved[k],k);assert.equal(b.career().number,17);assert.equal(b.career().face.jaw,.4);});

test('rechargement : plusieurs cycles jouer/enregistrer/recharger ne dérivent pas (état identique à chaque cycle)',()=>{
 let raw;for(let i=0;i<6;i++){const g=boot(null,{rawStore:raw});if(i>0)assert.equal(g.run('career.games'),i);g.playMatch({goals:i%2,passes:i});raw=g.store[KEY];assert.deepEqual(boot(null,{rawStore:raw}).career(),P.parseCareer(raw));}});

test('reset annulé : confirm refusé ne touche ni la carrière en mémoire ni le stockage',()=>{
 const g=boot();g.playMatch({goals:1,assists:1});const before=g.career(),stored=g.store[KEY];
 g.ctx.confirm=()=>false;g.run("$('reset').onclick();");assert.deepEqual(g.career(),before);assert.equal(g.store[KEY],stored);});

test('reset confirmé : retour à une carrière neuve enregistrée, et le look par défaut est restauré',()=>{
 const g=boot();g.playMatch({goals:2});g.run("career.number=11;career.name='Zed';career.brow='#000000';save();");
 g.ctx.confirm=()=>true;g.run("$('reset').onclick();");const c=g.career();
 assert.equal(c.games,0);assert.equal(c.xp,0);assert.equal(c.goals,0);assert.equal(c.name,'Jeune espoir');assert.equal(c.number,9);assert.equal(c.brow,'');assert.deepEqual(c.face,P.FACE_DEFAULT);
 assert.deepEqual(JSON.parse(g.store[KEY]),c);assert.deepEqual(boot(null,{rawStore:g.store[KEY]}).career(),{...c,chem:{},weakFoot:.45});});

test('reset annulé puis reset confirmé : un refus ne « s’accumule » pas, la décision suivante est respectée',()=>{
 const g=boot();g.playMatch({goals:1});g.ctx.confirm=()=>false;g.run("$('reset').onclick();");assert.equal(g.run('career.games'),1);g.ctx.confirm=()=>true;g.run("$('reset').onclick();");assert.equal(g.run('career.games'),0);});

test('vestiaire : abandonner le brouillon de look rétablit le look enregistré et n’écrit rien dans le stockage',()=>{
 const g=boot();g.playMatch({goals:1});const stored=g.store[KEY],before=g.career();
 g.run("lockerSnap=lookSnapshot();career.number=77;career.brow='#abcdef';career.face.jaw=.9;save();");
 assert.equal(g.store[KEY],stored,'le brouillon n’est pas écrit tant que le joueur ne valide pas');
 g.ctx.confirm=()=>false;g.run('closeLocker(false)');assert.equal(g.run('career.number'),77,'refus d’abandonner : le brouillon reste ouvert');assert.equal(g.store[KEY],stored);
 g.ctx.confirm=()=>true;g.run('closeLocker(false)');assert.deepEqual(g.career(),before);assert.equal(g.store[KEY],stored);});

test('vestiaire : valider enregistre le look (numéro, sourcils, couleur de barbe, visage) et il survit au rechargement',()=>{
 const g=boot();g.run("lockerSnap=lookSnapshot();career.number=77;career.brow='#abcdef';career.beardColor='#123456';career.beard='barbe';career.face.jaw=.9;");
 g.run('closeLocker(true)');const c=boot(null,{rawStore:g.store[KEY]}).career();assert.equal(c.number,77);assert.equal(c.brow,'#abcdef');assert.equal(c.beardColor,'#123456');assert.equal(c.beard,'barbe');assert.equal(c.face.jaw,.9);});
