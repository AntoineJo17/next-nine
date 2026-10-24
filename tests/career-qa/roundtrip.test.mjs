import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot,KEY,progression} from './harness.mjs';
const {parseCareer,FACE_KEYS}=progression;

const FULL={name:'Zinedine',games:14,goals:9,assists:5,xp:2300,baseXP:400,baseLevel:2,energy:73,last:'AC Rivage 2 – 1 Olympique Valmont · Note 7,4 · 1 but(s), 0 passe(s) décisive(s).',
 skin:'#8d5524',hair:'#111111',hairStyle:'boucles',beard:'barbe',brow:'#221100',beardColor:'#331a0d',number:10,position:'MOC',trust:64,tactic:'possession',sound:false,weakFoot:.6,chem:{'7':12,'10':40},
 face:{lipFull:.25,lipHeight:-.5,chin:.1,eyes:.35,lipRed:.15,lipWidth:.05,noseWidth:-.3,noseLength:.2,noseOut:0,jaw:.45,cheekBones:.3,cheekFull:-.2,faceWidth:.1,faceLength:-.1,forehead:.0,eyeSize:.15,neck:.2,age:.5}};

test('parseCareer est idempotent : analyser deux fois donne exactement le même état',()=>{const once=parseCareer(FULL);assert.deepEqual(parseCareer(once),once);assert.deepEqual(parseCareer(JSON.stringify(once)),once);});

test('une sauvegarde complète traverse parseCareer sans perdre aucun champ valide (look, numéro, nom, couleurs)',()=>{const out=parseCareer(FULL);for(const k of Object.keys(FULL))assert.deepEqual(out[k],FULL[k],'champ perdu ou modifié : '+k);assert.deepEqual(Object.keys(out).sort(),Object.keys(FULL).sort());});

test('aller-retour export puis import : la carrière importée est identique en profondeur (look compris)',async()=>{
 const a=boot(FULL);a.run("career={...career,...parseCareer(career)};");const before=a.career();
 const file=a.exportFile();const wrapper=JSON.parse(file);assert.equal(wrapper.format,'next-nine');assert.equal(wrapper.version,1);
 const b=boot();const msg=await b.importText(file);assert.match(msg,/importée/);
 const after=b.career();assert.deepEqual(after,before);
 for(const k of ['face','brow','beardColor','number','name','skin','hair','hairStyle','beard','position','tactic','trust','energy','xp','baseXP','baseLevel'])assert.deepEqual(after[k],FULL[k],k);
 assert.deepEqual(JSON.parse(b.store[KEY]),before,'la carrière importée est écrite dans localStorage');});

test('aller-retour après un vrai match joué : tout est conservé, seuls chem et weakFoot (absents d’une carrière neuve) reçoivent leur défaut, puis état stable',async()=>{
 const a=boot();a.playMatch({goals:1,assists:1,passes:4,dribbles:2,chances:1},77);const before=a.career();
 assert.equal('chem' in before,false);assert.equal('weakFoot' in before,false);
 const b=boot();await b.importText(a.exportFile());const after=b.career();assert.deepEqual(after,{...before,chem:{},weakFoot:.45});
 const c=boot(null,{rawStore:b.store[KEY]});assert.deepEqual(c.career(),after);
 const d=boot();await d.importText(c.exportFile());assert.deepEqual(d.career(),after,'point fixe après un second aller-retour');});

test('export : le fichier est du JSON valide au format next-nine v1 et ne contient que la carrière',()=>{const a=boot(FULL);const w=JSON.parse(a.exportFile());assert.deepEqual(Object.keys(w).sort(),['career','format','version']);assert.equal(typeof w.career.name,'string');});

test('import refusé par le joueur : la carrière actuelle et le stockage restent intacts',async()=>{
 const a=boot();a.playMatch({goals:1});const before=a.career(),stored=a.store[KEY];
 const donor=boot(FULL);const msg=await a.importText(donor.exportFile(),false);
 assert.deepEqual(a.career(),before);assert.equal(a.store[KEY],stored);assert.ok(msg===''||!/importée/.test(msg));});

test('chaque valeur de FACE_KEYS est conservée par l’aller-retour et reste dans [-1, 1] au pas de 0,05',()=>{const out=parseCareer(JSON.parse(JSON.stringify(FULL)));for(const k of FACE_KEYS){assert.equal(out.face[k],FULL.face[k]);assert.ok(Math.abs(out.face[k]*20-Math.round(out.face[k]*20))<1e-9);}});
