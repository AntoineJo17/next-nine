import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot,KEY,progression} from './harness.mjs';
const {parseCareer}=progression;
const base={name:'Alex',games:3,goals:2,assists:1,xp:170};
const INVALIDE='Fichier invalide : ta carrière actuelle est conservée.';

test('JSON malformé : parseCareer lève une exception, jamais de résultat partiel',()=>{for(const t of ['','{','}','{"name":"A",','{name:"A"}',"{'name':'A'}",'undefined','NaN','{"name":"A","games":0,"goals":0,"assists":0,"xp":NaN}'])assert.throws(()=>parseCareer(t),t);});

test('JSON tronqué : chaque préfixe strict d’un export valide est refusé à l’import et la carrière reste intacte',async()=>{
 const g=boot();g.playMatch({goals:1});const before=g.career(),stored=g.store[KEY],file=g.exportFile().trim();
 for(let n=0;n<file.length;n+=Math.max(1,Math.floor(file.length/60))){const msg=await g.importText(file.slice(0,n));assert.equal(msg,INVALIDE,'préfixe de '+n);}
 assert.deepEqual(g.career(),before);assert.equal(g.store[KEY],stored);});

test('import : mauvais format, mauvaise version ou carrière absente sont refusés sans toucher à la carrière',async()=>{
 const g=boot();g.playMatch({goals:1});const before=g.career();
 for(const f of [{format:'autre',version:1,career:base},{format:'next-nine',version:2,career:base},{format:'next-nine',version:1},{format:'next-nine',version:1,career:null},{format:'next-nine',version:1,career:{...base,xp:-3}},base,[],null,'texte'])assert.equal(await g.importText(JSON.stringify(f)),INVALIDE,JSON.stringify(f));
 assert.deepEqual(g.career(),before);});

test('import : un fichier de plus de 100 000 octets est refusé',async()=>{const g=boot();const before=g.career();const big=JSON.stringify({format:'next-nine',version:1,career:{...base,last:'x'.repeat(120000)}});assert.equal(await g.importText(big),INVALIDE);assert.deepEqual(g.career(),before);});

test('pollution de prototype via __proto__ et constructor : ni Object.prototype ni le résultat ne sont touchés',()=>{
 const raw=`{"__proto__":{"polluted":"oui"},"constructor":{"prototype":{"polluted2":"oui"}},"name":"Alex","games":3,"goals":2,"assists":1,"xp":170,
  "face":{"__proto__":{"polluted3":1},"constructor":{"jaw":1},"jaw":0.5},"chem":{"__proto__":5,"constructor":5,"prototype":5,"7":9},"position":"__proto__","tactic":"constructor","hairStyle":"toString"}`;
 const out=parseCareer(raw);
 assert.equal({}.polluted,undefined);assert.equal({}.polluted2,undefined);assert.equal({}.polluted3,undefined);
 assert.equal(Object.getPrototypeOf(out),Object.prototype);assert.equal(out.polluted,undefined);assert.equal(Object.hasOwn(out,'__proto__'),false);assert.equal(Object.hasOwn(out,'constructor'),false);
 assert.equal(out.face.jaw,.5);assert.equal(Object.hasOwn(out.face,'__proto__'),false);assert.deepEqual(out.chem,{'7':9});
 assert.equal(out.position,'BU','« __proto__ » n’est pas une position (POSITIONS[...] hérité de Object)');assert.equal(out.tactic,'equilibre');assert.equal(out.hairStyle,'degrade');});

test('position « constructor », « toString » ou « hasOwnProperty » : retombe sur BU (clé héritée d’Object refusée)',()=>{for(const p of ['constructor','toString','hasOwnProperty','valueOf'])assert.equal(parseCareer({...base,position:p}).position,'BU',p);});

test('pollution via import complet : la carrière chargée ne contient pas la clé et le jeu continue de fonctionner',async()=>{
 const g=boot();const raw='{"format":"next-nine","version":1,"__proto__":{"polluted":1},"career":{"__proto__":{"polluted":1},"name":"Alex","games":3,"goals":2,"assists":1,"xp":170}}';
 assert.match(await g.importText(raw),/importée/);assert.equal({}.polluted,undefined);g.playMatch({goals:1});assert.equal(g.run('career.games'),4);});

