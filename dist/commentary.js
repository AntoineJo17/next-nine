// 27 · Short contextual commentary: one line, chosen from the score, the minute, the scenario and the player's match.
// Every line stays under 50 characters so it reads at a glance on a phone.
const POOLS={
 kickoff:['C’est parti à Rivage !','Coup d’envoi, le public est là.'],
 kickoff_derby:['Derby ! Le stade est bouillant.','Derby : personne ne veut perdre.'],
 kickoff_remontada:['Trente-cinq minutes pour y croire.','Mené 0–1 : Rivage doit réagir.'],
 kickoff_finale:['Dernière journée, tout se joue ici.'],
 kickoff_pluie:['Pluie battante sur la pelouse.','Terrain lourd, ballon glissant.'],
 bench:['{name} attend son heure sur le banc.'],
 goal_us_equal:['Égalisation de Rivage !','Tout est à refaire : {us} partout.'],
 goal_us_lead:['Rivage passe devant !','Rivage prend l’avantage !'],
 goal_us_more:['Rivage fait le break !','Rivage creuse l’écart.'],
 goal_us_behind:['Rivage réduit l’écart !','Rivage revient dans le match.'],
 goal_them:['Coup dur pour Rivage.','L’adversaire frappe fort.'],
 goal_them_equal:['L’adversaire égalise : {us} partout.'],
 goal_them_more:['La soirée se complique…','Rivage est dans le dur.'],
 hero_goal:['{name} trouve le chemin des filets !','But de {name} !'],
 hero_goal_first:['{name} ouvre son compteur !'],
 hero_goal_brace:['Doublé pour {name} !'],
 hero_goal_hat:['Triplé ! {name} est en feu !'],
 hero_goal_late:['{name} délivre Rivage au bout du temps !'],
 hero_goal_equal:['{name} remet Rivage à hauteur !'],
 assist:['Passe décisive de {name} !','Quel service de {name} !'],
 save:['Le gardien s’interpose.','Belle parade adverse.'],
 miss:['Pas loin du cadre…','Ça passe à côté.'],
 frame:['Sur le montant !','Le cadre tremble !'],
 tackle:['Ballon perdu, il faut repartir.','Le défenseur a bien lu.'],
 chance_open:['{name} a de l’espace !','Une ouverture pour {name}.'],
 chance_wing:['{name} lancé sur son aile.'],
 chance_playmaker:['{name} cherche la faille.'],
 chance_cross:['Centre pour {name}…'],
 chance_penalty:['Penalty ! {name} s’avance.'],
 chance_freekick:['Coup franc dangereux.'],
 chance_press:['{name} presse le relanceur.'],
 late_behind:['Rivage pousse pour égaliser.','Il faut un but, vite !'],
 late_level:['Les dernières minutes sont tendues.'],
 late_ahead:['Rivage gère son avance.','Plus que quelques minutes à tenir.'],
 red:['Carton rouge ! {team} à dix.'],
 foul:['{name} est fauché !','Faute sur {name}.'],
 change:['{in} remplace {out}.'],
 sub_in:['{name} entre en jeu.','Place à {name} !'],
 sub_out:['{name} sort sous les applaudissements.']
};
// Picks the most specific pool that fits the situation.
export function commentKey(event,c={}){const diff=(c.us||0)-(c.them||0);
 if(event==='kickoff')return c.scenario&&POOLS['kickoff_'+c.scenario]?'kickoff_'+c.scenario:'kickoff';
 if(event==='goal_us')return diff===0?'goal_us_equal':diff===1?'goal_us_lead':diff>1?'goal_us_more':'goal_us_behind';
 if(event==='goal_them')return diff===0?'goal_them_equal':diff<=-2?'goal_them_more':'goal_them';
 if(event==='hero_goal')return c.goals>=3?'hero_goal_hat':c.goals===2?'hero_goal_brace':c.minute>=80&&diff===1?'hero_goal_late':diff===0?'hero_goal_equal':c.careerGoals===0?'hero_goal_first':'hero_goal';
 if(event==='chance')return POOLS['chance_'+c.kind]?'chance_'+c.kind:'chance_open';
 if(event==='late')return diff<0?'late_behind':diff===0?'late_level':'late_ahead';
 return POOLS[event]?event:null;}
export function commentLine(event,c={},pick=Math.random){const key=commentKey(event,c);if(!key)return '';const pool=POOLS[key],line=pool[Math.floor(pick()*pool.length)%pool.length];
 return line.replace(/\{(\w+)\}/g,(_,k)=>String(k==='name'?(c.name||'Espoir').slice(0,14):c[k]??''));}
export const COMMENT_POOLS=POOLS;
