#!/usr/bin/env python3
"""Lot 12 · ia : remplacements exacts pour dist/game.js (lignes trop longues pour Git).

Usage : python3 docs/audit-gameplay2/ia-patch.py [chemin/vers/game.js]   (défaut : dist/game.js)
Chaque remplacement exige que `old` apparaisse exactement une fois ; sinon le script s'arrête sans rien écrire.
Si `new` est déjà présent (script déjà rejoué), le remplacement est ignoré.
"""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'dist/game.js'
src = open(path, encoding='utf-8').read()

R = []

# 1. Import de la nouvelle fonction de soutien (football-ai.js).
R.append((
    ",offsidePosition} from './football-ai.js",
    ",offsidePosition,supportSpot} from './football-ai.js",
))

# 2. Partenaires sans ballon : ils cherchent un espace où ils peuvent vraiment être servis (soutien, appels, dédoublements, entre les lignes)
#    au lieu de rester sur leur poste. Le poste reste l'ancre (rayon limité par rôle), le calcul est refait toutes les ~0,4 s.
R.append((
    "moveToward(t,target,2.7*(tt==='contre'?1.2:1),dt,8);",
    "if(!match.training&&carrier&&t.tacticalId%11!==0&&Math.hypot(t.x-carrier.x,t.z-carrier.z)>3){t.spotClock=(t.spotClock||0)-dt;if(t.spotClock<=0||!t.spot){t.spotClock=.4+(t.tacticalId%5)*.06;t.spot=supportSpot(t,carrier,a.defenders,{anchor:target,line:a.offsideLine??-99,mates:[a.hero,...a.teammates.filter(m=>m!==t)],tactic:tt,previous:t.spot})||target;}moveToward(t,t.spot,(Math.hypot(t.spot.x-t.x,t.spot.z-t.z)>2.5?3.9:2.7)*(tt==='contre'?1.2:1),dt,8);}else moveToward(t,target,2.7*(tt==='contre'?1.2:1),dt,8);",
))

# 3. Appels proposés au joueur : jusqu'à trois (au lieu de deux), et une course de plus de 16 m est raccourcie (un partenaire à 25 m du point
#    n'arrivait jamais : le ballon attendu était intercepté). Raccourcir garde le point en jeu (moins profond).
R.append((
    "return point.z<t.z-3?{mate:t,point,space:space(point)",
    "{const L=Math.hypot(point.x-t.x,point.z-t.z);if(L>16){point.x=t.x+(point.x-t.x)*16/L;point.z=t.z+(point.z-t.z)*16/L;}}return point.z<t.z-3?{mate:t,point,space:space(point)",
))
R.append((
    ".sort((p,q)=>q.space-p.space).slice(0,2);}",
    ".sort((p,q)=>q.space-p.space).slice(0,3);}",
))

# 4. Passe en profondeur : la vitesse dépendait de la course du partenaire (jusqu'à 5,5 m/s, le ballon s'arrêtait avant le point). Désormais le ballon
#    arrive au point en 0,75 x le temps de course du partenaire, mais jamais plus lentement que 12 m/s en moyenne ni plus vite que la passe normale ;
#    il ne roule pas plus de 12 m au-delà du point.
R.append((
    "want=clamp(dist/Math.max(run,.4)+1.2,6,v);b.vx*=want/v;b.vz*=want/v;",
    "T=clamp(run*.75,dist/22,Math.max(dist/12,.6)),want=Math.min(v,dist*.55/(1-Math.exp(-.55*T)),(dist+12)*.55);b.vx*=want/v;b.vz*=want/v;",
))

# 5. Protection du ballon : le défenseur reste collé au joueur (0,95 m) au lieu de flotter à 1,4 m, où le contact (< 1 m) n'arrivait presque jamais.
R.append((
    "if(i===a.pressIndex&&carrier===a.hero)target.x+=(match.sideBias||0)*.7;",
    "if(i===a.pressIndex&&carrier===a.hero)target.x+=(match.sideBias||0)*.7;if(a.phase==='shield'&&i===a.pressIndex){const sx=d.x-a.hero.x,sz=d.z-a.hero.z,sl=Math.hypot(sx,sz)||1;target={x:a.hero.x+sx/sl*.95,z:a.hero.z+sz/sl*.95};}",
))

# 6. Début d'une occasion de jeu ouvert : un partenaire dont la ligne de passe est bouchée (lot 12) se place d'emblée dans un espace ouvert, en jeu
#    (c'est la disposition de départ de la scène, pas un déplacement visible) : le joueur démarre avec au moins quelques solutions de passe.
R.append((
    "for(const p of [a.hero,...a.teammates,...a.defenders])p.home={x:p.x,z:p.z};engine.resize();updateDistance();}",
    "if(!match.training&&kind==='open'){const line=offsideLineZ(a);for(const t of a.teammates){const dh=Math.hypot(t.x-a.hero.x,t.z-a.hero.z);if(t.tacticalId%11===0||t===a.incomingPlayer||dh<5||dh>32||laneClearance(a.hero,t,a.defenders)>=1.2)continue;const s=supportSpot(t,a.hero,a.defenders,{anchor:{x:t.x,z:t.z},line,mates:[a.hero,...a.teammates.filter(m=>m!==t)],tactic:teamTactic()});if(s&&laneClearance(a.hero,s,a.defenders)>=1.6&&Math.min(...a.defenders.map(d=>Math.hypot(d.x-s.x,d.z-s.z)))>=2.2&&Math.hypot(s.x-t.x,s.z-t.z)<=10){t.x=s.x;t.z=s.z;}}}\n for(const p of [a.hero,...a.teammates,...a.defenders])p.home={x:p.x,z:p.z};engine.resize();updateDistance();}",
))

for old, new in R:
    if new in src:
        print('déjà appliqué :', old[:60])
        continue
    n = src.count(old)
    assert n == 1, f'{n} occurrences (attendu 1) pour : {old[:80]}'
    src = src.replace(old, new)

open(path, 'w', encoding='utf-8').write(src)
print('ok :', len(R), 'remplacements dans', path)
