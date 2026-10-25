// Harnais AUDIT-4 « contrôles » : charge dist/game.js dans un contexte vm avec un faux DOM permissif,
// un faux moteur 3D (Proxy), un faux rAF piloté à la main et une horloge Date.now contrôlée.
// Contrairement aux harnais existants, beginInterval / beginIncoming ne sont PAS remplacés : le vrai enchaînement
// simulation -> occasion -> simulation est joué. Aucune sauvegarde personnelle : localStorage factice vierge.
import vm from 'node:vm';import fs from 'node:fs';
import * as ai from '../../dist/football-ai.js';import * as tactical from '../../dist/tactical.js';import * as physics from '../../dist/physics.js';import * as movement from '../../dist/movement.js';import * as gestures from '../../dist/gestures.js';import * as progression from '../../dist/career.js';import * as commentary from '../../dist/commentary.js';import * as audio from '../../dist/audio.js';

/** PRNG déterministe (mulberry32). */
export function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

export function boot({career,seed=1,w=390,h=844}={}){
 const els=new Map(),store={},listeners=[];
 const modes=['dribble','low','normal','lob'].map(mode=>({dataset:{mode},classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(){}}));
 const mkEl=id=>{const e={id,value:'',style:{},disabled:false,hidden:false,textContent:'',innerHTML:'',dataset:{},children:[],handlers:{},attrs:{},captured:new Set(),
  classList:{toggle(){},add(){},remove(){},contains:()=>false},
  addEventListener(name,fn){(this.handlers[name]||(this.handlers[name]=[])).push(fn);listeners.push([id,name]);},
  removeEventListener(){},setPointerCapture(p){this.captured.add(p);},releasePointerCapture(p){this.captured.delete(p);},hasPointerCapture(p){return this.captured.has(p);},
  getBoundingClientRect(){return{left:0,top:0,width:w,height:h,right:w,bottom:h};},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},
  querySelector:()=>mkEl(id+'>q'),querySelectorAll:()=>[],appendChild(c){return c;},remove(){},focus(){},click(){if(this.onclick)this.onclick();},
  lastChild:{style:{},classList:{toggle(){}}},firstChild:{style:{}},clientWidth:w,clientHeight:h,parentElement:null,getContext:()=>null,
  // gestionnaires on* éventuellement posés par game.js
  };return e;};
 const el=id=>{if(!els.has(id))els.set(id,mkEl(id));return els.get(id);};
 // moteur factice : toutes les méthodes inconnues sont des no-op ; projection écran linéaire inversible
 const engine=new Proxy({appearance:{},aim:{visible:false},targetRing:{visible:false},calls:{},
  actorScreen(a){return{x:w/2+(a?.x||0)*12,y:h*.62+(a?.z||0)*8};},
  ballScreen(){return this.actorScreen(vmGet('action.ball'));},
  groundAtScreen(x,y){return{x:(x-w/2)/12,z:(y-h*.62)/8};},
  actorNDC(a){const p=this.actorScreen(a);return{x:p.x/w*2-1,y:1-p.y/h*2,behind:false};},
  render(){this.calls.render=(this.calls.render||0)+1;},
  setup(){this.calls.setup=(this.calls.setup||0)+1;}},
  {get(t,k){if(k in t)return t[k];if(typeof k==='symbol')return undefined;return(...a)=>{t.calls[k]=(t.calls[k]||0)+1;};}});
 const timers=[];let rafCb=null,rafCount=0;
 const dateState={now:1.7e12};
 const ctx=vm.createContext({...ai,...tactical,...physics,...movement,...gestures,...progression,...commentary,...audio,
  console:{log(){},warn(){},info(){},error(...a){errors.push(a.map(String).join(' '));}},
  setTimeout:(fn,ms)=>{timers.push({fn,ms,id:timers.length+1});return timers.length;},clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  document:{getElementById:el,querySelectorAll:()=>modes,querySelector:id=>el('q:'+id),createElement:()=>mkEl('created'),body:{classList:{toggle(){},add(){},remove(){}},appendChild(){}},hidden:false,fullscreenElement:null,addEventListener(n){listeners.push(['document',n]);},documentElement:{style:{}}},
  window:{scrollTo(){},addEventListener(n){listeners.push(['window',n]);},innerWidth:w,innerHeight:h},
  navigator:{vibrate(){}},
  localStorage:{getItem:k=>store[k]===undefined?null:store[k],setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
  Blob:class{constructor(p){this.text=p.join('');}},URL:{createObjectURL:()=>'blob:t',revokeObjectURL(){}},
  requestAnimationFrame:cb=>{rafCb=cb;rafCount++;return 1;},cancelAnimationFrame(){},confirm:()=>true});
 const errors=[];
 const vmGet=s=>vm.runInContext(s,ctx);
 if(career)store['nextnine-career-v1']=JSON.stringify(career);
 let source=fs.readFileSync(process.env.GAME_JS||new URL('../../dist/game.js',import.meta.url),'utf8');
 source=source.replace(/^(import .*?;\n)+/,'').replace('});init();','});');
 vm.runInContext(source,ctx);
 const run=s=>vm.runInContext(s,ctx);
 const R=rng(seed);
 run(`engine=null;`);ctx.__engine=engine;run(`engine=__engine;$('play').disabled=false;$('practice').disabled=false;refresh();`);
 // Date.now et Math.random pilotés
 ctx.__dateState=dateState;ctx.__rnd=R;
 run(`Date.now=()=>__dateState.now;Math.random=()=>__rnd();`);
 const api={get rafCount(){return rafCount;},run,ctx,store,engine,errors,els,el,listeners,timers,dateState,w,h,R,
  /** Avance l'horloge et appelle loop comme le ferait requestAnimationFrame. */
  frame(dtMs=16.7){dateState.now+=dtMs;api.t=(api.t||1000)+dtMs;run(`loop(${api.t})`);},
  /** Évènement pointeur synthétique sur le canevas du match. */
  pointer(type,x,y,id=1){const c=el('pitch');const f=c.handlers[type]||[];const e={type,pointerId:id,clientX:x,clientY:y,preventDefault(){},isPrimary:id===1};for(const fn of f)fn(e);return e;},
 };
 return api;
}

/** Joue jusqu'à une occasion jouable (phase ready/aerial) en accélérant la simulation. */
export function toChance(g,max=40000){
 g.run("$('play').onclick()");
 for(let i=0;i<max;i++){
  if(g.run("action&&action.interval&&(action.interval.speed=2,0)")){}
  g.frame();
  const ph=g.run('action&&action.phase');
  if(g.run('!!action&&action.ready&&action.phase!=="interval"'))return ph;
 }
 throw new Error('aucune occasion jouable atteinte');
}

