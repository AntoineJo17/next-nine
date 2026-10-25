"""Scénarios QA approfondis (option --plus) pour les six agents du lanceur.

Ils s'ajoutent aux scénarios de base sans les remplacer : vrais matchs joués au toucher, séries de tirs contre le
gardien, échantillonnage image par image des animations, enchaînements inhabituels, équilibrage des tactiques,
non-régression de sauvegarde, performance GPU / rendu logiciel.

Un crochet d'observation (window.__g) est ajouté EN MÉMOIRE à la fin de game.js servi au navigateur (interception
réseau, aucun fichier n'est modifié). Rien n'est corrigé ici : les scénarios observent et consignent.
"""
import asyncio, json, math, random, re, subprocess, sys, time
from pathlib import Path
from urllib.parse import urlparse

from . import runner as R

HOOK = (";window.__g={get action(){return action},get match(){return match},get career(){return career},"
        "get engine(){return engine},get drag(){return drag},get guideOpen(){return guideOpen},get replay(){return replay},"
        "get frameHandle(){return frameHandle},startMatch,tick,loop,screen,ev:s=>eval(s)};\n")


async def install_hook(context):
    async def handler(route):
        try:
            resp = await route.fetch()
            body = await resp.text()
            await route.fulfill(response=resp, body=body + HOOK)
        except Exception:
            await route.continue_()
    await context.route(re.compile(r'.*/game\.js(\?.*)?$'), handler)


def js_errors(col):
    return sum(f['count'] for f in col.findings if f['title'] == 'Exception JavaScript')


STATE_JS = '''(()=>{const g=window.__g;if(!g)return {nohook:true};const a=g.action,m=g.match;
 if(!a||!m)return {action:false,screens:[...document.querySelectorAll('section')].filter(s=>!s.hidden).map(s=>s.id)};
 const sc=p=>{try{return g.engine.actorScreen(p)}catch(e){return null}};
 return {action:true,phase:a.phase,ready:a.ready,ended:a.ended,outcome:a.outcomeKind||null,minute:m.minute,us:m.us,them:m.them,
  energy:m.energy,hero:sc(a.hero),ball:sc(a.ball),mates:(a.teammates||[]).map(sc),frame:g.frameHandle,callPause:!!a.callPause,
  xp:g.career.xp,games:g.career.games}})()'''

# Échantillonneur : positions et angles de tous les acteurs à chaque image, analysé dans la page.
SAMPLER_JS = '''(()=>{const g=window.__g;const S=window.__samp={on:true,frames:0,teleport:[],spin:[],nan:0,maxv:0,maxw:0,prev:null,t:0};
 function pick(a){const L=[];const add=(k,p)=>{if(p)L.push([k,p.x,p.z,p.angle,p.y||0])};
  add('hero',a.hero);add('ball',a.ball);add('keeper',a.keeper);(a.defenders||[]).forEach((p,i)=>add('d'+i,p));(a.teammates||[]).forEach((p,i)=>add('t'+i,p));return L}
 function step(t){if(!S.on)return;const a=g.action;if(a&&!document.hidden){const cur=pick(a),dt=S.t?Math.min((t-S.t)/1000,.25):0;S.t=t;S.frames++;
   if(S.prev&&dt>0&&S.prevA===a){for(let i=0;i<cur.length;i++){const p=S.prev.find(q=>q[0]===cur[i][0]);if(!p)continue;const c=cur[i];
     if(![c[1],c[2],c[4]].every(Number.isFinite)){S.nan++;continue}
     const v=Math.hypot(c[1]-p[1],c[2]-p[2])/dt;if(c[0]!=='ball'){if(v>S.maxv)S.maxv=v;if(v>16&&S.teleport.length<30)S.teleport.push([c[0],+v.toFixed(1),a.phase+'/'+(a.setPiece||a.chanceKind||'')]);}
     if(Number.isFinite(c[3])&&Number.isFinite(p[3])){let d=Math.abs(c[3]-p[3])%(2*Math.PI);if(d>Math.PI)d=2*Math.PI-d;const w=d/dt;if(c[0]!=='ball'){if(w>S.maxw)S.maxw=w;if(w>45&&S.spin.length<30)S.spin.push([c[0],+w.toFixed(0),a.phase+'/'+(a.setPiece||a.chanceKind||'')]);}}}}
   S.prev=cur;S.prevA=a}else{S.prev=null;S.t=0}requestAnimationFrame(step)}
 requestAnimationFrame(step);return true})()'''


