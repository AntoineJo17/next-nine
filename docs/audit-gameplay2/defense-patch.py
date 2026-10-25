#!/usr/bin/env python3
"""Lot 12 · defense : le pressing (séquence qui commence avec le ballon chez l'adversaire) devient une vraie situation défensive.

Usage : python3 docs/audit-gameplay2/defense-patch.py [chemin/vers/dist/game.js]
Chaque remplacement est exact (old -> new) et vérifié par count==1. Rejouable une seule fois (après, old n'existe plus).
"""
import sys, pathlib

path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/game.js')
src = path.read_text(encoding='utf-8')

R = []

# 1 · consignes lisibles : on touche le PORTEUR pour le presser
R.append((
"$('gestureLabel').textContent='TOUCHE L’HERBE POUR COURIR SUR LE PORTEUR';",
"$('gestureLabel').textContent='TOUCHE LE PORTEUR POUR COURIR DESSUS ET LE PRESSER';"))
R.append((
"$('feedback').textContent='Pressing : touche l’herbe pour courir sur le porteur. Coupe sa passe ou prends-lui le ballon.';}",
"$('feedback').textContent='Pressing : touche le porteur pour le presser et le tacler. Touche l’herbe pour couper sa passe.';}"))

# 2 · tête de tickPress : suivi continu du porteur, tacle visible, geste « presser » en un seul toucher
R.append((
"function tickPress(a,dt){const c=a.pressCarrier,h=a.hero;a.pressTime+=dt;if(a.runTarget)moveToward(h,a.runTarget,attributes(developmentXP()).speed*fatigueFactor(match.energy)*1.05,dt);drainEnergy(h.speed*dt*.12);",
"""// Lot 12 · Pressing jouable. Un toucher à moins de 4,5 m du porteur = « presse-le » : le joueur le suit seul (plus besoin de retoucher
// l'herbe à chaque mètre), s'arrête à 0,8 m (pas de traversée), puis tente UN tacle (cooldown 1,2 s). Un tacle réussi fait rouler le ballon
// vers lui (plus de ballon qui saute dans ses pieds) ; il le contrôle quand il l'atteint. Un toucher ailleurs = couper la passe.
function pressStride(){return attributes(developmentXP()).speed*fatigueFactor(match.energy)*1.05;}
function pressTap(p){const a=action,c=a.pressCarrier;if(!a||a.pressWon)return;a.runTarget=p;a.ready=false;a.started=true;if(c&&!a.pressPass&&Math.hypot(p.x-c.x,p.z-c.z)<4.5){if(!a.pressChase)$('feedback').textContent='Tu presses le porteur : reste sur lui !';a.pressChase=true;}else a.pressChase=false;}
function tickPressWon(a,dt){const c=a.pressCarrier,h=a.hero,w=a.pressWon;w.t+=dt;c.speed=0;c.vx=c.vz=0;stepBall(a.ball,dt);{const dx=a.ball.x-h.x,dz=a.ball.z-h.z,l=Math.hypot(dx,dz);moveToward(h,l>.58?{x:a.ball.x-dx/l*.58,z:a.ball.z-dz/l*.58}:{x:h.x,z:h.z},pressStride()*.8,dt);}drainEnergy(h.speed*dt*.12);
 const ax=h.x-Math.sin(h.angle)*.58,az=h.z-Math.cos(h.angle)*.58;/* point où le ballon se pose devant ses pieds */
 if(w.t>.15&&Math.hypot(a.ball.x-ax,a.ball.z-az)<.14||w.t>1.2){match.recoveries=(match.recoveries||0)+1;a.phase='won';a.pressWon=null;controlAgain(w.msg||'Ballon récupéré haut ! À toi de jouer.');}}
function tickPress(a,dt){const c=a.pressCarrier,h=a.hero;a.pressTime+=dt;if(h.kickTimer>=0){h.kickTimer+=dt;if(h.kickTimer>.5)h.kickTimer=-1;}a.pressCool=Math.max(0,(a.pressCool||0)-dt);
 if(a.pressWon){tickPressWon(a,dt);return;}
 if(a.pressChase&&!a.pressPass)a.runTarget={x:c.x,z:c.z};
 if(a.runTarget){let tg=a.runTarget;if(a.pressChase&&!a.pressPass){const dx=c.x-h.x,dz=c.z-h.z,l=Math.hypot(dx,dz);if(l>1.1){moveToward(h,{x:c.x,z:c.z},pressStride(),dt,12,false);tg=null;}else tg=l>.8?{x:c.x-dx/l*.8,z:c.z-dz/l*.8}:{x:h.x,z:h.z};}if(tg)moveToward(h,tg,pressStride(),dt);}drainEnergy(h.speed*dt*.12);"""))

