"""Analyse d'un enregistrement observe.py : vitesses de rotation rendues, glissement des pieds (vitesse au sol rendue vs cadence de foulée), sauts de caméra.
Usage : python analyze_obs.py obs.json"""
import json, math, sys, collections
d = json.load(open(sys.argv[1])); R = d['rec']; fps = d.get('fps', 60); dt = 1 / fps
wrap = lambda a: math.atan2(math.sin(a), math.cos(a))
turn = []; slide = collections.Counter(); sl_ex = {}; treadmill = collections.Counter(); cam = []; turn_by_phase = collections.defaultdict(list)
frames = 0
for k in range(1, len(R)):
    a, b = R[k], R[k - 1]
    if a['id'] != b['id'] or a['fr'] or b['fr'] or len(a['pl']) != len(b['pl']): continue
    frames += 1
    cj = math.dist(a['cam'], b['cam']); cam.append((cj, a['ph'], a['i']))
    for p, q in zip(a['pl'], b['pl']):
        if not p or not q or p['n'] == 'gk': continue
        w = abs(wrap(p['rrot'] - q['rrot'])) * fps
        turn.append((w, p['n'], a['ph'], p['sp'], p['cel'])); turn_by_phase[a['ph']].append(w)
        v = math.hypot(p['rx'] - q['rx'], p['rz'] - q['rz']) * fps
        if p['ch'] is None and not p['cel']:
            if v > 1.5 and p['gait'] < 0.35 * v: slide[a['ph']] += 1; sl_ex.setdefault(a['ph'], (p['n'], round(v, 1), round(p['gait'], 2), p['sp']))
            if p['gait'] > 2 and v < 0.3 * p['gait']: treadmill[a['ph']] += 1
print('images analysables', frames)
turn.sort(reverse=True)
print('vitesse de rotation rendue : max %.1f rad/s (%d deg/s), p99 %.1f, p999 %.1f ; images > 12 rad/s : %d' % (turn[0][0], turn[0][0] * 57.3, turn[len(turn) // 100][0], turn[len(turn) // 1000][0], sum(1 for t in turn if t[0] > 12)))
print('  pires cas :', [(round(t[0], 1), t[1], t[2], t[3], t[4]) for t in turn[:5]])
print('glissement (vitesse rendue > 1.5 m/s et cadence de foulée < 35 %) par phase :', dict(slide), sl_ex)
print('course sur place (cadence > 2 et déplacement < 30 %) par phase :', dict(treadmill))
cam.sort(reverse=True); print('saut de caméra max par image : %.2f m (%s, image %d) ; > 1 m : %d ; > 3 m : %d' % (cam[0][0], cam[0][1], cam[0][2], sum(1 for c in cam if c[0] > 1), sum(1 for c in cam if c[0] > 3)))
print('pires sauts caméra :', [(round(c[0], 2), c[1], c[2]) for c in cam[:5]])

# écart entre la position LOGIQUE (ballon, collisions) et la position RENDUE (le personnage dessiné), joueurs en course (vitesse logique > 3 m/s)
lag = []
for r in R:
    if r['fr']: continue
    for p in r['pl']:
        if p and p['n'] != 'gk' and p['sp'] > 3 and p['ch'] is None:
            lag.append((math.hypot(p['x'] - p['rx'], p['z'] - p['rz']), p['n'], r['ph'], p['sp']))
if lag:
    lag.sort(reverse=True); L = [l[0] for l in lag]
    print('retard rendu/logique en course (>3 m/s) : médiane %.2f m, p90 %.2f m, max %.2f m sur %d échantillons ; > 0.3 m : %d (%.0f %%)' % (L[len(L)//2], L[len(L)//10], L[0], len(L), sum(1 for l in L if l > .3), 100 * sum(1 for l in L if l > .3) / len(L)))