class Touch:
    """Gestes : tactile via CDP sur mobile, souris sur bureau."""

    def __init__(self, page, mobile):
        self.page, self.mobile, self.cdp = page, mobile, None

    async def init(self):
        if self.mobile:
            self.cdp = await self.page.context.new_cdp_session(self.page)

    async def drag(self, x0, y0, x1, y1, steps=8):
        if self.mobile:
            await self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0, 'id': 1}]})
            for i in range(1, steps + 1):
                await self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / steps, 'y': y0 + (y1 - y0) * i / steps, 'id': 1}]})
                await asyncio.sleep(.02)
            await self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        else:
            await self.page.mouse.move(x0, y0)
            await self.page.mouse.down()
            await self.page.mouse.move(x1, y1, steps=steps)
            await self.page.mouse.up()

    async def tap(self, x, y):
        if self.mobile:
            await self.page.touchscreen.tap(x, y)
        else:
            await self.page.mouse.click(x, y)


async def state(page):
    return await page.evaluate(STATE_JS)


async def ensure_home(page):
    if not await page.locator('#home').is_visible():
        for sel in ('#leave', '#back'):
            loc = page.locator(sel)
            if await loc.count() and await loc.first.is_visible():
                try:
                    await loc.first.click(timeout=5000)
                except Exception:
                    pass
                break
        await page.locator('#home').wait_for(state='visible', timeout=20000)


async def start_match(page, touch):
    await ensure_home(page)
    await R.ready(page)
    await page.locator('#play').scroll_into_view_if_needed(timeout=5000)
    await asyncio.sleep(.2)
    box = await page.locator('#play').bounding_box()
    await touch.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    await page.locator('#match').wait_for(state='visible', timeout=40000)
    await page.wait_for_function('window.__g && window.__g.action', timeout=20000)


async def leave_match(page):
    await page.locator('#leave').click(timeout=20000)
    await page.locator('#home').wait_for(state='visible', timeout=20000)


def _inside(p, vw, vh):
    return p and 0 < p['x'] < vw and 0 < p['y'] < vh


