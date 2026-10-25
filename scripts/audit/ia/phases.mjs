import fs from 'node:fs';
const r=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));let last='';
r.frames.forEach((f,i)=>{const k=f.ph+'|'+f.ready+'|'+f.ended;if(k!==last){console.log(i,f.t,k,'hero',f.h,'ball',f.b,'keeper',f.k);last=k;}});
console.log(r.summary,r.log.slice(0,5));
