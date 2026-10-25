"""NEXT NINE QA - orchestrateur durci.

Garanties : exécution en série par défaut, timeouts global/agent/test, journal
horodaté flush immédiat, rapport JSON partiel toujours écrit, statuts
PASS/FAIL/SKIP/INFRA distincts, sas de santé navigateur, capture réseau
(HTTP>=400 + requestfailed avec URL complète), contexte vierge par agent.
Ne modifie jamais le dépôt du jeu.
"""
import argparse
import asyncio
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import traceback
import urllib.error
import urllib.request
from urllib.parse import urlparse

from playwright.async_api import async_playwright

DEFAULT_URL = 'http://127.0.0.1:8771/'
AGENTS = ('gameplay', 'interface', 'equilibrage', 'sauvegarde', 'robustesse', 'performance')
SELFTESTS = ('selftest-slow', 'selftest-404')   # jamais lancés par défaut
LABELS = {'gameplay': 'Gameplay', 'interface': 'Interface & mobile', 'equilibrage': 'Équilibrage & carrière',
          'sauvegarde': 'Sauvegarde', 'robustesse': 'Robustesse', 'performance': 'Performance & moteur 3D',
          'selftest-slow': 'Auto-test : cas lent (preuve du timeout)',
          'selftest-404': 'Auto-test : capture d’une 404 (preuve de l’URL)'}
MOBILE_AGENTS = ('gameplay', 'interface', 'sauvegarde', 'robustesse', 'selftest-slow', 'selftest-404')
SEVERITY = {'CRITIQUE': 0, 'MAJEUR': 1, 'MINEUR': 2, 'ATTENTION': 3, 'INFO': 4}
# IDs créés dynamiquement (panel.innerHTML) : absents du HTML statique, normal.
DYNAMIC_IDS = {'flockName', 'flockCount', 'flockNumber'}
EXIT_PASS, EXIT_FAIL, EXIT_INFRA = 0, 1, 2


def now():
    return datetime.now(timezone.utc).astimezone().strftime('%H:%M:%S.%f')[:-3]


class Journal:
    """Journal horodaté, flush immédiat (écran + fichier)."""
    def __init__(self):
        self.fh = None

    def open(self, path):
        self.fh = open(path, 'a', encoding='utf-8', buffering=1)

    def log(self, msg):
        line = f'[{now()}] {msg}'
        print(line, flush=True)
        if self.fh:
            self.fh.write(line + '\n')
            self.fh.flush()


J = Journal()


class InfraError(Exception):
    """Problème d'infrastructure (navigateur, serveur), pas un défaut du jeu."""


class Collector:
    def __init__(self, agent, output, test_timeout):
        self.agent = agent
        self.output = output
        self.test_timeout = test_timeout
        self.findings = []
        self.tests = []
        self.network = {}
        self.screen_no = 0
        self.current = None
        self.status = 'RUNNING'
        self.started = time.time()
        self.duration = None
        self.on_change = lambda: None

    def finding(self, severity, title, detail, evidence='Automatique'):
        detail = str(detail)
        for f in self.findings:  # déduplication avec compteur
            if (f['severity'], f['title'], f['detail']) == (severity, title, detail):
                f['count'] += 1
                return
        self.findings.append({'severity': severity, 'title': title, 'detail': detail, 'evidence': evidence, 'count': 1})

    def net(self, kind, url, rtype, info):
        key = (kind, url, rtype, info)
        if key in self.network:
            self.network[key]['count'] += 1
            return
        self.network[key] = {'kind': kind, 'url': url, 'resource_type': rtype, 'info': info, 'count': 1}
        sev = 'MAJEUR' if kind == 'http' and rtype in ('document', 'script', 'stylesheet') else 'ATTENTION'
        self.finding(sev, f'Réponse réseau en erreur ({info})' if kind == 'http' else f'Requête échouée ({info})',
                     f'{rtype} {url}', 'Réseau')

    async def screenshot(self, page, label):
        if not page:
            return None
        try:
            self.screen_no += 1
            name = f'{self.agent}-{self.screen_no:02}-{label}.png'
            await page.screenshot(path=str(self.output / name), timeout=6000)
            return name
        except Exception:
            return None

    async def check(self, label, async_callable, severity='MAJEUR', page=None, timeout=None):
        self.current = label
        J.log(f'{self.agent} > début : {label}')
        t0 = time.time()
        try:
            detail = await asyncio.wait_for(async_callable(), timeout or self.test_timeout)
            self.tests.append({'name': label, 'status': 'PASS', 'detail': str(detail or '')[:400]})
            J.log(f'{self.agent} > PASS ({time.time()-t0:.1f}s) : {label}')
            self.on_change()
            return True
        except InfraError as e:
            self.tests.append({'name': label, 'status': 'INFRA', 'detail': str(e)[:550]})
            J.log(f'{self.agent} > INFRA : {label} : {e}')
            self.on_change()
            return False
        except asyncio.CancelledError:
            raise
        except Exception as e:
            msg = f'Timeout du test ({timeout or self.test_timeout}s)' if isinstance(e, asyncio.TimeoutError) else str(e)
            self.tests.append({'name': label, 'status': 'FAIL', 'detail': msg[:550]})
            shot = await self.screenshot(page, 'echec')
            self.finding(severity, label, msg[:550], shot or type(e).__name__)
            J.log(f'{self.agent} > FAIL ({time.time()-t0:.1f}s) : {label} : {msg[:200]}')
            self.on_change()
            return False

    def skip(self, title, reason):
        self.tests.append({'name': title, 'status': 'SKIP', 'detail': reason})
        J.log(f'{self.agent} > SKIP : {title} ({reason})')
        self.on_change()

    def compute_status(self):
        st = [t['status'] for t in self.tests]
        if 'INFRA' in st:
            return 'INFRA'
        if 'FAIL' in st:
            return 'FAIL'
        if 'PASS' in st:
            return 'PASS'
        return 'SKIP'

    def serialize(self):
        running = self.status == 'RUNNING'
        return {'agent': self.agent, 'title': LABELS[self.agent],
                'status': self.compute_status(), 'running': running,
                'duration_s': round(self.duration if self.duration is not None else time.time() - self.started, 1),
                'tests': self.tests, 'findings': self.findings, 'network': list(self.network.values())}