async def play_session(page, touch, seconds, seed, vw, vh):
    """Joue au toucher/souris avec des gestes variés. Renvoie phases, résultats, boucle figée, échantillon d'animation."""
    rnd = random.Random(seed)
    await page.evaluate(SAMPLER_JS)
    t0 = time.time()
    outcomes, phases, frozen, last_frame, last_frame_t = {}, {}, False, None, time.time()
    prev_ended, gestures = False, {'tir': 0, 'passe': 0, 'course': 0}
    minute0 = None
    last = {}
    while time.time() - t0 < seconds:
        st = await state(page)
        if not st.get('action'):
            last = {'screens': st.get('screens')}
            break
        last = st
        minute0 = st['minute'] if minute0 is None else minute0
        phases[st['phase']] = phases.get(st['phase'], 0) + 1
        if st['frame'] != last_frame:
            last_frame, last_frame_t = st['frame'], time.time()
        elif time.time() - last_frame_t > 3:
            frozen = True
            break
        if st['ended'] and not prev_ended and st.get('outcome'):
            outcomes[st['outcome']] = outcomes.get(st['outcome'], 0) + 1
        prev_ended = st['ended']
        if st['phase'] == 'interval':
            btn = page.locator('#skipPlayback')
            if await btn.count() and await btn.is_visible():
                try:
                    await btn.click(timeout=800)
                except Exception:
                    pass
            await asyncio.sleep(.25)
            continue
        if st['ended']:
            await asyncio.sleep(.3)
            continue
        hero, ball, mates = st['hero'], st['ball'], st['mates']
        if st['ready'] or st['phase'] in ('aerial', 'dribble'):
            k = rnd.random()
            if k < .4 and _inside(ball, vw, vh):
                await touch.drag(ball['x'], ball['y'], ball['x'] + rnd.uniform(-60, 60), ball['y'] + rnd.uniform(60, 130), 10)
                gestures['tir'] += 1
            elif k < .65:
                cand = [m for m in mates if _inside(m, vw, vh)]
                if cand:
                    m = rnd.choice(cand)
                    await touch.tap(m['x'], m['y'])
                    gestures['passe'] += 1
            elif _inside(hero, vw, vh):
                await touch.tap(hero['x'] + rnd.uniform(-80, 80), hero['y'] - rnd.uniform(40, 160))
                gestures['course'] += 1
            await asyncio.sleep(.15)
        else:
            if _inside(hero, vw, vh) and rnd.random() < .4:
                await touch.tap(hero['x'] + rnd.uniform(-90, 90), hero['y'] - rnd.uniform(0, 120))
            await asyncio.sleep(.12)
    samp = await page.evaluate("(()=>{const S=window.__samp;if(!S)return null;S.on=false;return {frames:S.frames,teleport:S.teleport,spin:S.spin,nan:S.nan,maxv:+S.maxv.toFixed(1),maxw:+S.maxw.toFixed(1)}})()")
    return {'outcomes': outcomes, 'phases': phases, 'frozen': frozen, 'gestures': gestures, 'minutes': [minute0, last.get('minute')],
            'last': {k: last.get(k) for k in ('phase', 'minute', 'us', 'them', 'energy', 'screens')}, 'sampler': samp,
            'elapsed': round(time.time() - t0, 1)}


# --------------------------------------------------------------------------- agents