test('très gros champs : nom trop long refusé, last tronqué à 350, chem et face bornés',()=>{
 assert.throws(()=>parseCareer({...base,name:'x'.repeat(1e6)}),{message:'Sauvegarde invalide'});
 assert.equal(parseCareer({...base,last:'é'.repeat(1e6)}).last.length,350);
 const chem=Object.fromEntries([...Array(1e5).keys()].map(i=>[String(i),1]));assert.ok(Object.keys(parseCareer({...base,chem}).chem).length<=20);
 const face=Object.fromEntries([...Array(1e5).keys()].map(i=>['k'+i,1]));assert.equal(Object.keys(parseCareer({...base,face}).face).length,18);});

test('JSON très profondément imbriqué : refus propre à la racine, ignoré dans un champ inconnu',()=>{const deep='['.repeat(2e5)+']'.repeat(2e5);assert.throws(()=>parseCareer(deep));assert.equal(parseCareer('{"name":"A","games":0,"goals":0,"assists":0,"xp":0,"face":'+deep+'}').face.jaw,0,'imbrication ignorée dans face');});

test('limites numériques : xp exactement 10 000 000 accepté, au-dessus ou non entier refusé, entiers dangereux refusés',()=>{assert.equal(parseCareer({...base,xp:1e7}).baseLevel,39);for(const v of [1e7+1,Number.MAX_SAFE_INTEGER,2**53,1e308,-0.5])assert.throws(()=>parseCareer({...base,xp:v}),{message:'Sauvegarde invalide'},String(v));});

test('chaînes de couleur hostiles : seules les formes #rrggbb passent (pas de CSS ni de HTML injecté)',()=>{for(const c of ['red','#fff','#12345g','#1234567','url(javascript:1)','<img onerror=x>','#c98b62;x:y','#c98b62\n']){const o=parseCareer({...base,skin:c,hair:c,brow:c,beardColor:c});assert.equal(o.skin,'#c98b62');assert.equal(o.hair,'#28231e');assert.equal(o.brow,'');assert.equal(o.beardColor,'');}const ok=parseCareer({...base,skin:'#ABCDEF'});assert.equal(ok.skin,'#ABCDEF');});

test('nom contenant du HTML : conservé tel quel comme texte (affiché via textContent), sans exception',()=>{const o=parseCareer({...base,name:'<b>x</b>'});assert.equal(o.name,'<b>x</b>');});

test('stockage illisible au démarrage : carrière neuve, et la sauvegarde illisible n’est pas écrasée avant une action du joueur',()=>{
 for(const raw of ['n’importe quoi','{"name":"Alex"','null','[]','{"name":"x","games":-1,"goals":0,"assists":0,"xp":0}',JSON.stringify({...base,name:'x'.repeat(30)})]){const g=boot(null,{rawStore:raw});assert.equal(g.run('career.games'),0,raw);assert.equal(g.run('career.name'),'Jeune espoir');assert.equal(g.store[KEY],raw,'non écrasée au chargement');}});

test('stockage bloqué (localStorage lève) : le jeu reste jouable en mémoire, sans exception',()=>{const g=boot(null,{storageThrows:true});g.playMatch({goals:1});assert.equal(g.run('career.games'),1);assert.equal(g.run('storageOK'),false);});

// Régression : POSITIONS[s.position] acceptait les clés héritées d'Object ; le jeu plantait ensuite sur INSTRUCTIONS[coachInstruction(...)].text.
test('régression : une position « constructor » ou « __proto__ » dans une sauvegarde ne fait pas planter le chargement du jeu',()=>{
 for(const p of ['constructor','__proto__','toString','hasOwnProperty']){const g=boot({...base,position:p});assert.equal(g.run('career.position'),'BU',p);g.playMatch({goals:1});assert.equal(g.run('career.games'),4);}});