async def require(condition, message):
    if not condition:
        raise AssertionError(message)


async def require_proxy(awaitable, reason):
    await require(await awaitable, reason)


def attach_listeners(page, col):
    page.on('pageerror', lambda e: col.finding('MAJEUR', 'Exception JavaScript', str(e)[:450], 'Console navigateur'))

    def on_console(m):
        if m.type == 'error':
            loc = ''
            try:
                loc = (m.location or {}).get('url', '')
            except Exception:
                pass
            col.finding('ATTENTION', 'Erreur console', m.text[:450] + (f' [source: {loc}]' if loc else ''), 'Console navigateur')
    page.on('console', on_console)
    page.on('response', lambda r: col.net('http', r.url, r.request.resource_type, f'HTTP {r.status}') if r.status >= 400 else None)
    page.on('requestfailed', lambda r: col.net('failed', r.url, r.resource_type, str(r.failure or 'échec')))
    page._qa_dialog_policy = {'accept': False}
    page.on('dialog', lambda d: asyncio.ensure_future(d.accept() if page._qa_dialog_policy['accept'] else d.dismiss()))


async def fresh_page(context, collector, url):
    page = await context.new_page()
    attach_listeners(page, collector)
    await page.goto(url, wait_until='domcontentloaded', timeout=30000)
    return page


async def ready(page):
    await page.locator('#home').wait_for(state='visible', timeout=15000)
    await page.locator('#play').wait_for(state='visible')
    await page.wait_for_function("!document.querySelector('#play').disabled || document.querySelector('#engineStatus').textContent.includes('indisponible')", timeout=25000)
    await require(await page.locator('#play').is_enabled(), 'WebGL/Three.js non initialisé. État: ' + (await page.locator('#engineStatus').inner_text()))


async def settings(page):
    details = page.locator('details.home-settings')
    if not await details.evaluate('(el)=>el.open'):
        await details.locator('summary').first.click(timeout=5000)


async def scenario_gameplay(page, col):
    if not await col.check('Chargement du moteur de jeu / Three.js', lambda: ready(page), page=page, timeout=50):
        return
    await col.check('Entraînement disponible', lambda: require_proxy(page.locator('#practice').is_enabled(), 'Entraînement désactivé'), page=page)

    async def practice():
        t0 = time.time()
        await page.locator('#practice').click(timeout=40000)   # le thread principal peut être occupé par l'init 3D
        await page.locator('#match').wait_for(state='visible', timeout=30000)
        col.finding('INFO', 'Délai clic Entraînement > terrain visible', f'{time.time()-t0:.1f}s', 'chronométrage')
        await require(await page.locator('#pitch').is_visible(), 'Canvas du terrain absent')
        await require((await page.locator('#pitch').bounding_box() or {}).get('height', 0) > 100, 'Canvas sans hauteur')
    if await col.check('Entrer dans un entraînement et afficher le terrain', practice, page=page, timeout=80):
        async def gesture():
            rect = await page.locator('#pitch').bounding_box()
            if not rect:
                raise AssertionError('Terrain sans rectangle')
            x = rect['x'] + rect['width'] * .50
            y = rect['y'] + rect['height'] * .53
            await page.mouse.move(x, y)
            await page.mouse.down()
            await page.mouse.move(x + 12, y + 75, steps=8)
            await page.mouse.up()
            await page.wait_for_timeout(600)
            await require(await page.locator('#match').is_visible(), 'Le terrain a disparu après un geste')
        await col.check('Geste de tir/interaction sans plantage du match', gesture, 'MINEUR', page)

        async def leave():
            await page.locator('#leave').click(timeout=15000)
            await page.locator('#home').wait_for(state='visible', timeout=20000)
        await col.check('Quitter un entraînement et revenir à l’accueil', leave, page=page, timeout=50)

    async def match():
        t0 = time.time()
        await page.locator('#play').click(timeout=40000)
        await page.locator('#match').wait_for(state='visible', timeout=30000)
        col.finding('INFO', 'Délai clic Entrer sur le terrain > match visible', f'{time.time()-t0:.1f}s', 'chronométrage')
        await require(bool((await page.locator('#score').inner_text()).strip()), 'Score absent')
        await require(bool((await page.locator('#energyValue').inner_text()).strip()), 'Énergie absente')
    if await col.check('Démarrer un véritable match et afficher HUD/score', match, page=page, timeout=80):
        async def menu():
            await page.locator('#menuToggle').click(timeout=5000)
            await require(await page.locator('#toolMenu').is_visible(), 'Options du match masquées')
            await page.locator('#gestureHelp').click(timeout=5000)
            await require(await page.locator('#gestureGuide').is_visible(), 'Guide des gestes absent')
            await page.locator('#guideClose').click(timeout=5000)
            await require(not await page.locator('#gestureGuide').is_visible(), 'Guide non refermable')
        await col.check('Ouvrir les options et consulter/fermer le guide des gestes', menu, 'MINEUR', page)