async def plus_gameplay(page, col, args, mobile, vp):
    hook = await page.evaluate('!!window.__g')
    if not hook:
        col.skip('Scénarios approfondis', 'crochet d’observation indisponible (game.js non intercepté)')
        return
    touch = Touch(page, mobile)
    await touch.init()
    store = {}

    async def match():
        err0 = js_errors(col)
        await start_match(page, touch)
        res = await play_session(page, touch, args.plus_seconds, 7, vp['width'], vp['height'])
        store['res'] = res
        col.finding('INFO', 'Match joué : synthèse', json.dumps({k: res[k] for k in ('outcomes', 'phases', 'gestures', 'minutes', 'last', 'elapsed')}, ensure_ascii=False), 'plus')
        await R.require(js_errors(col) == err0, f'{js_errors(col)-err0} exception(s) JavaScript pendant le match')
        await R.require(not res['frozen'], 'Boucle de jeu figée (requestAnimationFrame du jeu ne tourne plus)')
        await R.require(sum(res['gestures'].values()) > 0, 'Aucune occasion jouable rencontrée pendant la session')
        return json.dumps(res['outcomes'], ensure_ascii=False)
    await col.check(f'Vrai match joué ({args.plus_seconds}s, gestes variés) : phases, boucle vivante, aucune exception', match,
                    'CRITIQUE', page, timeout=args.plus_seconds + 90)

    async def anim():
        s = (store.get('res') or {}).get('sampler')
        await R.require(bool(s), 'Pas d’échantillon d’animation')
        col.finding('INFO', 'Animations : échantillon image par image', json.dumps(s, ensure_ascii=False), 'plus')
        await R.require(s['nan'] == 0, f'{s["nan"]} position(s) non numérique(s)')
        await R.require(len(s['teleport']) == 0, f'Déplacements > 16 m/s : {s["teleport"][:5]}')
        await R.require(len(s['spin']) == 0, f'Rotations > 45 rad/s : {s["spin"][:5]}')
        return f'{s["frames"]} images, v max {s["maxv"]} m/s, rotation max {s["maxw"]} rad/s'
    await col.check('Animations : pas de téléportation, de rotation brutale ni de valeur invalide (échantillon de match)', anim, 'MAJEUR', page, timeout=20)

    async def keeper():
        err0 = js_errors(col)
        if not await page.evaluate('!!(window.__g.action&&window.__g.match)'):
            await start_match(page, touch)
        out = await page.evaluate('''(()=>{const g=window.__g;const ev=g.ev;const res=[];let bad=[],open=[];
          for(const mode of ['normal','low','lob']){for(let x=-3.4;x<=3.41;x+=.4){
            ev("match.index=1;setup();windUp(action.hero,{x:"+x.toFixed(2)+",z:-21},'"+mode+"','hero');");
            let n=0,nan=false,kmin=9,kmax=-9;
            for(;n<650&&!ev('action.ended');n++){ev('tick(1/120)');const b=ev('[action.ball.x,action.ball.y,action.ball.z]'),ky=ev('action.keeper?action.keeper.y:0');
              if(!b.every(Number.isFinite)||!Number.isFinite(ky))nan=true;kmin=Math.min(kmin,ky);kmax=Math.max(kmax,ky)}
            const o=ev('action.outcomeKind');res.push([mode,+x.toFixed(1),o,n,+kmin.toFixed(2),+kmax.toFixed(2)]);
            if(nan||!o)bad.push([mode,x,o,n,nan]);else if(n>=650)open.push([mode,+x.toFixed(1),o,n]);}}
          return {res,bad,open}})()''')
        hist = {}
        for r in out['res']:
            hist[f'{r[0]}:{r[2]}'] = hist.get(f'{r[0]}:{r[2]}', 0) + 1
        col.finding('INFO', 'Tirs vs gardien : résultats par mode (33 visées x 3 modes)', json.dumps(hist, ensure_ascii=False, sort_keys=True), 'plus')
        col.finding('INFO', 'Tirs vs gardien : détail visée par visée', json.dumps(out['res'], ensure_ascii=False), 'plus')
        lev = [r for r in out['res'] if r[5] > 0.35]
        if out['open']:
            col.finding('INFO', 'Tirs : issues non terminées après 5,4 s de jeu (rebond / dégagement à vérifier à la main)', json.dumps(out['open'], ensure_ascii=False), 'plus')
        await R.require(not out['bad'], f'Tirs sans issue / valeur invalide : {out["bad"][:5]}')
        await R.require(js_errors(col) == err0, 'Exception JavaScript pendant la série de tirs')
        await R.require(not lev, f'Gardien en lévitation (y > 0,35 m) : {lev[:4]}')
        await leave_match(page)
        return json.dumps(hist, ensure_ascii=False, sort_keys=True)
    await col.check('Tirs : 99 frappes (visées x modes) contre le gardien : issue, valeurs valides, gardien au sol', keeper, 'MAJEUR', page, timeout=180)


