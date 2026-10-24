"""QA-01 : qualification de #crowdToggle en interaction reelle (Chromium).
Usage: python crowd_toggle_qa.py [--load]
Serveur: python3 -m http.server 8772 --directory dist
engine.js est patche a la volee (page.route) pour exposer l'instance et journaliser
setCrowdVisible : aucun fichier du depot n'est modifie.
--load lance 3 processus Chromium supplementaires qui jouent un match 3D en parallele.
"""
import sys, json, time, subprocess, pathlib
from playwright.sync_api import sync_playwright
URL = "http://127.0.0.1:8772/index.html"
OUT = pathlib.Path(__file__).parent / "out"; OUT.mkdir(exist_ok=True)
N = 20
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

def patch(route):
    r = route.fetch(); body = r.text()
    body = body.replace("setCrowdVisible(show){", "setCrowdVisible(show){globalThis.__eng=this;(globalThis.__log=globalThis.__log||[]).push(!!show);", 1)
    route.fulfill(response=r, body=body, headers={**r.headers, "content-type": "text/javascript"})

def new_ctx(b, touch=False):
    kw = dict(viewport={"width": 390, "height": 844})
    if touch: kw.update(has_touch=True, is_mobile=True)
    c = b.new_context(**kw); c.route("**/engine.js*", patch); return c

def load(page):
    page.goto(URL); page.wait_for_function("!document.querySelector('#play').disabled", timeout=90000)
    page.evaluate("""()=>{const c=document.querySelector('#crowdToggle');window.__ev=[];
      for(const t of ['change','click','input'])c.addEventListener(t,e=>__ev.push([t,c.checked]));}""")

def state(page):
    return page.evaluate("()=>({checked:document.querySelector('#crowdToggle').checked,vis:globalThis.__eng?globalThis.__eng.crowd.group.visible:null,log:(globalThis.__log||[]).length})")

def run_mode(page, name, act):
    res = {"mode": name, "ok": 0, "fail": [], "ms": []}
    page.screenshot(path=str(OUT / f"{name}_avant.png"))
    for i in range(N):
        s0 = state(page); t = time.time()
        try: act()
        except Exception as e:
            res["fail"].append(f"{i}: {type(e).__name__} {str(e)[:120]}"); continue
        res["ms"].append(round((time.time() - t) * 1000)); s1 = state(page)
        if s1["checked"] != s0["checked"] and s1["vis"] == s1["checked"]: res["ok"] += 1
        else: res["fail"].append(f"{i}: avant={s0} apres={s1}")
        if i == 0: page.screenshot(path=str(OUT / f"{name}_apres1.png"))
    if not state(page)["checked"]: page.check("#crowdToggle")
    res["max_ms"] = max(res["ms"] or [0]); res["events_tail"] = page.evaluate("()=>__ev.slice(-6)")
    return res

def main():
    loadmode = "--load" in sys.argv
    results = []; procs = []
    if loadmode:
        procs = [subprocess.Popen([sys.executable, __file__, "--bg"]) for _ in range(3)]
        time.sleep(20)
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=ARGS)
        c = new_ctx(b); page = c.new_page(); page.set_default_timeout(30000); load(page)
        results.append(run_mode(page, "souris_case", lambda: page.click("#crowdToggle")))
        results.append(run_mode(page, "souris_label", lambda: page.click("label.crowd-option:has(#crowdToggle)")))
        results.append(run_mode(page, "set_checked", lambda: page.set_checked("#crowdToggle", not page.is_checked("#crowdToggle"))))
        def kb():
            page.focus("#soundHome"); page.keyboard.press("Shift+Tab"); page.keyboard.press("Space")
        results.append(run_mode(page, "clavier_tab_espace", kb))
        c.close()
        c = new_ctx(b, touch=True); tp = c.new_page(); tp.set_default_timeout(30000); load(tp)
        results.append(run_mode(tp, "tactile_tap_case", lambda: tp.tap("#crowdToggle")))
        results.append(run_mode(tp, "tactile_tap_label", lambda: tp.tap("label.crowd-option:has(#crowdToggle)")))
        c.close(); b.close()
    for p in procs: p.terminate()
    s = json.dumps(results, ensure_ascii=False, indent=1); print(s)
    (OUT / ("resultats_charge.json" if loadmode else "resultats.json")).write_text(s)

def bg():
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=ARGS)
        c = new_ctx(b); p = c.new_page(); p.goto(URL)
        try:
            p.wait_for_function("!document.querySelector('#play').disabled", timeout=90000); p.click("#play")
        except Exception: pass
        time.sleep(150)

if __name__ == "__main__":
    bg() if "--bg" in sys.argv else main()
