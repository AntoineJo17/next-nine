// Usage: npm run stamp -- "V18 · idée 30" 18-30
// Writes the build label shown on the home screen and adds ?v=<token> to every local module and the stylesheet,
// so a phone that cached an older version never mixes old and new files after an update.
import fs from 'node:fs';
const [label,token]=process.argv.slice(2);
if(!label||!/^[\w.-]+$/.test(token||'')){console.error('Usage: npm run stamp -- "<libellé>" <jeton>, par exemple npm run stamp -- "V18 · idée 30" 18-30');process.exit(1);}
const dir=new URL('../dist/',import.meta.url);
for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.js')||n==='index.html')){
 const file=new URL(name,dir);let s=fs.readFileSync(file,'utf8');const before=s;
 s=s.replace(/((?:from\s*|import\()\s*['"]\.\/[\w.-]+\.js)(\?v=[\w.-]+)?(['"])/g,(_,a,__,q)=>a+'?v='+token+q);
 if(name==='game.js')s=s.replace(/^const BUILD='[^']*';/m,`const BUILD='${label.replace(/'/g,'’')}';`);
 if(name==='index.html')s=s.replace(/(src="game\.js|href="style\.css)(\?v=[\w.-]+)?"/g,(_,a)=>a+'?v='+token+'"');
 if(s!==before){fs.writeFileSync(file,s);console.log('mis à jour :',name);}
}
