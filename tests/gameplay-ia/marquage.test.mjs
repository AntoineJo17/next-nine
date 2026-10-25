// AUDIT-3 · marquage : stabilité (pas d'échanges A↔B), gardien allié jamais marqué, primaire cohérent entre assignMarkers et refreshDefence.
// Lancer : node --test tests/gameplay-ia/*.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';
import {refreshDefence,assignMarkers} from '../../dist/football-ai.js';
import {layout,run,batch} from './defence-harness.mjs';

test('le gardien allié (style gardien) n\'est jamais marqué, même quand un défenseur n\'a plus personne d\'autre',()=>{
 const carrier={x:0,z:0},keeperMate={x:0,z:83,style:'gardien',tacticalId:0},mate={x:10,z:8,tacticalId:1};
 const ds=[{x:0,z:-2},{x:3,z:-6},{x:-4,z:-9},{x:7,z:-9}].map(d=>({...d,home:{...d}}));
 refreshDefence(ds,carrier,[carrier,keeperMate,mate],-1);
 assert.ok(ds.every(d=>d.mark!==keeperMate),'refreshDefence');
 const ds2=[{x:0,z:-2},{x:3,z:-6},{x:-4,z:-9},{x:7,z:-9}].map(d=>({...d,home:{...d}}));
 assignMarkers(ds2,carrier,[keeperMate,mate]);
 assert.ok(ds2.every(d=>d.mark!==keeperMate),'assignMarkers');
});

test('chaque partenaire est marqué par un seul défenseur (pas de doublon), refreshDefence comme assignMarkers',()=>{
 for(let s=1;s<=40;s++){const {hero,defenders,mates}=layout(s*31+7);const partners=[hero,...mates];
  refreshDefence(defenders,hero,partners,-1);let marks=defenders.map(d=>d.mark).filter(Boolean);assert.equal(new Set(marks).size,marks.length,'refresh '+s);
  assignMarkers(defenders,hero,mates);marks=defenders.map(d=>d.mark).filter(Boolean);assert.equal(new Set(marks).size,marks.length,'assign '+s);}
});

test('assignMarkers désigne le même défenseur de tête que refreshDefence (un défenseur battu, dans le dos du porteur, ne devient pas le presseur)',()=>{
 // Le plus proche du porteur est derrière lui (battu) : le défenseur côté but doit presser, comme le fait refreshDefence 0,18 s plus tard.
 const carrier={x:0,z:-10,vx:0,vz:-4};
 const mk=()=>[{x:.6,z:-9},{x:1.9,z:-12.4}].map(d=>({...d,home:{...d}}));
 const a=assignMarkers(mk(),carrier,[{x:8,z:-5}]),b=refreshDefence(mk(),carrier,[carrier,{x:8,z:-5}],-1);
 assert.equal(a,b);assert.equal(a,1);
});

test('la défense ne change presque plus de marquage pendant une conduite de 6 s (avant : environ 15 échanges A→B par occasion)',()=>{
 const o=batch(120,{seconds:6});
 assert.ok(o.swapsPerEpisode<3,'échanges par occasion : '+o.swapsPerEpisode.toFixed(2));
 assert.ok(o.markFlipsPerEpisode<8,'changements de marquage par occasion : '+o.markFlipsPerEpisode.toFixed(2));
 assert.equal(o.keeperMarked,0);
});

test('un défenseur garde son joueur tant qu\'un joueur libre n\'est pas nettement plus proche, et en change si le sien s\'éloigne vraiment',()=>{
 const carrier={x:0,z:0},p1={x:20,z:15},p2={x:-20,z:15},near={x:0,z:-1.5,home:{x:0,z:-1.5}},d={x:19,z:12,home:{x:19,z:12}};
 refreshDefence([near,d],carrier,[carrier,p1,p2],-1);assert.equal(d.mark,p1);
 // p1 s'éloigne un peu (distance > 9 m) mais p2 n'est pas 4 m plus près : le marquage reste
 p1.x=30;p1.z=20;refreshDefence([near,d],carrier,[carrier,p1,p2],-1);assert.equal(d.mark,p1);
 // un nouveau joueur libre apparaît juste à côté : il prend le relais
 const p3={x:17,z:10};refreshDefence([near,d],carrier,[carrier,p1,p2,p3],-1);assert.equal(d.mark,p3);
});