async def close_locker_if_open(page):
    if await page.locator('#locker').is_visible():
        # « Retour » demande confirmation si le look a changé : on accepte (abandon des essais).
        before = page._qa_dialog_policy['accept']
        page._qa_dialog_policy['accept'] = True
        try:
            await page.locator('#lockerBack').click(timeout=5000)
            await page.locator('#locker').wait_for(state='hidden', timeout=6000)
        finally:
            page._qa_dialog_policy['accept'] = before


async def open_locker(page):
    await close_locker_if_open(page)
    await settings(page)
    await page.locator('#openLocker').click(timeout=8000)
    await page.locator('#locker').wait_for(state='visible', timeout=15000)


async def recover(page):
    """Après un échec : referme le vestiaire pour ne pas contaminer les tests suivants."""
    try:
        await asyncio.wait_for(close_locker_if_open(page), 15)
    except BaseException:
        pass


async def scenario_interface(page, col):
    await col.check('Accueil accessible et identité visibles', lambda: require_proxy(page.locator('#playername').is_visible(), 'Nom du joueur invisible'), page=page)

    async def forms():
        await settings(page)
        await page.locator('details.customize summary').click(timeout=5000)
        options = await page.locator('#position option').count()
        await require(options == 3, f'{options} postes disponibles au lieu de trois')
        await require(await page.locator('#tactic option').count() == 4, 'Choix tactiques incomplets')
    await col.check('Profil : trois postes et quatre tactiques', forms, 'MINEUR', page)

    async def locker():
        await open_locker(page)
        await page.locator('#lockerDone').click(timeout=40000)
        await require(not await page.locator('#locker').is_visible(), 'Vestiaire bloqué ouvert')
    await col.check('Personnalisation : ouvrir/fermer le vestiaire', locker, 'MINEUR', page, timeout=40)
    await recover(page)

    async def flock():
        await open_locker(page)
        # Créés dynamiquement par panel.innerHTML : absents tant que l'onglet Maillot n'est pas ouvert.
        await require(await page.locator('#flockName').count() == 0, 'flockName présent avant ouverture de l’onglet Maillot (attendu: dynamique)')
        await page.locator('.locker-tabs button[data-tab="maillot"]').click(timeout=5000)
        for ident in ('flockName', 'flockCount', 'flockNumber'):
            await page.locator('#' + ident).wait_for(state='attached', timeout=5000)
            await require(await page.locator('#' + ident).is_visible(), f'#{ident} non visible dans l’onglet Maillot')
        await page.locator('#flockName').fill('Zidane')
        await require('Maximum 14' in await page.locator('#flockCount').inner_text(), 'Compteur flockCount inattendu pour un nom court')
        await page.locator('#flockName').fill('A' * 18)
        await require('14 premières' in await page.locator('#flockCount').inner_text(), 'Avertissement des 14 lettres absent pour 18 caractères')
        await page.locator('#flockNumber').fill('12')
        await page.locator('#flockNumber').press('Tab')
        await require(await page.locator('#lockerName').inner_text() == '12', 'Numéro 12 non répercuté dans #lockerName')
        await page.locator('#flockNumber').fill('150')
        await page.locator('#flockNumber').press('Tab')
        await require(await page.locator('#flockNumber').input_value() == '99', 'Numéro non borné à 99')
        await close_locker_if_open(page)  # annule les essais (accepte la confirmation d'abandon)
    await col.check('Vestiaire > onglet Maillot : flockName / flockCount / flockNumber (IDs dynamiques)', flock, 'MAJEUR', page, timeout=60)
    await recover(page)

    async def narrow_screen():
        o = await page.evaluate('() => ({w:document.documentElement.scrollWidth,v:innerWidth})')
        await require(o['w'] <= o['v'] + 6, f'Débordement horizontal de {o["w"]-o["v"]} px sur mobile')
    await col.check('Interface mobile : pas de débordement horizontal', narrow_screen, 'MINEUR', page)

    async def desktop():
        orig = page.viewport_size
        await page.set_viewport_size({'width': 1366, 'height': 768})
        try:
            o = await page.evaluate('() => ({w:document.documentElement.scrollWidth,v:innerWidth})')
            await require(o['w'] <= o['v'] + 6, 'Débordement horizontal en vue bureau')
        finally:
            await page.set_viewport_size(orig or {'width': 390, 'height': 844})
    await col.check('Interface bureau : pas de débordement horizontal', desktop, 'MINEUR', page)

    async def toggles():
        # Interaction robuste : clic sur le label (cible tactile réelle) puis vérification de l'état.
        box = page.locator('#crowdToggle')
        label = page.locator('label.crowd-option:has(#crowdToggle)')
        original = await box.is_checked()
        await label.click(timeout=5000)
        await require(await box.is_checked() != original, 'Option du public non modifiée par le clic sur son label')
        await label.click(timeout=5000)
        await require(await box.is_checked() == original, 'Option du public non rétablie au second clic')
    await col.check('Option public activable et réversible (clic label.crowd-option)', toggles, 'MINEUR', page, timeout=20)