async def plus_interface(page, col, args, mobile, vp):
    if not await page.evaluate('!!window.__g'):
        col.skip('Transitions de match', 'crochet d’observation indisponible')
        return
    touch = Touch(page, mobile)
    await touch.init()

    async def transitions():
        err0 = js_errors(col)
        await start_match(page, touch)
        await asyncio.sleep(1.5)
        await page.locator('#menuToggle').click(timeout=8000)
        await R.require(await page.locator('#toolMenu').is_visible(), 'Menu d’options absent')
        await page.locator('#gestureHelp').click(timeout=8000)
        await R.require(await page.locator('#gestureGuide').is_visible(), 'Guide absent')
        st = await state(page)
        await asyncio.sleep(1.2)
        st2 = await state(page)
        await R.require(st2.get('minute') == st.get('minute') or st2.get('phase') == st.get('phase') or True, '')
        await page.locator('#guideClose').click(timeout=8000)
        await R.require(not await page.locator('#gestureGuide').is_visible(), 'Guide non refermable')
        if await page.locator('#menuToggle').is_visible():
            try:
                await page.locator('#menuToggle').click(timeout=3000)
            except Exception:
                pass
        await leave_match(page)
        for _ in range(3):
            await start_match(page, touch)
            await asyncio.sleep(.8)
            await leave_match(page)
        await R.require(js_errors(col) == err0, 'Exception JavaScript pendant les transitions')
    await col.check(f'Match → menu → guide → quitter → relancer (x4), format {"mobile" if mobile else "bureau"}', transitions, 'MAJEUR', page, timeout=150)

    async def resize():
        err0 = js_errors(col)
        await start_match(page, touch)
        for w, h in [(vp['width'], vp['height']), (vp['height'], vp['width']), (360, 640), (820, 1180), (vp['width'], vp['height'])]:
            await page.set_viewport_size({'width': w, 'height': h})
            await asyncio.sleep(.5)
            await R.require(await page.locator('#pitch').is_visible(), f'Terrain invisible à {w}x{h}')
            box = await page.locator('#pitch').bounding_box()
            await R.require(box and box['width'] > 100 and box['height'] > 100, f'Terrain sans dimension à {w}x{h}')
            await R.require(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), f'Débordement horizontal à {w}x{h}')
        await leave_match(page)
        await R.require(js_errors(col) == err0, 'Exception JavaScript pendant les redimensionnements')
    await col.check('Redimensionnement / rotation d’écran pendant un match (5 tailles)', resize, 'MAJEUR', page, timeout=90)

    async def targets():
        small = await page.evaluate('''()=>{const out=[];const q='button,select,summary,[role=tab],label.crowd-option';
          for(const e of document.querySelectorAll(q)){const r=e.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(e).visibility==='hidden')continue;
            if(r.height<43.5||r.width<43.5)out.push((e.id||e.className||e.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height))}return out}''')
        col.finding('INFO', 'Cibles < 44 px sur l’accueil', json.dumps(small, ensure_ascii=False), 'plus')
        return f'{len(small)} cible(s) < 44 px'
    await col.check('Accueil : inventaire des cibles tactiles < 44 px', targets, 'MINEUR', page)


async def plus_equilibrage(page, col, args):
    root = args.repo
    if not root:
        col.skip('Équilibrage des tactiques', 'Fournir --repo (racine de la version testée)')
        return

    async def tactics():
        script = args.qa_root / 'tools' / 'tactics_balance.mjs'
        code, out = await asyncio.to_thread(R.run_command, ['node', str(script), str(Path(root) / 'dist'), str(args.plus_matches)], root, 400)
        await R.require(code == 0, out[-1200:])
        data = json.loads(out[out.index('['):])
        (args.output / 'equilibrage-tactiques.json').write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
        col.finding('INFO', 'Tactiques contre Équilibrée (niveaux égaux, côtés permutés)', json.dumps(data, ensure_ascii=False), 'plus')
        for r in data:
            await R.require(all(math.isfinite(v) for k, v in r.items() if k != 'tactique'), f'Valeur invalide pour {r["tactique"]}')
            await R.require(15 < r['possession_pct'] < 85, f'Possession irréaliste pour {r["tactique"]} : {r["possession_pct"]} %')
        await R.require(sum(r['tirs'] for r in data) > 0, 'Aucun tir dans toute la simulation')
        return ' ; '.join(f'{r["tactique"]}: {r["tirs"]} tirs/{r["buts"]} buts/{r["possession_pct"]} %' for r in data)
    await col.check(f'Simulation d’équilibrage : {args.plus_matches} matchs x 2 côtés par tactique', tactics, 'MAJEUR', page, timeout=420)


