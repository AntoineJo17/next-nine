// Protection des sauvegardes illisibles : jamais écrasées sans copie de sécurité, jamais d'écriture si la copie est impossible.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot,KEY} from './harness.mjs';
import {loadSavedCareer,readLost,LOST_SUFFIX} from '../../dist/career.js';
const LOST=KEY+LOST_SUFFIX;
const bad={
 'JSON tronqué':'{"name":"Léo","games":4,"goals":',
 'texte quelconque':'ceci n’est pas du JSON',
 'nom trop long':JSON.stringify({name:'N'.repeat(40),games:5,goals:2,assists:1,xp:300}),
 'xp hors bornes':JSON.stringify({name:'Léo',games:5,goals:2,assists:1,xp:99999999999}),
 'statistique négative':JSON.stringify({name:'Léo',games:-1,goals:2,assists:1,xp:3}),
};
for(const [nom,raw] of Object.entries(bad)){
 test(`sauvegarde illisible (${nom}) : copie de sécurité faite avant toute écriture, bouton de récupération visible`,()=>{
  const g=boot(undefined,{rawStore:raw});
  assert.equal(g.store[KEY],raw,'la sauvegarde d’origine n’est pas touchée au démarrage');
  const copies=JSON.parse(g.store[LOST]);assert.equal(copies.length,1);assert.equal(copies[0].raw,raw);
  assert.equal(g.els.get('rescue').hidden,false);assert.match(g.els.get('storage').textContent,/illisible/);
  g.playMatch({goals:1});
  assert.notEqual(g.store[KEY],raw,'la nouvelle carrière a pris la place');
  assert.equal(JSON.parse(g.store[LOST])[0].raw,raw,'l’ancienne reste récupérable');
  g.run("$('rescue').onclick();");assert.equal(g.blobs.at(-1),raw,'le fichier de récupération contient exactement l’original');
 });
}
test('sauvegarde valide : aucune copie parasite, bouton caché',()=>{const g=boot({name:'Léo',games:5,goals:2,assists:1,xp:300});assert.equal(g.store[LOST],undefined);assert.equal(g.els.get('rescue').hidden,true);assert.equal(g.career().name,'Léo');});
test('aucune sauvegarde ou valeur vide : rien n’est copié',()=>{for(const raw of [undefined,'null','','  {}  ']){const g=boot(undefined,{rawStore:raw});assert.equal(g.store[LOST],undefined,String(raw));}});
test('la même sauvegarde illisible n’est copiée qu’une fois ; trois copies au plus, les plus récentes',()=>{
 const st={};const ls={getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=v;}};
 for(let i=0;i<2;i++){st[KEY]='abîmé 0';assert.equal(loadSavedCareer(ls,KEY,i).status,'recovered');}
 assert.equal(readLost(ls,KEY).length,1);
 for(let i=1;i<=4;i++){st[KEY]='abîmé '+i;loadSavedCareer(ls,KEY,i);}
 const l=readLost(ls,KEY);assert.equal(l.length,3);assert.deepEqual(l.map(x=>x.raw),['abîmé 2','abîmé 3','abîmé 4']);});
test('copie impossible : mode protégé, la sauvegarde illisible n’est JAMAIS écrasée, y compris après un match',()=>{
 const raw=bad['JSON tronqué'];const g=boot(undefined,{rawStore:raw,lostThrows:true});
 assert.equal(g.store[LOST],undefined);assert.match(g.els.get('storage').textContent,/rien ne sera enregistré/);
 g.playMatch({goals:1});g.run("$('position').value='MOC';$('position').onchange&&0;");
 assert.equal(g.store[KEY],raw,'toujours l’original');});
test('mode protégé levé seulement par un import confirmé ou une remise à zéro confirmée',async()=>{
 const raw=bad['texte quelconque'];
 let g=boot(undefined,{rawStore:raw,lostThrows:true});
 const ok=JSON.stringify({format:'next-nine',version:1,career:{name:'Import',games:3,goals:1,assists:0,xp:50}});
 await g.importText(ok,false);g.playMatch();assert.equal(g.store[KEY],raw,'import refusé : rien ne bouge');
 await g.importText(ok,true);assert.equal(JSON.parse(g.store[KEY]).name,'Import');
 g=boot(undefined,{rawStore:raw,lostThrows:true});g.c=g.ctx;g.ctx.confirm=()=>false;g.run("$('reset').onclick();");g.playMatch();assert.equal(g.store[KEY],raw,'reset refusé : rien ne bouge');
 g.ctx.confirm=()=>true;g.run("$('reset').onclick();");assert.notEqual(g.store[KEY],raw);assert.equal(JSON.parse(g.store[KEY]).name,'Jeune espoir');});
test('stockage bloqué en lecture : le jeu démarre sans planter et signale la sauvegarde indisponible',()=>{const g=boot(undefined,{storageThrows:true});assert.match(g.els.get('storage').textContent,/indisponible/);assert.equal(g.store[LOST],undefined);});
test('pages statiques : le bouton de récupération existe, caché par défaut',async()=>{const fs=await import('node:fs');assert.match(fs.readFileSync('dist/index.html','utf8'),/<button id="rescue" class="secondary" hidden>/);});