# 3 · plus de snap du point visé sur le porteur : on active simplement le suivi
R.append((
"const d=Math.hypot(h.x-c.x,h.z-c.z);if(d<3.5&&a.runTarget)a.runTarget={x:c.x,z:c.z};",
"const d=Math.hypot(h.x-c.x,h.z-c.z);if(d<3.5&&a.runTarget)a.pressChase=true;"))

# 4 · le tirage « d<.95 et hasard par image » (ballon téléporté) devient un vrai duel : un tacle, un résultat, un ballon qui roule
R.append((
"if(d<.95&&Math.random()<dt*2.4){c.hasBall=false;match.recoveries=(match.recoveries||0)+1;a.phase='won';controlAgain('Ballon récupéré haut ! À toi de jouer.');return;}",
"""if(d<1.15&&!(a.pressCool>0)){h.kickTimer=0;a.pressDuels=(a.pressDuels||0)+1;if(Math.random()<clamp(.42*fatigueFactor(match.energy),.25,.42)){c.hasBall=false;const ux=(h.x-c.x)/(d||1),uz=(h.z-c.z)/(d||1);a.ball={x:c.x,y:R,z:c.z+.5,vx:ux*2.4,vy:0,vz:uz*2.4,age:0,bounces:0};a.pressWon={t:0};$('feedback').textContent='Tacle ! Le ballon lui échappe…';return;}a.pressCool=1.2;$('feedback').textContent='Il résiste : reste sur lui !';}"""))

# 4b · le porteur ne lâche sa passe que s'il est vraiment serré (2,2 m, avant : 3,2 m) : le joueur, qui doit accélérer, a le temps d'arriver au contact
R.append((
"a.pressure=d<3.2?a.pressure+dt:",
"a.pressure=d<2.2?a.pressure+dt:"))

# 5 · la passe de l'adversaire : le joueur part automatiquement sur la trajectoire (il peut retoucher l'herbe pour choisir lui-même)
R.append((
"a.pressPass={to};c.hasBall=false;$('feedback').textContent='Il cherche une passe…';}}",
"""a.pressPass={to};c.hasBall=false;a.pressChase=false;{const px=to.x-c.x,pz=to.z-c.z,l2=px*px+pz*pz||1,k=clamp(((h.x-c.x)*px+(h.z-c.z)*pz)/l2,.2,.9);a.runTarget={x:c.x+px*k,z:c.z+pz*k};}$('feedback').textContent='Il passe ! Coupe la trajectoire.';}}"""))

# 5b · une passe lâchée à bout portant ne touche pas le joueur collé au passeur ; coupée plus loin, le ballon est amorti vers ses pieds
R.append((
"if(a.pressPass){stepBall(a.ball,dt);if(hitPlayer(a.ball,h,.7,1.6)){a.pressPass=null;match.recoveries=(match.recoveries||0)+1;a.phase='won';controlAgain('Interception ! À toi de jouer.');return;}",
"if(a.pressPass){stepBall(a.ball,dt);if(hitPlayer(a.ball,h,.7,1.6)&&Math.hypot(a.ball.x-c.x,a.ball.z-c.z)>1.1){const dx=h.x-a.ball.x,dz=h.z-a.ball.z,l=Math.hypot(dx,dz)||1;a.ball.vx=dx/l*2.6;a.ball.vz=dz/l*2.6;a.ball.vy=0;a.pressPass=null;a.pressWon={t:0,msg:'Interception ! À toi de jouer.'};return;}"))

# 6 · le geste du joueur pendant le pressing
R.append((
"if(action.phase==='press'){const p=engine.groundAtScreen(e.clientX,e.clientY);if(p){action.runTarget=p;action.ready=false;action.started=true;}e.preventDefault();return;}",
"if(action.phase==='press'){const p=engine.groundAtScreen(e.clientX,e.clientY);if(p)pressTap(p);e.preventDefault();return;}"))

for old, new in R:
    n = src.count(old)
    assert n == 1, (n, old[:90])
    src = src.replace(old, new)
path.write_text(src, encoding='utf-8')
print('defense-patch : %d remplacements appliqués dans %s' % (len(R), path))