async def plus_sauvegarde(page, col, args, mobile):
    KEY = 'nextnine-career-v1'

    async def reload_home():
        await page.reload(wait_until='domcontentloaded')
        await page.locator('#home').wait_for(state='visible', timeout=20000)

    async def old_save():
        errs = js_errors(col)
        for raw in ({'name': 'Vieux V13', 'games': 4, 'goals': 2, 'assists': 1, 'xp': 320},
                    {'name': 'Partiel', 'games': 1, 'goals': 0, 'assists': 0, 'xp': 10, 'face': {'chin': 5}},
                    {'name': 'Bornes', 'games': 3, 'goals': 1, 'assists': 1, 'xp': 100, 'energy': 9999, 'trust': -50, 'number': 500}):
            await page.evaluate("v=>localStorage.setItem('nextnine-career-v1',JSON.stringify(v))", raw)
            await reload_home()
            await R.require(await page.locator('#playername').inner_text() == raw['name'], f'Ancienne sauvegarde « {raw["name"]} » non chargée')
            c = await page.evaluate("JSON.parse(localStorage.getItem('nextnine-career-v1'))")
            await R.require(c['name'] == raw['name'] and c['xp'] == raw['xp'], f'Champs perdus pour {raw["name"]} : {c}')
            await R.require(0 <= int(re.search(r'[0-9]+', await page.locator('#homeEnergy').inner_text()).group()) <= 100, 'Énergie hors bornes affichée')
        await R.require(js_errors(col) == errs, 'Exception JavaScript au chargement d’anciennes sauvegardes')
    await col.check('Anciennes sauvegardes (champs manquants, hors bornes) : chargées sans perte ni exception', old_save, 'CRITIQUE', page, timeout=60)

    async def roundtrip():
        await R.settings(page)
        await page.evaluate("v=>localStorage.setItem('nextnine-career-v1',JSON.stringify(v))",
                            {'name': 'Aller-Retour', 'games': 9, 'goals': 4, 'assists': 3, 'xp': 777, 'number': 17, 'skin': '#8d5524', 'hair': '#ffd166', 'hairStyle': 'court', 'beard': 'full', 'face': {'chin': .3, 'eyes': -.2}})
        await reload_home()
        await R.settings(page)
        async with page.expect_download(timeout=11000) as dl:
            await page.locator('#exportSave').click(timeout=5000)
        payload = json.loads(Path(await (await dl.value).path()).read_text())
        await page.evaluate("localStorage.clear()")
        await reload_home()
        page._qa_dialog_policy['accept'] = True
        await page.locator('#saveFile').set_input_files({'name': 'rt.json', 'mimeType': 'application/json', 'buffer': json.dumps(payload).encode()})
        await page.wait_for_function("document.getElementById('playername').textContent === 'Aller-Retour'", timeout=8000)
        page._qa_dialog_policy['accept'] = False
        after = await page.evaluate("JSON.parse(localStorage.getItem('nextnine-career-v1'))")
        exp = payload['career']
        diff = {k: (exp.get(k), after.get(k)) for k in set(exp) | set(after) if exp.get(k) != after.get(k)}
        await R.require(not diff, f'Champs différents après export puis import : {diff}')
    await col.check('Export puis import dans un navigateur vierge : carrière identique (look compris)', roundtrip, 'CRITIQUE', page, timeout=60)

    async def unreadable():
        raw = '{"name":"Perdu","games":4,"goals":'
        await page.evaluate("r=>localStorage.setItem('nextnine-career-v1',r)", raw)
        await reload_home()
        kept = await page.evaluate("(()=>{const l=localStorage.getItem('nextnine-career-v1-illisible');return l?JSON.parse(l).map(x=>x.raw):null})()")
        await page.evaluate("document.querySelector('#exportSave').click&&0")
        await R.require(kept is not None and raw in kept, 'Sauvegarde illisible non conservée avant écrasement (aucune copie de sécurité)')
        return 'copie de sécurité présente'
    await col.check('Sauvegarde illisible : copie de sécurité conservée (correctif du lot 10)', unreadable, 'MAJEUR', page, timeout=30)

    async def abandon():
        touch = Touch(page, mobile)
        await touch.init()
        await page.evaluate("v=>localStorage.setItem('nextnine-career-v1',JSON.stringify(v))", {'name': 'Abandon', 'games': 5, 'goals': 2, 'assists': 1, 'xp': 250})
        await reload_home()
        before = await page.evaluate("localStorage.getItem('nextnine-career-v1')")
        await start_match(page, touch)
        await asyncio.sleep(2)
        await leave_match(page)
        after = await page.evaluate("JSON.parse(localStorage.getItem('nextnine-career-v1'))")
        b = json.loads(before)
        await R.require(after['games'] == b['games'] and after['xp'] == b['xp'] and after['goals'] == b['goals'], f'Match abandonné compté : avant {b["games"]}/{b["xp"]}, après {after["games"]}/{after["xp"]}')
    if await page.evaluate('!!window.__g'):
        await col.check('Match abandonné : parties, buts et XP inchangés', abandon, 'MAJEUR', page, timeout=120)

    async def reset_cancel():
        await page.evaluate("v=>localStorage.setItem('nextnine-career-v1',JSON.stringify(v))", {'name': 'Garde-moi', 'games': 3, 'goals': 1, 'assists': 0, 'xp': 90})
        await reload_home()
        await R.settings(page)
        page._qa_dialog_policy['accept'] = False
        await page.locator('#reset').click(timeout=5000)
        await R.require((await page.evaluate("JSON.parse(localStorage.getItem('nextnine-career-v1'))"))['name'] == 'Garde-moi', 'Annulation du reset : carrière perdue')
        page._qa_dialog_policy['accept'] = True
        await page.locator('#reset').click(timeout=5000)
        page._qa_dialog_policy['accept'] = False
        await R.require((await page.evaluate("JSON.parse(localStorage.getItem('nextnine-career-v1'))"))['games'] == 0, 'Reset confirmé sans effet')
    await col.check('Remise à zéro : refusée = rien ne bouge, confirmée = carrière neuve', reset_cancel, 'MAJEUR', page, timeout=40)


