// Harnais QA carrière : charge dist/game.js dans un contexte vm avec un faux DOM, un faux localStorage et de faux Blob/URL.
// Aucune vraie sauvegarde n'est lue : tout vient de fixtures écrites dans les tests.
import vm from 'node:vm';import fs from 'node:fs';
import * as ai from '../../dist/football-ai.js';import * as tactical from '../../dist/tactical.js';import * as physics from '../../dist/physics.js';import * as movement from '../../dist/movement.js';import * as gestures from '../../dist/gestures.js';import * as progression from '../../dist/career.js';import * as commentary from '../../dist/commentary.js';import * as audio from '../../dist/audio.js';
export const KEY='nextnine-career-v1';
export {progression};
export function boot(existing,{rawStore,storageThrows=false,lostThrows=false}={}){
 const els=new Map(),modes=['dribble','low','normal','lob'].map(mode=>({dataset:{mode},classList:{toggle(){}},setAttribute(){}})),store={},blobs=[];
 if(rawStore!==undefined)store[KEY]=rawStore;else if(existing)store[KEY]=JSON.stringify(existing);
 const el=id=>{if(!els.has(id))els.set(id,{value:'',style:{},disabled:false,hidden:false,classList:{toggle(){}},handlers:{},addEventListener(name,fn){this.handlers[name]=fn;},setPointerCapture(){},getBoundingClientRect(){return{left:0,top:0,width:140,height:140};},setAttribute(){},textContent:'',click(){}});return els.get(id);};
 const c=vm.createContext({...ai,...tactical,...physics,...movement,...gestures,...progression,...commentary,...audio,makeTimeline:()=>[],console,setTimeout(){},clearTimeout(){},
  document:{getElementById:el,querySelectorAll:()=>modes,querySelector:()=>el('jersey'),createElement:()=>({click(){}}),body:{classList:{toggle(){}}}},window:{scrollTo(){}},
  localStorage:{getItem:k=>{if(storageThrows)throw Error('stockage bloqué');return store[k]===undefined?null:store[k];},setItem:(k,v)=>{if(storageThrows||(lostThrows&&k.endsWith('-illisible')))throw Error('stockage bloqué');store[k]=v;}},
  Blob:class{constructor(parts){this.text=parts.join('');blobs.push(this.text);}},URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},requestAnimationFrame(){},confirm:()=>true});
 let source=fs.readFileSync(new URL('../../dist/game.js',import.meta.url),'utf8');source=source.replace(/^(import .*?;\n)+/,'').replace('});init();','});');vm.runInContext(source,c);
 const run=s=>vm.runInContext(s,c);
 run("beginInterval=()=>{match.minute=23;action.phase='ready';action.ready=true;};beginIncoming=()=>{};Math.random=()=>.9;engine={appearance:{},setup(){},resize(){},aim:{},preview(){},actorScreen(a){return{x:200+a.x*12,y:200+a.z*8};},ballScreen(){return this.actorScreen(action.ball);},groundAtScreen(x,y){return{x:(x-200)/12,z:(y-200)/8};}};refresh();");
 return {run,store,blobs,els,ctx:c,career:()=>JSON.parse(run('JSON.stringify(career)')),
  /** Joue un match complet fictif aux statistiques données puis le termine. */
  playMatch(stats={},energy=100){run("$('play').onclick();");run(`Object.assign(match,${JSON.stringify({goals:0,assists:0,passes:0,dribbles:0,chances:0,losses:0,us:0,them:0,...stats})});match.energy=${energy};finish();`);run("$('back').onclick();");},
  exportFile(){run("$('exportSave').onclick();");return blobs.at(-1);},
  async importText(text,accept=true){c.confirm=()=>accept;const file={size:text.length,text:async()=>text};await els.get('saveFile').handlers.change({target:{files:[file],value:'x'}});return els.get('storage').textContent;}};
}
