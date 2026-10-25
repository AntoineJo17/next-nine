// AUDIT-4 · C2 · Pendant le pressing, la consigne affichée ne doit plus être celle de la frappe (« TIRE VERS TOI POUR FRAPPER »).
// Exécution : node --test tests/gameplay-controles/*.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot} from './harness.mjs';

test('C2 · pressing : le libellé de geste correspond au contrôle (toucher l’herbe pour courir)',()=>{
 let found=0;
 for(let seed=50;seed<64&&!found;seed++){
  const g=boot({seed});g.run("$('play').onclick()");
  for(let i=0;i<300000&&g.run('!!match')&&!found;i++){
   g.run("action&&action.interval&&(action.interval.speed=2)");g.frame();
   if(g.run("!!action&&action.phase==='press'")){found=1;
    assert.match(g.run("$('gestureLabel').textContent"),/COURIR/,'libellé pressing');
    assert.doesNotMatch(g.run("$('gestureLabel').textContent"),/TIRE VERS TOI/);}
   else if(g.run("!!action&&action.ready&&action.phase!=='interval'"))g.run("resolve(false,'x','hero','miss');action.after=99;");
  }
 }
 assert.ok(found,'un pressing doit apparaître dans les graines essayées');
});
