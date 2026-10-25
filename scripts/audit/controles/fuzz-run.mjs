// Usage : node scripts/audit/controles/fuzz-run.mjs [premièreGraine] [nbGraines] [pas]
import {fuzz} from '../../../tests/gameplay-controles/fuzzer.mjs';
const from=+process.argv[2]||1,n=+process.argv[3]||20,steps=+process.argv[4]||6000,calm=process.argv[5]==='calm';
const seen=new Map();let tot={starts:0,frames:0,gestures:0,games:0,phases:{}};
for(let s=from;s<from+n;s++){
 const r=fuzz(s,{steps,calm});
 tot.starts+=r.stats.starts;tot.frames+=r.stats.frames;tot.gestures+=r.stats.gestures;tot.games+=r.stats.games;for(const [k,v] of Object.entries(r.stats.phases))tot.phases[k]=(tot.phases[k]||0)+v;
 for(const e of [...r.errors,...r.bad]){const key=e.replace(/\[seed \d+( step \d+)?\] /,'').slice(0,200);if(!seen.has(key))seen.set(key,{first:s,count:0,e});seen.get(key).count++;}
}
console.log(JSON.stringify(tot));
for(const [k,v] of seen)console.log(`x${v.count} first seed ${v.first}: ${v.e.slice(0,600)}`);
