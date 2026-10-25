// AUDIT-4 · La boucle de jeu ne doit jamais s'arrêter sur une exception (requestAnimationFrame toujours rappelé).
// Exécution : node --test tests/gameplay-controles/*.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot,toChance} from './harness.mjs';

test('une exception dans le rendu ne fige pas la boucle : requestAnimationFrame est rappelé',()=>{
 const g=boot({seed:5});toChance(g);
 g.engine.render=()=>{throw new TypeError('rendu cassé (injecté)');};
 const before=g.rafCount;
 assert.doesNotThrow(()=>g.frame(),'loop ne doit pas laisser remonter l’exception');
 assert.equal(g.rafCount,before+1,'la boucle doit se replanifier malgré l’exception');
 assert.ok(g.errors.some(e=>/rendu cassé/.test(e)),'l’exception est journalisée');
});

test('trois échecs de suite pendant une occasion : l’occasion est annulée proprement et le match reprend',()=>{
 const g=boot({seed:6});toChance(g);
 const render=g.engine.render;g.engine.render=()=>{throw new TypeError('rendu cassé (injecté)');};
 for(let i=0;i<4;i++)g.frame();
 assert.equal(g.run('action.ended'),true,'occasion terminée par le garde-fou');
 assert.equal(g.run('action.outcomeKind'),'miss');
 g.engine.render=render;g.frame();
 g.run("action.after=9;");g.frame();g.frame();
 assert.equal(g.run('action.phase'),'interval','le match reprend en simulation');
 assert.equal(g.run('!!match'),true);
});

test('échecs persistants : retour à l’accueil sans perdre la carrière, boucle toujours active',()=>{
 const g=boot({seed:7});toChance(g);
 const games=g.run('career.games');
 g.engine.render=()=>{throw new TypeError('rendu cassé (injecté)');};
 const before=g.rafCount;
 for(let i=0;i<95;i++)g.frame();
 assert.equal(g.rafCount,before+95);
 assert.equal(g.run('!!match||!!action'),false,'plus de match après abandon contrôlé');
 assert.equal(g.run("document.getElementById('home').hidden"),false);
 assert.equal(g.run('career.games'),games,'aucune partie comptée pour un match interrompu');
 assert.ok(g.run('career.energy')>=0&&g.run('career.energy')<=100);
});

test('chemin normal inchangé : aucune exception, une seule replanification par image',()=>{
 const g=boot({seed:8});g.run("$('play').onclick()");
 const before=g.rafCount;for(let i=0;i<300;i++)g.frame();
 assert.equal(g.rafCount,before+300);assert.deepEqual(g.errors,[]);
});
