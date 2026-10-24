// Fixtures d'anciennes sauvegardes (V13..V19). Les formes exactes sont reconstituées d'après le code actuel de parseCareer :
// chaque version ajoute des champs optionnels ; on vérifie qu'un champ absent prend une valeur par défaut valide.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot,progression} from './harness.mjs';
const {parseCareer,FACE_KEYS,FACE_DEFAULT,POSITIONS}=progression;
const base={name:'Alex',games:3,goals:2,assists:1,xp:170};
const V={
 V13:{...base},
 V14:{...base,last:'AC Rivage 1 – 0 AS Montclair',skin:'#8d5524',hair:'#111111',number:7},
 V15:{...base,skin:'#8d5524',hair:'#111111',number:7,hairStyle:'court',beard:'bouc',energy:60},
 V16:{...base,hairStyle:'afro',energy:40,position:'AIL',trust:72,tactic:'pressing'},
 V17:{...base,position:'MOC',trust:30,tactic:'contre',face:{lipFull:.4,jaw:.25}},
 V18:{...base,face:{lipFull:.4,jaw:.25,age:-.5},brow:'#221100',baseXP:170,baseLevel:1},
 V19:{...base,face:{...FACE_DEFAULT},brow:'#221100',beardColor:'#331a0d',beard:'barbe3j',sound:false,weakFoot:.5,chem:{'9':20},baseXP:100,baseLevel:3}};

