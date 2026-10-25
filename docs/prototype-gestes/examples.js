// Génère le tableau d'exemples concrets (node examples.js) pour docs/GESTES-PROPOSITIONS.md
const S=require('./sim.js');
const ctx0={x:0,z:-2};
const fmt=r=>{const g=r.flight.goal;if(!g)return r.launch.z>10?`retombe à ${(r.launch.z-r.flight.landing.z).toFixed(0)} m vers l'avant et ${r.flight.landing.x-r.launch.x>=0?'+':''}${(r.flight.landing.x-r.launch.x).toFixed(0)} m en latéral (apogée ${r.flight.apex.toFixed(1)} m)`: `ne franchit pas la ligne (retombe à z=${r.flight.landing.z.toFixed(0)}, x=${r.flight.landing.x.toFixed(1)})`;
 return (g.inside?'BUT':g.over?'au-dessus':'à côté')+` (x=${g.x.toFixed(1)} m, h=${g.y.toFixed(1)} m, ${g.t.toFixed(2)} s)`;};
const rows=[];
function disp(prop,pts,ctx,opts,N=80){const c={goal:0,wide:0,over:0,short:0};for(let s=1;s<=N;s++){const r=S.play(prop,pts,{...ctx0,...ctx},{...opts,seed:s*31});const g=r.flight.goal;if(!g)c.short++;else if(g.inside)c.goal++;else if(g.over)c.over++;else c.wide++;}
 return `${Math.round(c.goal/N*100)} % but · ${Math.round(c.wide/N*100)} % à côté · ${Math.round(c.over/N*100)} % au-dessus · ${Math.round(c.short/N*100)} % sans atteindre la ligne`;}
function ex(name,prop,pts,ctx,opts){const r=S.play(prop,pts,{...ctx0,...ctx},opts);rows.push([name,prop,`${r.params.v0.toFixed(0)} m/s`,`${(r.params.elev*57.3).toFixed(0)}°`,`${r.params.wy.toFixed(0)}`,fmt(r),disp(prop,pts,ctx,opts||{})]);}
ex('Frappe tendue et puissante (swipe rapide, droit)','A',S.line(260,150),{}, {});
ex('Frappe douce et placée (swipe lent, légèrement vers le coin)','A',S.line(190,330,{dir:.1}),{});
ex('Enroulée intérieure (arc vers la gauche, départ vers la droite)','A',S.line(250,220,{bow:-.16,dir:.23}),{});
ex('Enroulée extérieure (arc inverse)','A',S.line(250,220,{bow:.16,dir:-.23}),{});
ex('Frappe aérienne haute (doigt parti du bas du ballon)','A',S.line(230,200),{contact:{ox:0,oy:.9}});
ex('Frappe trop rapide et tremblée (raté probable)','A',S.line(300,110,{jitter:14,seed:4}),{});
ex('Même geste, joueur peu précis (compétence .7, stress .5)','A',S.line(260,150),{}, {skill:.7,stress:.5});
ex('Visée libre très large (45° hors cadre) ','A',S.line(250,160,{dir:.8}),{});
ex('Coup franc balle sans effet (droit, très rapide, arrêt net)','A',S.line(310,100,{brake:true,dir:.46}),{freekick:true,z:-8,x:-6});
ex('Coup franc enroulé par-dessus le mur','A',S.line(260,210,{bow:-.16,dir:.62}),{contact:{ox:0,oy:.5},freekick:true,z:-8,x:-6});
ex('Passe lobée courte par-dessus un défenseur (départ bas du ballon, geste lent)','A',S.line(170,260),{contact:{ox:0,oy:.55},z:40,x:0});
ex('Passe lobée en profondeur (geste plus long et plus rapide)','A',S.line(230,200),{contact:{ox:0,oy:.7},z:40,x:0});
ex('Renversement de jeu, grande diagonale (geste long, très haut)','A',S.line(280,190,{dir:1.0}),{contact:{ox:0,oy:.85},z:40,x:-15});
ex('Même tir, fronde (B) : tirer 180 px en arrière','B',S.line(180,260).map(p=>({x:-p.x,y:-p.y,t:p.t})),{});
ex('Deux temps (C) : visée au poteau gauche + frappe courte','C',S.line(120,110),{aim:{x:-3.2,z:-20}});
const out=rows.map(r=>`| ${r.join(' | ')} |`).join('\n');console.log('| Geste | Variante | Vitesse | Élévation | Effet (rad/s) | Résultat (un tir) | 80 tirs, mêmes gestes |\n|---|---|---|---|---|---|---|\n'+out);
