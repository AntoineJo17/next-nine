#!/usr/bin/env python3
"""Lot 12 · possession : remplacements exacts pour dist/game.js (usage : python3 possession-patch.py [chemin/vers/dist/game.js]).
Chaque `old` doit apparaitre exactement une fois. Le correctif de physique (followBall) est dans dist/physics.js, edite directement."""
import sys, pathlib
path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/game.js')
src = path.read_text(encoding='utf-8')

R = []
# 1. import de followBall
R.append(("import {launch,stepBall,goalCrossing,hitPlayer,R,clamp,PITCH,containGoalBall,stepNetBall,frameContact} from './physics.js?v=20-11';",
          "import {launch,stepBall,goalCrossing,hitPlayer,R,clamp,PITCH,containGoalBall,stepNetBall,frameContact,followBall} from './physics.js?v=20-11';"))

# 2. winBall : le ballon n'est plus place sur le defenseur ; la jambe (poke/tacle/bloc) va au bout de son geste ; plus de rotation instantanee
OLD_WIN = "function winBall(defender,message){defender.challenge=null;resolve(false,message,action.shotBy,'tackle');action.newOwner=defender;action.ballControl='defender';defender.kickTimer=.18;action.escapeTarget={x:clamp(defender.x+(defender.x<action.hero.x?-1:1),-PITCH.W+1,PITCH.W-1),z:defender.z+2};defender.angle=Math.atan2(-(action.escapeTarget.x-defender.x),-(action.escapeTarget.z-defender.z));attachBall(defender);}"
NEW_WIN = ("// Lot 12 · Une récupération est un contact : le ballon reste où il a été touché, puis ROULE jusqu'au pied du défenseur (carryToOwner), sans traverser un corps ;\n"
          "// la jambe du défenseur (poke, tacle glissé, bloc) continue son geste jusqu'au bout au lieu d'être coupée, et il ne pivote plus d'un coup.\n"
          "function winBall(defender,message){const y0=action.ball.y;resolve(false,message,action.shotBy,'tackle');action.ball.y=Math.max(R,y0);action.newOwner=defender;action.ballControl='defender';defender.kickTimer=.18;action.escapeTarget={x:clamp(defender.x+(defender.x<action.hero.x?-1:1),-PITCH.W+1,PITCH.W-1),z:defender.z+2};}\n"
          "function carryToOwner(p,moving,dt){const a=action,step=moving?.58+Math.sin(a.sim*17)*.16:.58;followBall(a.ball,{x:p.x-Math.sin(p.angle)*step,y:R+(moving?Math.abs(Math.sin(a.sim*17))*.055:0),z:p.z-Math.cos(p.angle)*step},dt,9,[{x:p.x,z:p.z,r:.42},{x:a.hero.x,z:a.hero.z,r:.5}]);}")
R.append((OLD_WIN, NEW_WIN))

# 3. fin d'action : tant que son geste dure, le defenseur ne repart pas (pas de glissement sur place pendant un tacle)
R.append(("if(a.ended){if(d.challenge)updateChallenge(d,dt);if(d===a.newOwner&&a.after<1.1)",
          "if(a.ended){if(d.challenge){updateChallenge(d,dt);if(d!==a.newOwner)d.speed=0;continue;}if(d===a.newOwner&&a.after<1.1)"))

# 4. le ballon suit son nouveau possesseur par un trajet physique
R.append(("else if(a.ballControl==='defender')attachBall(a.newOwner,a.after<1.1);",
          "else if(a.ballControl==='defender')carryToOwner(a.newOwner,a.after<1.1,dt);"))

# 5. conduite : un defenseur tout pres ne « gagne » plus le ballon sans le toucher, il tente de le piquer (la jambe doit atteindre le ballon)
R.append(("||close<.95&&!d.shoulder&&Math.random()<dt*1.5*match.profile.press){winBall(d,'Ballon récupéré par le défenseur. Essaie de le contourner.');break;}}",
          "){winBall(d,'Ballon récupéré par le défenseur. Essaie de le contourner.');break;}if(close<.95&&!d.shoulder&&!d.challenge&&Math.random()<dt*1.5*match.profile.press)beginChallenge(d,{x:a.ball.x+(a.hero.vx||0)*.3,z:a.ball.z+(a.hero.vz||0)*.3},'poke');}"))

if all(src.count(new) == 1 and src.count(old) == 0 for old, new in R):
    print('possession-patch : déjà appliqué, rien à faire')
    sys.exit(0)
for old, new in R:
    n = src.count(old)
    assert n == 1, f"{n} occurrences pour : {old[:80]}"
    src = src.replace(old, new)
path.write_text(src, encoding='utf-8')
print('possession-patch : %d remplacements appliqués à %s' % (len(R), path))