async def scenario_equilibrage(page, col, args):
    async def invariant():
        vals = await page.evaluate('''() => Object.fromEntries(['overall','homeEnergy','trust','games','goals','assists'].map(k=>[k,document.getElementById(k)?.textContent.trim()]))''')
        for id_ in ('homeEnergy', 'trust'):
            v = float(re.search(r'[0-9]+', vals[id_]).group())
            await require(0 <= v <= 100, f'{id_} hors borne: {v}')
        for id_ in ('games', 'goals', 'assists'):
            await require(int(vals[id_]) >= 0, id_ + ' négatif')
    await col.check('Carrière : statistiques initiales bornées', invariant, 'MAJEUR', page)

    async def matrix():
        for pos in ['BU', 'AIL', 'MOC']:
            await settings(page)
            if not await page.locator('details.customize').evaluate('(el)=>el.open'):
                await page.locator('details.customize summary').click(timeout=5000)
            await page.locator('#position').select_option(pos, timeout=5000)
            await page.reload(wait_until='domcontentloaded')
            await require(await page.locator('#position').input_value() == pos, f'Poste {pos} perdu à la recharge')
        for tact in ['equilibre', 'pressing', 'contre', 'possession']:
            await page.locator('#tactic').select_option(tact, timeout=5000)
            await page.reload(wait_until='domcontentloaded')
            await require(await page.locator('#tactic').input_value() == tact, f'Tactique {tact} perdue à la recharge')
    await col.check('Matrice carrière : 3 postes + 4 tactiques persistent', matrix, 'MAJEUR', page, timeout=90)
    if args.repo:
        async def model():
            code, out = await asyncio.to_thread(run_command, ['node', str(args.qa_root / 'tools/analyze_career.mjs'), str(args.repo)], args.repo, 90)
            await require(code == 0, out[-1700:])
            return out[-400:]
        await col.check('Analyse de propriétés du vrai moteur de carrière (2400+ cas)', model, 'MAJEUR', page, timeout=100)
    else:
        col.skip('Tests mathématiques directs du moteur de carrière', 'Fournir --repo /chemin/vers/next-nine')


async def scenario_sauvegarde(page, col):
    await settings(page)
    name = 'NEXT NINE QA'

    async def persist():
        await page.locator('#name').fill(name, timeout=5000)
        await page.locator('#name').press('Tab')
        await page.reload(wait_until='domcontentloaded')
        await require(await page.locator('#name').input_value() == name, 'Nom perdu après recharge')
        stored = await page.evaluate("JSON.parse(localStorage.getItem('nextnine-career-v1') || 'null')")
        await require(stored and stored.get('name') == name, 'Sauvegarde navigateur incohérente')
    if not await col.check('Nom sauvegardé et restauré après actualisation', persist, page=page):
        return

    async def exported():
        await settings(page)
        async with page.expect_download(timeout=11000) as dl:
            await page.locator('#exportSave').click(timeout=5000)
        download = await dl.value
        payload = json.loads(Path(await download.path()).read_text())
        await require(payload.get('format') == 'next-nine', 'Format export incorrect')
        await require(payload.get('career', {}).get('name') == name, 'Export différent de la sauvegarde')
    await col.check('Exporter une carrière JSON cohérente', exported, page=page)

    async def cancel_reset():
        page._qa_dialog_policy['accept'] = False
        await page.locator('#reset').click(timeout=5000)
        await require(await page.locator('#playername').inner_text() == name, 'Une annulation a effacé le joueur')
    await col.check('Annuler une remise à zéro sans perdre la carrière', cancel_reset, 'MAJEUR', page)

    async def import_save():
        incoming = {'format': 'next-nine', 'version': 1, 'career': {'name': 'IMPORT QA', 'games': 2, 'goals': 1, 'assists': 0, 'xp': 45}}
        page._qa_dialog_policy['accept'] = True
        await page.locator('#saveFile').set_input_files({'name': 'qa-test.json', 'mimeType': 'application/json', 'buffer': json.dumps(incoming).encode()})
        await page.wait_for_function("document.getElementById('playername').textContent === 'IMPORT QA'", timeout=6000)
        page._qa_dialog_policy['accept'] = False
        await page.reload(wait_until='domcontentloaded')
        await require(await page.locator('#playername').inner_text() == 'IMPORT QA', 'Import perdu après recharge')
    await col.check('Importer une carrière valide et la conserver', import_save, 'MAJEUR', page)


async def scenario_robustesse(page, col):
    async def corrupt():
        await page.evaluate("localStorage.setItem('nextnine-career-v1', '{not JSON')")
        await page.reload(wait_until='domcontentloaded')
        await page.locator('#home').wait_for(state='visible', timeout=10000)
        await require(bool((await page.locator('#playername').inner_text()).strip()), 'Écran cassé après sauvegarde corrompue')
    await col.check('Résister à une sauvegarde JSON malformée', corrupt, page=page)

    async def injections():
        await settings(page)
        trial = '<img src=x>'
        await page.locator('#name').fill(trial[:20], timeout=5000)
        await page.locator('#name').press('Tab')
        await require(await page.locator('#playername').inner_text() == trial[:20], 'Affichage du pseudo inattendu')
        count = await page.locator('#playername img').count()
        await require(count == 0, 'Injection HTML possible dans le nom du joueur')
    await col.check('Pseudo affiché comme texte, pas comme HTML', injections, 'CRITIQUE', page)

    async def rapid():
        for i in range(16):
            await page.locator('#tactic').select_option(['equilibre', 'pressing', 'contre', 'possession'][i % 4], timeout=5000)
            await page.locator('label.crowd-option:has(#soundHome)').click(timeout=5000)
        await page.reload(wait_until='domcontentloaded')
        await require(await page.locator('#home').is_visible(), 'Écran figé après changements répétés')
    await col.check('Changements de tactique et de son répétés', rapid, 'MINEUR', page, timeout=90)