function assertValide(o){
 assert.equal(typeof o.name,'string');assert.ok(o.name.trim()&&o.name.length<=20);
 for(const k of ['games','goals','assists','xp','baseXP'])assert.ok(Number.isSafeInteger(o[k])&&o[k]>=0,k);
 assert.ok(o.baseXP<=o.xp);assert.ok(Number.isInteger(o.baseLevel)&&o.baseLevel>=0&&o.baseLevel<=39);
 assert.ok(o.energy>=0&&o.energy<=100);assert.ok(o.trust>=0&&o.trust<=100);assert.ok(o.weakFoot>=.3&&o.weakFoot<=.95);
 assert.ok(Number.isInteger(o.number)&&o.number>=1&&o.number<=99);assert.ok(POSITIONS[o.position]);
 assert.deepEqual(Object.keys(o.face),FACE_KEYS);for(const k of FACE_KEYS)assert.ok(Number.isFinite(o.face[k])&&Math.abs(o.face[k])<=1,k);
 for(const k of ['skin','hair'])assert.match(o[k],/^#[0-9a-f]{6}$/i);for(const k of ['brow','beardColor'])assert.match(o[k],/^(#[0-9a-f]{6})?$/i);
 assert.ok(['','barbe3j','barbe','bouc'].includes(o.beard));assert.equal(typeof o.sound,'boolean');assert.ok(o.last.length<=350);
 for(const [k,v] of Object.entries(o.chem)){assert.match(k,/^\d{1,2}$/);assert.ok(v>=0&&v<=60);}
 assert.equal(JSON.stringify(parseCareer(o)),JSON.stringify(o),'idempotence');}

for(const [version,fx] of Object.entries(V))test(`migration ${version} : la sauvegarde ancienne donne un état valide, borné, sans perdre les champs valides`,()=>{
 const out=parseCareer(JSON.parse(JSON.stringify(fx)));assertValide(out);
 for(const k of ['name','games','goals','assists','xp'])assert.equal(out[k],fx[k]);
 for(const k of ['skin','hair','number','hairStyle','beard','energy','position','trust','tactic','brow','beardColor','sound','weakFoot','last'])if(k in fx)assert.equal(out[k],fx[k],k);
 if(fx.face)for(const k of Object.keys(fx.face))assert.equal(out.face[k],fx.face[k],'face.'+k);
 if(fx.chem)assert.deepEqual(out.chem,fx.chem);});

test('migration : face absente ou partielle prend les valeurs de départ pour les réglages manquants',()=>{assert.deepEqual(parseCareer(V.V13).face,FACE_DEFAULT);const p=parseCareer(V.V17).face;assert.equal(p.lipFull,.4);assert.equal(p.jaw,.25);assert.equal(p.eyes,FACE_DEFAULT.eyes);assert.equal(p.age,0);});

test('migration : sans baseXP ni baseLevel, la carrière garde son niveau général (niveau = XP/100, plafonné à 39)',()=>{const o=parseCareer({...base,xp:430});assert.equal(o.baseXP,430);assert.equal(o.baseLevel,4);assert.equal(parseCareer({...base,xp:9000000}).baseLevel,39);});

test('migration : baseXP supérieur à xp ou baseLevel hors bornes sont écartés',()=>{const o=parseCareer({...base,baseXP:999,baseLevel:40});assert.equal(o.baseXP,170);assert.equal(o.baseLevel,1);assert.equal(parseCareer({...base,baseLevel:-1}).baseLevel,1);assert.equal(parseCareer({...base,baseLevel:2.5}).baseLevel,1);});

test('valeurs hors bornes : corrigées par écrêtage, la sauvegarde reste chargeable',()=>{
 const o=parseCareer({...base,energy:250,trust:-40,number:500,weakFoot:9,face:{lipFull:7,jaw:-7,chin:.123}});
 assert.equal(o.energy,100);assert.equal(o.trust,0);assert.equal(o.number,99);assert.equal(o.weakFoot,.95);assert.equal(o.face.lipFull,1);assert.equal(o.face.jaw,-1);assert.equal(o.face.chin,.1);
 assert.equal(parseCareer({...base,energy:-5}).energy,0);assert.equal(parseCareer({...base,number:0}).number,1);assert.equal(parseCareer({...base,weakFoot:0}).weakFoot,.3);assert.equal(parseCareer({...base,trust:49.6}).trust,50);});

test('types faux, NaN et chaînes sur les champs optionnels : valeurs par défaut, aucune exception',()=>{
 const wrong={energy:'80',trust:'70',number:'10',weakFoot:'.6',position:7,tactic:null,sound:'non',face:'visage',skin:'rouge',hair:12,brow:{},beardColor:[],beard:'longue',hairStyle:'mohawk',last:42,chem:'x'};
 const o=parseCareer({...base,...wrong});assertValide(o);
 assert.equal(o.energy,100);assert.equal(o.trust,50);assert.equal(o.number,9);assert.equal(o.weakFoot,.45);assert.equal(o.position,'BU');assert.equal(o.tactic,'equilibre');
 assert.equal(o.sound,true,'sound ne se désactive que sur false strict');assert.deepEqual(o.face,FACE_DEFAULT);assert.equal(o.skin,'#c98b62');assert.equal(o.hairStyle,'degrade');assert.equal(o.beard,'');assert.equal(o.last,'');assert.deepEqual(o.chem,{});
 const nan=parseCareer({...base,energy:NaN,trust:NaN,weakFoot:Infinity,number:NaN,face:{lipFull:NaN,jaw:Infinity}});assertValide(nan);assert.equal(nan.energy,100);assert.equal(nan.number,9);assert.equal(nan.face.jaw,FACE_DEFAULT.jaw);});

test('champs obligatoires invalides : parseCareer refuse avec « Sauvegarde invalide »',()=>{
 const bad=[{...base,name:''},{...base,name:'   '},{...base,name:'x'.repeat(21)},{...base,name:12},{...base,games:-1},{...base,goals:1.5},{...base,xp:'170'},{...base,assists:NaN},{...base,xp:Infinity},{...base,xp:10000001},{...base,games:undefined},{name:'A'},null,undefined,[],0,'null','"texte"','[]'];
 for(const b of bad)assert.throws(()=>parseCareer(b),/Sauvegarde invalide|SyntaxError|Cannot read/,JSON.stringify(b));
 for(const b of bad.slice(0,12))assert.throws(()=>parseCareer(b),{message:'Sauvegarde invalide'});});

test('chem : seules les clés numériques de 1 à 2 chiffres avec valeur entière de 0 à 60 survivent, 20 entrées au plus',()=>{
 const chem={'3':5,'12':60,'123':4,'a':1,'4':61,'5':-1,'6':1.5,'7':'9'};const o=parseCareer({...base,chem});assert.deepEqual(o.chem,{'3':5,'12':60});
 const many=Object.fromEntries([...Array(99).keys()].map(i=>[String(i+1),1]));assert.equal(Object.keys(parseCareer({...base,chem:many}).chem).length,20);});

test('chargement au démarrage : une sauvegarde V13 en localStorage est migrée et jouable',()=>{const g=boot(V.V13);assert.equal(g.run('career.number'),9);assert.equal(g.run('career.games'),3);assert.equal(g.run('career.trust'),50);assert.equal(g.run("career.face.eyes"),FACE_DEFAULT.eyes);g.playMatch({goals:1});assert.equal(g.run('career.games'),4);});
