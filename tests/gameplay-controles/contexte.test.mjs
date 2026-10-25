// AUDIT-4 · C3 · Perte du contexte WebGL pendant un match : retour à l'accueil sans geste ni son de stade résiduels.
// Avant correction : le son du stade (ambience) continuait sur l'écran d'accueil et le geste en cours restait en mémoire.
// Exécution : node --test tests/gameplay-controles/*.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot,toChance} from './harness.mjs';

test('C3 · webglcontextlost : accueil, plus de match ni de geste, son du stade coupé',()=>{
 const g=boot({seed:21});toChance(g);
 g.run("globalThis.__stops=0;const o=ambience.stop.bind(ambience);ambience.stop=()=>{globalThis.__stops++;return o();};");
 const b=g.run('engine.ballScreen()');g.pointer('pointerdown',b.x,b.y,1);g.pointer('pointermove',b.x,b.y+60,1);
 assert.equal(g.run('!!drag'),true);
 const handlers=g.el('pitch').handlers.webglcontextlost;assert.ok(handlers&&handlers.length,'écouteur webglcontextlost présent');
 handlers[0]({preventDefault(){}});
 assert.equal(g.run('!!match||!!action'),false);
 assert.equal(g.run('!!drag'),false,'geste en cours oublié');
 assert.equal(g.run('__stops'),1,'ambience.stop appelé');
 assert.equal(g.run("document.getElementById('home').hidden"),false);
 assert.equal(g.run("$('play').disabled"),true,'on ne peut pas relancer sans 3D');
 g.frame();g.pointer('pointerup',b.x,b.y+60,1);
 assert.deepEqual(g.errors,[]);
});