async def scenario_performance(page, col):
    async def timing():
        t = await page.evaluate('''() => {const n=performance.getEntriesByType('navigation')[0];return {dcl:n?.domContentLoadedEventEnd||0,load:n?.loadEventEnd||0,transferred:n?.transferSize||0}}''')
        await require(t['dcl'] >= 0, 'Navigation chronométrique absente')
        col.finding('INFO', 'Temps de chargement', json.dumps(t, ensure_ascii=False), 'performance.navigation')
        if t['dcl'] > 5000:
            col.finding('ATTENTION', 'Chargement lent > 5 secondes', str(t), 'performance.navigation')
    await col.check('Mesurer le chargement de la page', timing, 'MINEUR', page)

    async def sample_fps():
        result = await page.evaluate('''() => new Promise(resolve=>{let n=0, start=performance.now();
          function tick(t){n++;if(t-start>2100)resolve(Math.round((n-1)*1000/(t-start)));else requestAnimationFrame(tick)} requestAnimationFrame(tick);
        })''')
        await require(result > 0, 'Aucune frame navigateur produite')
        col.finding('INFO', 'Fréquence de rafraîchissement approximative', f'{result} FPS (rAF navigateur, pas FPS Three.js)', 'requestAnimationFrame')
        if result < 24:
            col.finding('ATTENTION', 'Rafraîchissement navigateur bas', f'{result} FPS ; vérifier sur téléphone physique', 'Mesure indicative')
    await col.check('Mesurer le rafraîchissement navigateur sur deux secondes', sample_fps, 'MINEUR', page, timeout=20)

    async def webgl():
        g = await page.evaluate('''() => {const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'));}''')
        await require(g, 'WebGL indisponible dans ce navigateur')
    await col.check('Disponibilité WebGL', webgl, 'MAJEUR', page)

    async def page_assets():
        count = await page.evaluate("performance.getEntriesByType('resource').length")
        await require(count > 0, 'Aucune ressource chargée')
        return f'{count} ressources'
    await col.check('Chargement des ressources', page_assets, 'MINEUR', page)


async def scenario_selftest_slow(page, col):
    async def slow():
        await asyncio.sleep(3600)   # volontairement bloqué : doit être coupé par le timeout
    ok = await col.check('Cas volontairement lent (le timeout du test doit le couper)', slow, 'INFO', None, timeout=6)
    if not ok and col.tests[-1]['detail'].startswith('Timeout du test'):
        # Échec attendu : c'est la preuve que le timeout fonctionne.
        col.tests[-1]['status'] = 'PASS'
        col.tests[-1]['detail'] = 'Coupé comme prévu : ' + col.tests[-1]['detail']
        col.findings[:] = [f for f in col.findings if f['title'] != col.tests[-1]['name']]
    async def after():
        await asyncio.sleep(0.2)
        return 'la suite s’exécute normalement après un timeout'
    await col.check('Test suivant exécuté après le timeout', after, 'INFO')


async def scenario_selftest_404(page, col):
    async def force404():
        await page.evaluate("""() => { const i = new Image(); i.src = '/__qa_forced_404__.png?x=1'; document.body.appendChild(i);
                                     return fetch('/__qa_forced_404_fetch__.json').catch(()=>0); }""")
        await page.wait_for_timeout(1200)
        urls = [n['url'] for n in col.network.values() if n['kind'] == 'http']
        await require(any(u.endswith('/__qa_forced_404__.png?x=1') for u in urls), f'URL 404 complète non capturée : {urls}')
        await require(any(u.endswith('/__qa_forced_404_fetch__.json') for u in urls), 'URL 404 (fetch) non capturée')
        types = {n['resource_type'] for n in col.network.values() if n['kind'] == 'http'}
        return f'URLs capturées: {urls} ; types: {sorted(types)}'
    await col.check('Une 404 forcée est capturée avec URL complète + type de ressource', force404, 'MAJEUR', page, timeout=20)


class IdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k == 'id':
                self.ids.append(v)


def run_command(cmd, cwd, timeout):
    try:
        p = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, timeout=timeout, check=False)
        return p.returncode, p.stdout + '\n' + p.stderr
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        return 127, str(e)


async def code_audit(col, args):
    repo = args.repo
    if not repo:
        col.skip('Audit du code et tests Node existants', 'Fournir --repo /chemin/vers/next-nine')
        return

    async def layout():
        required = ['package.json', 'dist/index.html', 'dist/game.js', 'dist/engine.js', 'dist/career.js']
        missing = [x for x in required if not (repo / x).is_file()]
        await require(not missing, 'Fichiers manquants: ' + ', '.join(missing))
    if not await col.check('Vérifier les fichiers source du dépôt', layout):
        return

    async def ids():
        parser = IdParser()
        parser.feed((repo / 'dist/index.html').read_text(encoding='utf-8'))
        dup = sorted({x for x in parser.ids if parser.ids.count(x) > 1})
        await require(not dup, 'IDs HTML dupliqués: ' + ', '.join(dup[:20]))
        source = (repo / 'dist/game.js').read_text(encoding='utf-8')
        refs = set(re.findall(r"\$\(['\"]([A-Za-z][A-Za-z0-9_-]*)['\"]\)", source))
        missing = sorted(refs - set(parser.ids) - DYNAMIC_IDS)
        if missing:
            col.finding('ATTENTION', 'Sélecteurs JS sans ID statique HTML', ', '.join(missing[:60]), 'Revue manuelle requise')
        return f'{len(parser.ids)} IDs HTML, {len(refs)} références JS analysées (IDs dynamiques connus ignorés: {", ".join(sorted(DYNAMIC_IDS))})'
    await col.check('Cohérence HTML / sélecteurs JavaScript', ids, 'MINEUR')

    if args.npm_check:
        async def baseline():
            code, out = await asyncio.to_thread(run_command, ['npm', 'run', 'check'], repo, 600)
            await require(code == 0, out[-3500:])
            return out[-950:]
        await col.check('Exécuter la suite officielle npm run check', baseline, 'MAJEUR', timeout=620)
    else:
        col.skip('Suite officielle npm run check', 'Option --npm-check non fournie (suite longue)')

    async def imports():
        source = (repo / 'dist/game.js').read_text(encoding='utf-8')
        paths = re.findall(r"from\s*['\"](\./[^'\"]+)['\"]", source)
        missing = [rel.split('?', 1)[0] for rel in paths if not (repo / 'dist' / rel.split('?', 1)[0]).exists()]
        await require(not missing, 'Imports locaux introuvables : ' + ', '.join(missing))
        return f'{len(paths)} imports inspectés'
    await col.check('Résolution des imports internes du jeu', imports, 'MAJEUR')


