// AUDIT-4 · Simulation entre les occasions : pause réelle de 3 s sur but adverse, score incrémenté une fois,
// boutons Aide / Quitter / Vitesse pendant la pause, quitter pendant la célébration.
// Exécution : node --test tests/gameplay-controles/*.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot} from './harness.mjs';

/** Joue jusqu'au premier but adverse (en résolvant les occasions du joueur par un tir manqué). */
function toOpponentGoal(){
 for(let seed=70;seed<110;seed++){
  const g=boot({seed});g.run("$('play').onclick()");
  for(let i=0;i<250000&&g.run('!!match');i++){
   g.run("action&&action.interval&&(action.interval.speed=2)");
   const before=g.run('match.them');g.frame();
   if(g.run('!!match&&match.them')>before)return {g,them:before+1};
   if(g.run("!!action&&action.ready&&action.phase!=='interval'"))g.run("resolve(false,'x','hero','miss');action.after=99;");
  }
 }
 throw new Error('aucun but adverse trouvé');
}

test('but adverse : la minute est figée 3 s, le bouton de vitesse est inactif, puis le jeu reprend ; le score ne bouge qu’une fois',()=>{
 const {g,them}=toOpponentGoal();
 assert.equal(g.run('action.phase'),'interval');
 const pause=g.run('action.interval.goalPause');assert.ok(pause>2.8&&pause<=3,'pause de 3 s armée : '+pause);
 assert.equal(g.run("$('skipPlayback').disabled"),true);assert.equal(g.run("$('goalCelebration').hidden"),false);
 const minute=g.run('match.minute');
 for(let i=0;i<150;i++)g.frame(16.7);      // ~2,5 s
 assert.equal(g.run('match.minute'),minute,'minute figée pendant la pause');
 assert.equal(g.run('match.them'),them,'score non réincrémenté');
 // appui sur Vitesse pendant la pause : sans effet
 g.run("$('skipPlayback').onclick()");assert.equal(g.run('action.interval.speed||0')<=2,true);
 for(let i=0;i<60;i++)g.frame(16.7);        // au-delà de 3 s
 assert.equal(g.run('action.interval.goalPause'),0);assert.equal(g.run("$('skipPlayback').disabled"),false);
 assert.equal(g.run("$('goalCelebration').hidden"),true);
 for(let i=0;i<30;i++)g.frame(16.7);
 assert.ok(g.run('match.minute')>minute,'la simulation reprend');
 assert.deepEqual(g.errors,[]);
});

test('but adverse puis Aide ouverte : la pause ne s’écoule pas tant que l’aide est ouverte ; Quitter nettoie la célébration',()=>{
 const {g}=toOpponentGoal();
 g.run("$('gestureHelp').onclick()");const p0=g.run('action.interval.goalPause');
 for(let i=0;i<180;i++)g.frame(16.7);
 assert.equal(g.run('action.interval.goalPause'),p0,'pause suspendue par l’aide');
 g.run("$('guideClose').onclick()");
 g.run("$('leave').onclick()");
 assert.equal(g.run("$('goalCelebration').hidden"),true);assert.equal(g.run("$('skipPlayback').disabled"),false);
 assert.equal(g.run('!!match||!!action'),false);
 g.run("$('play').onclick()");g.frame();assert.equal(g.run('action.interval.goalPause||0'),0,'nouveau match sans pause résiduelle');
 assert.deepEqual(g.errors,[]);
});