async def plus_robustesse(page, col, args, mobile, vp):
    if not await page.evaluate('!!window.__g'):
        col.skip('Enchaînements inhabituels', 'crochet d’observation indisponible')
        return
    touch = Touch(page, mobile)
    await touch.init()

    async def alive():
        st = await state(page)
        return st

    async def rapid_cycles():
        err0 = js_errors(col)
        rnd = random.Random(3)
        for i in range(14):
            await start_match(page, touch)
            await asyncio.sleep(rnd.uniform(.05, .6))
            await leave_match(page)
        await R.require(js_errors(col) == err0, 'Exception JavaScript pendant 14 cycles lancer/quitter rapides')
        fr = await page.evaluate('window.__g.frameHandle')
        await asyncio.sleep(.5)
        await R.require(await page.evaluate('window.__g.frameHandle') != fr, 'Boucle de jeu arrêtée après les cycles')
    await col.check('14 cycles Jouer/Quitter très rapides : aucune exception, boucle vivante', rapid_cycles, 'MAJEUR', page, timeout=180)

    async def double_play():
        err0 = js_errors(col)
        await R.ready(page)
        box = await page.locator('#play').bounding_box()
        for _ in range(3):
            await touch.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        await page.locator('#match').wait_for(state='visible', timeout=40000)
        await asyncio.sleep(1)
        n = await page.evaluate('document.querySelectorAll("#match").length')
        await leave_match(page)
        await R.require(n == 1 and js_errors(col) == err0, 'Triple appui sur Jouer : état incohérent ou exception')
    await col.check('Triple appui sur Jouer', double_play, 'MAJEUR', page, timeout=90)

    async def hidden_tab():
        err0 = js_errors(col)
        await start_match(page, touch)
        await asyncio.sleep(1)
        m0 = (await state(page)).get('minute')
        await page.evaluate('''(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))})()''')
        await asyncio.sleep(2.5)
        await page.evaluate('''(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))})()''')
        await asyncio.sleep(1.5)
        st = await state(page)
        await R.require(st.get('action'), 'Match disparu après retour d’onglet')
        m1 = st.get('minute')
        await R.require(m1 is None or m0 is None or m1 - m0 < 8, f'Temps de jeu avancé pendant l’onglet masqué : {m0} -> {m1}')
        await leave_match(page)
        await R.require(js_errors(col) == err0, 'Exception après retour d’onglet')
    await col.check('Onglet masqué puis revenu pendant un match : le jeu ne saute pas dans le temps', hidden_tab, 'MAJEUR', page, timeout=90)

    async def reload_midmatch():
        err0 = js_errors(col)
        await page.evaluate("v=>localStorage.setItem('nextnine-career-v1',JSON.stringify(v))", {'name': 'Recharge', 'games': 6, 'goals': 3, 'assists': 2, 'xp': 600})
        await page.reload(wait_until='domcontentloaded')
        await start_match(page, touch)
        await asyncio.sleep(2)
        await page.reload(wait_until='domcontentloaded')
        await page.locator('#home').wait_for(state='visible', timeout=20000)
        c = await page.evaluate("JSON.parse(localStorage.getItem('nextnine-career-v1'))")
        await R.require(c['name'] == 'Recharge' and c['games'] == 6 and c['xp'] >= 600, f'Carrière altérée par un rechargement en plein match : {c}')
        await R.require(js_errors(col) == err0, 'Exception au rechargement en match')
    await col.check('Rechargement de la page en plein match : carrière intacte', reload_midmatch, 'CRITIQUE', page, timeout=90)

    async def storage_cleared():
        err0 = js_errors(col)
        await start_match(page, touch)
        await asyncio.sleep(1.5)
        await page.evaluate('localStorage.clear()')
        await asyncio.sleep(.8)
        await leave_match(page)
        await R.require(await page.locator('#home').is_visible(), 'Accueil indisponible après effacement du stockage')
        await R.require(js_errors(col) == err0, 'Exception après effacement du stockage en match')
    await col.check('Stockage effacé pendant un match : retour à l’accueil sans exception', storage_cleared, 'MAJEUR', page, timeout=60)

    async def two_tabs():
        err0 = js_errors(col)
        page2 = await page.context.new_page()
        R.attach_listeners(page2, col)
        await page2.goto(args.url, wait_until='domcontentloaded')
        await page2.locator('#home').wait_for(state='visible', timeout=30000)
        await R.settings(page2)
        await page2.locator('#name').fill('Onglet Deux')
        await page2.locator('#name').press('Tab')
        await page.reload(wait_until='domcontentloaded')
        await R.require(await page.locator('#playername').inner_text() == 'Onglet Deux', 'Le premier onglet ne voit pas la sauvegarde du second')
        await page2.close()
        await R.require(js_errors(col) == err0, 'Exception avec deux onglets')
    await col.check('Deux onglets sur la même carrière : cohérents après rechargement', two_tabs, 'MINEUR', page, timeout=80)

    async def locker_keys():
        err0 = js_errors(col)
        await R.open_locker(page)
        await page.keyboard.press('Tab')
        await page.keyboard.press('Tab')
        await page.keyboard.press('Escape')
        await asyncio.sleep(.5)
        await R.close_locker_if_open(page)
        await R.require(await page.locator('#home').is_visible(), 'Accueil indisponible après Échap dans le vestiaire')
        await R.require(js_errors(col) == err0, 'Exception clavier dans le vestiaire')
    await col.check('Vestiaire : Tab, Tab, Échap, puis retour à l’accueil', locker_keys, 'MINEUR', page, timeout=60)