SCENARIOS = {'gameplay': scenario_gameplay, 'interface': scenario_interface, 'sauvegarde': scenario_sauvegarde,
             'robustesse': scenario_robustesse, 'performance': scenario_performance,
             'selftest-slow': scenario_selftest_slow, 'selftest-404': scenario_selftest_404}


def viewport_for(agent, device):
    mobile = (agent in MOBILE_AGENTS) if device == 'mixte' else (device == 'mobile')
    return mobile, ({'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800})


async def agent_body(agent, browser, args, col):
    mobile, vp = viewport_for(agent, args.device)
    # Contexte vierge : aucun profil, aucun stockage partagé.
    context = await browser.new_context(viewport=vp, device_scale_factor=1, is_mobile=mobile, has_touch=mobile, accept_downloads=True)
    page = None
    try:
        page = await fresh_page(context, col, args.url)
        if agent == 'equilibrage':
            await scenario_equilibrage(page, col, args)
        else:
            await SCENARIOS[agent](page, col)
        if agent == 'robustesse':
            await code_audit(col, args)
        if args.ai:
            from .brain import explore
            await explore(page, agent, col.finding, args.ai_steps)
        if page and args.screenshots:
            try:
                await page.screenshot(path=str(args.output / f'{agent}-final.png'), timeout=8000, full_page=True)
            except Exception:
                pass
    except asyncio.CancelledError:
        # timeout d'agent : preuve visuelle si possible, puis on laisse l'annulation se propager
        shot = None
        if page:
            try:
                shot = await asyncio.wait_for(col.screenshot(page, 'timeout'), 4)
            except BaseException:
                pass
        col.tests.append({'name': col.current or 'Scénario', 'status': 'FAIL', 'detail': 'Interrompu (timeout agent/global)'})
        col.finding('CRITIQUE', 'Agent interrompu par timeout', f'Dernier test: {col.current}', shot or 'Agent')
        raise
    except Exception as exc:
        shot = await col.screenshot(page, 'exception')
        col.finding('CRITIQUE', 'Exécution interrompue', f'{type(exc).__name__}: {exc}', shot or 'Agent')
        col.tests.append({'name': 'Initialisation ou scénario', 'status': 'FAIL', 'detail': traceback.format_exc()[-1000:]})
    finally:
        try:
            await asyncio.wait_for(context.close(), 8)
        except BaseException:
            pass


async def run_agent(agent, browser, args, state):
    col = Collector(agent, args.output, args.test_timeout)
    state['collectors'].append(col)
    col.on_change = state['flush']
    J.log(f'=== Agent {agent} : début (timeout {args.agent_timeout}s) ===')
    try:
        await asyncio.wait_for(agent_body(agent, browser, args, col), args.agent_timeout)
    except asyncio.TimeoutError:
        J.log(f'=== Agent {agent} : TIMEOUT ===')
    except asyncio.CancelledError:
        col.status = 'DONE'
        col.duration = time.time() - col.started
        raise
    col.status = 'DONE'
    col.duration = time.time() - col.started
    (args.output / f'agent-{agent}.json').write_text(json.dumps(col.serialize(), ensure_ascii=False, indent=2), encoding='utf-8')
    c = lambda s: sum(t['status'] == s for t in col.tests)
    J.log(f'=== Agent {agent} : {col.compute_status()} - {c("PASS")} OK, {c("FAIL")} échecs, {c("INFRA")} infra, {len(col.findings)} observations ({col.duration:.0f}s) ===')
    state['flush']()


def overall(state):
    sts = [c.compute_status() for c in state['collectors']]
    if state.get('infra'):
        return 'INFRA'
    if 'FAIL' in sts or state.get('interrupted'):
        return 'FAIL'
    if 'INFRA' in sts:
        return 'INFRA'
    return 'PASS' if 'PASS' in sts else 'SKIP'


def write_report(state, args, final=False):
    out = args.output
    data = [c.serialize() for c in state['collectors']]
    all_tests = [t for r in data for t in r['tests']]
    count = lambda s: sum(t['status'] == s for t in all_tests)
    summary = {'passed': count('PASS'), 'failed': count('FAIL'), 'skipped': count('SKIP'), 'infra': count('INFRA'),
               'observations': sum(len(r['findings']) for r in data)}
    doc = {'complete': bool(final and not state.get('interrupted')), 'status': overall(state), 'url': args.url, 'browser': args.browser,
           'device': args.device, 'headless': not args.headed, 'date': datetime.now(timezone.utc).isoformat(),
           'elapsed_s': round(time.time() - state['t0'], 1), 'load_avg_start': state.get('load0'), 'load_avg_now': [round(x, 1) for x in os.getloadavg()], 'infra': state.get('infra'), 'interrupted': state.get('interrupted'),
           'summary': summary, 'agents': data}
    tmp = out / 'rapport.json.tmp'
    tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(tmp, out / 'rapport.json')
    if final:
        render_html(doc, out)
    return doc


def render_html(doc, out):
    css = '''body{font:15px system-ui,sans-serif;background:#101c19;color:#e6f2ec;margin:0;padding:28px;line-height:1.5}main{max-width:1120px;margin:auto}
      small{color:#a2b3ae}.agent,.issue{background:#1b2c26;border:1px solid #345148;border-radius:12px;padding:15px;margin:9px 0}
      .PASS{color:#78d6a8}.FAIL{color:#ffaeaa}.SKIP{color:#ddb879}.INFRA{color:#9ad7ff}.pre{white-space:pre-wrap;word-break:break-word;font-size:12px}'''
    cards = []
    for a in doc['agents']:
        li = ''.join(f'<li><b class="{t["status"]}">{t["status"]}</b> {escape(t["name"])} <small>{escape(t["detail"])}</small></li>' for t in a['tests'])
        net = ''.join(f'<li><small>{escape(n["kind"])} {escape(n["info"])} · {escape(n["resource_type"])} · {escape(n["url"])} · x{n["count"]}</small></li>' for n in a['network'])
        cards.append(f'<section class="agent"><h3>{escape(a["title"])} <span class="{a["status"]}">{a["status"]}</span></h3><ul>{li}</ul>{"<b>Réseau</b><ul>"+net+"</ul>" if net else ""}</section>')
    issues = sorted(((r['title'], f) for r in doc['agents'] for f in r['findings']), key=lambda v: SEVERITY.get(v[1]['severity'], 5))
    ih = ''.join(f'<section class="issue"><b>{escape(f["title"])}</b> [{escape(f["severity"])}] x{f["count"]}<br><small>{escape(s)} · {escape(f["evidence"])}</small><p class="pre">{escape(f["detail"])}</p></section>' for s, f in issues)
    infra = f'<p class="INFRA">INFRA : {escape(str(doc["infra"]))}</p>' if doc.get('infra') else ''
    interrupted = f'<p class="FAIL">Interrompu : {escape(str(doc["interrupted"]))}</p>' if doc.get('interrupted') else ''
    (out / 'rapport.html').write_text(f'<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>NEXT NINE QA</title><style>{css}</style></head><body><main><h1>Rapport QA : {doc["status"]}</h1><small>{doc["date"]} · {escape(doc["url"])} · {doc["browser"]} · {doc["device"]} · {doc["summary"]}</small>{infra}{interrupted}{"".join(cards)}<h2>Observations</h2>{ih or "<p>Aucune.</p>"}<p><small>Une observation est un symptôme, pas une preuve de bug.</small></p></main></body></html>', encoding='utf-8')


def probe_url(url, timeout=6):
    """Joignabilité HTTP de l'URL (sans navigateur). Retourne (ok, détail)."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'nextnine-qa'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return True, f'HTTP {r.status}'
    except urllib.error.HTTPError as e:
        return True, f'HTTP {e.code}'   # le serveur répond : le jeu décidera
    except Exception as e:
        return False, f'{type(e).__name__}: {e}'


async def health_gate(p, args):
    """Lance le navigateur + new_page avec timeout. Retourne le browser ou lève InfraError."""
    kwargs = {'headless': not args.headed}
    if args.browser == 'chromium' and args.gl == 'swiftshader':
        kwargs['args'] = ['--enable-webgl', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
    if args.browser == 'chromium':
        kwargs.setdefault('args', [])
        kwargs['args'] += list(args.chromium_arg or [])
        if args.chromium_path:
            kwargs['executable_path'] = str(args.chromium_path)
    step = 'launch'
    try:
        browser = await asyncio.wait_for(getattr(p, args.browser).launch(**kwargs), args.health_timeout)
        J.log(f'Sas de santé : {args.browser} lancé (version {browser.version})')
        step = 'new_context'
        ctx = await asyncio.wait_for(browser.new_context(), args.health_timeout)
        step = 'new_page'
        page = await asyncio.wait_for(ctx.new_page(), args.health_timeout)
        step = 'about:blank'
        await asyncio.wait_for(page.goto('about:blank'), args.health_timeout)
        await asyncio.wait_for(ctx.close(), args.health_timeout)
        J.log('Sas de santé : OK')
        return browser
    except Exception as e:
        cause = (f'{args.browser} : étape "{step}" sans réponse en {args.health_timeout}s' if isinstance(e, asyncio.TimeoutError)
                 else f'{args.browser} : étape "{step}" en erreur : {type(e).__name__}: {str(e)[:300]}')
        raise InfraError(cause + ' (problème d’infrastructure du navigateur, pas du jeu)')


async def arun(args, state):
    args.output.mkdir(parents=True, exist_ok=True)
    J.open(args.output / 'journal.log')
    J.log(f'Charge machine (load avg 1/5/15 min) : {state.get("load0")} ; une charge supérieure au nombre de coeurs rend les tests 3D lents (timeouts possibles, non imputables au jeu)')
    J.log(f'NEXT NINE QA : url={args.url} browser={args.browser} device={args.device} headless={not args.headed} parallel={args.parallel} agents={args.agents}')
    write_report(state, args)
    ok, detail = probe_url(args.url)
    if not ok:
        state['infra'] = f'URL injoignable : {args.url} ({detail}). Serveur arrêté ou mauvaise URL/port.'
        J.log('INFRA : ' + state['infra'])
        return
    J.log(f'URL joignable ({detail})')
    async with async_playwright() as p:
        try:
            browser = await health_gate(p, args)
        except InfraError as e:
            state['infra'] = str(e)
            J.log('INFRA : ' + state['infra'])
            return
        try:
            if args.parallel <= 1:
                for name in args.agents:
                    await run_agent(name, browser, args, state)
            else:
                sem = asyncio.Semaphore(args.parallel)

                async def guarded(n):
                    async with sem:
                        await run_agent(n, browser, args, state)
                await asyncio.gather(*(guarded(n) for n in args.agents))
        finally:
            try:
                await asyncio.wait_for(browser.close(), 10)
            except BaseException:
                pass


async def amain(args):
    state = {'collectors': [], 't0': time.time(), 'infra': None, 'interrupted': None, 'load0': [round(x, 1) for x in os.getloadavg()]}
    state['flush'] = lambda: write_report(state, args)
    try:
        await asyncio.wait_for(arun(args, state), args.global_timeout)
    except asyncio.TimeoutError:
        state['interrupted'] = f'Timeout global ({args.global_timeout}s) atteint'
        J.log('!!! ' + state['interrupted'])
    except (asyncio.CancelledError, KeyboardInterrupt):
        state['interrupted'] = 'Interruption (Ctrl-C / signal)'
        J.log('!!! ' + state['interrupted'])
    except BaseException as e:
        state['interrupted'] = f'Erreur inattendue {type(e).__name__}: {e}'
        J.log('!!! ' + state['interrupted'] + '\n' + traceback.format_exc())
    doc = write_report(state, args, final=True)
    s = doc['summary']
    J.log(f'RAPPORT : {(args.output/"rapport.html").resolve()} | statut global {doc["status"]} | {s["passed"]} OK, {s["failed"]} échecs, {s["infra"]} infra, {s["skipped"]} non exécutés | {doc["elapsed_s"]}s')
    return {'PASS': EXIT_PASS, 'SKIP': EXIT_PASS, 'FAIL': EXIT_FAIL, 'INFRA': EXIT_INFRA}[doc['status']]


def main():
    ap = argparse.ArgumentParser(description='Agents QA NEXT NINE (durci : série, timeouts, rapport partiel, statuts INFRA)')
    ap.add_argument('--url', default=DEFAULT_URL, help=f'URL du jeu (défaut {DEFAULT_URL}, serveur local de dist/)')
    ap.add_argument('--repo', type=Path, help='Chemin local du dépôt pour l’audit du code')
    ap.add_argument('--npm-check', action='store_true', help='Avec --repo : lance aussi `npm run check` (long)')
    ap.add_argument('--browser', choices=['chromium', 'webkit'], default='chromium')
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument('--headed', action='store_true', help='Fenêtres visibles')
    mode.add_argument('--headless', action='store_true', help='Sans fenêtre (défaut)')
    ap.add_argument('--device', choices=['mixte', 'mobile', 'desktop'], default='mixte', help='mobile=390x844 ; desktop=1280x800 ; mixte=selon l’agent')
    ap.add_argument('--chromium-path', type=Path)
    ap.add_argument('--gl', choices=['auto', 'swiftshader'], default='auto', help='auto = réglages Chromium par défaut (GPU si dispo) ; swiftshader = WebGL logiciel forcé (lent)')
    ap.add_argument('--chromium-arg', action='append', help='argument Chromium supplémentaire (répétable), ex. --chromium-arg=--use-angle=metal')
    ap.add_argument('--ai', action='store_true')
    ap.add_argument('--ai-steps', type=int, default=3)
    ap.add_argument('--parallel', type=int, default=1, help='Sessions concurrentes (défaut 1 = série)')
    ap.add_argument('--agents', nargs='+', choices=AGENTS + SELFTESTS, default=list(AGENTS))
    ap.add_argument('--output', type=Path, default=Path(__file__).resolve().parent.parent / 'out' / 'latest')
    ap.add_argument('--screenshots', action='store_true')
    ap.add_argument('--global-timeout', type=int, default=900, help='secondes, campagne entière')
    ap.add_argument('--agent-timeout', type=int, default=240, help='secondes par agent')
    ap.add_argument('--test-timeout', type=int, default=45, help='secondes par test (défaut)')
    ap.add_argument('--health-timeout', type=int, default=20, help='secondes par étape du sas de santé')
    args = ap.parse_args()
    if args.repo:
        args.repo = args.repo.expanduser().resolve()
    args.output = args.output.expanduser().resolve()
    args.qa_root = Path(__file__).resolve().parent.parent
    if urlparse(args.url).scheme not in ('http', 'https'):
        ap.error('URL HTTP(S) obligatoire')
    if not 1 <= args.parallel <= 6:
        ap.error('--parallel doit être entre 1 et 6')
    if args.ai and not os.getenv('OPENAI_API_KEY'):
        ap.error('Mode IA : définir OPENAI_API_KEY')
    code = EXIT_INFRA
    try:
        code = asyncio.run(amain(args))
    except BaseException as e:
        print(f'Arrêt anormal : {type(e).__name__}: {e}', flush=True)
        code = EXIT_FAIL
    sys.stdout.flush()
    # Sortie immédiate : un processus navigateur bloqué ne doit jamais retenir le script.
    os._exit(code)
