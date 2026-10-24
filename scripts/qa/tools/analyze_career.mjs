// Analyse de propriétés quantitatives du modèle de carrière réel, sans modifier les données du jeu.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const repo=process.argv[2];
if(!repo)throw Error('Indiquer le dépôt local');
const c=await import(pathToFileURL(path.join(repo,'dist','career.js')).href);
const assert=(cond,message)=>{if(!cond)throw Error(message);};
const stats=[];
for(let xp=0;xp<=100000;xp+=137){const v=c.attributes(xp), level=c.progressionLevel(xp);
 assert(Number.isInteger(level)&&level>=0&&level<=39,'Niveau hors bornes');
 for(const [k,x] of Object.entries(v))assert(Number.isFinite(x)&&x>=0,'Caractéristique invalide '+k);
 stats.push(v.finishing);
}
for(let i=1;i<stats.length;i++)assert(stats[i]>=stats[i-1],'Progression décroissante');
for(let energy=-100;energy<=200;energy+=2){
 const spent=c.spendEnergy(energy,12), factor=c.fatigueFactor(energy), start=c.matchStartEnergy(energy);
 assert(spent>=0&&spent<=100,'Dépense hors bornes');
 assert(factor>=.75&&factor<=1,'Fatigue hors bornes');
 assert(start>=85&&start<=100,'Récupération hors bornes');
}
for(let games=0;games<600;games++){
 const levels=c.teamLevels(games);
 assert(Array.isArray(levels)&&levels.length===2&&levels.every(Number.isFinite),'Niveaux clubs invalides');
 const coach=c.coachInstruction({position:['BU','AIL','MOC'][games%3],games});
 assert(c.INSTRUCTIONS[coach], 'Consigne inaccessible');
}
for(let i=0;i<1000;i++){
 const x={goals:i%7,assists:i%5,passes:i%13,dribbles:i%9,chances:i%6,losses:i%8};
 const p=c.performance(x);
 assert(p.rating>=3&&p.rating<=10,'Note hors bornes');
 assert(Number.isFinite(p.earned)&&p.earned>=10,'XP de match invalide');
}
console.log('OK propriétés: progression, énergie, récupération, équipes, consignes, XP/notes (plus de 2400 cas)');