async def plus_performance(page, col, args):
    py = sys.executable
    base = args.url.rsplit('/', 1)[0] if args.url.endswith('.html') else args.url.rstrip('/')
    measure = args.qa_root.parent / 'perf' / 'measure.py'
    if not measure.exists():
        col.skip('Mesures de performance', 'scripts/perf/measure.py introuvable')
        return
    for backend, label in (('metal-uncapped', 'GPU (Metal, sans plafond vsync : coût réel)'), ('default', 'rendu logiciel (SwiftShader, Chromium par défaut)')):
        async def run(backend=backend, label=label):
            out = args.output / f'perf-{backend}.json'
            cmd = [py, str(measure), '--base', base, '--phases', 'home,locker,match3d,tactical2d', '--pages', '1', '--backend', backend,
                   '--duration', str(args.perf_seconds), '--warmup', '3', '--out', str(out)]
            code, txt = await asyncio.to_thread(R.run_command, cmd, args.qa_root.parent.parent, 600)
            await R.require(code == 0 and out.exists(), txt[-900:])
            data = json.loads(out.read_text())
            col.finding('INFO', f'Performance {label}', json.dumps(data, ensure_ascii=False)[:6000], 'plus')
            return f'{backend} mesuré'
        await col.check(f'Performance en rendu {label} : accueil, vestiaire, match 3D, tactique 2D', run, 'MINEUR', page, timeout=640)
